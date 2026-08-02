import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ConversationSummary } from "@/lib/supabase/conversations";
import { ProfileModal } from "./ProfileModal";
import type { Profile } from "./Navbar";
import {
  ArrowUpRightIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  HamburgerIcon,
  LogoutIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  HeartIcon,
} from "./icons";


const railIconButton =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[--color-text-secondary] transition-all duration-200 hover:bg-[--color-primary]/8 hover:text-[--color-text] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

const STATIC_NAV_ITEMS = [
  { label: "Wishlist", icon: HeartIcon, href: "/wishlist" },
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

  const renderUserMenuPopover = (positionClass: string) =>
    signedIn &&
    profile &&
    menuOpen && (
      <div className={`absolute z-50 w-52 rounded-2xl bg-white p-1.5 text-[--color-text] shadow-[0_12px_32px_rgba(0,0,0,0.14)] ring-1 ring-black/[0.04] animate-scale-in ${positionClass}`}>
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

  const profileModal = (
    <ProfileModal open={modalOpen} onClose={() => setModalOpen(false)} profile={profile} />
  );

  if (!open) {
    return (
      <>
        {profileModal}
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
          {/* Mirrors the expanded nav exactly — same icons, same order. The
              static items are mapped from one array so the two can't drift. */}
          <Link href="/calendar" title="Upcoming Events" aria-label="Upcoming Events" className={railIconButton}>
            <CalendarIcon className="h-[18px] w-[18px]" />
          </Link>
          {STATIC_NAV_ITEMS.map(({ label, icon: Icon, href }) => (
            <Link key={label} href={href} title={label} aria-label={label} className={railIconButton}>
              <Icon className="h-[18px] w-[18px]" />
            </Link>
          ))}

          <div className="flex-1" />

          {signedIn && profile && (
            <div ref={menuRef} className="relative">
              {renderUserMenuPopover("bottom-12 left-14")}
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                title={profile.name}
                aria-label={`Account: ${profile.name}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-200 to-rose-300 text-sm font-bold text-amber-900 transition-all duration-200 hover:shadow-md active:scale-95"
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
      <aside className="glass-panel flex w-72 shrink-0 flex-col transition-[width] duration-300 ease-in-out">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto scrollbar-thin px-4 pb-5 pt-3">
          <div className="flex items-center justify-between">
            {/* Wordmark doubles as the home link from any screen. */}
            <Link
              href="/"
              aria-label="Memento — go to home"
              className="flex items-center gap-2.5 rounded-xl px-1 py-0.5 transition-opacity duration-150 hover:opacity-70"
            >
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
            </Link>
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
