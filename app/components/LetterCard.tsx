import { useState } from "react";
import { CopyIcon, MailIcon, CheckCircleIcon } from "./icons";

export function LetterCard({ letter }: { letter: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy letter", err);
    }
  }

  return (
    <div className="glass-card relative overflow-hidden rounded-2xl p-6">
      {/* Decorative top gradient bar */}
      <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-[--color-accent-rose] via-[--color-accent-lavender] to-[--color-accent-mint]" />

      <div className="mb-4 flex items-center justify-between text-[--color-text-tertiary]">
        <div className="flex items-center gap-2">
          <MailIcon className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">A note to include</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200 hover:bg-[--color-primary]/5 hover:text-[--color-text]"
        >
          {copied ? (
            <>
              <CheckCircleIcon className="h-3.5 w-3.5 text-[--color-success] animate-scale-in" />
              <span className="text-[--color-success]">Copied</span>
            </>
          ) : (
            <>
              <CopyIcon className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-[--color-text]">
        {letter}
      </p>
    </div>
  );
}
