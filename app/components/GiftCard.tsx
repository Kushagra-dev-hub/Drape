import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GiftCandidate } from "@/lib/gifts";
import { createClient } from "@/lib/supabase/client";

export function GiftCard({ gift }: { gift: GiftCandidate }) {
  const router = useRouter();
  const [approved, setApproved] = useState(false);

  async function handleApprove() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }
    setApproved(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#034F46]/10 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F0D7FF] text-2xl">
          {gift.emoji}
        </div>
        <div className="min-w-0">
          <p className="font-medium leading-snug text-[#034F46]">{gift.name}</p>
          <p className="text-xs text-[#034F46]/60">{gift.merchant}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-[#034F46]/80">
        <span>₹{gift.price.toLocaleString("en-IN")}</span>
        <span>{gift.deliveryDays}-day delivery</span>
      </div>

      <button
        type="button"
        onClick={handleApprove}
        disabled={approved}
        className={`mt-1 rounded-full px-4 py-2 text-sm font-medium transition ${
          approved
            ? "bg-[#034F46]/10 text-[#034F46]/50"
            : "bg-[#F0D7FF] text-[#034F46] hover:brightness-95"
        }`}
      >
        {approved ? "Approved ✓" : "Approve"}
      </button>
    </div>
  );
}
