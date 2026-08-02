import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GiftCandidate, GiftVariant } from "@/lib/gifts";
import { createClient } from "@/lib/supabase/client";
import { addToWishlist, removeFromWishlist } from "@/lib/supabase/wishlist";
import { HeartIcon } from "./icons";

export function GiftCard({
  gift,
  onApprove,
  onSelectVariant,
  initiallyWishlisted = false,
  onWishlistChange,
  approveLabel = "Approve",
  approvedLabel = "Approved ✓",
}: {
  gift: GiftCandidate;
  onApprove?: (giftId: string) => void;
  onSelectVariant?: (gift: GiftCandidate, variant: GiftVariant) => void;
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

  // Real size/colour groups from the merchant catalogue (absent for simple items).
  const sizes = gift.options?.find((o) => /size/i.test(o.name))?.values ?? [];
  const colors = gift.options?.find((o) => /colou?r/i.test(o.name))?.values ?? [];
  const configurable = !!gift.variants?.length && (sizes.length > 0 || colors.length > 0);

  // Progressive selection state: choose → size → colour → checkout.
  const [choosing, setChoosing] = useState(false);
  const [size, setSize] = useState<string | undefined>();
  const [color, setColor] = useState<string | undefined>();

  // Only offer colours that actually exist for the chosen size (real combos).
  const colorsForSize = size
    ? Array.from(
        new Set(
          (gift.variants ?? [])
            .filter((v) => v.size === size)
            .map((v) => v.color)
            .filter((c): c is string => Boolean(c))
        )
      )
    : colors;

  // The exact purchasable variant for the current picks.
  const variant = gift.variants?.find(
    (v) => (!sizes.length || v.size === size) && (!colors.length || v.color === color)
  );

  // Swap the photo to the chosen colour's variant image.
  const shownImage =
    (color && gift.variants?.find((v) => v.color === color)?.imageUrl) || gift.imageUrl;

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
    if (gift.checkoutUrl && popup) popup.location.href = gift.checkoutUrl;
  }

  // Shared by both render paths below — configurable products get the same
  // wishlist control as simple ones, and the two can't drift apart.
  const heartButton = (
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
  );

  const imageBlock = (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-br from-[--color-accent-lavender]/30 to-[--color-accent-rose]/30">
      {shownImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shownImage}
          alt={gift.name}
          className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-5xl">{gift.emoji}</div>
      )}
    </div>
  );

  // Explicit hex (not CSS-var arbitrary values): Tailwind v4 no longer wraps a
  // bare `bg-[--var]` in var(), so those silently render transparent. Selected =
  // solid green with white text; unselected = white with dark-green text.
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition-all press-scale ${
      active
        ? "border-[#1A6B5F] bg-[#1A6B5F] text-white shadow-sm"
        : "border-[#0A2F2A]/15 bg-white text-[#0A2F2A]/75 hover:border-[#1A6B5F]"
    }`;

  if (configurable) {
    return (
      <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-1.5">
        {imageBlock}
        <div className="flex flex-col gap-3 px-2 pb-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-snug text-[--color-text]">{gift.name}</p>
            <p className="text-xs text-[--color-text-tertiary]">{gift.merchant}</p>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-[--color-success]">
              {variant ? "₹" + variant.price.toLocaleString("en-IN") : "from ₹" + gift.price.toLocaleString("en-IN")}
            </span>
            <span className="text-xs font-medium text-[--color-text-tertiary]">
              {gift.deliveryDays}-day delivery
            </span>
          </div>

          {!choosing ? (
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => setChoosing(true)}
                className="gradient-accent-button press-scale flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-[--color-text]"
              >
                Choose size &amp; colour
              </button>
              {heartButton}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sizes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-tertiary]">Size</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setSize(s);
                          setColor(undefined); // colours depend on size — reset
                        }}
                        className={chip(size === s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(size || sizes.length === 0) && colorsForSize.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-tertiary]">Colour</span>
                  <div className="flex flex-wrap gap-1.5">
                    {colorsForSize.map((c) => (
                      <button key={c} type="button" onClick={() => setColor(c)} className={chip(color === c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {variant ? (
                variant.available ? (
                  <button
                    type="button"
                    onClick={() => onSelectVariant?.(gift, variant)}
                    className="gradient-accent-button press-scale w-full rounded-full px-4 py-2.5 text-sm font-semibold text-[--color-text]"
                  >
                    Checkout · ₹{variant.price.toLocaleString("en-IN")} with Prava
                  </button>
                ) : (
                  <p className="text-center text-xs font-medium text-[--color-text-tertiary]">
                    Out of stock in this combo — try another size or colour.
                  </p>
                )
              ) : (
                <p className="text-center text-xs text-[--color-text-tertiary]">
                  {sizes.length > 0 && !size ? "Pick a size to continue." : "Pick a colour to continue."}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Simple product (books, mugs) — one-tap approve → checkout.
  return (
    <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-1.5">
      {imageBlock}
      <div className="flex flex-col gap-3 px-2 pb-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-snug text-[--color-text]">{gift.name}</p>
          <p className="text-xs text-[--color-text-tertiary]">{gift.merchant}</p>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-[--color-success]">₹{gift.price.toLocaleString("en-IN")}</span>
          <span className="text-xs font-medium text-[--color-text-tertiary]">{gift.deliveryDays}-day delivery</span>
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

          {heartButton}
        </div>
      </div>
    </div>
  );
}
