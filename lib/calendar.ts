// Import only the Calendar API client, not the full `googleapis` package —
// that package eagerly requires all 300+ Google API clients at import time
// (~200MB), which was enough to OOM a memory-constrained production instance
// for an app that only ever talks to Calendar.
import { calendar as calendarClient, auth, type calendar_v3 } from "@googleapis/calendar";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGoogleTokens, deleteGoogleTokens } from "@/lib/supabase/google-tokens";

// Keywords in event titles/descriptions that suggest a gift occasion.
export const OCCASION_KEYWORDS = [
  "birthday",
  "bday",
  "b-day",
  "anniversary",
  "wedding",
  "graduation",
  "engagement",
  "baby shower",
  "farewell",
  "retirement",
  "promotion",
  "housewarming",
  "raksha bandhan",
  "diwali",
  "christmas",
  "eid",
  "onam",
  "pongal",
  "navratri",
];

// Calendar names that are entirely gift-occasion calendars — skip keyword
// filtering for these and include every event they contain.
const ALWAYS_INCLUDE_CALENDAR_NAMES = ["birthdays", "birthday"];

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string; // ISO date or datetime
  description?: string;
  occasion: string; // matched keyword
};

function isGiftOccasion(event: { summary?: string | null; description?: string | null }) {
  const text = `${event.summary ?? ""} ${event.description ?? ""}`.toLowerCase();
  return OCCASION_KEYWORDS.some((kw) => text.includes(kw));
}

export function detectOccasion(event: { summary?: string | null; description?: string | null }): string {
  const text = `${event.summary ?? ""} ${event.description ?? ""}`.toLowerCase();
  return OCCASION_KEYWORDS.find((kw) => text.includes(kw)) ?? "occasion";
}

/**
 * Fetches upcoming gift-occasion events from all of the user's Google Calendars.
 * Returns an empty array (never throws) if the user has no tokens or if the
 * fetch fails — callers should treat this as a graceful degradation.
 *
 * @param supabase  Server-side Supabase client (from createClient())
 * @param userId    Supabase auth user ID
 * @param daysAhead How many days into the future to look (default: 60)
 */
export async function getUpcomingOccasions(
  supabase: SupabaseClient,
  userId: string,
  daysAhead = 60
): Promise<CalendarEvent[]> {
  const tokenRow = await getGoogleTokens(supabase, userId).catch(() => null);
  if (!tokenRow) return [];

  try {
    const oauth2Client = new auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: tokenRow.access_token,
      refresh_token: tokenRow.refresh_token ?? undefined,
      expiry_date: new Date(tokenRow.expires_at).getTime(),
    });

    const calendar = calendarClient({ version: "v3", auth: oauth2Client });

    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const calListRes = await calendar.calendarList.list({ showHidden: false });
    const allCalendars = calListRes.data.items ?? [];

    const rawEvents: CalendarEvent[] = [];

    for (const cal of allCalendars) {
      const calId = cal.id;
      if (!calId) continue;

      const calNameLower = (cal.summary ?? "").toLowerCase();
      const isOccasionCalendar = ALWAYS_INCLUDE_CALENDAR_NAMES.some((n) =>
        calNameLower.includes(n)
      );

      let pageToken: string | undefined = undefined;
      while (true) {
        const response = (await calendar.events.list({
          calendarId: calId,
          timeMin: now.toISOString(),
          timeMax: future.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 2500,
          pageToken: pageToken,
        })) as { data: calendar_v3.Schema$Events };

        const items = response.data.items ?? [];
        const filtered = isOccasionCalendar ? items : items.filter(isGiftOccasion);

        for (const ev of filtered) {
          rawEvents.push({
            id: ev.id ?? Math.random().toString(),
            summary: ev.summary ?? "Untitled event",
            start: ev.start?.date ?? ev.start?.dateTime ?? now.toISOString(),
            description: ev.description ?? undefined,
            occasion: isOccasionCalendar ? "birthday" : detectOccasion(ev),
          });
        }
        
        pageToken = response.data.nextPageToken || undefined;
        if (!pageToken) break;
      }
    }

    // Deduplicate by event ID and sort by date.
    const seen = new Set<string>();
    return rawEvents
      .filter((ev) => {
        if (seen.has(ev.id)) return false;
        seen.add(ev.id);
        return true;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  } catch (err) {
    console.error("[calendar] Failed to fetch events:", err);

    // A stored token that lacks calendar scope (e.g. the user signed in with
    // Google but declined the calendar permission on the consent screen)
    // fails every request with this error. The row in google_calendar_tokens
    // still exists, so the UI would otherwise keep claiming "Connected"
    // forever. Clear it so the user is prompted to reconnect (and re-grant
    // the scope) instead of silently seeing an empty calendar.
    const status = (err as { response?: { status?: number }; code?: number })?.response?.status
      ?? (err as { code?: number })?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (status === 401 || status === 403 || /insufficient.*scope/i.test(message)) {
      await deleteGoogleTokens(supabase, userId).catch(() => {});
    }

    return [];
  }
}

/** Format a list of events as a compact text block for injection into the LLM system prompt. */
export function formatEventsForAgent(events: CalendarEvent[]): string {
  if (events.length === 0) return "";

  const lines = events.map((ev) => {
    const date = new Date(ev.start).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
    });
    const daysAway = Math.round(
      (new Date(ev.start).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
        (1000 * 60 * 60 * 24)
    );
    const when = daysAway === 0 ? "today" : daysAway === 1 ? "tomorrow" : `in ${daysAway} days`;
    return `- ${ev.summary} (${ev.occasion}) — ${date} (${when})`;
  });

  return `[UPCOMING OCCASIONS — next ${lines.length} gift event(s) on the user's calendar]\n${lines.join("\n")}`;
}
