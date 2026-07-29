import { ArrowUpRightIcon, ClockIcon, PanelIcon, PlusIcon, SearchIcon, UsersIcon } from "./icons";

// Display-only for now — visual placeholders, not wired to real functionality yet.
const NAV_ITEMS = [
  { label: "New Chat", icon: PlusIcon },
  { label: "Recipients", icon: UsersIcon },
  { label: "Gift Timeline", icon: ClockIcon },
];

const CHAT_HISTORY = [
  "Sara's birthday gift",
  "Mom's Mother's Day gift",
  "Coworker farewell gift",
  "Girlfriend's anniversary",
];

export function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-6 border-r border-[#034F46]/10 bg-white px-4 py-5 md:flex">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#034F46]">
          <span>🎁</span>
          <span>Memento</span>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[#034F46]/50">
          <PanelIcon />
        </span>
      </div>

      <div className="flex cursor-default items-center gap-2 rounded-full border border-[#034F46]/10 bg-[#FFFFEB]/60 px-3.5 py-2 text-sm text-[#034F46]/45">
        <SearchIcon className="h-4 w-4 shrink-0 text-[#034F46]/40" />
        Search
      </div>

      <nav className="flex flex-col gap-2">
        {NAV_ITEMS.map(({ label, icon: Icon }) => (
          <span
            key={label}
            className="flex cursor-default items-center gap-3 rounded-xl bg-[#FFFFEB] px-3.5 py-2.5 text-sm font-medium text-[#034F46]"
          >
            <Icon className="h-[18px] w-[18px] text-[#034F46]/70" />
            {label}
          </span>
        ))}
      </nav>

      <div className="flex flex-col gap-1 px-1">
        <div className="flex items-center justify-between py-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#034F46]/45">
            Chat History
          </span>
          <ArrowUpRightIcon className="h-3.5 w-3.5 text-[#034F46]/35" />
        </div>
        <div className="flex flex-col">
          {CHAT_HISTORY.map((item) => (
            <span
              key={item}
              className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#034F46]/70"
            >
              <ArrowUpRightIcon className="h-3.5 w-3.5 shrink-0 text-[#034F46]/40" />
              <span className="truncate">{item}</span>
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
