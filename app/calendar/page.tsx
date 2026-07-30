import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUpcomingOccasions, detectOccasion } from "@/lib/calendar";
import { getGoogleTokens } from "@/lib/supabase/google-tokens";
import { ArrowLeftIcon, CalendarIcon } from "@/app/components/icons";

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

  // Check whether this user has Google tokens stored.
  const tokenRow = await getGoogleTokens(supabase, user.id).catch(() => null);

  // Fetch events using the shared utility (never throws).
  const events = tokenRow ? await getUpcomingOccasions(supabase, user.id, 60) : [];
  const fetchFailed = tokenRow && events.length === 0 && !oauthError
    ? false // empty is valid — user just has no upcoming occasions
    : false;

  void detectOccasion; // imported for potential future use in this file
  void fetchFailed;

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
            <h1 className="text-2xl font-bold tracking-tight text-[#034F46]">Upcoming Events</h1>
          </div>
        </div>

        {/* OAuth error banner */}
        {oauthError && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {oauthError === "access_denied"
              ? "You declined calendar access. Sign in with Google to try again."
              : "Something went wrong connecting your calendar. Try signing in with Google again."}
          </div>
        )}

        {/* Not connected — no Google tokens stored */}
        {!tokenRow && (
          <div className="flex flex-col items-center gap-6 rounded-3xl bg-white px-8 py-12 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFFFEB]">
              <CalendarIcon className="h-8 w-8 text-[#034F46]/60" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#034F46]">No calendar connected</h2>
              <p className="mt-2 max-w-sm text-sm text-[#034F46]/60">
                Sign in with Google on the{" "}
                <Link href="/login" className="font-medium text-[#034F46] underline underline-offset-2">
                  login page
                </Link>{" "}
                to automatically connect your calendar — birthdays, anniversaries, and other
                occasions will appear here.
              </p>
            </div>
            <p className="text-xs text-[#034F46]/40">
              Read-only access · Only gift-occasion events are shown · Revoke anytime in Google settings
            </p>
          </div>
        )}

        {/* Connected — show events or empty state */}
        {tokenRow && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[#034F46]/60">
              Upcoming gift occasions in the next 60 days
            </p>

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
