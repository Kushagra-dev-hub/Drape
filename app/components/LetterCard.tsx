import { useState } from "react";
import { CopyIcon, MailIcon } from "./icons";

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
    <div className="rounded-3xl border border-[#034F46]/10 bg-[#FFFFEB] p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between text-[#034F46]/60">
        <div className="flex items-center gap-2">
          <MailIcon className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">A note to include</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-semibold transition hover:text-[#034F46]"
        >
          <CopyIcon className="h-3.5 w-3.5" />
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-[#034F46]">{letter}</p>
    </div>
  );
}
