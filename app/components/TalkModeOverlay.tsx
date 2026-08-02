"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { MicIcon, MicOffIcon, CloseIcon } from "./icons";
import type { TalkConnectionState } from "../hooks/useTalkMode";
import type { MascotVoiceElement, MascotVoiceState } from "../mascot-voice";

const STATE_LABEL: Record<TalkConnectionState, string> = {
  idle: "Ended",
  connecting: "Connecting…",
  connected: "Listening",
  error: "Connection error",
};

export function TalkModeOverlay({
  connectionState,
  isMuted,
  isAgentSpeaking,
  isProcessing,
  interimCaption,
  agentCaption,
  onToggleMute,
  onEndCall,
}: {
  connectionState: TalkConnectionState;
  isMuted: boolean;
  isAgentSpeaking: boolean;
  isProcessing: boolean;
  interimCaption: string;
  agentCaption: string;
  onToggleMute: () => void;
  onEndCall: () => void;
}) {
  const mascotState: MascotVoiceState =
    connectionState !== "connected"
      ? "idle"
      : isAgentSpeaking
      ? /\?\s*$/.test(agentCaption)
        ? "asking"
        : "speaking"
      : isProcessing
      ? "thinking"
      : "listening";

  const mascotRef = useRef<MascotVoiceElement | null>(null);
  const [caption, setCaption] = useState("");

  const liveRef = useRef({ mascotState, agentCaption, interimCaption });
  useEffect(() => {
    liveRef.current = { mascotState, agentCaption, interimCaption };
  });

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const el = mascotRef.current;
      const { mascotState, agentCaption, interimCaption } = liveRef.current;
      if (el) {
        if (mascotState === "speaking" || mascotState === "asking") {
          setCaption(agentCaption.slice(0, el.spokenChars));
        } else if (mascotState === "listening") {
          setCaption(interimCaption);
        } else {
          setCaption("");
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isListening = mascotState === "listening";
  const displayCaption = caption
    ? isListening
      ? `“${caption}”`
      : caption
    : isListening
    ? "Say something…"
    : "";

  return (
    <div className="hero-gradient fixed inset-0 z-50 flex animate-fade-in flex-col items-center justify-center gap-8 px-6">
      <Script type="module" src="/mascot-voice/mascot-voice.js" strategy="afterInteractive" />

      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[--color-text-tertiary]">
        <span
          className={`h-2 w-2 rounded-full ${
            connectionState === "connected"
              ? isAgentSpeaking
                ? "animate-pulse-dot bg-[--color-primary]"
                : "bg-[--color-success]"
              : connectionState === "error"
              ? "bg-red-500"
              : "animate-pulse-dot bg-[--color-primary-muted]"
          }`}
        />
        {STATE_LABEL[connectionState]}
      </div>

      <mascot-voice
        ref={mascotRef}
        state={mascotState}
        text={mascotState === "listening" ? interimCaption : agentCaption}
        size={260}
        assets="/mascot-voice/"
        suppressHydrationWarning
      />

      <p className="min-h-[3.5rem] max-w-md text-center text-lg font-semibold leading-relaxed text-[--color-text]">
        {displayCaption}
      </p>

      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? "Unmute" : "Mute"}
          className={`press-scale flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            isMuted ? "bg-red-500/10 text-red-500" : "glass-card text-[--color-text-secondary]"
          }`}
        >
          {isMuted ? <MicOffIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={onEndCall}
          aria-label="End talk mode"
          className="press-scale flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
