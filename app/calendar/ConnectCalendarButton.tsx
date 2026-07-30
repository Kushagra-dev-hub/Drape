"use client";

import { useState } from "react";

type Props = {
  /** When true, renders as a small "Reconnect" text link instead of a big CTA button */
  reconnect?: boolean;
};

export function ConnectCalendarButton({ reconnect = false }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/google/auth-url");
      if (!res.ok) throw new Error("Could not build auth URL");
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setLoading(false);
      alert("Something went wrong. Check that GOOGLE_CLIENT_ID is set in .env.local.");
    }
  }

  if (reconnect) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        className="text-xs text-[#034F46]/45 underline-offset-2 transition hover:text-[#034F46] hover:underline disabled:opacity-50"
      >
        {loading ? "Redirecting…" : "Reconnect"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={loading}
      className="flex items-center gap-2 rounded-full bg-[#034F46] px-6 py-3 text-sm font-semibold text-[#FFFFEB] shadow-sm transition hover:brightness-110 disabled:opacity-60"
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFFFEB]/30 border-t-[#FFFFEB]" />
          Redirecting…
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
            <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 1 1 0-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0 0 12.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" />
          </svg>
          Connect Google Calendar
        </>
      )}
    </button>
  );
}
