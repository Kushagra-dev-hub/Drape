"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { GiftCandidate, GiftVariant } from "@/lib/gifts";
import { GiftCard } from "./GiftCard";
import { LetterCard } from "./LetterCard";
import { MicIcon, MicOffIcon, CloseIcon, GiftIcon, MailIcon } from "./icons";
import type { TalkConnectionState } from "../hooks/useTalkMode";
import type { MascotVoiceElement, MascotVoiceState } from "../mascot-voice";

const CONNECTION_LABEL: Partial<Record<TalkConnectionState, string>> = {
  idle: "Ended",
  connecting: "Connecting…",
  error: "Connection error",
};

const MASCOT_STATE_LABEL: Record<MascotVoiceState, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  asking: "Asking",
};

export function TalkModeOverlay({
  connectionState,
  isMuted,
  isProcessing,
  interimCaption,
  gifts,
  letter,
  getPlaybackLevel,
  isPlaybackActive,
  getCurrentSentenceText,
  onToggleMute,
  onEndCall,
  onApproveGift,
  onSelectVariant,
}: {
  connectionState: TalkConnectionState;
  isMuted: boolean;
  isProcessing: boolean;
  interimCaption: string;
  gifts?: GiftCandidate[] | null;
  letter?: string | null;
  getPlaybackLevel: () => number;
  isPlaybackActive: () => boolean;
  getCurrentSentenceText: () => string;
  onToggleMute: () => void;
  onEndCall: () => void;
  onApproveGift: (giftId: string) => void;
  onSelectVariant: (gift: GiftCandidate, variant: GiftVariant) => void;
}) {
  const hasGifts = Boolean(gifts && gifts.length > 0);
  const hasLetter = Boolean(letter);
  const hasResults = hasGifts || hasLetter;

  const [resultsTab, setResultsTab] = useState<"gifts" | "letter">("gifts");
  // Auto-jump to whichever pane just got fresh content — most usefully, the
  // letter, since it's usually asked for after the gifts are already showing.
  // Adjusted during render (React's blessed pattern for "reset state when a
  // prop changes"), not via useEffect — an effect here would mean an extra
  // render where the old tab briefly shows stale/mismatched content.
  const [lastGifts, setLastGifts] = useState(gifts);
  if (gifts !== lastGifts) {
    setLastGifts(gifts);
    if (hasGifts) setResultsTab("gifts");
  }
  const [lastLetter, setLastLetter] = useState(letter);
  if (letter !== lastLetter) {
    setLastLetter(letter);
    if (hasLetter) setResultsTab("letter");
  }

  const mascotRef = useRef<MascotVoiceElement | null>(null);
  const [caption, setCaption] = useState("");
  const [displayState, setDisplayState] = useState<MascotVoiceState>("idle");

  // mascot-voice's `state`/`level` are driven imperatively every animation
  // frame from the ACTUAL audio graph (isPlaybackActive/getPlaybackLevel/
  // getCurrentSentenceText), not from the socket's ai-transcript/turn-complete
  // timing — those fire on when the server sent text/started synthesis, not
  // on when the browser is actually producing sound, so wiring the pose (or
  // the caption) to them visibly drifts from what's audible. Real playback
  // state is the only ground truth for "is it talking, and what's it saying,
  // right now." This keeps cycling through listening/thinking/speaking/asking
  // for every turn regardless of whether the results pane is showing — cards
  // on the right don't change how live the mascot on the left is.
  const liveRef = useRef({ connectionState, isProcessing, interimCaption });
  useEffect(() => {
    liveRef.current = { connectionState, isProcessing, interimCaption };
  });

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const el = mascotRef.current;
      const { connectionState, isProcessing, interimCaption } = liveRef.current;
      if (el) {
        const playing = connectionState === "connected" && isPlaybackActive();
        const sentenceText = playing ? getCurrentSentenceText() : "";
        const trueState: MascotVoiceState =
          connectionState !== "connected"
            ? "idle"
            : playing
            ? /\?\s*$/.test(sentenceText)
              ? "asking"
              : "speaking"
            : isProcessing
            ? "thinking"
            : "listening";

        el.state = trueState;
        if (playing) el.level = getPlaybackLevel();
        setDisplayState((prev) => (prev === trueState ? prev : trueState));

        if (trueState === "speaking" || trueState === "asking") {
          el.text = sentenceText;
          setCaption(sentenceText);
        } else if (trueState === "listening") {
          el.text = interimCaption;
          setCaption(interimCaption);
        } else {
          el.text = "";
          setCaption("");
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getPlaybackLevel, isPlaybackActive, getCurrentSentenceText]);

  const isListening = displayState === "listening";
  const isSpeaking = displayState === "speaking" || displayState === "asking";
  const displayCaption = caption
    ? isListening
      ? `“${caption}”`
      : caption
    : isListening
    ? "Say something…"
    : "";

  return (
    <div
      className={`hero-gradient fixed inset-0 z-50 flex animate-fade-in overflow-hidden px-6 py-6 ${
        hasResults ? "flex-col gap-6 md:flex-row md:items-stretch md:gap-10" : "flex-col items-center justify-center gap-8"
      }`}
    >
      <Script type="module" src="/mascot-voice/mascot-voice.js" strategy="afterInteractive" />

      <div
        className={`flex shrink-0 flex-col items-center gap-8 ${
          hasResults ? "justify-center md:w-1/2" : "w-full justify-center"
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[--color-text-tertiary]">
          <span
            className={`h-2 w-2 rounded-full ${
              connectionState === "connected"
                ? isSpeaking
                  ? "animate-pulse-dot bg-[--color-primary]"
                  : "bg-[--color-success]"
                : connectionState === "error"
                ? "bg-red-500"
                : "animate-pulse-dot bg-[--color-primary-muted]"
            }`}
          />
          {CONNECTION_LABEL[connectionState] ?? MASCOT_STATE_LABEL[displayState]}
        </div>

        <mascot-voice ref={mascotRef} size={hasResults ? 200 : 260} assets="/mascot-voice/" suppressHydrationWarning />

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

      {hasResults && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 py-2 md:w-1/2 md:py-10">
          {hasGifts && hasLetter && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setResultsTab("gifts")}
                className={`press-scale flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  resultsTab === "gifts"
                    ? "border-[#1A6B5F] bg-[#1A6B5F] text-white shadow-sm"
                    : "border-[#0A2F2A]/15 bg-white text-[#0A2F2A]/75 hover:border-[#1A6B5F]"
                }`}
              >
                <GiftIcon className="h-3.5 w-3.5" />
                Gifts
              </button>
              <button
                type="button"
                onClick={() => setResultsTab("letter")}
                className={`press-scale flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  resultsTab === "letter"
                    ? "border-[#1A6B5F] bg-[#1A6B5F] text-white shadow-sm"
                    : "border-[#0A2F2A]/15 bg-white text-[#0A2F2A]/75 hover:border-[#1A6B5F]"
                }`}
              >
                <MailIcon className="h-3.5 w-3.5" />
                Note
              </button>
            </div>
          )}

          <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
            {hasGifts && (!hasLetter || resultsTab === "gifts") && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {gifts!.map((g) => (
                  <GiftCard key={g.id} gift={g} onApprove={onApproveGift} onSelectVariant={onSelectVariant} />
                ))}
              </div>
            )}
            {hasLetter && (!hasGifts || resultsTab === "letter") && <LetterCard letter={letter!} compact />}
          </div>
        </div>
      )}
    </div>
  );
}
