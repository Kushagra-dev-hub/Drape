import WebSocket from "ws";

// Deepgram Flux v2 — raw WebSocket, native end-pointing. EndOfTurn is the
// sole trigger for handing a transcript to the LLM; there's no custom
// silence/VAD logic here, Deepgram does that decision server-side.
const DEEPGRAM_STT_URL = "wss://api.deepgram.com/v2/listen";
const STT_MODEL = process.env.DEEPGRAM_STT_MODEL || "flux-general-en";
const HEARTBEAT_MS = 20_000;
const MAX_PENDING_PACKETS = 160;

type TurnInfoMessage = {
  type: "TurnInfo";
  event: "Update" | "EagerEndOfTurn" | "EndOfTurn";
  transcript?: string;
};

export type STTSessionCallbacks = {
  onOpen: () => void;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
};

export type STTSession = {
  sendAudio: (buf: Buffer) => void;
  close: () => void;
};

export function createSTTSession(callbacks: STTSessionCallbacks): STTSession {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY not configured");

  let active = true;
  let reconnected = false;
  let everOpened = false;
  let ws: WebSocket;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let pending: Buffer[] = [];

  function connect() {
    const params = new URLSearchParams({
      model: STT_MODEL,
      encoding: "linear16",
      sample_rate: "16000",
    });
    ws = new WebSocket(`${DEEPGRAM_STT_URL}?${params}`, {
      headers: { Authorization: `Token ${apiKey}` },
    });

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          type: "Configure",
          thresholds: { eot_threshold: 0.65, eot_timeout_ms: 5500 },
        })
      );
      heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }, HEARTBEAT_MS);

      // Flush anything buffered while we were still connecting.
      for (const buf of pending) ws.send(buf);
      pending = [];

      // Only the first successful open fires onOpen — a mid-call reconnect
      // is silent/internal, the client's already in the "connected" state.
      if (!everOpened) {
        everOpened = true;
        callbacks.onOpen();
      }
    });

    ws.on("message", (data: WebSocket.RawData) => {
      let msg: TurnInfoMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.type !== "TurnInfo") return;

      if (msg.event === "Update" || msg.event === "EagerEndOfTurn") {
        if (msg.transcript) callbacks.onInterim(msg.transcript);
      } else if (msg.event === "EndOfTurn") {
        if (msg.transcript && msg.transcript.trim()) {
          callbacks.onFinal(msg.transcript.trim());
        }
      }
    });

    ws.on("error", (err: Error) => {
      if (!active) return;
      callbacks.onError(err.message || "Deepgram connection error");
    });

    ws.on("close", () => {
      if (heartbeat) clearInterval(heartbeat);
      if (!active) return;
      if (!reconnected) {
        reconnected = true;
        connect();
      } else {
        callbacks.onClose();
      }
    });
  }

  connect();

  return {
    sendAudio(buf: Buffer) {
      if (!active) return;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(buf);
      } else if (pending.length < MAX_PENDING_PACKETS) {
        pending.push(buf);
      }
    },
    close() {
      active = false;
      if (heartbeat) clearInterval(heartbeat);
      try {
        ws.close();
      } catch {
        // already closed
      }
    },
  };
}
