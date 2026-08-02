"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type Profile = { name: string; email?: string; initial: string };

type NavbarProps = {
  profile: Profile | null;
};

function useLiveTime() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

export function Navbar({ profile }: NavbarProps) {
  const time = useLiveTime();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSwitchProfile() {
    setIsOpen(false);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "select_account consent",
        },
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  }

  return (
    <header className="sticky top-0 z-40 flex shrink-0 items-center justify-end px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-3">
        {profile ? (
          <div className="flex items-center gap-3">
            {time && (
              <span className="hidden text-sm tabular-nums tracking-tight text-[--color-text-tertiary] sm:inline">
                {time}
              </span>
            )}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                title={profile.name}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-200 to-rose-300 text-sm font-bold text-amber-900 shadow-sm transition-shadow duration-200 hover:shadow-md focus:outline-none"
              >
                {profile.initial}
              </button>
              
              {isOpen && (
                <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5 animate-fade-up">
                  <div className="px-4 py-2.5 border-b border-[--color-border]">
                    <p className="text-sm font-semibold text-[--color-text] truncate">{profile.name}</p>
                  </div>
                  <button
                    onClick={handleSwitchProfile}
                    className="block w-full text-left px-4 py-2.5 text-sm text-[--color-text] hover:bg-black/5 transition-colors"
                  >
                    Switch Profile
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-[--color-text-secondary] transition-colors duration-200 hover:text-[--color-text]"
            >
              Login
            </Link>
            <Link
              href="/login?tab=signup"
              className="gradient-accent-button press-scale rounded-full px-5 py-2.5 text-sm font-semibold text-[--color-text] shadow-sm"
            >
              Get Started
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
