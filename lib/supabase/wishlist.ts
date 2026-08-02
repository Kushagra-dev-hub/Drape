import type { SupabaseClient } from "@supabase/supabase-js";
import type { GiftCandidate } from "@/lib/gifts";

/** A wishlist row as stored — a denormalised snapshot of a gift candidate. */
export type WishlistItem = {
  id: string;
  gift_id: string;
  gift_name: string;
  gift_image_url: string | null;
  merchant: string;
  price: number;
  delivery_days: number;
  category: string | null;
  emoji: string | null;
  checkout_url: string | null;
  created_at: string;
};

/** Turn a stored row back into the shape the gift cards render. */
export function toGiftCandidate(item: WishlistItem): GiftCandidate {
  return {
    id: item.gift_id,
    name: item.gift_name,
    category: item.category ?? "",
    price: Number(item.price),
    merchant: item.merchant,
    deliveryDays: item.delivery_days,
    tags: [],
    emoji: item.emoji ?? "🎁",
    imageUrl: item.gift_image_url ?? undefined,
    checkoutUrl: item.checkout_url ?? undefined,
  };
}

export async function listWishlist(supabase: SupabaseClient): Promise<WishlistItem[]> {
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("id, gift_id, gift_name, gift_image_url, merchant, price, delivery_days, category, emoji, checkout_url, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Just the gift ids, for deciding which hearts render filled. */
export async function listWishlistGiftIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from("wishlist_items").select("gift_id");
  if (error) throw error;
  return (data ?? []).map((r: { gift_id: string }) => r.gift_id);
}

/**
 * Upsert on (user_id, gift_id) — the table's unique constraint makes
 * re-hearting the same gift a no-op instead of an error.
 */
export async function addToWishlist(
  supabase: SupabaseClient,
  userId: string,
  gift: GiftCandidate
): Promise<void> {
  const { error } = await supabase.from("wishlist_items").upsert(
    {
      user_id: userId,
      gift_id: gift.id,
      gift_name: gift.name,
      gift_image_url: gift.imageUrl ?? null,
      merchant: gift.merchant,
      price: gift.price,
      delivery_days: gift.deliveryDays,
      category: gift.category || null,
      emoji: gift.emoji || null,
      checkout_url: gift.checkoutUrl ?? null,
    },
    { onConflict: "user_id,gift_id" }
  );

  if (error) throw error;
}

export async function removeFromWishlist(
  supabase: SupabaseClient,
  userId: string,
  giftId: string
): Promise<void> {
  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("user_id", userId)
    .eq("gift_id", giftId);

  if (error) throw error;
}
