"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/app/components/Modal";
import { SparkleIcon, CakeIcon, HeartIcon, PartyPopperIcon, StarIcon } from "@/app/components/icons";
import { getCardStyle, formatDate, daysUntil, getNormalizedCategory } from "./utils";

type CalendarEvent = {
  id: string;
  summary: string;
  occasion: string;
  start: string;
};

type CalendarDay = {
  day: number;
  isCurrentMonth: boolean;
  dateKey: string;
};

type CalendarViewProps = {
  calendarDays: CalendarDay[];
  eventsByDateKey: Record<string, CalendarEvent[]>;
};

export function CalendarView({ calendarDays, eventsByDateKey }: CalendarViewProps) {
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // The modal plays a ~1s exit after selectedDateKey clears, so hold on to the
  // last selection — otherwise the card empties out while the mascot is still
  // climbing back down.
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (selectedDateKey && selectedDateKey !== lastKey) setLastKey(selectedDateKey);
  const shownKey = selectedDateKey ?? lastKey;

  const selectedEvents = shownKey ? eventsByDateKey[shownKey] || [] : [];
  const selectedDateObj = shownKey ? new Date(shownKey) : null;

  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <>
      <div className="flex-1 p-6 flex flex-col min-h-0 bg-[#F9FAFB]">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-3 mb-2 text-center text-xs font-semibold text-[--color-text-tertiary] uppercase tracking-widest shrink-0">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Large Calendar Grid */}
        <div className="grid grid-cols-7 gap-3 flex-1 min-h-0">
          {calendarDays.map((d, i) => {
            const hasEvents = !!eventsByDateKey[d.dateKey] && eventsByDateKey[d.dateKey].length > 0;
            const dayEvents = eventsByDateKey[d.dateKey] || [];
            const isToday = d.dateKey === todayKey;

            return (
              <div
                key={i}
                onClick={() => {
                  if (hasEvents) setSelectedDateKey(d.dateKey);
                }}
                className={`flex flex-col p-2.5 rounded-2xl border bg-white transition-all duration-200 overflow-hidden
                  ${d.isCurrentMonth ? 'text-[--color-text]' : 'text-black/30 bg-black/5'}
                  ${isToday ? 'bg-[#F0F4FF] border-[#D6E4FF]' : 'border-black/5'}
                  ${hasEvents ? 'cursor-pointer hover:-translate-y-1 hover:shadow-md hover:border-black/10' : ''}
                `}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-semibold flex h-7 w-7 items-center justify-center rounded-full
                    ${isToday ? 'bg-[--color-primary] text-white' : ''}
                  `}>
                    {d.day}
                  </span>
                </div>
                
                <div className="flex flex-col gap-1.5 flex-1 justify-end">
                  {dayEvents.slice(0, 2).map((ev) => {
                    const style = getCardStyle(ev.occasion);
                    return (
                      <div key={ev.id} className="flex items-center gap-1.5 text-[11px] font-medium leading-none px-1.5 py-1 rounded bg-[#F4F5F7] truncate">
                        <span>{style.symbol}</span>
                        <span className="truncate">{ev.summary}</span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <div className="text-[10px] font-semibold text-[--color-text-tertiary] px-1.5 mt-0.5">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Details Modal */}
      <Modal
        open={!!selectedDateKey}
        onClose={() => setSelectedDateKey(null)}
        label="Day details"
        width={448}
        cardStyle={{ padding: "76px 24px 24px", maxHeight: "65vh" }}
      >
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Dismiss by clicking the scrim or pressing Escape — no close button. */}
            <div className="mb-5 shrink-0">
              <h2 className="text-2xl font-bold">
                {selectedDateObj?.toLocaleDateString("en-US", { month: "long", day: "numeric" }) ?? ""}
                {selectedDateObj && (
                  <span className="font-semibold text-[--color-text-secondary]">
                    , {selectedDateObj.toLocaleDateString("en-US", { weekday: "long" })}
                  </span>
                )}
              </h2>
            </div>

            {/* scrollbar-hide keeps the scroll but drops the visible track. The
                mask only kicks in when there's more than one event, so a single
                card never fades at the bottom for no reason. */}
            <div
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scrollbar-hide pb-4"
              style={
                selectedEvents.length > 1
                  ? {
                      maskImage: "linear-gradient(to bottom, #000 calc(100% - 28px), transparent 100%)",
                      WebkitMaskImage: "linear-gradient(to bottom, #000 calc(100% - 28px), transparent 100%)",
                    }
                  : undefined
              }
            >
              {selectedEvents.map(ev => {
                const style = getCardStyle(ev.occasion);
                const chatPrompt = encodeURIComponent(`It's ${ev.summary} on ${formatDate(ev.start)}. Help me find a great gift.`);
                const days = daysUntil(ev.start);
                const cat = getNormalizedCategory(ev.occasion);
                
                const IconComponent = cat === 'birthdays' ? CakeIcon : cat === 'anniversaries' ? HeartIcon : cat === 'holidays' ? PartyPopperIcon : StarIcon;

                return (
                  <div key={ev.id} className={`flex flex-col p-5 rounded-2xl ${style.bg} border border-white/40 shadow-sm`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-2.5 rounded-xl bg-white/60 shadow-sm ${style.text}`}>
                        <IconComponent className="h-6 w-6" />
                      </div>
                      {days === 0 ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-red-600 shadow-sm">
                          Today!
                        </span>
                      ) : (
                        <span className="rounded-full bg-white/50 px-3 py-1 text-xs font-semibold text-black/60">
                          In {days} Days
                        </span>
                      )}
                    </div>
                    
                    <h4 className={`text-lg font-bold leading-tight mb-4 ${style.title}`}>
                      {ev.summary}
                    </h4>

                    <div className="flex items-center gap-2 mt-auto pt-4 border-t border-black/5">
                      <Link
                        href={`/?q=${chatPrompt}`}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold hover:bg-white/90 transition-colors text-[--color-text] shadow-sm"
                        onClick={() => setSelectedDateKey(null)}
                      >
                        <SparkleIcon className="h-4 w-4 text-[--color-primary]" />
                        Find Gift
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
      </Modal>
    </>
  );
}
