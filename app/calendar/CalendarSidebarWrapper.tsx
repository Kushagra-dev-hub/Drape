"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/Sidebar";
import type { ConversationSummary } from "@/lib/supabase/conversations";
import type { Profile } from "@/app/components/Navbar";
import { createClient } from "@/lib/supabase/client";

type CalendarSidebarWrapperProps = {
  profile: Profile | null;
  conversations: ConversationSummary[];
};

export function CalendarSidebarWrapper({ profile, conversations }: CalendarSidebarWrapperProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const handleNewChat = () => {
    router.push("/");
  };

  const handleSelectConversation = (id: string) => {
    router.push(`/?c=${id}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <Sidebar
      open={sidebarOpen}
      onToggle={() => setSidebarOpen((prev) => !prev)}
      signedIn={!!profile}
      profile={profile}
      conversations={conversations}
      activeConversationId={null}
      newChatDisabled={false}
      onNewChat={handleNewChat}
      onSelectConversation={handleSelectConversation}
      onLogout={handleLogout}
    />
  );
}
