import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GiftCandidate } from "@/lib/gifts";
import { createClient } from "@/lib/supabase/client";
import { addToWishlist, removeFromWishlist } from "@/lib/supabase/wishlist";
import { HeartIcon } from "./icons";

export function GiftCard({
  gift,
  onApprove,
  initiallyWishlisted = false,
  onWishlistChange,
  approveLabel = "Approve",
  approvedLabel = "Approved ✓",
}: {
  gift: GiftCandidate;
  onApprove?: (giftId: string) => void;
  /** Renders the heart filled on first paint (used by the wishlist page). */
  initiallyWishlisted?: boolean;
  /** Fires after the row is written/removed, so lists can re-sync. */
  onWishlistChange?: (giftId: string, wishlisted: boolean) => void;
  /** Primary action label — the wishlist page uses "Buy Now". */
  approveLabel?: string;
  approvedLabel?: string;
}) {
  const router = useRouter();
  const [approved, setApproved] = useState(false);
  const [wishlisted, setWishlisted] = useState(initiallyWishlisted);
  const [savingWish, setSavingWish] = useState(false);

  async function handleWishlist() {
    if (savingWish) return;
    setSavingWish(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSavingWish(false);
      router.push("/login");
      return;
    }

    // Optimistic: the heart is the whole feedback, so waiting on the round
    // trip to fill it makes the button feel broken.
    const next = !wishlisted;
    setWishlisted(next);

    try {
      if (next) await addToWishlist(supabase, user.id, gift);
      else await removeFromWishlist(supabase, user.id, gift.id);
      onWishlistChange?.(gift.id, next);
    } catch (err) {
      console.error("Wishlist update failed", err);
      setWishlisted(!next); // roll back
    } finally {
      setSavingWish(false);
    }
  }

  async function handleApprove() {
    if (onApprove) {
      onApprove(gift.id);
      return;
    }
    
    // Legacy fallback
    const popup = gift.checkoutUrl ? window.open("", "_blank", "noopener,noreferrer") : null;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      popup?.close();
      router.push("/login");
      return;
    }
    setApproved(true);
    if (gift.checkoutUrl && popup) {
      popup.location.href = gift.checkoutUrl;
    }
  }

  return (
    <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-1.5">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-br from-[--color-accent-lavender]/30 to-[--color-accent-rose]/30">
        {gift.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gift.imageUrl}
            alt={gift.name}
            className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            {gift.emoji}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-2 pb-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-snug text-[--color-text]">
            {gift.name}
          </p>
          <p className="text-xs text-[--color-text-tertiary]">{gift.merchant}</p>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-[--color-success]">
            ₹{gift.price.toLocaleString("en-IN")}
          </span>
          <span className="text-xs font-medium text-[--color-text-tertiary]">
            {gift.deliveryDays}-day delivery
          </span>
        </div>

        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={approved}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-250 ${
              approved
                ? "bg-[--color-success]/10 text-[--color-success]"
                : "gradient-accent-button press-scale text-[--color-text]"
            }`}
          >
            {approved ? approvedLabel : approveLabel}
          </button>

          <button
            type="button"
            onClick={handleWishlist}
            aria-pressed={wishlisted}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            className={`press-scale flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
              wishlisted
                ? "border-rose-200 bg-rose-50 text-rose-500"
                : "border-[--color-border] text-[--color-text-tertiary] hover:border-rose-200 hover:bg-rose-50 hover:text-rose-400"
            }`}
          >
            <HeartIcon
              className={`h-4 w-4 transition-transform duration-200 ${wishlisted ? "scale-110 fill-current" : ""}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
