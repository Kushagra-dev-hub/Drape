export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export function getMonthYear(d: Date = new Date()) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function getShortDay(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short" }); // Mon, Tue
}

export function getDayNum(d: Date) {
  return d.getDate();
}

export function daysUntil(iso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getNormalizedCategory(occasion: string) {
  const kw = occasion.toLowerCase();
  if (['birthday', 'bday', 'b-day'].includes(kw)) return 'birthdays';
  if (['anniversary', 'wedding'].includes(kw)) return 'anniversaries';
  if (['diwali', 'christmas', 'eid', 'onam', 'pongal', 'navratri', 'raksha bandhan', 'holi', 'thanksgiving', 'halloween'].includes(kw)) return 'holidays';
  return 'other';
}

// Pastel color mapping for occasions
export function getCardStyle(occasion: string) {
  const category = getNormalizedCategory(occasion);
  switch (category) {
    case "birthdays":
      return { bg: "bg-[#EAE4FC]", text: "text-[#5B3BC4]", title: "text-[#3D258A]", dot: "bg-[#5B3BC4]", symbol: '🟣', icon: '🎂' }; // Lavender
    case "anniversaries":
      return { bg: "bg-[#FCE4EC]", text: "text-[#C2185B]", title: "text-[#880E4F]", dot: "bg-[#C2185B]", symbol: '🩷', icon: '💍' }; // Pink
    case "holidays":
      return { bg: "bg-[#E8F5E9]", text: "text-[#2E7D32]", title: "text-[#1B5E20]", dot: "bg-[#2E7D32]", symbol: '🟢', icon: '🎉' }; // Green
    default:
      return { bg: "bg-[#E3F2FD]", text: "text-[#1976D2]", title: "text-[#0D47A1]", dot: "bg-[#1976D2]", symbol: '🔵', icon: '✨' }; // Blue
  }
}

export function getLocalDayKey(dateStr: string): string {
  if (!dateStr.includes('T')) {
    // All-day event: use the date string exactly as-is
    return dateStr;
  }
  // Timed event: convert to local date
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
