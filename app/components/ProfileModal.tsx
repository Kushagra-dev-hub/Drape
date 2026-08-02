"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { createClient } from "@/lib/supabase/client";
import { GoogleIcon } from "./icons";
import type { Profile } from "./Navbar";

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
};

/** The rich "Profile" card — name, email, Google Calendar connection status.
 * Shared by the Sidebar's avatar menu and the Navbar's top-right avatar so
 * both click paths open the exact same popup. */
export function ProfileModal({ open, onClose, profile }: ProfileModalProps) {
  const [googleConnected, setGoogleConnected] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    let active = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) setGoogleConnected(false);
        return;
      }
      const { data } = await supabase
        .from("google_calendar_tokens")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (active) setGoogleConnected(!!data);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConnectGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  if (!profile) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Profile"
      width={560}
      cardStyle={{ padding: "76px 26px 26px", background: "#F9FAFB" }}
    >
      {/* No maxHeight/overflow: the content is sized to fit, and PopupPeek
          scales the whole stage down rather than introducing a scrollbar.
          Dismiss by clicking the scrim or pressing Escape — no close button. */}
      <div className="flex w-full flex-col gap-5">
        <h2 className="text-2xl font-bold tracking-tight text-[--color-text]">Profile</h2>

        {/* User Card */}
        <section className="flex items-center gap-4 rounded-2xl bg-white p-5 border border-black/5 shadow-sm">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-200 to-rose-300 text-2xl font-bold text-amber-900 shadow-sm">
            {profile.initial}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-xl font-bold text-[--color-text]">{profile.name}</h1>
          </div>
        </section>

        {/* Contact Details */}
        <section className="flex flex-col gap-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[--color-text-tertiary] px-2">Contact Details</h3>

          <div className="flex flex-col rounded-2xl border border-black/5 bg-white overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4">
              <div className="flex flex-col mb-3 sm:mb-0">
                <span className="text-sm font-semibold text-[--color-text]">Email Address</span>
                <span className="text-sm text-[--color-text-secondary] mt-1">{profile.email || "No email"}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Integrated Services */}
        <section className="flex flex-col gap-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[--color-text-tertiary] px-2">Integrated Services</h3>

          <div className="flex flex-col rounded-2xl border border-black/5 bg-white overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4">
              <div className="flex items-center gap-4 mb-3 sm:mb-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--color-surface]">
                  <GoogleIcon className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-semibold text-[--color-text]">Google Calendar</span>
                  <span className="text-sm text-[--color-text-tertiary] mt-0.5">Sync upcoming gift occasions</span>
                </div>
              </div>

              {googleConnected ? (
                <span className="rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700 border border-emerald-100 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Connected
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  className="rounded-full bg-[--color-surface] px-4 py-1.5 text-sm font-semibold text-[--color-text-secondary] border border-black/5 transition-colors hover:bg-black/5 hover:text-[--color-text]"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
