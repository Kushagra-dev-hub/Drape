import Link from "next/link";
import { HamburgerIcon } from "./icons";

type NavbarProps = {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
};

export function Navbar({ sidebarOpen, onToggleSidebar }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 flex shrink-0 items-center justify-between bg-transparent px-4 py-3 sm:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Open sidebar"
        tabIndex={sidebarOpen ? -1 : 0}
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-[#034F46]/70 transition hover:bg-[#034F46]/10 ${
          sidebarOpen ? "invisible" : ""
        }`}
      >
        <HamburgerIcon />
      </button>

      <span className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold tracking-tight text-[#034F46]">
        Memento
      </span>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/login"
          className="rounded-full px-3.5 py-2 text-sm font-medium text-[#034F46]/70 transition hover:text-[#034F46]"
        >
          Login
        </Link>
        <button
          type="button"
          className="rounded-full bg-[#F0D7FF] px-4 py-2 text-sm font-semibold text-[#034F46] transition hover:brightness-95"
        >
          Get Started
        </button>
      </div>
    </header>
  );
}
