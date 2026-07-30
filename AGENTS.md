<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Google Calendar integration — plan for whoever picks this up

**Goal:** `/calendar` (currently `app/calendar/page.tsx`, an "under development" stub) should show a signed-in user's real Google Calendar events. This is a per-user private calendar via OAuth, not a shared/public one.

**Status: scaffolding only, no working auth or data fetching yet.** Do the steps below in order; each one is small enough to test before moving to the next.

## 0. Google Cloud Console (no code)
1. Create a project at console.cloud.google.com.
2. Enable the **Google Calendar API** for it.
3. Configure the **OAuth consent screen** (app name, support email, scope `https://www.googleapis.com/auth/calendar.readonly` — read-only is enough to display events).
4. Create an **OAuth Client ID** (type: Web application). Add an **Authorized redirect URI** matching `GOOGLE_REDIRECT_URI` below exactly (including the port) — a mismatch here is the most common first-time OAuth bug.
5. Copy the Client ID and Client Secret into `.env.local` (never commit these — `.env.local` is already gitignored):
   ```
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
   ```
   (placeholders already exist in `.env.example`)

## 1. "Connect Google Calendar" button
Add a button (on `/calendar`, shown only when there's no connected calendar yet) that links to Google's OAuth URL, built from `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`, the scope above, `response_type=code`, and `access_type=offline&prompt=consent` (the last two are required to get a refresh token back, not just a short-lived access token).

## 2. Handle the callback
`app/api/google/callback/route.ts` already exists with the route wired up (it builds and redirects back to `/calendar`) but has 4 TODOs to fill in, in order:
1. Exchange the `code` query param for tokens — POST to `https://oauth2.googleapis.com/token` (or use the `googleapis` npm package's OAuth2 client, which does this exchange for you).
2. Identify the signed-in user — reuse `lib/supabase/server.ts`'s `createClient()` + `supabase.auth.getUser()`, same as `app/calendar/page.tsx` already does.
3. Store the tokens — needs a new Supabase table, e.g. `google_calendar_tokens` (`user_id`, `access_token`, `refresh_token`, `expires_at`), RLS scoped to `auth.uid()` the same way as `conversations`/`messages` in `supabase/chat_history.sql`. Write the `CREATE TABLE` + RLS policy SQL the same way that file does it, and note in chat that it needs to be run in the Supabase dashboard (there's no migration tooling in this repo — SQL is applied manually).
4. Redirect back to `/calendar`.

## 3. Fetch and display events
In `app/calendar/page.tsx`, after the existing `getUser()` auth check: if the user has a row in `google_calendar_tokens`, use the `googleapis` package (handles refreshing an expired access token automatically given the refresh token) to call `calendar.events.list(...)` and render the upcoming events. If they don't have a row yet, show the "Connect Google Calendar" button from step 1 instead of the events list.

## If OAuth turns out to be too much friction
There's a much simpler fallback that skips OAuth, login redirects, and token storage entirely: Google Calendar's `events.list` API also works with just an **API key** for calendars marked **public**. That only works for a single shared/public calendar, not each user's private one — but if the actual goal turns out to be "show some pre-existing events" rather than "every user connects their own calendar," it's worth reconsidering before sinking time into the full OAuth flow above.
