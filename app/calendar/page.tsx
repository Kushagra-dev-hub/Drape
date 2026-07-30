import Link from "next/link";
import { redirect } from "next/navigation";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { getGoogleTokens } from "@/lib/supabase/google-tokens";
import { ArrowLeftIcon, CalendarIcon } from "@/app/components/icons";
import { ConnectCalendarButton } from "@/app/calendar/ConnectCalendarButton";

// Keywords in event titles/descriptions that suggest a gift occasion.
const OCCASION_KEYWORDS = [
  "birthday",
  "anniversary",
  "wedding",
  "graduation",
  "engagement",
  "baby shower",
  "farewell",
  "retirement",
  "promotion",
  "housewarming",
];

function isGiftOccasion(event: { summary?: string | null; description?: string | null }) {
  const text = `${event.summary ?? ""} ${event.description ?? ""}`.toLowerCase();
  return OCCASION_KEYWORDS.some((kw) => text.includes(kw));
}

type CalendarEvent = {
  id: string;
  summary: string;
  start: string; // ISO date or datetime
  description?: string;
  occasion: string; // matched keyword
};

function detectOccasion(event: { summary?: string | null; description?: string | null }): string {
  const text = `${event.summary ?? ""} ${event.description ?? ""}`.toLowerCase();
  return OCCASION_KEYWORDS.find((kw) => text.includes(kw)) ?? "occasion";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function daysUntil(iso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyLabel(days: number): { text: string; color: string } {
  if (days === 0) return { text: "Today!", color: "text-red-600" };
  if (days === 1) return { text: "Tomorrow", color: "text-orange-500" };
  if (days <= 7) return { text: `${days} days away`, color: "text-amber-600" };
  return { text: `${days} days away`, color: "text-[#034F46]/50" };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error: oauthError } = await searchParams;

  // --- Check if the user has connected Google Calendar ---
  const tokenRow = await getGoogleTokens(supabase, user.id).catch(() => null);

  let events: CalendarEvent[] = [];
  let fetchError: string | null = null;

  if (tokenRow) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        access_token: tokenRow.access_token,
        refresh_token: tokenRow.refresh_token ?? undefined,
        expiry_date: new Date(tokenRow.expires_at).getTime(),
      });

      // googleapis will automatically refresh an expired access_token using
      // the stored refresh_token, as long as access_type=offline was used.
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      const now = new Date();
      const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: in60Days.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 100,
      });

      events = (res.data.items ?? [])
        .filter(isGiftOccasion)
        .map((ev) => ({
          id: ev.id ?? Math.random().toString(),
          summary: ev.summary ?? "Untitled event",
          start: ev.start?.date ?? ev.start?.dateTime ?? now.toISOString(),
          description: ev.description ?? undefined,
          occasion: detectOccasion(ev),
        }));
    } catch (err) {
      console.error("Google Calendar fetch error:", err);
      fetchError = "Couldn't load your calendar right now. Try reconnecting below.";
    }
  }

  const isConnected = !!tokenRow && !fetchError;

  return (
    <div className="hero-gradient min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-semibold text-[#034F46]/60 transition hover:text-[#034F46]"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
              <CalendarIcon className="h-5 w-5 text-[#034F46]/70" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#034F46]">Calendar</h1>
          </div>
        </div>

        {/* OAuth error banner */}
        {oauthError && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {oauthError === "access_denied"
              ? "You declined calendar access. Connect anytime you're ready."
              : "Something went wrong connecting your calendar. Please try again."}
          </div>
        )}

        {/* Fetch error banner */}
        {fetchError && (
          <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {fetchError}
          </div>
        )}

        {/* Not connected — show connect UI */}
        {!tokenRow && (
          <div className="flex flex-col items-center gap-6 rounded-3xl bg-white px-8 py-12 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFFFEB]">
              <CalendarIcon className="h-8 w-8 text-[#034F46]/60" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#034F46]">Connect Google Calendar</h2>
              <p className="mt-2 max-w-sm text-sm text-[#034F46]/60">
                Let Memento peek at your upcoming events — birthdays, anniversaries, graduations —
                and remind you to shop before it&apos;s too late.
              </p>
            </div>
            <ConnectCalendarButton />
            <p className="text-xs text-[#034F46]/40">
              Read-only access · Only gift-occasion events are shown · Revoke anytime in Google settings
            </p>
          </div>
        )}

        {/* Connected — show events or empty state */}
        {tokenRow && !fetchError && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#034F46]/60">
                Upcoming gift occasions in the next 60 days
              </p>
              <ConnectCalendarButton reconnect />
            </div>

            {events.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-8 py-12 text-center shadow-sm">
                <span className="text-4xl">🎉</span>
                <p className="font-semibold text-[#034F46]">All clear for now!</p>
                <p className="max-w-xs text-sm text-[#034F46]/55">
                  No birthdays, anniversaries, or other gift occasions found in the next 60 days.
                  Add events to your Google Calendar and they&apos;ll appear here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {events.map((ev) => {
                  const days = daysUntil(ev.start);
                  const urgency = urgencyLabel(days);
                  const chatPrompt = encodeURIComponent(
                    `It's ${ev.summary} in ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`}. Help me find a great gift.`
                  );
                  return (
                    <div
                      key={ev.id}
                      className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[#034F46]">{ev.summary}</span>
                          <span className="text-xs capitalize text-[#034F46]/50">{ev.occasion}</span>
                        </div>
                        <span className={`shrink-0 text-xs font-medium ${urgency.color}`}>
                          {urgency.text}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#034F46]/40">{formatDate(ev.start)}</span>
                        <Link
                          href={`/?q=${chatPrompt}`}
                          className="flex items-center gap-1 rounded-full bg-[#034F46] px-3.5 py-1.5 text-xs font-medium text-[#FFFFEB] transition hover:brightness-110"
                        >
                          Shop for a gift →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
