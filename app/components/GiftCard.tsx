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
    <div className="flex flex-col gap-3 rounded-3xl border border-[#034F46]/10 bg-white p-1.5 shadow-sm">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#034F46]/5 bg-[#F0D7FF]">
        {gift.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gift.imageUrl} alt={gift.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">{gift.emoji}</div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-1 pb-1">
        <div className="min-w-0">
          <p className="truncate font-semibold leading-snug text-[#034F46]">{gift.name}</p>
          <p className="text-xs text-[#034F46]/60">{gift.merchant}</p>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-[#16A34A]">₹{gift.price.toLocaleString("en-IN")}</span>
          <span className="text-xs font-bold text-[#034F46]/50">{gift.deliveryDays}-day delivery</span>
        </div>

        <button
          type="button"
          onClick={handleApprove}
          disabled={approved}
          className={`w-full rounded-full px-4 py-2 text-sm font-medium transition ${
            approved
              ? "bg-[#034F46]/10 text-[#034F46]/50"
              : "bg-[#F0D7FF] text-[#034F46] hover:brightness-95"
          }`}
        >
          {approved ? "Approved ✓" : "Approve"}
        </button>
      </div>
    </div>
  );
}
