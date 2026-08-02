"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ProfileModal } from "./ProfileModal";

export type Profile = { name: string; email?: string; initial: string };

type NavbarProps = {
  profile: Profile | null;
  title?: ReactNode;
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

export function Navbar({ profile, title }: NavbarProps) {
  const time = useLiveTime();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className={`sticky top-0 z-40 flex shrink-0 items-center px-4 py-3 sm:px-6 ${title ? "justify-between gap-4" : "justify-end"}`}>
      {title && (
        <div className="mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight text-[--color-text]">
          {title}
        </div>
      )}
      <div className="flex items-center gap-2 sm:gap-3">
        {profile ? (
          <div className="flex items-center gap-3">
            {time && (
              <span className="hidden text-sm tabular-nums tracking-tight text-[--color-text-tertiary] sm:inline">
                {time}
              </span>
            )}
            <button
              onClick={() => setProfileOpen(true)}
              title={profile.name}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-200 to-rose-300 text-sm font-bold text-amber-900 shadow-sm transition-shadow duration-200 hover:shadow-md focus:outline-none"
            >
              {profile.initial}
            </button>

            <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} profile={profile} />
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
