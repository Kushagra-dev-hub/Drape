import Link from "next/link";
import { useEffect, useState } from "react";

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

  return (
    <header className="sticky top-0 z-40 flex shrink-0 items-center justify-end bg-transparent px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-3">
        {profile ? (
          <div className="flex items-center gap-2.5">
            {time && (
              <span className="hidden text-sm tabular-nums text-[#034F46]/60 sm:inline">{time}</span>
            )}
            <div
              title={profile.name}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#034F46] text-sm font-semibold text-[#FFFFEB]"
            >
              {profile.initial}
            </div>
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-full px-3.5 py-2 text-sm font-medium text-[#034F46]/70 transition hover:text-[#034F46]"
            >
              Login
            </Link>
            <Link
              href="/login?tab=signup"
              className="rounded-full bg-[#F0D7FF] px-4 py-2 text-sm font-semibold text-[#034F46] transition hover:brightness-95"
            >
              Get Started
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
