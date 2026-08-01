import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUpcomingOccasions, detectOccasion } from "@/lib/calendar";
import { getGoogleTokens } from "@/lib/supabase/google-tokens";
import { ArrowLeftIcon, CalendarIcon, SearchIcon, SparkleIcon } from "@/app/components/icons";
import { CalendarSidebarWrapper } from "./CalendarSidebarWrapper";
import { listConversations } from "@/lib/supabase/conversations";

// Basic date utilities
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function getMonthYear(d: Date = new Date()) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getShortDay(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short" }); // Mon, Tue
}

function getDayNum(d: Date) {
  return d.getDate();
}

function daysUntil(iso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getNormalizedCategory(occasion: string) {
  const kw = occasion.toLowerCase();
  if (['birthday', 'bday', 'b-day'].includes(kw)) return 'birthdays';
  if (['anniversary', 'wedding'].includes(kw)) return 'anniversaries';
  if (['diwali', 'christmas', 'eid', 'onam', 'pongal', 'navratri', 'raksha bandhan', 'holi', 'thanksgiving', 'halloween'].includes(kw)) return 'holidays';
  return 'other';
}

// Pastel color mapping for occasions
function getCardStyle(occasion: string) {
  const category = getNormalizedCategory(occasion);
  switch (category) {
    case "birthdays":
      return { bg: "bg-[#EAE4FC]", text: "text-[#5B3BC4]", title: "text-[#3D258A]", dot: "bg-[#5B3BC4]" }; // Lavender
    case "anniversaries":
      return { bg: "bg-[#FCE4EC]", text: "text-[#C2185B]", title: "text-[#880E4F]", dot: "bg-[#C2185B]" }; // Pink
    case "holidays":
      return { bg: "bg-[#E8F5E9]", text: "text-[#2E7D32]", title: "text-[#1B5E20]", dot: "bg-[#2E7D32]" }; // Green
    default:
      return { bg: "bg-[#E3F2FD]", text: "text-[#1976D2]", title: "text-[#0D47A1]", dot: "bg-[#1976D2]" }; // Blue
  }
}

function getLocalDayKey(dateStr: string): string {
  if (!dateStr.includes('T')) {
    // All-day event: use the date string exactly as-is
    return dateStr;
  }
  // Timed event: convert to local date
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

  // Mini-calendar month logic
  const today = new Date();
  const todayKey = getLocalDayKey(today.toISOString());

  let activeMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  if (month) {
    const [y, m] = month.split('-');
    activeMonthDate = new Date(parseInt(y), parseInt(m) - 1, 1);
  }

  // Filter events based on selected category ONLY
  const activeCategory = category || "all";
  const filteredEvents = allEvents.filter(ev => {
    if (activeCategory === "all") return true;
    return getNormalizedCategory(ev.occasion) === activeCategory;
  });

  // Group filtered events by date string
  const eventsByDate = new Map<string, typeof allEvents>();
  for (const ev of filteredEvents) {
    const key = getLocalDayKey(ev.start);
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key)!.push(ev);
  }

  const uniqueDayKeys = Array.from(eventsByDate.keys()).sort();

  // Group ALL events for the mini calendar
  const allEventsByDate = new Map<string, typeof allEvents>();
  for (const ev of allEvents) {
    const key = getLocalDayKey(ev.start);
    if (!allEventsByDate.has(key)) allEventsByDate.set(key, []);
    allEventsByDate.get(key)!.push(ev);
  }

  const firstDayOfMonth = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth(), 1);
  const lastDayOfMonth = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() + 1, 0);
  
  const startOffset = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
  const daysInMonth = lastDayOfMonth.getDate();
  const prevMonthLastDay = new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth(), 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < startOffset; i++) {
    calendarDays.unshift({ day: prevMonthLastDay - i, isCurrentMonth: false, date: new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() - 1, prevMonthLastDay - i) });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, isCurrentMonth: true, date: new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth(), i) });
  }
  const remainingSlots = 42 - calendarDays.length; 
  for (let i = 1; i <= remainingSlots; i++) {
    calendarDays.push({ day: i, isCurrentMonth: false, date: new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() + 1, i) });
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
    <div className="flex h-screen overflow-hidden bg-[#F4F5F7] text-[--color-text]">
      
      <CalendarSidebarWrapper 
        profile={{
          name: name,
          email: user.email || "",
          initial: initial,
        }} 
        conversations={conversations} 
      />

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 bg-white overflow-y-auto">
        
        {/* TOP NAVBAR */}
        <header className="flex h-20 shrink-0 items-center justify-between px-8 pt-4 pb-2">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-[--color-text]">
              {activeCategory === 'all' ? 'All Upcoming Occasions' : `Upcoming ${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}`}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/" className="press-scale inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-[#F4F5F7] text-[--color-text-secondary] hover:text-[--color-text] hover:bg-black/5 transition-colors">
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
        </header>

        {/* HEADER AREA: Mini Calendar & Categories */}
        <div className="px-8 py-4 flex flex-col lg:flex-row gap-8 border-b border-black/5">
          {/* Mini Calendar Widget */}
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm w-full lg:w-80 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <Link href={prevUrl} className="press-scale flex h-7 w-7 items-center justify-center rounded-full text-[--color-text-tertiary] hover:bg-black/5 hover:text-[--color-text] transition-colors">&lt;</Link>
              <span className="font-semibold text-sm">{getMonthYear(activeMonthDate)}</span>
              <Link href={nextUrl} className="press-scale flex h-7 w-7 items-center justify-center rounded-full text-[--color-text-tertiary] hover:bg-black/5 hover:text-[--color-text] transition-colors">&gt;</Link>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-[--color-text-tertiary] mb-2">
              <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
            </div>
            <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center text-xs">
              {calendarDays.map((d, i) => {
                const dayKey = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}-${String(d.date.getDate()).padStart(2, '0')}`;
                const hasEvents = allEventsByDate.has(dayKey) && allEventsByDate.get(dayKey)!.length > 0;
                const isToday = dayKey === todayKey;
                
                const eventColors = hasEvents ? allEventsByDate.get(dayKey)!.slice(0, 3).map(ev => {
                   return getCardStyle(ev.occasion).dot;
                }) : [];

                return (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <button className={`press-scale flex h-6 w-6 items-center justify-center rounded-full transition-colors ${isToday ? "bg-[--color-primary] text-white font-bold" : d.isCurrentMonth ? "text-[--color-text-secondary] hover:bg-black/5 hover:text-[--color-text]" : "text-black/20 hover:bg-black/5"}`}>
                      {d.day}
                    </button>
                    <div className="flex gap-0.5 h-1">
                      {eventColors.map((color, idx) => (
                        <span key={idx} className={`h-1 w-1 rounded-full ${color}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Categories Horizontal Tabs */}
          <div className="flex flex-wrap gap-2 content-start pt-2">
            <Link href={getCatUrl('all')} className={`press-scale flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeCategory === 'all' ? 'bg-[--color-primary] text-white shadow-md' : 'bg-[#F4F5F7] text-[--color-text-secondary] hover:bg-black/5 hover:text-[--color-text]'}`}>
              <span className={`h-2 w-2 rounded-full ${activeCategory === 'all' ? 'bg-white' : 'bg-[--color-primary]'}`}></span>
              All Events
              <span className={`text-xs ml-1 ${activeCategory === 'all' ? 'opacity-90' : 'opacity-60'}`}>({allEvents.length})</span>
            </Link>
            <Link href={getCatUrl('birthdays')} className={`press-scale flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeCategory === 'birthdays' ? 'bg-[#5B3BC4] text-white shadow-md' : 'bg-[#F4F5F7] text-[--color-text-secondary] hover:bg-black/5 hover:text-[--color-text]'}`}>
              <span className={`h-2 w-2 rounded-full ${activeCategory === 'birthdays' ? 'bg-white' : 'bg-[#5B3BC4]'}`}></span>
              Birthdays
              <span className={`text-xs ml-1 ${activeCategory === 'birthdays' ? 'opacity-90' : 'opacity-60'}`}>({allEvents.filter(e => getNormalizedCategory(e.occasion) === 'birthdays').length})</span>
            </Link>
            <Link href={getCatUrl('anniversaries')} className={`press-scale flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeCategory === 'anniversaries' ? 'bg-[#C2185B] text-white shadow-md' : 'bg-[#F4F5F7] text-[--color-text-secondary] hover:bg-black/5 hover:text-[--color-text]'}`}>
              <span className={`h-2 w-2 rounded-full ${activeCategory === 'anniversaries' ? 'bg-white' : 'bg-[#C2185B]'}`}></span>
              Anniversaries
              <span className={`text-xs ml-1 ${activeCategory === 'anniversaries' ? 'opacity-90' : 'opacity-60'}`}>({allEvents.filter(e => getNormalizedCategory(e.occasion) === 'anniversaries').length})</span>
            </Link>
            <Link href={getCatUrl('holidays')} className={`press-scale flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeCategory === 'holidays' ? 'bg-[#2E7D32] text-white shadow-md' : 'bg-[#F4F5F7] text-[--color-text-secondary] hover:bg-black/5 hover:text-[--color-text]'}`}>
              <span className={`h-2 w-2 rounded-full ${activeCategory === 'holidays' ? 'bg-white' : 'bg-[#2E7D32]'}`}></span>
              Holidays
              <span className={`text-xs ml-1 ${activeCategory === 'holidays' ? 'opacity-90' : 'opacity-60'}`}>({allEvents.filter(e => getNormalizedCategory(e.occasion) === 'holidays').length})</span>
            </Link>
            <Link href={getCatUrl('other')} className={`press-scale flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeCategory === 'other' ? 'bg-[#1976D2] text-white shadow-md' : 'bg-[#F4F5F7] text-[--color-text-secondary] hover:bg-black/5 hover:text-[--color-text]'}`}>
              <span className={`h-2 w-2 rounded-full ${activeCategory === 'other' ? 'bg-white' : 'bg-[#1976D2]'}`}></span>
              Other
              <span className={`text-xs ml-1 ${activeCategory === 'other' ? 'opacity-90' : 'opacity-60'}`}>({allEvents.filter(e => getNormalizedCategory(e.occasion) === 'other').length})</span>
            </Link>
          </div>
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
          <div className="mx-8 glass-card flex flex-col items-center gap-4 rounded-3xl px-8 py-12 text-center animate-fade-up">
            <CalendarIcon className="h-10 w-10 text-[--color-text-tertiary] mb-2" />
            <h2 className="text-xl font-semibold">No calendar connected</h2>
            <p className="max-w-sm text-sm text-[--color-text-secondary]">
              Sign in with Google on the <Link href="/login" className="underline">login page</Link> to connect your calendar.
            </p>
          </div>
        )}

        {/* CALENDAR GRID */}
        {tokenRow && (
          <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin px-8 pb-8">
            <div className="flex h-full gap-4 min-w-max items-stretch">
              {uniqueDayKeys.length > 0 ? (() => {
                let currentMonthStr = "";
                const gridElements = [];

                for (const dayKey of uniqueDayKeys) {
                  const date = new Date(dayKey);
                  const isToday = dayKey === todayKey;
                  const dayEvents = eventsByDate.get(dayKey) || [];
                  const monthStr = getMonthYear(date);

                  // Inject a month separator if the month changes
                  if (monthStr !== currentMonthStr) {
                    currentMonthStr = monthStr;
                    gridElements.push(
                      <div key={`month-header-${monthStr}`} className="flex flex-col shrink-0 items-center justify-center w-20 h-full ml-2 mr-2 animate-fade-up">
                        <span className="text-2xl font-bold text-[--color-text-tertiary] [writing-mode:vertical-lr] rotate-180 opacity-40 tracking-widest uppercase flex items-center gap-4">
                          <span className="h-16 w-px bg-black/10"></span>
                          {monthStr}
                          <span className="h-16 w-px bg-black/10"></span>
                        </span>
                      </div>
                    );
                  }

                  gridElements.push(
                    <div key={dayKey} className="flex flex-col w-[260px] shrink-0 h-full animate-fade-up">
                      
                      {/* Day Column Header */}
                      <div className="flex flex-col items-center justify-center p-4 mb-4 rounded-2xl border border-black/5 bg-[#F9FAFB] shadow-sm">
                        <span className={`text-xs uppercase tracking-widest font-semibold ${isToday ? 'text-[--color-primary]' : 'text-[--color-text-tertiary]'}`}>
                          {getShortDay(date)}
                        </span>
                        <span className={`text-3xl font-medium mt-1 ${isToday ? 'text-[--color-primary]' : 'text-[--color-text]'}`}>
                          {getDayNum(date)}
                        </span>
                      </div>

                      {/* Day Events Column */}
                      <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-hide pb-10">
                        {dayEvents.map(ev => {
                          const style = getCardStyle(ev.occasion);
                          const chatPrompt = encodeURIComponent(`It's ${ev.summary} on ${formatDate(ev.start)}. Help me find a great gift.`);
                          const days = daysUntil(ev.start);
                          const cat = getNormalizedCategory(ev.occasion);
                          
                          return (
                            <div key={ev.id} className={`flex flex-col p-5 rounded-3xl transition-transform hover:-translate-y-1 ${style.bg}`}>
                              <div className="flex items-start justify-between mb-3">
                                <span className="text-2xl">{cat === 'birthdays' ? '🎂' : cat === 'anniversaries' ? '💐' : cat === 'holidays' ? '🎉' : '✨'}</span>
                                {days === 0 && (
                                  <span className="rounded-full bg-white/50 px-2 py-0.5 text-xs font-bold text-red-600">
                                    Today!
                                  </span>
                                )}
                              </div>
                              <h4 className={`text-lg font-bold leading-tight mb-1 ${style.title}`}>
                                {ev.summary}
                              </h4>
                              <p className={`text-xs font-medium uppercase tracking-wider mb-5 ${style.text}`}>
                                {ev.occasion}
                              </p>
                              
                              <Link
                                href={`/?q=${chatPrompt}`}
                                className="mt-auto flex items-center justify-center gap-1.5 rounded-full bg-white/60 px-4 py-2.5 text-sm font-semibold hover:bg-white transition-colors text-[--color-text]"
                              >
                                <SparkleIcon className="h-4 w-4 text-[--color-primary]" />
                                Find a gift
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return gridElements;
              })() : (
                <div className="flex w-full items-center justify-center mt-20 animate-fade-up">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5">
                      <CalendarIcon className="h-6 w-6 text-[--color-text-tertiary]" />
                    </div>
                    <h3 className="text-lg font-medium">No upcoming {activeCategory === 'all' ? 'events' : activeCategory}</h3>
                    <p className="text-sm text-[--color-text-tertiary]">There are no {activeCategory === 'all' ? 'events' : activeCategory} scheduled in the next 365 days.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
