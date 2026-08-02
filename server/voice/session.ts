import Groq from "groq-sdk";
import type { Server as SocketIOServer, Socket } from "socket.io";
import { createServerClient } from "@supabase/ssr";
import { SYSTEM_PROMPT } from "@/lib/agent";
import { runAgentTurn, describeGroqError, type AgentConvo, type AgentTurnEvent } from "@/lib/agent-runtime";
import { getUpcomingOccasions, formatEventsForAgent } from "@/lib/calendar";
import { createSTTSession, type STTSession } from "./deepgram-stt";
import { splitIntoSentences, synthesizeSpeech } from "./tts";

// Hackathon scope: no real users, no real cost — a generous max call
// duration is enough of a guard against a forgotten open tab. No auth gate,
// no concurrent-session cap; voice stays guest-accessible like text chat.
const MAX_CALL_DURATION_MS = 15 * 60 * 1000;

type IncomingHistoryMessage = { role: "user" | "assistant"; content: string };

type VoiceSessionState = {
  socket: Socket;
  convo: AgentConvo;
  stt: STTSession | null;
  isGenerating: boolean;
  currentAbort: AbortController | null;
  isMuted: boolean;
  durationTimer: ReturnType<typeof setTimeout> | null;
};

function parseCookieHeader(header: string | undefined): { name: string; value: string }[] {
  if (!header) return [];
  return header
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      const name = idx === -1 ? pair : pair.slice(0, idx);
      const value = idx === -1 ? "" : decodeURIComponent(pair.slice(idx + 1));
      return { name, value };
    });
}

// Same silent, best-effort pattern as app/api/chat/route.ts, just sourcing
// cookies from the raw socket handshake instead of next/headers' cookies()
// (which isn't available outside a Next.js request).
async function buildCalendarContext(socket: Socket): Promise<string> {
  try {
    const cookies = parseCookieHeader(socket.handshake.headers.cookie);
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookies, setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";
    const events = await getUpcomingOccasions(supabase, user.id, 30);
    return formatEventsForAgent(events);
  } catch {
    return "";
  }
}

function translateAgentEvent(socket: Socket, event: AgentTurnEvent) {
  if (event.type === "stage") {
    socket.emit("voice:stage", { tool: event.tool, label: event.label, status: event.status });
  } else if (event.type === "gifts") {
    socket.emit("voice:gifts", { items: event.items });
  } else if (event.type === "options") {
    socket.emit("voice:options", { prompt: event.prompt, options: event.options });
  } else if (event.type === "letter") {
    socket.emit("voice:letter", { content: event.content });
  }
}

async function runVoiceTurn(state: VoiceSessionState, groq: Groq, userText: string) {
  state.convo.push({ role: "user", content: userText });

  const controller = new AbortController();
  state.currentAbort = controller;
  state.isGenerating = true;

  try {
    const result = await runAgentTurn(groq, state.convo, {
      signal: controller.signal,
      onEvent: (e) => translateAgentEvent(state.socket, e),
    });

    if (controller.signal.aborted) return;

    state.convo.push({ role: "assistant", content: result.message });

    const sentences = splitIntoSentences(result.message);
    for (const sentence of sentences) {
      if (controller.signal.aborted) return;
      state.socket.emit("voice:ai-transcript", { text: sentence });
      await synthesizeSpeech(sentence, controller.signal, (base64) => {
        state.socket.emit("voice:audio", { data: base64 });
      });
    }

    if (!controller.signal.aborted) {
      state.socket.emit("voice:turn-complete", { text: result.message });
    }
  } catch (err) {
    if (controller.signal.aborted) return;
    console.error("[Voice] turn error:", err);
    state.socket.emit("voice:error", {
      message: describeGroqError(err) ?? "I got tripped up putting that together — could you say that again?",
    });
  } finally {
    if (state.currentAbort === controller) {
      state.isGenerating = false;
      state.currentAbort = null;
    }
  }
}

export function registerVoiceHandlers(io: SocketIOServer) {
  io.on("connection", (socket: Socket) => {
    const state: VoiceSessionState = {
      socket,
      convo: [],
      stt: null,
      isGenerating: false,
      currentAbort: null,
      isMuted: false,
      durationTimer: null,
    };

    function endSession(reason: string) {
      state.currentAbort?.abort();
      state.stt?.close();
      state.stt = null;
      if (state.durationTimer) {
        clearTimeout(state.durationTimer);
        state.durationTimer = null;
      }
      socket.emit("voice:ended", { reason });
    }

    socket.on("voice:start", async (payload: { history?: IncomingHistoryMessage[] }) => {
      if (!process.env.GROQ_API_KEY) {
        socket.emit("voice:error", { message: "GROQ_API_KEY is not set on the server." });
        return;
      }
      if (!process.env.DEEPGRAM_API_KEY) {
        socket.emit("voice:error", { message: "DEEPGRAM_API_KEY is not set on the server." });
        return;
      }
      if (!process.env.XAI_API_KEY) {
        socket.emit("voice:error", { message: "XAI_API_KEY is not set on the server." });
        return;
      }

      const calendarContext = await buildCalendarContext(socket);
      const history = Array.isArray(payload?.history) ? payload.history : [];

      state.convo = [
        { role: "system", content: SYSTEM_PROMPT },
        ...(calendarContext ? [{ role: "system", content: calendarContext }] : []),
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ];

      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

      try {
        state.stt = createSTTSession({
          onOpen: () => {
            socket.emit("voice:ready");
            state.durationTimer = setTimeout(() => endSession("max_duration"), MAX_CALL_DURATION_MS);
          },
          onInterim: (text) => {
            socket.emit("voice:interim-transcript", { text });
          },
          onFinal: (text) => {
            if (state.isGenerating) {
              state.currentAbort?.abort();
              state.isGenerating = false;
              socket.emit("voice:interrupted");
            }
            socket.emit("voice:user-transcript", { text });
            runVoiceTurn(state, groq, text).catch((err) => {
              console.error("[Voice] unhandled turn error:", err);
            });
          },
          onError: (message) => {
            socket.emit("voice:error", { message });
          },
          onClose: () => {
            endSession("stt_closed");
          },
        });
      } catch (err) {
        socket.emit("voice:error", {
          message: err instanceof Error ? err.message : "Failed to start voice session",
        });
      }
    });

    socket.on("voice:audio", (payload: { data?: string; audio?: ArrayBuffer }) => {
      if (!state.stt) return;
      if (payload.data) {
        state.stt.sendAudio(Buffer.from(payload.data, "base64"));
      } else if (payload.audio) {
        state.stt.sendAudio(Buffer.from(payload.audio));
      }
    });

    socket.on("voice:mute", (payload: { muted: boolean }) => {
      state.isMuted = Boolean(payload?.muted);
    });

    socket.on("voice:stop", () => {
      endSession("client_stopped");
    });

    socket.on("disconnect", () => {
      state.currentAbort?.abort();
      state.stt?.close();
      state.stt = null;
      if (state.durationTimer) clearTimeout(state.durationTimer);
    });
  });
}
