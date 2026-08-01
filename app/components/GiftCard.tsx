import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GiftCandidate } from "@/lib/gifts";
import { createClient } from "@/lib/supabase/client";

export function GiftCard({ gift }: { gift: GiftCandidate }) {
  const router = useRouter();
  const [approved, setApproved] = useState(false);

  async function handleApprove() {
    // Open the tab synchronously, before the auth await, so the click's user
    // activation isn't lost — opening it after an await gets silently
    // popup-blocked in Chrome/Firefox.
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

        <button
          type="button"
          onClick={handleApprove}
          disabled={approved}
          className={`w-full rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-250 ${
            approved
              ? "bg-[--color-success]/10 text-[--color-success]"
              : "gradient-accent-button press-scale text-[--color-text]"
          }`}
        >
          {approved ? "Approved ✓" : "Approve"}
        </button>
      </div>
    </div>
  );
}
