import { NextResponse, type NextRequest } from "next/server";

// Google redirects here after the user approves (or denies) calendar access,
// with a one-time `code` in the query string. This route's job is to trade
// that code for real tokens and hand the user back to the app — nothing
// else should read `code` directly.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    // User denied access, or Google sent an error instead of a code.
    // TODO: redirect to /calendar with an error state instead of a bare 400.
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  // TODO 1: exchange `code` for tokens.
  // POST to https://oauth2.googleapis.com/token with:
  //   code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
  //   redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: "authorization_code"
  // Response includes access_token, refresh_token, and expires_in (seconds).
  // The `googleapis` npm package's OAuth2 client can do this exchange for you
  // instead of a raw fetch, if preferred.

  // TODO 2: find the signed-in user.
  // Use lib/supabase/server.ts's createClient() + supabase.auth.getUser() —
  // same pattern as app/calendar/page.tsx — to know whose tokens these are.

  // TODO 3: store the tokens.
  // Needs a new Supabase table, e.g. google_calendar_tokens
  // (user_id, access_token, refresh_token, expires_at), with RLS scoped to
  // auth.uid() — same shape as the conversations/messages tables in
  // supabase/chat_history.sql.

  // TODO 4: send the user back into the app.
  return NextResponse.redirect(new URL("/calendar", req.url));
}
