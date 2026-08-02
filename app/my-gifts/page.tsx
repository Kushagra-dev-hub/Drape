"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Navbar, type Profile } from "../components/Navbar";
import { Sidebar } from "../components/Sidebar";
import { listConversations, type ConversationSummary } from "@/lib/supabase/conversations";

type Order = {
  id: string;
  user_id: string;
  gift_id: string;
  gift_name: string;
  gift_image_url: string | null;
  merchant: string;
  price: number;
  delivery_days: number;
  status: string;
  delivery_date: string | null;
  created_at: string;
  rating?: number | null;
  review?: string | null;
};

type Review = { rating: number; text: string };
const REVIEWS_KEY = "memento-reviews";

// Warm, gifting-flavoured status meta instead of cold e-commerce labels.
const STATUS_META: Record<string, { dot: string; chip: string; copy: string }> = {
  Processing: { dot: "#8B7CF0", chip: "bg-[#8B7CF0]/12 text-[#5F4FC7]", copy: "Being wrapped with care." },
  "On the way": { dot: "#F5A623", chip: "bg-[#F5A623]/14 text-[#B9791A]", copy: "On its way to them." },
  Delivered: { dot: "#1A6B5F", chip: "bg-[#1A6B5F]/12 text-[#1A6B5F]", copy: "Delivered with love." },
  Cancelled: { dot: "#E8546B", chip: "bg-[#E8546B]/12 text-[#C43E54]", copy: "This gift was cancelled." },
  Returned: { dot: "#94A3B8", chip: "bg-black/[0.06] text-black/55", copy: "This gift was returned." },
};
const metaFor = (s: string) => STATUS_META[s] ?? { dot: "#94A3B8", chip: "bg-black/[0.06] text-black/55", copy: "Your gift is on its way." };

function Star({ filled, size = 22 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#F5A623" : "none"} stroke={filled ? "#F5A623" : "#CBD5E1"} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export default function MyGiftsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [activeStatus, setActiveStatus] = useState("All");

  // Review flow: locally-persisted reviews (works even without DB columns) plus
  // the modal state for the order being reviewed right now.
  const [localReviews, setLocalReviews] = useState<Record<string, Review>>({});
  const [reviewing, setReviewing] = useState<Order | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REVIEWS_KEY);
      if (raw) setLocalReviews(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    async function loadOrders() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const name = user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "there";
      setProfile({ name, email: user.email || undefined, initial: name.charAt(0).toUpperCase() || "?" });
      setUserId(user.id);

      try {
        const list = await listConversations(supabase);
        setConversations(list);
      } catch (err) {
        console.error("Failed to load conversations", err);
      }

      const { data: userOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (userOrders) setOrders(userOrders);
      setLoading(false);
    }
    loadOrders();
  }, [router, supabase]);

  // Close the review modal on Escape.
  useEffect(() => {
    if (!reviewing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeReview(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing]);

  const statuses = useMemo(() => {
    const set = new Set(orders.map((o) => o.status));
    return ["All", ...Array.from(set)];
  }, [orders]);

  const filteredOrders = orders.filter((order) => activeStatus === "All" || order.status === activeStatus);

  const reviewFor = (order: Order): Review | null => {
    if (typeof order.rating === "number" && order.rating > 0) return { rating: order.rating, text: order.review ?? "" };
    return localReviews[order.id] ?? null;
  };

  function openReview(order: Order) {
    const existing = reviewFor(order);
    setReviewing(order);
    setRating(existing?.rating ?? 0);
    setReviewText(existing?.text ?? "");
    setHoverRating(0);
  }
  function closeReview() {
    setReviewing(null);
    setRating(0);
    setHoverRating(0);
    setReviewText("");
  }
  async function submitReview() {
    if (!reviewing || rating < 1) return;
    const entry: Review = { rating, text: reviewText.trim() };
    // Persist locally so it survives a reload even without DB columns.
    setLocalReviews((prev) => {
      const next = { ...prev, [reviewing.id]: entry };
      try { localStorage.setItem(REVIEWS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    // Best-effort DB save (needs `rating` int + `review` text columns on orders).
    try {
      await supabase.from("orders").update({ rating: entry.rating, review: entry.text }).eq("id", reviewing.id);
    } catch {
      /* columns may not exist yet — local copy still shows it */
    }
    closeReview();
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[--color-surface]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[--color-primary]/20 border-t-[--color-primary]"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[--color-surface]">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        signedIn={Boolean(userId)}
        profile={profile}
        conversations={conversations}
        activeConversationId={null}
        newChatDisabled={false}
        onNewChat={() => router.push("/")}
        onSelectConversation={() => router.push("/")}
        onLogout={async () => {
          await supabase.auth.signOut();
          router.push("/login");
        }}
      />

      <div className="hero-gradient flex min-h-0 flex-1 flex-col overflow-y-auto pb-12">
        <Navbar profile={profile} />

        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
          {/* Header */}
          <div className="gift-rise mb-8 flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-[--color-text] sm:text-4xl">Your Gifts 🎁</h1>
            <p className="text-sm text-[--color-text-secondary]">
              Every thoughtful gift you have sent, from wrapped to delivered, all in one place.
            </p>
          </div>

          {/* Filter chips */}
          <div className="gift-rise mb-6 flex flex-wrap gap-2" style={{ animationDelay: "0.05s" }}>
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setActiveStatus(s)}
                className={`press-scale rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  activeStatus === s
                    ? "bg-[#1A6B5F] text-white shadow-[0_4px_14px_rgba(26,107,95,0.25)]"
                    : "border border-black/[0.06] bg-white/70 text-[--color-text-secondary] hover:border-[#1A6B5F]/40 hover:text-[--color-text]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Gifts grid / empty state */}
          {filteredOrders.length === 0 ? (
            <div className="gift-rise flex flex-col items-center justify-center gap-4 rounded-3xl border border-black/[0.06] bg-white/60 px-8 py-16 text-center shadow-[0_8px_30px_rgba(10,47,42,0.05)]">
              <div className="text-6xl">🎁</div>
              <h3 className="text-xl font-bold text-[--color-text]">
                {orders.length === 0 ? "No gifts yet" : "Nothing in this filter"}
              </h3>
              <p className="max-w-sm text-sm text-[--color-text-secondary]">
                {orders.length === 0
                  ? "Every thoughtful gift you send will land here, ready to track from wrapped to delivered."
                  : "Try a different status."}
              </p>
              {orders.length === 0 && (
                <Link
                  href="/"
                  className="gradient-button btn-shine press-scale mt-1 rounded-full px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg"
                >
                  Find the perfect gift
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {filteredOrders.map((order, i) => {
                const m = metaFor(order.status);
                const review = reviewFor(order);
                const canReview = order.status === "Delivered" || order.status === "Processing";
                return (
                  <div
                    key={order.id}
                    className="cal-card gift-rise flex flex-col gap-4 rounded-3xl p-5"
                    style={{ animationDelay: `${Math.min(i * 0.06, 0.4)}s` }}
                  >
                    <div className="flex gap-4">
                      <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-2xl bg-white shadow-[inset_0_0_0_1px_rgba(10,47,42,0.05)]">
                        {order.gift_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={order.gift_image_url} alt={order.gift_name} className="h-full w-full object-cover mix-blend-multiply" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-4xl">🎁</div>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="line-clamp-2 text-base font-bold leading-snug text-[--color-text]">{order.gift_name}</h3>
                        <p className="mt-0.5 text-xs font-medium text-[--color-text-tertiary]">{order.merchant}</p>
                        <p className="mt-auto pt-2 text-lg font-bold text-[#1A6B5F]">₹{order.price.toLocaleString("en-IN")}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${m.chip}`}>
                        <span className="h-2 w-2 rounded-full" style={{ background: m.dot }} />
                        {order.status}
                      </span>
                      <span className="text-xs font-medium text-[--color-text-tertiary]">
                        {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    <p className="text-sm text-[--color-text-secondary]">{m.copy}</p>

                    {review ? (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} filled={n <= review.rating} size={16} />
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-[--color-text-tertiary]">Your review</span>
                        <button
                          onClick={() => openReview(order)}
                          className="ml-auto text-xs font-semibold text-[#1A6B5F] hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    ) : (
                      canReview && (
                        <button
                          onClick={() => openReview(order)}
                          className="press-scale flex w-fit items-center gap-1.5 rounded-full bg-[#1A6B5F]/10 px-3.5 py-1.5 text-sm font-semibold text-[#1A6B5F] transition-colors hover:bg-[#1A6B5F]/16"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          Rate &amp; Review
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Review modal */}
      {reviewing && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeReview}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="aspect-square w-14 shrink-0 overflow-hidden rounded-xl bg-black/5">
                {reviewing.gift_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={reviewing.gift_image_url} alt="" className="h-full w-full object-cover mix-blend-multiply" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">🎁</div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-[--color-text]">How was this gift?</h3>
                <p className="truncate text-sm text-[--color-text-tertiary]">{reviewing.gift_name}</p>
              </div>
            </div>

            {/* Stars */}
            <div className="mb-4 flex justify-center gap-1.5" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  className="press-scale p-1"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star filled={n <= (hoverRating || rating)} size={30} />
                </button>
              ))}
            </div>

            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={3}
              placeholder="Share a thought about it (optional)"
              className="mb-4 w-full resize-none rounded-2xl border border-black/[0.08] bg-[--color-surface] px-4 py-3 text-sm text-[--color-text] placeholder-[--color-text-tertiary] focus:border-[#1A6B5F]/40 focus:outline-none"
            />

            <div className="flex gap-2">
              <button
                onClick={closeReview}
                className="press-scale flex-1 rounded-full border border-black/[0.08] bg-white px-4 py-2.5 text-sm font-semibold text-[--color-text-secondary] hover:bg-black/[0.02]"
              >
                Cancel
              </button>
              <button
                onClick={submitReview}
                disabled={rating < 1}
                className="gradient-button press-scale flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
              >
                Submit review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
