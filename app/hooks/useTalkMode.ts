"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { AgentTurnEvent } from "@/lib/agent-runtime";
import type { GiftCandidate } from "@/lib/gifts";
import { createAudioCapture } from "@/lib/voice/audio-capture";
import { createAudioPlayback } from "@/lib/voice/audio-playback";

export type TalkConnectionState = "idle" | "connecting" | "connected" | "error";

type HistoryMessage = { role: "user" | "assistant"; content: string };

type UseTalkModeOptions = {
  onUserTranscript: (text: string) => void;
  onAgentEvent: (event: AgentTurnEvent) => void;
  onTurnComplete: (fullText: string) => void;
  onInterrupted: () => void;
  onError: (message: string) => void;
};

export function useTalkMode(options: UseTalkModeOptions) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const [connectionState, setConnectionState] = useState<TalkConnectionState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimCaption, setInterimCaption] = useState("");
  const [agentCaption, setAgentCaption] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const captureRef = useRef<ReturnType<typeof createAudioCapture> | null>(null);
  const playbackRef = useRef<ReturnType<typeof createAudioPlayback> | null>(null);

  const cleanupAudio = useCallback(() => {
    captureRef.current?.stop();
    playbackRef.current?.stopAll();
  }, []);

  const ensureSocket = useCallback((): Socket => {
    if (socketRef.current) return socketRef.current;

    const socket = io({ transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("voice:ready", () => setConnectionState("connected"));

    socket.on("voice:interim-transcript", ({ text }: { text: string }) => {
      setInterimCaption(text);
    });

    socket.on("voice:user-transcript", ({ text }: { text: string }) => {
      setInterimCaption("");
      setAgentCaption("");
      setIsAgentSpeaking(false);
      setIsProcessing(true);
      optionsRef.current.onUserTranscript(text);
    });

    socket.on("voice:stage", (payload: { tool: string; label: string; status: "active" | "done" }) => {
      optionsRef.current.onAgentEvent({ type: "stage", ...payload });
    });

    socket.on("voice:gifts", (payload: { items: GiftCandidate[] }) => {
      optionsRef.current.onAgentEvent({ type: "gifts", items: payload.items });
    });

    socket.on("voice:options", (payload: { prompt: string; options: { label: string; value: string }[] }) => {
      optionsRef.current.onAgentEvent({ type: "options", ...payload });
    });

    socket.on("voice:letter", (payload: { content: string }) => {
      optionsRef.current.onAgentEvent({ type: "letter", ...payload });
    });

    socket.on("voice:ai-transcript", ({ text }: { text: string }) => {
      // Replace, not accumulate: mascot-voice's `text` prop is "the line
      // currently being spoken" — appending would reset its utterance
      // timeline (and the lipsync/caption reveal riding on it) every sentence.
      setIsProcessing(false);
      setIsAgentSpeaking(true);
      setAgentCaption(text);
    });

    socket.on("voice:audio", ({ data }: { data: string }) => {
      playbackRef.current?.enqueueBase64Chunk(data);
    });

    socket.on("voice:turn-complete", ({ text }: { text: string }) => {
      setIsAgentSpeaking(false);
      setIsProcessing(false);
      setAgentCaption("");
      optionsRef.current.onTurnComplete(text);
    });

    socket.on("voice:interrupted", () => {
      playbackRef.current?.stopAll();
      setIsAgentSpeaking(false);
      setIsProcessing(false);
      setAgentCaption("");
      optionsRef.current.onInterrupted();
    });

    socket.on("voice:error", ({ message }: { message: string }) => {
      setConnectionState("error");
      setIsProcessing(false);
      optionsRef.current.onError(message);
    });

    socket.on("voice:ended", () => {
      cleanupAudio();
      setConnectionState("idle");
      setIsProcessing(false);
    });

    socket.on("disconnect", () => {
      cleanupAudio();
      setConnectionState((prev) => (prev === "idle" ? prev : "idle"));
      setIsProcessing(false);
    });

    return socket;
  }, [cleanupAudio]);

  const startVoice = useCallback(async (history: HistoryMessage[]) => {
    const socket = ensureSocket();
    if (!socket.connected) socket.connect();

    setConnectionState("connecting");
    playbackRef.current = createAudioPlayback();

    const capture = createAudioCapture();
    captureRef.current = capture;

    socket.emit("voice:start", { history });

    const started = await capture.start((buf) => {
      socket.emit("voice:audio", { audio: buf });
    });

    if (!started) {
      socket.emit("voice:stop");
      setConnectionState("error");
      optionsRef.current.onError("Microphone access denied.");
    }
  }, [ensureSocket]);

  const stopVoice = useCallback(() => {
    cleanupAudio();
    socketRef.current?.emit("voice:stop");
    setConnectionState("idle");
    setIsAgentSpeaking(false);
    setIsProcessing(false);
    setAgentCaption("");
    setInterimCaption("");
  }, [cleanupAudio]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      captureRef.current?.setMuted(next);
      socketRef.current?.emit("voice:mute", { muted: next });
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudio();
      socketRef.current?.disconnect();
    };
  }, [cleanupAudio]);

  return {
    connectionState,
    isVoiceActive: connectionState === "connecting" || connectionState === "connected",
    isMuted,
    isAgentSpeaking,
    isProcessing,
    interimCaption,
    agentCaption,
    startVoice,
    stopVoice,
    toggleMute,
  };
}
