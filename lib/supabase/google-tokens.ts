import type { SupabaseClient } from "@supabase/supabase-js";

export type GoogleTokenRow = {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string; // ISO timestamp
};

/** Upsert (insert or replace) tokens for a user. */
export async function upsertGoogleTokens(
  supabase: SupabaseClient,
  tokens: GoogleTokenRow
): Promise<void> {
  const { error } = await supabase
    .from("google_calendar_tokens")
    .upsert(tokens, { onConflict: "user_id" });

  if (error) throw error;
}

/** Fetch stored tokens for the signed-in user, or null if not connected. */
export async function getGoogleTokens(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleTokenRow | null> {
  const { data, error } = await supabase
    .from("google_calendar_tokens")
    .select("user_id, access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/** Delete stored tokens (disconnect calendar). */
export async function deleteGoogleTokens(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("google_calendar_tokens")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}
