import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ConversationSummary } from "@/lib/supabase/conversations";
import type { Profile } from "./Navbar";
import {
  ArrowUpRightIcon,
  CalendarIcon,
  ChatBubbleIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  GoogleIcon,
  HamburgerIcon,
  LogoutIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
} from "./icons";
import { SettingsModal } from "./SettingsModal";

const railIconButton =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[--color-text-secondary] transition-all duration-200 hover:bg-[--color-primary]/8 hover:text-[--color-text] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

const STATIC_NAV_ITEMS = [
  { label: "Recipients", icon: UsersIcon, href: "/recipients" },
  { label: "My Gifts", icon: ClockIcon, href: "/my-gifts" },
];

// Removed groupConversationsByDate as we now use a flat list under "Chat History"

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
  onDeleteConversation?: (id: string) => void;
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
  onDeleteConversation,
  onLogout,
}: SidebarProps) {

  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setModalOpen(false);
        setSettingsModalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const openProfileModal = () => {
    setMenuOpen(false);
    setModalOpen(true);
  };

  const openSettingsModal = () => {
    setMenuOpen(false);
    setSettingsModalOpen(true);
  };

  const renderUserMenuPopover = (positionClass: string) =>
    signedIn &&
    profile &&
    menuOpen && (
      <div className={`absolute z-50 w-64 rounded-2xl border border-[--color-border] bg-white/95 backdrop-blur-xl p-2 text-[--color-text] shadow-xl animate-scale-in ${positionClass}`}>
        {/* Top User Lockup */}
        <button
          type="button"
          onClick={openProfileModal}
          className="flex w-full items-center justify-between gap-3 rounded-xl p-2.5 text-left transition-colors duration-150 hover:bg-[--color-surface]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-200 to-rose-300 text-sm font-bold text-amber-900">
              {profile.initial}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-[--color-text]">{profile.name}</span>
              <span className="truncate text-xs text-[--color-text-tertiary]">{profile.email || "Free Account"}</span>
            </div>
          </div>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-[--color-text-tertiary]" />
        </button>

        <div className="my-1.5 h-px bg-[--color-border]" />

        {/* Menu Options */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={openProfileModal}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[--color-text] transition-colors duration-150 hover:bg-[--color-surface]"
          >
            <UserIcon className="h-4 w-4 text-[--color-text-secondary]" />
            Profile
          </button>
          <button
            type="button"
            onClick={openSettingsModal}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[--color-text] transition-colors duration-150 hover:bg-[--color-surface]"
          >
            <SettingsIcon className="h-4 w-4 text-[--color-text-secondary]" />
            Settings
          </button>
        </div>

        <div className="my-1.5 h-px bg-[--color-border]" />

        {/* Log out option */}
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            onLogout();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[--color-error] transition-colors duration-150 hover:bg-red-50"
        >
          <LogoutIcon className="h-4 w-4 text-[--color-error]" />
          Log out
        </button>
      </div>
    );

  const profileModal = modalOpen && profile && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-[--color-border] bg-white p-7 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-[--color-text]">Profile</h2>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[--color-text-secondary] transition-colors duration-150 hover:bg-[--color-primary]/8"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-4 rounded-2xl bg-[--color-surface] p-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-200 to-rose-300 text-xl font-bold text-amber-900 shadow-sm">
            {profile.initial}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-lg font-semibold text-[--color-text]">{profile.name}</span>
            <span className="truncate text-sm text-[--color-text-secondary]">{profile.email || "No email linked"}</span>
            <span className="mt-1.5 inline-flex w-max items-center rounded-full bg-[--color-accent-lavender]/30 px-3 py-1 text-xs font-semibold text-[--color-primary]">
              Free Plan
            </span>
          </div>
        </div>

        {/* Account Details */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[--color-text-tertiary]">Integrations & Services</h3>

          <div className="flex items-center justify-between rounded-xl border border-[--color-border] p-4 transition-colors duration-150 hover:border-[--color-border-hover]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--color-surface]">
                <GoogleIcon className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[--color-text]">Google Calendar</span>
                <span className="text-xs text-[--color-text-tertiary]">Sync upcoming gift occasions</span>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Connected
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="gradient-button press-scale rounded-full px-6 py-2.5 text-sm font-semibold text-[--color-text-inverse]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (!open) {
    return (
      <>
        {profileModal}
        <SettingsModal open={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} profile={profile} />
        <aside className="glass-panel flex w-16 shrink-0 flex-col items-center gap-1.5 pb-5 pt-3 transition-[width] duration-300 ease-in-out">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Open sidebar"
            className="group relative mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:bg-[--color-primary]/8"
          >
            <Image
              src="/logo.png"
              alt="Memento"
              width={28}
              height={28}
              className="h-7 w-7 object-contain transition-opacity duration-150 group-hover:opacity-0"
              priority
            />
            <span className="absolute inset-0 flex items-center justify-center text-[--color-text-secondary] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <HamburgerIcon />
            </span>
          </button>
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
            <div ref={menuRef} className="relative">
              {renderUserMenuPopover("bottom-12 left-14")}
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                title={profile.name}
                aria-label={`Account: ${profile.name}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[--color-primary] text-sm font-semibold text-[--color-text-inverse] transition-all duration-200 hover:shadow-md active:scale-95"
              >
                {profile.initial}
              </button>
            </div>
          )}
        </aside>
      </>
    );
  }

  return (
    <>
      {profileModal}
      <SettingsModal open={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} profile={profile} />
      <aside className="glass-panel flex w-72 shrink-0 flex-col transition-[width] duration-300 ease-in-out">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto scrollbar-thin px-4 pb-5 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Memento"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
              <span className="text-lg font-bold tracking-wide text-[--color-text]">
                Memento
              </span>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Close sidebar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[--color-text-secondary] transition-all duration-200 hover:bg-[--color-primary]/8"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>


          <nav className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onNewChat}
              disabled={newChatDisabled}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-[--color-text] transition-all duration-200 hover:bg-[--color-surface] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusIcon className="h-[18px] w-[18px] text-[--color-text-secondary]" />
              New Chat
            </button>
            <Link
              href="/calendar"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[--color-text] transition-all duration-200 hover:bg-[--color-surface]"
            >
              <CalendarIcon className="h-[18px] w-[18px] text-[--color-text-secondary]" />
              Upcoming Events
            </Link>
            {STATIC_NAV_ITEMS.map(({ label, icon: Icon, href }) => (
              <Link
                href={href}
                key={label}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[--color-text-secondary] transition-all duration-200 hover:bg-[--color-surface] hover:text-[--color-text]"
              >
                <Icon className="h-[18px] w-[18px] text-[--color-text-tertiary]" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-4 px-0.5">
            {!signedIn ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-tertiary]">
                  Chat History
                </span>
                <p className="py-2 text-sm text-[--color-text-tertiary]">
                  <Link href="/login" className="font-semibold text-[--color-text] transition-colors hover:text-[--color-primary-muted]">
                    Log in
                  </Link>{" "}
                  to save your chats.
                </p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-tertiary]">
                  Chat History
                </span>
                <p className="py-2 text-sm text-[--color-text-tertiary]">No chats yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="px-1 pb-1 text-xs font-semibold uppercase tracking-wider text-[--color-text-tertiary]">
                  Chat History
                </span>
                <div className="flex flex-col gap-0.5">
                  {conversations.map((c) => (
                    <div key={c.id} className={`group flex items-center justify-between gap-1 rounded-xl pr-1 transition-all duration-200 ${
                      c.id === activeConversationId
                        ? "bg-[--color-surface] font-medium text-[--color-text] shadow-sm"
                        : "hover:bg-[--color-surface]/60"
                    }`}>
                      <button
                        type="button"
                        onClick={() => onSelectConversation(c.id)}
                        className={`flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-sm ${
                          c.id === activeConversationId
                            ? ""
                            : "text-[--color-text-secondary] group-hover:text-[--color-text]"
                        }`}
                      >
                        <ArrowUpRightIcon className="h-3.5 w-3.5 shrink-0 text-[--color-text-tertiary]" />
                        <span className="truncate">{c.title}</span>
                      </button>
                      {onDeleteConversation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(c.id);
                          }}
                          className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[--color-text-tertiary] transition-colors hover:bg-red-50 hover:text-red-500 group-hover:flex"
                          aria-label="Delete chat"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {signedIn && profile && (
          <div ref={menuRef} className="relative shrink-0 border-t border-[--color-border] px-3 py-3">
            {renderUserMenuPopover("bottom-14 left-3")}
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={`Account menu for ${profile.name}`}
              className="flex w-full items-center justify-between gap-2.5 rounded-xl p-2 text-left transition-all duration-200 hover:bg-[--color-primary]/5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-200 to-rose-300 text-sm font-bold text-amber-900 shadow-sm">
                  {profile.initial}
                </div>
                <span className="truncate text-sm font-semibold text-[--color-text]">{profile.name}</span>
              </div>
              <ChevronRightIcon className={`h-4 w-4 shrink-0 text-[--color-text-tertiary] transition-transform duration-200 ${menuOpen ? "-rotate-90" : ""}`} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
