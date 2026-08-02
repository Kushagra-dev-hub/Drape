import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUpcomingOccasions, detectOccasion } from "@/lib/calendar";
import { getGoogleTokens } from "@/lib/supabase/google-tokens";
import { ArrowLeftIcon, CalendarIcon } from "@/app/components/icons";
import { CalendarSidebarWrapper } from "./CalendarSidebarWrapper";
import { listConversations } from "@/lib/supabase/conversations";
import { getMonthYear, getNormalizedCategory, getLocalDayKey } from "./utils";
import { CalendarView } from "./CalendarView";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; category?: string; month?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const name = user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "there";
  const initial = name.charAt(0).toUpperCase() || "?";

  const { error: oauthError, category, month } = await searchParams;
  const tokenRow = await getGoogleTokens(supabase, user.id).catch(() => null);
  
  const conversations = await listConversations(supabase);

  // Fetch up to 365 days (1 year) to ensure we have a rich timeline of events
  const allEvents = tokenRow ? await getUpcomingOccasions(supabase, user.id, 365) : [];

  void detectOccasion;

  // Active month logic
  const today = new Date();
  
  let activeMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  if (month) {
    const [y, m] = month.split('-');
    activeMonthDate = new Date(parseInt(y), parseInt(m) - 1, 1);
  }

  // Calculate events specifically for the active month for counts
  const allEventsInMonth = allEvents.filter(ev => {
    const d = new Date(ev.start);
    return d.getFullYear() === activeMonthDate.getFullYear() && d.getMonth() === activeMonthDate.getMonth();
  });


  // Filter events based on selected category ONLY
  const activeCategory = category || "all";
  const filteredEvents = allEvents.filter(ev => {
    if (activeCategory === "all") return true;
    return getNormalizedCategory(ev.occasion) === activeCategory;
  });

  // Group filtered events by date string for the calendar view
  const eventsByDate: Record<string, typeof allEvents> = {};
  for (const ev of filteredEvents) {
    const key = getLocalDayKey(ev.start);
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(ev);
  }

  // Generate calendar grid dates
  const firstDayOfMonth = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth(), 1);
  const lastDayOfMonth = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() + 1, 0);
  
  const startOffset = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
  const daysInMonth = lastDayOfMonth.getDate();
  const prevMonthLastDay = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth(), 0).getDate();

  const calendarDays = [];
  
  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() - 1, prevMonthLastDay - i);
    calendarDays.push({ day: prevMonthLastDay - i, isCurrentMonth: false, dateKey: getLocalDayKey(d.toISOString()) });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth(), i);
    calendarDays.push({ day: i, isCurrentMonth: true, dateKey: getLocalDayKey(d.toISOString()) });
  }
  
  // Next month padding (always render 6 rows = 42 slots for consistent height)
  const remainingSlots = 42 - calendarDays.length;
  for (let i = 1; i <= remainingSlots; i++) {
    const d = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() + 1, i);
    calendarDays.push({ day: i, isCurrentMonth: false, dateKey: getLocalDayKey(d.toISOString()) });
  }

  // URLs for Month Navigation
  const prevMonthDate = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() - 1, 1);
  const nextMonthDate = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() + 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
  
  const catQuery = category ? `&category=${category}` : "";
  const prevUrl = `/calendar?month=${prevMonthStr}${catQuery}`;
  const nextUrl = `/calendar?month=${nextMonthStr}${catQuery}`;
  const todayUrl = `/calendar?month=${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}${catQuery}`;

  const currentMonthQuery = month ? `?month=${month}` : "";
  const getCatUrl = (c: string) => {
    if (c === 'all') return `/calendar${currentMonthQuery}`;
    return `/calendar${currentMonthQuery ? currentMonthQuery + '&' : '?'}category=${c}`;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[--color-surface] text-[--color-text]">
      
      <CalendarSidebarWrapper 
        profile={{
          name: name,
          email: user.email || "",
          initial: initial,
        }} 
        conversations={conversations} 
      />

      {/* MAIN CONTENT */}
      <main className="hero-gradient flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* TOP NAVBAR */}
        <header className="flex shrink-0 items-center justify-between px-8 py-6 border-b border-black/5 z-10">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-bold text-[--color-text] tracking-tight">
              Upcoming Events
            </h2>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-1 rounded-full p-1.5 border border-black/[0.06] bg-gradient-to-b from-white to-[#FBF6EE] shadow-[0_6px_18px_rgba(10,47,42,0.09),inset_0_1px_0_rgba(255,255,255,0.8)]">
            <Link href={prevUrl} className="press-scale flex h-8 w-8 items-center justify-center rounded-full text-[--color-text-secondary] hover:bg-[#1A6B5F]/12 hover:text-[#1A6B5F] transition-colors">&lt;</Link>
            <Link href={todayUrl} className="min-w-[130px] px-4 text-center text-sm font-bold text-[--color-text] hover:text-[#1A6B5F] transition-colors">
              {getMonthYear(activeMonthDate)}
            </Link>
            <Link href={nextUrl} className="press-scale flex h-8 w-8 items-center justify-center rounded-full text-[--color-text-secondary] hover:bg-[#1A6B5F]/12 hover:text-[#1A6B5F] transition-colors">&gt;</Link>
          </div>
        </header>

        {/* Filters Row */}
        <div className="px-8 py-4 shrink-0 flex flex-wrap gap-2">
          <Link href={getCatUrl('all')} className={`press-scale flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeCategory === 'all' ? 'bg-black text-white shadow-md' : 'bg-[#F4F5F7] text-[--color-text-secondary] hover:bg-black/5 hover:text-[--color-text]'}`}>
            All Events
            <span className={`text-xs ml-1 ${activeCategory === 'all' ? 'text-white/70' : 'text-black/40'}`}>({allEventsInMonth.length})</span>
          </Link>
          <Link href={getCatUrl('birthdays')} className={`press-scale flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeCategory === 'birthdays' ? 'bg-[#5B3BC4] text-white shadow-md' : 'bg-[#F4F5F7] text-[--color-text-secondary] hover:bg-black/5 hover:text-[--color-text]'}`}>
            <span className={`h-2 w-2 rounded-full ${activeCategory === 'birthdays' ? 'bg-white' : 'bg-[#5B3BC4]'}`}></span>
            Birthdays
            <span className={`text-xs ml-1 ${activeCategory === 'birthdays' ? 'text-white/70' : 'text-black/40'}`}>({allEventsInMonth.filter(e => getNormalizedCategory(e.occasion) === 'birthdays').length})</span>
          </Link>
          <Link href={getCatUrl('anniversaries')} className={`press-scale flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeCategory === 'anniversaries' ? 'bg-[#C2185B] text-white shadow-md' : 'bg-[#F4F5F7] text-[--color-text-secondary] hover:bg-black/5 hover:text-[--color-text]'}`}>
            <span className={`h-2 w-2 rounded-full ${activeCategory === 'anniversaries' ? 'bg-white' : 'bg-[#C2185B]'}`}></span>
            Anniversaries
            <span className={`text-xs ml-1 ${activeCategory === 'anniversaries' ? 'text-white/70' : 'text-black/40'}`}>({allEventsInMonth.filter(e => getNormalizedCategory(e.occasion) === 'anniversaries').length})</span>
          </Link>
          <Link href={getCatUrl('holidays')} className={`press-scale flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeCategory === 'holidays' ? 'bg-[#2E7D32] text-white shadow-md' : 'bg-[#F4F5F7] text-[--color-text-secondary] hover:bg-black/5 hover:text-[--color-text]'}`}>
            <span className={`h-2 w-2 rounded-full ${activeCategory === 'holidays' ? 'bg-white' : 'bg-[#2E7D32]'}`}></span>
            Holidays
            <span className={`text-xs ml-1 ${activeCategory === 'holidays' ? 'text-white/70' : 'text-black/40'}`}>({allEventsInMonth.filter(e => getNormalizedCategory(e.occasion) === 'holidays').length})</span>
          </Link>
          <Link href={getCatUrl('other')} className={`press-scale flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeCategory === 'other' ? 'bg-[#1976D2] text-white shadow-md' : 'bg-[#F4F5F7] text-[--color-text-secondary] hover:bg-black/5 hover:text-[--color-text]'}`}>
            <span className={`h-2 w-2 rounded-full ${activeCategory === 'other' ? 'bg-white' : 'bg-[#1976D2]'}`}></span>
            Other
            <span className={`text-xs ml-1 ${activeCategory === 'other' ? 'text-white/70' : 'text-black/40'}`}>({allEventsInMonth.filter(e => getNormalizedCategory(e.occasion) === 'other').length})</span>
          </Link>
        </div>

        {/* ERROR / EMPTY STATES */}
        {oauthError && (
          <div className="mx-8 mb-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
            {oauthError === "access_denied"
              ? "You declined calendar access. Sign in with Google to try again."
              : "Something went wrong connecting your calendar. Try signing in with Google again."}
          </div>
        )}

        {!tokenRow && !oauthError && (
          <div className="m-8 glass-card flex flex-col items-center gap-4 rounded-3xl px-8 py-16 text-center animate-fade-up border border-black/5">
            <CalendarIcon className="h-10 w-10 text-[--color-text-tertiary] mb-2" />
            <h2 className="text-xl font-semibold">No calendar connected</h2>
            <p className="max-w-sm text-sm text-[--color-text-secondary]">
              Sign in with Google on the <Link href="/login" className="underline font-medium">login page</Link> to connect your calendar.
            </p>
          </div>
        )}

        {/* LARGE CALENDAR GRID */}
        {tokenRow && (
          <CalendarView calendarDays={calendarDays} eventsByDateKey={eventsByDate} />
        )}
      </main>
    </div>
  );
}
