import Image from "next/image";
import Link from "next/link";
import type { ConversationSummary } from "@/lib/supabase/conversations";
import type { Profile } from "./Navbar";
import {
  ArrowUpRightIcon,
  CalendarIcon,
  ChatBubbleIcon,
  ClockIcon,
  CloseIcon,
  HamburgerIcon,
  LogoutIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from "./icons";

const railIconButton =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#034F46]/70 transition hover:bg-[#034F46]/10 hover:text-[#034F46] disabled:cursor-not-allowed disabled:opacity-40";

// Display-only for now — visual placeholders, not wired to real functionality yet.
const STATIC_NAV_ITEMS = [
  { label: "Recipients", icon: UsersIcon },
  { label: "Gift Timeline", icon: ClockIcon },
];

function groupConversationsByDate(conversations: ConversationSummary[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groups: { label: string; items: ConversationSummary[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 Days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const c of conversations) {
    const updatedAt = new Date(c.updated_at);
    if (updatedAt >= startOfToday) groups[0].items.push(c);
    else if (updatedAt >= startOfYesterday) groups[1].items.push(c);
    else if (updatedAt >= sevenDaysAgo) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

type SidebarProps = {
  open: boolean;
  onToggle: () => void;
  signedIn: boolean;
  profile: Profile | null;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  newChatDisabled: boolean;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onLogout: () => void;
};

export function Sidebar({
  open,
  onToggle,
  signedIn,
  profile,
  conversations,
  activeConversationId,
  newChatDisabled,
  onNewChat,
  onSelectConversation,
  onLogout,
}: SidebarProps) {
  const groupedConversations = groupConversationsByDate(conversations);

  const logoButton = open ? (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center">
      <Image src="/logo.png" alt="Memento" width={28} height={28} className="h-7 w-7 object-contain" priority />
    </div>
  ) : (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Open sidebar"
      className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition hover:bg-[#034F46]/10"
    >
      <Image
        src="/logo.png"
        alt="Memento"
        width={28}
        height={28}
        className="h-7 w-7 object-contain transition-opacity duration-150 group-hover:opacity-0"
        priority
      />
      <span className="absolute inset-0 flex items-center justify-center text-[#034F46]/70 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <HamburgerIcon />
      </span>
    </button>
  );

  const brandLockup = (
    <>
      <div className="fixed left-3 top-3 z-50">{logoButton}</div>
      <span
        className={`fixed top-3 z-50 text-lg font-bold uppercase tracking-wide text-[#034F46] transition-[left] duration-300 ease-in-out ${
          open ? "left-[300px]" : "left-[76px]"
        }`}
      >
        Memento
      </span>
    </>
  );

  if (!open) {
    return (
      <>
        {brandLockup}
        <aside className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-[#034F46]/10 bg-white pb-5 pt-16 transition-[width] duration-300 ease-in-out">
          <button
            type="button"
            onClick={onNewChat}
            disabled={newChatDisabled}
            title="New Chat"
            aria-label="New Chat"
            className={railIconButton}
          >
            <PlusIcon className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            title="Search"
            aria-label="Search"
            className={railIconButton}
          >
            <SearchIcon className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            title="Chat History"
            aria-label="Chat History"
            className={railIconButton}
          >
            <ChatBubbleIcon className="h-[18px] w-[18px]" />
          </button>
          <Link href="/calendar" title="Calendar" aria-label="Calendar" className={railIconButton}>
            <CalendarIcon className="h-[18px] w-[18px]" />
          </Link>

          <div className="flex-1" />

          {signedIn && profile && (
            <button
              type="button"
              onClick={onToggle}
              title={profile.name}
              aria-label={`Account: ${profile.name}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#034F46] text-sm font-semibold text-[#FFFFEB] transition hover:brightness-110"
            >
              {profile.initial}
            </button>
          )}
        </aside>
      </>
    );
  }

  return (
    <>
      {brandLockup}
      <aside className="flex w-72 shrink-0 flex-col border-r border-[#034F46]/10 bg-white transition-[width] duration-300 ease-in-out">
      <div className="flex w-72 min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-5 pt-3">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Close sidebar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#034F46]/70 transition hover:bg-[#034F46]/10"
          >
            <CloseIcon />
          </button>
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
            className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#FFFFEB] px-3.5 py-2.5 text-left text-sm font-medium text-[#034F46] transition hover:bg-[#FFFFEB]/70 disabled:cursor-not-allowed disabled:opacity-50"
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

        <div className="flex flex-col gap-4 px-1">
          {!signedIn ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#034F46]/45">
                Chat History
              </span>
              <p className="px-1 py-2 text-sm text-[#034F46]/50">
                <Link href="/login" className="font-medium text-[#034F46] hover:underline">
                  Log in
                </Link>{" "}
                to save your chats.
              </p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#034F46]/45">
                Chat History
              </span>
              <p className="px-1 py-2 text-sm text-[#034F46]/45">No chats yet.</p>
            </div>
          ) : (
            groupedConversations.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <span className="px-1 text-xs font-semibold uppercase tracking-wide text-[#034F46]/45">
                  {group.label}
                </span>
                <div className="flex flex-col">
                  {group.items.map((c) => (
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
              </div>
            ))
          )}
        </div>
      </div>

      {signedIn && profile && (
        <div className="flex w-72 shrink-0 items-center justify-between gap-2 border-t border-[#034F46]/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#034F46] text-sm font-semibold text-[#FFFFEB]">
              {profile.initial}
            </div>
            <span className="truncate text-sm font-medium text-[#034F46]">{profile.name}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#034F46]/60 transition hover:bg-[#034F46]/10 hover:text-[#034F46]"
          >
            <LogoutIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}
      </aside>
    </>
  );
}
