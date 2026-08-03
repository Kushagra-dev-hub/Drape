import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertGoogleTokens } from "@/lib/supabase/google-tokens";

// Behind a reverse proxy (e.g. Render), req.url's host/protocol are only as
// good as the proxy headers Next.js infers them from. SITE_URL, when set,
// is an explicit trusted base so this redirect can't land on the wrong
// origin regardless of proxy behavior; unset (local dev) falls back to the
// request's own origin.
function siteOrigin(req: NextRequest): string {
  return process.env.SITE_URL ?? req.nextUrl.origin;
}

// Supabase redirects here after a signInWithOAuth flow (PKCE exchange).
// The `code` query param is a one-time auth code; we exchange it for a
// session, then pull the Google provider_token / provider_refresh_token
// from that session and store them so the calendar features work.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/";
  const origin = siteOrigin(req);

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const supabase = await createClient();

  // Exchange the one-time code for a session.  Supabase includes
  // provider_token + provider_refresh_token when we requested offline access.
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("[auth/callback] session exchange failed:", error);
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  const { session } = data;
  const userId = session.user.id;
  const providerToken = session.provider_token;
  const providerRefreshToken = session.provider_refresh_token;

  // Store Google tokens so the calendar page and chat agent can use them
  // without the user having to go through a second OAuth flow.
  if (providerToken) {
    try {
      // Google access tokens expire in 3600 seconds; store a safe expiry.
      const expiresAt = new Date(Date.now() + 3500 * 1000).toISOString();

      await upsertGoogleTokens(supabase, {
        user_id: userId,
        access_token: providerToken,
        refresh_token: providerRefreshToken ?? null,
        expires_at: expiresAt,
      });
    } catch (err) {
      // Non-fatal: the user is still signed in; calendar just won't work.
      console.error("[auth/callback] failed to store provider tokens:", err);
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
