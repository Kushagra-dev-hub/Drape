"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { GiftCandidate } from "@/lib/gifts";
import { ArrowLeftIcon } from "../components/icons";

// We need a wrapper to useSearchParams safely inside Suspense
function CheckoutFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messageId = searchParams.get("messageId");
  const giftId = searchParams.get("giftId");
  const isVariant = searchParams.get("variant");

  const [gift, setGift] = useState<GiftCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);

  const supabase = createClient();

  // Load gift details on mount. No address step: Drape is only a mediator —
  // Prava's hosted checkout collects the delivery address + card + passkey, so
  // there's nothing for us to gather here beyond confirming the gift.
  useEffect(() => {
    async function loadData() {
      // Configurable product: the exact size+colour variant was stashed in
      // sessionStorage by the gift card. Its price/name/image are the real
      // merchant variant, so use them directly (no DB round-trip needed).
      if (isVariant) {
        try {
          const raw = sessionStorage.getItem("drape-checkout-selection");
          if (raw) {
            const sel = JSON.parse(raw);
            setGift({
              id: String(sel.variantId || sel.giftId),
              name: sel.variantTitle ? `${sel.name} — ${sel.variantTitle}` : sel.name,
              category: "live",
              price: Number(sel.price) || 0,
              merchant: sel.merchant || "",
              deliveryDays: Number(sel.deliveryDays) || 5,
              tags: [],
              emoji: "🎁",
              imageUrl: sel.imageUrl || undefined,
            });
          }
        } catch {
          // fall through to the "gift not found" screen
        }
        setLoading(false);
        return;
      }

      if (messageId && giftId) {
        const { data, error } = await supabase
          .from("messages")
          .select("gifts")
          .eq("id", messageId)
          .single();

        if (!error && data?.gifts) {
          const found = (data.gifts as GiftCandidate[]).find((g: GiftCandidate) => g.id === giftId);
          if (found) setGift(found);
        }
      }
      setLoading(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, giftId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[--color-surface]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[--color-primary]/20 border-t-[--color-primary]"></div>
      </div>
    );
  }

  if (!gift) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[--color-surface]">
        <h1 className="text-xl font-bold text-[--color-text]">Gift not found</h1>
        <button onClick={() => router.back()} className="gradient-button rounded-xl px-6 py-2.5 text-white font-medium">
          Go Back
        </button>
      </div>
    );
  }

  // Real Prava checkout: open a hosted payment session, the buyer approves with
  // a passkey (their card never touches Drape or the merchant), then we settle
  // and record the paid order. Sandbox — no real money moves.
  const saveOrder = async (status: string, txn?: string, orderId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !gift) return;
    try {
      await supabase.from("orders").insert({
        user_id: user.id,
        gift_id: gift.id,
        gift_name: gift.name,
        gift_image_url: gift.imageUrl || null,
        merchant: gift.merchant,
        price: gift.price,
        delivery_days: gift.deliveryDays,
        status,
        prava_txn: txn || null,
        prava_order: orderId || null,
      });
    } catch (e) {
      console.warn("[checkout] saveOrder failed:", e);
    }
  };

  const pollPrava = async (sessionId: string, tries: number): Promise<void> => {
    if (tries > 60) {
      setPlacingOrder(false);
      alert("Still waiting — finish payment in the Prava window, then it completes here.");
      return;
    }
    await new Promise((r) => setTimeout(r, 2500));
    let res: { status?: string; txnRefId?: string; orderId?: string } = {};
    try {
      res = await (await fetch("/api/prava/result?sessionId=" + encodeURIComponent(sessionId))).json();
    } catch {
      /* keep polling */
    }
    const st = String(res.status || "").toLowerCase();
    if (["completed", "approved", "success", "paid", "captured"].includes(st)) {
      await saveOrder("Processing", res.txnRefId, res.orderId);
      setPlacingOrder(false);
      alert("Payment successful via Prava — your gift is on its way! 🎁");
      router.push("/my-gifts");
      return;
    }
    if (["failed", "declined", "cancelled", "canceled", "expired", "error"].includes(st)) {
      setPlacingOrder(false);
      alert(`Payment ${st}. Please try again (rotate a different sandbox card if the passkey failed).`);
      return;
    }
    return pollPrava(sessionId, tries + 1);
  };

  const handlePlaceOrder = async () => {
    if (!gift) return;
    setPlacingOrder(true);

    // 1. Open a real Prava sandbox session for this gift.
    let session: { sessionId?: string; iframeUrl?: string; error?: string } = {};
    try {
      session = await (
        await fetch("/api/prava/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            amountMinor: Math.round(gift.price * 100),
            currency: "INR",
            description: gift.name,
            quantity: 1,
            orderRef: `DRAPE-${Date.now()}`,
            merchantName: gift.merchant,
          }),
        })
      ).json();
    } catch {
      session = { error: "network" };
    }
    if (!session.sessionId || !session.iframeUrl) {
      setPlacingOrder(false);
      alert(`Couldn't start Prava checkout (${session.error || "error"}). Please try again.`);
      return;
    }

    // 2. Open Prava's hosted checkout — buyer pays with card + passkey and
    //    enters their delivery address there (Prava is the payment surface).
    window.open(session.iframeUrl, "prava_checkout", "noopener,width=460,height=820");

    // 3. Poll until the payment settles, then record the order.
    pollPrava(session.sessionId, 0);
  };

  return (
    <div className="min-h-screen bg-[--color-surface] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[--color-border] bg-white/80 px-4 py-4 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-black/5 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 text-[--color-text-secondary]" />
          </button>
          <div className="text-xl font-bold tracking-tight text-[--color-primary]">
            Memento <span className="font-normal text-[--color-text-tertiary]">Checkout</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-8 sm:px-8">
        {/* Stepper — two steps: confirm the gift, then pay on Prava. */}
        <div className="mb-10 flex items-center justify-center gap-4 sm:gap-8">
          <div className="flex flex-col items-center gap-2 text-[--color-primary]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 font-bold">
              1
            </div>
            <span className="text-sm font-semibold">Review Gift</span>
          </div>
          <div className="h-1 w-16 rounded-full bg-black/10 sm:w-32" />
          <div className="flex flex-col items-center gap-2 text-[--color-text-tertiary]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 font-bold">
              2
            </div>
            <span className="text-sm font-semibold">Pay with Prava</span>
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Left Column */}
          <div className="flex-1 space-y-6">
            {/* Order Summary */}
            <div className="glass-card overflow-hidden rounded-2xl ring-2 ring-[--color-primary] ring-offset-2 transition-all duration-300">
              <div className="border-b border-[--color-border] bg-white/40 px-6 py-4">
                <h2 className="text-lg font-bold text-[--color-text]">Order Summary</h2>
              </div>
              <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:gap-6">
                <div className="aspect-square w-24 shrink-0 overflow-hidden rounded-xl bg-black/5">
                  {gift.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gift.imageUrl} alt={gift.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">{gift.emoji}</div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <h3 className="font-semibold text-[--color-text]">{gift.name}</h3>
                  <p className="text-sm text-[--color-text-tertiary]">{gift.merchant}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-lg font-bold text-[--color-success]">₹{gift.price.toLocaleString("en-IN")}</span>
                    <span className="text-sm text-[--color-text-tertiary] line-through">₹{Math.round(gift.price * 1.5).toLocaleString("en-IN")}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-[--color-primary-muted]">Delivery in {gift.deliveryDays} days</p>
                </div>
              </div>
            </div>

            {/* How payment works — Drape is the mediator; Prava is the payment surface. */}
            <div className="glass-card overflow-hidden rounded-2xl">
              <div className="border-b border-[--color-border] bg-white/40 px-6 py-4">
                <h2 className="text-lg font-bold text-[--color-text]">Secure payment by Prava</h2>
              </div>
              <div className="flex flex-col gap-3 p-6 text-sm text-[--color-text-secondary]">
                <p>
                  Drape doesn&apos;t handle your card or address. When you continue, Prava&apos;s secure
                  checkout opens where you enter your <span className="font-semibold text-[--color-text]">delivery address</span> and
                  approve payment with your <span className="font-semibold text-[--color-text]">card + passkey</span>.
                </p>
                <div className="flex items-start gap-3 rounded-xl bg-[--color-surface] p-3">
                  <span className="mt-0.5 text-lg">🔒</span>
                  <span>
                    Your real card number never touches Drape or the merchant — Prava issues a
                    one-time scoped credential, just like a UPI-style agentic payment.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Price Details) */}
          <div className="glass-card sticky top-24 w-full rounded-2xl lg:w-96">
            <div className="border-b border-[--color-border] bg-white/40 px-6 py-4">
              <h2 className="text-base font-bold uppercase tracking-wider text-[--color-text-secondary]">Price Details</h2>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex justify-between text-sm text-[--color-text]">
                <span>Price (1 item)</span>
                <span>₹{Math.round(gift.price * 1.5).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm text-[--color-text]">
                <span>Discount</span>
                <span className="text-[--color-success]">- ₹{Math.round(gift.price * 0.5).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm text-[--color-text]">
                <span>Delivery Charges</span>
                <span className="text-[--color-success]">Free</span>
              </div>

              <div className="my-2 h-px w-full bg-[--color-border]" />

              <div className="flex justify-between text-lg font-bold text-[--color-text]">
                <span>Total Amount</span>
                <span>₹{gift.price.toLocaleString("en-IN")}</span>
              </div>

              <div className="my-2 h-px w-full bg-[--color-border]" />

              <div className="text-sm font-medium text-[--color-success]">
                You will save ₹{Math.round(gift.price * 0.5).toLocaleString("en-IN")} on this order
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={placingOrder}
                className="gradient-accent-button mt-4 w-full rounded-xl py-3.5 text-base font-bold text-[--color-text] shadow-md transition-transform hover:shadow-lg active:scale-95 disabled:opacity-60"
              >
                {placingOrder ? "Opening Prava…" : "Pay securely with Prava"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[--color-surface]"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[--color-primary]/20 border-t-[--color-primary]"></div></div>}>
      <CheckoutFlow />
    </Suspense>
  );
}
