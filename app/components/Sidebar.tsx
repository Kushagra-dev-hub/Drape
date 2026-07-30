import Image from "next/image";
import Link from "next/link";
import type { ConversationSummary } from "@/lib/supabase/conversations";
import { ArrowUpRightIcon, CalendarIcon, ClockIcon, CloseIcon, PlusIcon, SearchIcon, UsersIcon } from "./icons";

// Display-only for now — visual placeholders, not wired to real functionality yet.
const STATIC_NAV_ITEMS = [
  { label: "Recipients", icon: UsersIcon },
  { label: "Gift Timeline", icon: ClockIcon },
];

type SidebarProps = {
  open: boolean;
  onToggle: () => void;
  signedIn: boolean;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  newChatDisabled: boolean;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
};

export function Sidebar({
  open,
  onToggle,
  signedIn,
  conversations,
  activeConversationId,
  newChatDisabled,
  onNewChat,
  onSelectConversation,
}: SidebarProps) {
  return (
    <aside
      className={`flex shrink-0 flex-col overflow-hidden border-[#034F46]/10 bg-white transition-[width,opacity,border-color] duration-300 ease-in-out ${
        open ? "w-72 border-r opacity-100" : "w-0 border-r-0 opacity-0"
      }`}
    >
      <div className="flex w-72 flex-col gap-6 px-4 py-5">
        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Close sidebar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#034F46]/70 transition hover:bg-[#034F46]/10"
          >
            <CloseIcon />
          </button>
          <div className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#034F46]">
            <Image src="/logo.png" alt="Memento" width={40} height={40} className="h-10 w-auto" priority />
            <span>Memento</span>
          </div>
        </div>

        <div className="flex cursor-default items-center gap-2 rounded-full border border-[#034F46]/10 bg-[#FFFFEB]/60 px-3.5 py-2 text-sm text-[#034F46]/45">
          <SearchIcon className="h-4 w-4 shrink-0 text-[#034F46]/40" />
          Search
        </div>

        <nav className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onNewChat}
            disabled={newChatDisabled}
            className="flex items-center gap-3 rounded-xl bg-[#FFFFEB] px-3.5 py-2.5 text-left text-sm font-medium text-[#034F46] transition hover:bg-[#FFFFEB]/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="h-[18px] w-[18px] text-[#034F46]/70" />
            New Chat
          </button>
          <Link
            href="/calendar"
            className="flex items-center gap-3 rounded-xl bg-[#FFFFEB] px-3.5 py-2.5 text-sm font-medium text-[#034F46] transition hover:bg-[#FFFFEB]/70"
          >
            <CalendarIcon className="h-[18px] w-[18px] text-[#034F46]/70" />
            Calendar
          </Link>
          {STATIC_NAV_ITEMS.map(({ label, icon: Icon }) => (
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

          {!signedIn ? (
            <p className="px-2 py-2 text-sm text-[#034F46]/50">
              <Link href="/login" className="font-medium text-[#034F46] hover:underline">
                Log in
              </Link>{" "}
              to save your chats.
            </p>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-2 text-sm text-[#034F46]/45">No chats yet.</p>
          ) : (
            <div className="flex flex-col">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectConversation(c.id)}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                    c.id === activeConversationId
                      ? "bg-[#FFFFEB] font-medium text-[#034F46]"
                      : "text-[#034F46]/70 hover:bg-[#FFFFEB]/60"
                  }`}
                >
                  <ArrowUpRightIcon className="h-3.5 w-3.5 shrink-0 text-[#034F46]/40" />
                  <span className="truncate">{c.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
