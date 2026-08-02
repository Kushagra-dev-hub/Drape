"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";
import { Navbar, type Profile } from "../components/Navbar";
import { Sidebar } from "../components/Sidebar";
import { GiftCard } from "../components/GiftCard";
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
        <Navbar
          profile={profile}
          title={
            <>
              Wishlist
              {items.length > 0 && (
                <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-500">
                  {items.length}
                </span>
              )}
            </>
          }
        />

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center animate-fade-up">
            <Script type="module" src="/mascot-banner/mascot-banner.js" strategy="afterInteractive" />
            <mascot-banner
              size={440}
              assets="/mascot-banner/"
              messages="Start adding to the Wish list!|It's a bit empty in here|Tap the heart on anything you like"
              suppressHydrationWarning
            />
            <Link
              href="/"
              className="gradient-button press-scale mt-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            >
              Find a gift
            </Link>
          </div>
        ) : (
          <main className="w-full max-w-6xl px-3 pb-8 sm:px-5">
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
          </main>
        )}
      </div>
    </div>
  );
}
