"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Navbar, type Profile } from "../components/Navbar";
import { Sidebar } from "../components/Sidebar";
import { SearchIcon } from "../components/icons";
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
};

export default function MyGiftsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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

      // Fetch conversations for sidebar
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

      if (userOrders) {
        setOrders(userOrders);
      }
      setLoading(false);
    }
    loadOrders();
  }, [router, supabase]);

  const toggleStatusFilter = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const filteredOrders = orders.filter(order => {
    if (statusFilter.length > 0 && !statusFilter.includes(order.status)) return false;
    if (searchQuery && !order.gift_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered": return "bg-green-500";
      case "Cancelled": return "bg-red-500";
      case "Processing": return "bg-blue-500";
      case "On the way": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

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
        
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
        {/* Back Button */}
        <div className="mb-6 flex items-center gap-3 text-sm font-medium text-[--color-text-tertiary]">
          <Link href="/" className="flex items-center gap-1.5 rounded-lg bg-[--color-primary]/10 px-3 py-1.5 text-[--color-primary] transition-colors hover:bg-[--color-primary]/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to Home
          </Link>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Left Column (Filters) */}
          <div className="glass-card w-full shrink-0 overflow-hidden rounded-2xl lg:w-64">
            <div className="border-b border-[--color-border] bg-white/40 p-5">
              <h2 className="text-lg font-bold text-[--color-text]">Filters</h2>
            </div>
            
            <div className="border-b border-[--color-border] p-5">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[--color-text-tertiary]">Order Status</h3>
              <div className="flex flex-col gap-3.5">
                {["On the way", "Delivered", "Cancelled", "Returned"].map(status => (
                  <label key={status} className="flex cursor-pointer items-center gap-3">
                    <input 
                      type="checkbox"
                      checked={statusFilter.includes(status)}
                      onChange={() => toggleStatusFilter(status)}
                      className="h-4 w-4 rounded border-[--color-border] accent-[--color-primary]"
                    />
                    <span className="text-sm font-medium text-[--color-text-secondary]">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-5">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[--color-text-tertiary]">Order Time</h3>
              <div className="flex flex-col gap-3.5">
                {["Last 30 days", "2024", "2023", "Older"].map(time => (
                  <label key={time} className="flex cursor-pointer items-center gap-3">
                    <input 
                      type="checkbox"
                      className="h-4 w-4 rounded border-[--color-border] accent-[--color-primary]"
                    />
                    <span className="text-sm font-medium text-[--color-text-secondary]">{time}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (Search + Orders List) */}
          <div className="flex-1 space-y-6">
            {/* Search Bar */}
            <div className="glass-card flex overflow-hidden rounded-2xl">
              <input
                type="text"
                placeholder="Search your orders here"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent px-5 py-4 text-sm font-medium text-[--color-text] placeholder-[--color-text-tertiary] focus:outline-none"
              />
              <button className="gradient-button flex items-center gap-2 px-8 py-4 text-sm font-bold text-white transition-transform active:scale-95">
                <SearchIcon className="h-4 w-4" />
                <span>Search Orders</span>
              </button>
            </div>

            {/* Orders List */}
            <div className="flex flex-col gap-5">
              {filteredOrders.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center rounded-2xl p-16">
                  <div className="text-lg font-medium text-[--color-text-tertiary]">No orders found</div>
                </div>
              ) : (
                filteredOrders.map(order => (
                  <div key={order.id} className="glass-card group relative cursor-pointer overflow-hidden rounded-2xl p-5 transition-all hover:ring-2 hover:ring-[--color-primary] hover:ring-offset-2">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
                      {/* Image */}
                      <div className="aspect-square w-24 shrink-0 overflow-hidden rounded-xl bg-black/5">
                        {order.gift_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={order.gift_image_url} alt={order.gift_name} className="h-full w-full object-cover mix-blend-multiply" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-4xl">🎁</div>
                        )}
                      </div>
                      
                      {/* Details */}
                      <div className="flex flex-1 flex-col gap-1.5">
                        <h3 className="line-clamp-2 text-base font-bold text-[--color-text] group-hover:text-[--color-primary]">{order.gift_name}</h3>
                        <p className="text-sm font-medium text-[--color-text-tertiary]">Merchant: {order.merchant}</p>
                      </div>

                      {/* Price */}
                      <div className="w-24 shrink-0 text-base font-bold text-[--color-text]">
                        ₹{order.price.toLocaleString("en-IN")}
                      </div>

                      {/* Status */}
                      <div className="flex w-64 shrink-0 flex-col gap-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-3 w-3 shrink-0 rounded-full shadow-sm ${getStatusColor(order.status)}`} />
                          <span className="text-sm font-bold text-[--color-text]">
                            {order.status} on {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-[--color-text-secondary]">
                          {order.status === "Delivered" ? "Your item has been delivered" : 
                           order.status === "Cancelled" ? "Your order was cancelled as per your request." :
                           order.status === "Processing" ? "Your order is being processed by the seller." :
                           "Your item is on the way."}
                        </p>
                        {(order.status === "Delivered" || order.status === "Processing") && (
                          <button className="mt-3 flex w-fit items-center gap-1.5 rounded-lg bg-[--color-primary]/10 px-3 py-1.5 text-sm font-semibold text-[--color-primary] transition-colors hover:bg-[--color-primary]/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            Rate & Review Product
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        </main>
      </div>
    </div>
  );
}
