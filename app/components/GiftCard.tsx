import type { GiftCandidate } from "@/lib/gifts";

export function GiftCard({ gift }: { gift: GiftCandidate }) {
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
        className="mt-1 rounded-full bg-[#F0D7FF] px-4 py-2 text-sm font-medium text-[#034F46] transition hover:brightness-95"
      >
        Approve
      </button>
    </div>
  );
}
