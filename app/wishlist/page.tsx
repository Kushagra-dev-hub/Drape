"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Navbar, type Profile } from "../components/Navbar";
import { Sidebar } from "../components/Sidebar";
import { GiftCard } from "../components/GiftCard";
import { HeartIcon } from "../components/icons";
import { listConversations, type ConversationSummary } from "@/lib/supabase/conversations";
import { listWishlist, toGiftCandidate, type WishlistItem } from "@/lib/supabase/wishlist";

export default function WishlistPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

      try {
        setItems(await listWishlist(supabase));
      } catch (err) {
        console.error("Failed to load wishlist", err);
      }

      setLoading(false);
    }
    load();
  }, [router, supabase]);

  // Un-hearting a card here should drop it from the grid rather than leave an
  // empty-hearted card sitting on the wishlist page.
  const handleWishlistChange = useCallback((giftId: string, wishlisted: boolean) => {
    if (!wishlisted) setItems((prev) => prev.filter((i) => i.gift_id !== giftId));
  }, []);

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

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-12">
        <Navbar profile={profile} />

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
          <div className="mb-6 flex items-center gap-3 text-sm font-medium text-[--color-text-tertiary]">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg bg-[--color-primary]/10 px-3 py-1.5 text-[--color-primary] transition-colors hover:bg-[--color-primary]/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back to Home
            </Link>
          </div>

          <div className="mb-8 flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-[--color-text]">Wishlist</h1>
            {items.length > 0 && (
              <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-500">
                {items.length}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl p-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
                <HeartIcon className="h-6 w-6 text-rose-400" />
              </div>
              <div className="text-lg font-semibold text-[--color-text]">Nothing saved yet</div>
              <p className="max-w-sm text-sm text-[--color-text-secondary]">
                Tap the heart on any recommended gift and it will show up here.
              </p>
              <Link
                href="/"
                className="gradient-button press-scale mt-2 rounded-full px-5 py-2.5 text-sm font-semibold text-[--color-text-inverse]"
              >
                Find a gift
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <GiftCard
                  key={item.id}
                  gift={toGiftCandidate(item)}
                  initiallyWishlisted
                  onWishlistChange={handleWishlistChange}
                  approveLabel="Buy Now"
                  approvedLabel="Opening checkout…"
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
