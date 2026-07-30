import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { upsertGoogleTokens } from "@/lib/supabase/google-tokens";

// Google redirects here after the user approves (or denies) calendar access,
// with a one-time `code` in the query string. This route's job is to trade
// that code for real tokens and hand the user back to the app.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    // User denied access, or Google sent an error instead of a code.
    return NextResponse.redirect(new URL("/calendar?error=access_denied", req.url));
  }

  try {
    // TODO 1 ✅ — Exchange `code` for tokens via the googleapis OAuth2 client.
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(new URL("/calendar?error=no_token", req.url));
    }

    // TODO 2 ✅ — Identify the signed-in Supabase user.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Not signed in — send them to login, then back to calendar.
      return NextResponse.redirect(new URL("/login?next=/calendar", req.url));
    }

    // TODO 3 ✅ — Store the tokens in google_calendar_tokens.
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(); // fallback: 1 hour

    await upsertGoogleTokens(supabase, {
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
    });

    // TODO 4 ✅ — Redirect back to the calendar page.
    return NextResponse.redirect(new URL("/calendar", req.url));
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(new URL("/calendar?error=oauth_failed", req.url));
  }
}
