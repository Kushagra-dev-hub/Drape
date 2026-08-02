import { useState } from "react";
import { Modal } from "./Modal";
import type { Profile } from "./Navbar";
import {
  SettingsIcon,
  SparkleIcon,
  PanelIcon,
  UserIcon,
  GoogleIcon,
} from "./icons";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
};

type TabId = "general" | "preferences" | "integrations" | "account";

export function SettingsModal({ open, onClose, profile }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const TABS = [
    { id: "general" as const, label: "General", icon: SettingsIcon },
    { id: "preferences" as const, label: "Preferences", icon: SparkleIcon },
    { id: "integrations" as const, label: "Integrations", icon: PanelIcon },
    { id: "account" as const, label: "Account", icon: UserIcon },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Settings"
      width={896}
      cardStyle={{ padding: "76px 0 0", height: 600, maxHeight: "65vh" }}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="flex w-64 shrink-0 flex-col border-r border-[--color-border] bg-[--color-surface]/30">
          <div className="p-6">
            <h2 className="text-lg font-bold tracking-tight text-[--color-text]">Settings</h2>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${
                  activeTab === tab.id
                    ? "bg-[--color-surface] text-[--color-text] shadow-sm"
                    : "text-[--color-text-secondary] hover:bg-[--color-surface]/50 hover:text-[--color-text]"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        {/* Dismiss by clicking the scrim or pressing Escape — no close button. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-10 pb-10 pt-4">
            {activeTab === "general" && (
              <div className="flex flex-col gap-8 animate-fade-in">
                <h3 className="text-xl font-bold text-[--color-text]">General</h3>
                
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-[--color-text]">Appearance</span>
                      <span className="text-sm text-[--color-text-secondary]">Choose your preferred theme</span>
                    </div>
                    <select className="rounded-lg border border-[--color-border] bg-white px-3 py-1.5 text-sm outline-none focus-visible:border-[--color-primary] focus-visible:ring-1 focus-visible:ring-[--color-primary]">
                      <option>System Default</option>
                      <option>Light Mode</option>
                      <option>Dark Mode</option>
                    </select>
                  </div>
                  
                  <div className="h-px bg-[--color-border]" />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-[--color-text]">Language</span>
                      <span className="text-sm text-[--color-text-secondary]">Select your preferred language</span>
                    </div>
                    <select className="rounded-lg border border-[--color-border] bg-white px-3 py-1.5 text-sm outline-none focus-visible:border-[--color-primary] focus-visible:ring-1 focus-visible:ring-[--color-primary]">
                      <option>English (US)</option>
                      <option>Hindi</option>
                      <option>Spanish</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "preferences" && (
              <div className="flex flex-col gap-8 animate-fade-in">
                <h3 className="text-xl font-bold text-[--color-text]">Preferences</h3>
                
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-[--color-text]">Default Currency</span>
                      <span className="text-sm text-[--color-text-secondary]">Set the currency for gift budgets</span>
                    </div>
                    <select className="rounded-lg border border-[--color-border] bg-white px-3 py-1.5 text-sm outline-none focus-visible:border-[--color-primary] focus-visible:ring-1 focus-visible:ring-[--color-primary]">
                      <option>₹ INR</option>
                      <option>$ USD</option>
                      <option>€ EUR</option>
                    </select>
                  </div>

                  <div className="h-px bg-[--color-border]" />

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-[--color-text]">Default Budget Range</span>
                      <span className="text-sm text-[--color-text-secondary]">Typical budget for gifts</span>
                    </div>
                    <select className="rounded-lg border border-[--color-border] bg-white px-3 py-1.5 text-sm outline-none focus-visible:border-[--color-primary] focus-visible:ring-1 focus-visible:ring-[--color-primary]">
                      <option>Under ₹1000</option>
                      <option>₹1000 - ₹5000</option>
                      <option>₹5000 - ₹10000</option>
                      <option>Any budget</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="flex flex-col gap-8 animate-fade-in">
                <h3 className="text-xl font-bold text-[--color-text]">Integrations</h3>
                
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between rounded-2xl border border-[--color-border] p-5 transition-colors duration-150 hover:border-[--color-border-hover]">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[--color-surface]">
                        <GoogleIcon className="h-6 w-6" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-base font-semibold text-[--color-text]">Google Calendar</span>
                        <span className="text-sm text-[--color-text-secondary]">Sync upcoming gift occasions directly</span>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      Connected
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "account" && profile && (
              <div className="flex flex-col gap-8 animate-fade-in">
                <h3 className="text-xl font-bold text-[--color-text]">Account</h3>
                
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-5 rounded-2xl bg-[--color-surface] p-6">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-200 to-rose-300 text-2xl font-bold text-amber-900 shadow-sm">
                      {profile.initial}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xl font-semibold text-[--color-text]">{profile.name}</span>
                      <span className="text-[--color-text-secondary]">{profile.email || "No email linked"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <h4 className="font-semibold text-[--color-text]">Subscription Plan</h4>
                    <div className="flex items-center justify-between rounded-2xl border border-[--color-border] p-5">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-[--color-primary]">Free Plan</span>
                        <span className="text-sm text-[--color-text-secondary]">Basic AI gift recommendations</span>
                      </div>
                      <button className="gradient-button rounded-full px-5 py-2 text-sm font-semibold text-[--color-text-inverse] press-scale">
                        Upgrade to Pro
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <h4 className="font-semibold text-[--color-error]">Danger Zone</h4>
                    <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50/50 p-5">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-red-900">Delete Account</span>
                        <span className="text-sm text-red-700">Permanently delete your data</span>
                      </div>
                      <button className="rounded-full bg-red-100 px-5 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-200">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === "account" && !profile && (
              <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[--color-surface]">
                  <UserIcon className="h-8 w-8 text-[--color-text-tertiary]" />
                </div>
                <h3 className="text-lg font-semibold text-[--color-text]">Not logged in</h3>
                <p className="mt-2 text-sm text-[--color-text-secondary]">Log in to view your account details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
