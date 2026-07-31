"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { GiftCandidate } from "@/lib/gifts";
import { createClient } from "@/lib/supabase/client";
import {
  createConversation,
  getConversationMessages,
  importConversation,
  insertMessage,
  listConversations,
  updateMessageGifts,
  updateMessageLetter,
  type ConversationSummary,
} from "@/lib/supabase/conversations";
import { GiftCard } from "./components/GiftCard";
import { LetterCard } from "./components/LetterCard";
import { SendIcon, SparkleIcon } from "./components/icons";
import { Navbar, type Profile } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { ThinkingStages, type Stage } from "./components/ThinkingStages";

const QUICK_STARTS = [
  { emoji: "🎂", label: "Birthday", prefill: "It's a birthday coming up for " },
  { emoji: "🎓", label: "Graduation", prefill: "They just graduated / got into " },
  { emoji: "💐", label: "Anniversary", prefill: "It's our anniversary and I want to celebrate " },
  { emoji: "☕", label: "Just because", prefill: "No occasion — I just want to surprise " },
];

const HERO_EXIT_MS = 300;
const STORAGE_KEY = "memento-chat";

type Role = "user" | "assistant";
type Message = {
  id: string;
  role: Role;
  content: string;
  gifts?: GiftCandidate[];
  letter?: string;
};

const nextId = () => crypto.randomUUID();

function deriveProfile(user: { email?: string | null; user_metadata?: { full_name?: string } } | null | undefined): Profile | null {
  if (!user) return null;
  const name = user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "there";
  return { name, email: user.email || undefined, initial: name.charAt(0).toUpperCase() || "?" };
}

type StreamEvent =
  | { type: "stage"; tool: string; label: string; status: "active" | "done" }
  | { type: "message"; content: string }
  | { type: "gifts"; items: GiftCandidate[] }
  | { type: "letter"; content: string }
  | { type: "done" }
  | { type: "error"; message: string };

function HomeContent() {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isHeroExiting, setIsHeroExiting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  // Pre-fill the input from ?q= (e.g. from calendar "Shop for a gift" links).
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setInput(decodeURIComponent(q));
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setProfile(deriveProfile(data.user));

      if (uid) {
        let guestMessages: Message[] = [];
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) guestMessages = JSON.parse(raw);
        } catch {
          // ignore malformed/unavailable storage
        }

        let importedId: string | null = null;
        if (guestMessages.length > 0) {
          try {
            const title = guestMessages.find((m) => m.role === "user")?.content ?? "Imported chat";
            const imported = await importConversation(supabase, uid, title, guestMessages);
            importedId = imported.id;
            localStorage.removeItem(STORAGE_KEY);
          } catch (err) {
            console.error("Failed to import guest chat", err);
          }
        }

        try {
          const list = await listConversations(supabase);
          if (active) setConversations(list);
        } catch (err) {
          console.error("Failed to load conversations", err);
        }

        if (active && importedId) {
          setConversationId(importedId);
          setMessages(guestMessages);
        }
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) setMessages(JSON.parse(raw));
        } catch {
          // ignore malformed/unavailable storage
        }
      }
      if (active) setIsHydrated(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserId(session?.user?.id ?? null);
      setProfile(deriveProfile(session?.user));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!isHydrated || userId) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, isHydrated, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stages]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserId(null);
    setProfile(null);
    setConversations([]);
    setConversationId(null);
    setMessages([]);
    setStages([]);
  }

  function handleNewChat() {
    if (isStreaming) return;
    setConversationId(null);
    setMessages([]);
    setStages([]);
    setIsHeroExiting(false);
  }

  async function handleSelectConversation(id: string) {
    if (id === conversationId || isStreaming) return;
    setConversationId(id);
    setStages([]);
    setIsHeroExiting(false);
    try {
      const stored = await getConversationMessages(supabase, id);
      setMessages(
        stored.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          gifts: m.gifts ?? undefined,
          letter: m.letter ?? undefined,
        }))
      );
    } catch (err) {
      console.error("Failed to load conversation", err);
      setMessages([]);
    }
  }

  function applyEvent(event: StreamEvent, assistantId: string, activeConversationId: string | null) {
    switch (event.type) {
      case "stage": {
        setStages((prev) => {
          const exists = prev.some((s) => s.tool === event.tool);
          if (exists) {
            return prev.map((s) =>
              s.tool === event.tool ? { ...s, status: event.status } : s
            );
          }
          return [...prev, { tool: event.tool, label: event.label, status: event.status }];
        });
        break;
      }
      case "message": {
        setStages([]);
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: event.content },
        ]);
        if (userId && activeConversationId) {
          insertMessage(supabase, {
            id: assistantId,
            conversationId: activeConversationId,
            role: "assistant",
            content: event.content,
          }).catch((err) => console.error("Failed to persist assistant message", err));
        }
        break;
      }
      case "gifts": {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, gifts: event.items } : m))
        );
        if (userId && activeConversationId) {
          updateMessageGifts(supabase, assistantId, event.items).catch((err) =>
            console.error("Failed to persist gifts", err)
          );
        }
        break;
      }
      case "letter": {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, letter: event.content } : m))
        );
        if (userId && activeConversationId) {
          updateMessageLetter(supabase, assistantId, event.content).catch((err) =>
            console.error("Failed to persist letter", err)
          );
        }
        break;
      }
      case "done": {
        setIsStreaming(false);
        break;
      }
      case "error": {
        setStages([]);
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: event.message },
        ]);
        setIsStreaming(false);
        break;
      }
    }
  }

  async function sendMessage(text: string) {
    const userMessage: Message = { id: nextId(), role: "user", content: text };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setStages([]);
    setIsStreaming(true);

    let activeConversationId = conversationId;

    if (userId) {
      try {
        if (!activeConversationId) {
          const created = await createConversation(supabase, userId, text);
          activeConversationId = created.id;
          setConversationId(created.id);
          setConversations((prev) => [created, ...prev]);
        }
        await insertMessage(supabase, {
          id: userMessage.id,
          conversationId: activeConversationId,
          role: "user",
          content: text,
        });
      } catch (err) {
        console.error("Failed to persist message", err);
      }
    }

    const assistantId = nextId();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok || !res.body) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error ?? "The chat request failed.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice("data:".length).trim();
          if (!jsonStr) continue;
          applyEvent(JSON.parse(jsonStr) as StreamEvent, assistantId, activeConversationId);
        }
      }
    } catch (err) {
      setStages([]);
      const content =
        err instanceof Error
          ? `Something went wrong: ${err.message}`
          : "Something went wrong reaching Memento — mind trying again?";
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content }]);
      if (userId && activeConversationId) {
        insertMessage(supabase, {
          id: assistantId,
          conversationId: activeConversationId,
          role: "assistant",
          content,
        }).catch(() => {});
      }
      setIsStreaming(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    if (messages.length === 0) {
      setIsHeroExiting(true);
      setTimeout(() => sendMessage(trimmed), HERO_EXIT_MS);
    } else {
      sendMessage(trimmed);
    }
  }

  const hasStarted = messages.length > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[--color-surface]">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        signedIn={Boolean(userId)}
        profile={profile}
        conversations={conversations}
        activeConversationId={conversationId}
        newChatDisabled={isStreaming}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onLogout={handleLogout}
      />

      <div className="hero-gradient flex min-h-0 flex-1 flex-col">
        <Navbar profile={profile} />

        <main className="flex min-h-0 flex-1 justify-center">
          <div className="flex min-h-0 w-full max-w-3xl flex-col overflow-hidden px-4 py-8">
          {!hasStarted ? (
            <div
              className={`flex flex-1 flex-col items-center justify-center gap-8 pb-16 text-center transition-all duration-300 ease-out ${
                isHeroExiting ? "scale-95 opacity-0" : "opacity-100"
              }`}
            >
              <mascot-hello size={160} greeting="Hello!" assets="/mascot-hello/" suppressHydrationWarning />

              <div className="flex flex-col items-center gap-3">
                <h1 className="whitespace-nowrap text-3xl font-bold tracking-tight text-[--color-text] sm:text-4xl md:text-5xl">
                  Who are we celebrating?
                </h1>
                <p className="max-w-md text-sm text-[--color-text-secondary]">
                  Describe someone special and the occasion — I&apos;ll find the perfect gift.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="glass-input flex w-full items-center gap-2 rounded-2xl p-2"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center pl-1">
                  <SparkleIcon className="h-4 w-4 text-[--color-text-tertiary]" />
                </div>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="It's my best friend's birthday tomorrow. She loves mystery novels and coffee. Budget ₹3,000."
                  className="flex-1 bg-transparent py-2.5 text-sm text-[--color-text] placeholder:text-[--color-text-tertiary] focus:outline-none"
                  disabled={isStreaming}
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={isStreaming || !input.trim()}
                  className="gradient-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[--color-text-inverse] disabled:opacity-30 disabled:hover:shadow-none"
                >
                  <SendIcon />
                </button>
              </form>

              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_STARTS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => setInput(q.prefill)}
                    className="glass-card glass-card-hover flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-[--color-text-secondary] press-scale"
                  >
                    <span className="text-base">{q.emoji}</span>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-fade-in mx-auto flex w-full min-h-0 max-w-2xl flex-1 flex-col">
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto flex flex-col gap-5 py-6">
                {messages.map((m, i) => (
                  <div key={m.id} className="animate-fade-in flex flex-col gap-3" style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}>
                    <div className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                      <div
                        className={
                          m.role === "user"
                            ? "max-w-[70%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[--color-primary] px-4 py-3 text-sm leading-relaxed text-[--color-text-inverse] shadow-sm"
                            : "glass-card max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-4 py-3 text-left text-sm leading-relaxed text-[--color-text]"
                        }
                      >
                        {m.content}
                      </div>
                    </div>
                    {m.gifts && m.gifts.length > 0 && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {m.gifts.map((g) => (
                          <GiftCard key={g.id} gift={g} />
                        ))}
                      </div>
                    )}
                    {m.letter && <LetterCard letter={m.letter} />}
                  </div>
                ))}

                {stages.length > 0 && (
                  <div className="animate-fade-in flex justify-start">
                    <ThinkingStages stages={stages} />
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              <div className="mt-2 flex shrink-0 flex-col items-center gap-4 pb-2">
                <form
                  onSubmit={handleSubmit}
                  className="glass-input flex w-full items-center gap-2 rounded-2xl p-2"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center pl-1">
                    <SparkleIcon className="h-4 w-4 text-[--color-text-tertiary]" />
                  </div>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Tell me more about who you're shopping for..."
                    className="flex-1 bg-transparent py-2.5 text-sm text-[--color-text] placeholder:text-[--color-text-tertiary] focus:outline-none"
                    disabled={isStreaming}
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={isStreaming || !input.trim()}
                    className="gradient-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[--color-text-inverse] disabled:opacity-30 disabled:hover:shadow-none"
                  >
                    <SendIcon />
                  </button>
                </form>
              </div>
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
