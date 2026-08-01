import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertGoogleTokens } from "@/lib/supabase/google-tokens";

// Supabase redirects here after a signInWithOAuth flow (PKCE exchange).
// The `code` query param is a one-time auth code; we exchange it for a
// session, then pull the Google provider_token / provider_refresh_token
// from that session and store them so the calendar features work.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }

  const supabase = await createClient();

  // Exchange the one-time code for a session.  Supabase includes
  // provider_token + provider_refresh_token when we requested offline access.
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("[auth/callback] session exchange failed:", error);
    return NextResponse.redirect(new URL("/login?error=auth_failed", req.url));
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

  return NextResponse.redirect(new URL(next, req.url));
}
