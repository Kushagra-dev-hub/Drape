"use client";

import { useEffect, useRef, useState } from "react";
import type { GiftCandidate } from "@/lib/gifts";
import { createClient } from "@/lib/supabase/client";
import {
  createConversation,
  getConversationMessages,
  importConversation,
  insertMessage,
  listConversations,
  updateMessageGifts,
  type ConversationSummary,
} from "@/lib/supabase/conversations";
import { GiftCard } from "./components/GiftCard";
import { SendIcon } from "./components/icons";
import { Navbar } from "./components/Navbar";
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
};

const nextId = () => crypto.randomUUID();

type StreamEvent =
  | { type: "stage"; tool: string; label: string; status: "active" | "done" }
  | { type: "message"; content: string }
  | { type: "gifts"; items: GiftCandidate[] }
  | { type: "done" }
  | { type: "error"; message: string };

export default function Home() {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
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

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);

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
      if (active) setUserId(session?.user?.id ?? null);
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
      setMessages(stored.map((m) => ({ id: m.id, role: m.role, content: m.content, gifts: m.gifts ?? undefined })));
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
    <div className="flex h-screen overflow-hidden bg-[#FFFFEB]">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        signedIn={Boolean(userId)}
        conversations={conversations}
        activeConversationId={conversationId}
        newChatDisabled={isStreaming}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
      />

      <div className="hero-gradient flex min-h-0 flex-1 flex-col">
        <Navbar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

        <main className="flex min-h-0 flex-1 justify-center">
          <div className="flex min-h-0 w-full max-w-3xl flex-col overflow-hidden px-4 py-8">
          {!hasStarted ? (
            <div
              className={`flex flex-1 flex-col items-center justify-center gap-6 pb-16 text-center transition-opacity duration-300 ease-out ${
                isHeroExiting ? "opacity-0" : "opacity-100"
              }`}
            >
              <mascot-hello size={160} greeting="Hello!" assets="/mascot-hello/" suppressHydrationWarning />
              <h1 className="whitespace-nowrap text-2xl font-bold tracking-tight text-[#034F46] sm:text-4xl md:text-5xl">
                Who are we celebrating?
              </h1>

              <form
                onSubmit={handleSubmit}
                className="flex w-full items-center gap-2 rounded-full bg-white p-2 shadow-lg shadow-[#034F46]/5"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="It's my best friend's birthday tomorrow. She loves mystery novels and coffee. Budget ₹3,000."
                  className="flex-1 bg-transparent px-4 py-2 text-sm text-[#034F46] placeholder:text-[#034F46]/40 focus:outline-none"
                  disabled={isStreaming}
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={isStreaming || !input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#034F46] text-[#FFFFEB] transition hover:brightness-110 disabled:opacity-40"
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
                    className="flex items-center gap-2 rounded-full border border-white/60 bg-white/40 px-4 py-2.5 text-sm font-medium text-[#034F46]/80 shadow-sm backdrop-blur-md transition hover:bg-white/70"
                  >
                    <span className="text-base">{q.emoji}</span>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-fade-in mx-auto flex w-full min-h-0 max-w-2xl flex-1 flex-col">
              <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto flex flex-col gap-4 py-6">
                {messages.map((m) => (
                  <div key={m.id} className="animate-fade-in flex flex-col gap-3">
                    <div className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                      <div
                        className={
                          m.role === "user"
                            ? "max-w-[65%] whitespace-pre-wrap rounded-2xl bg-[#034F46] px-4 py-2.5 text-sm text-[#FFFFEB]"
                            : "max-w-[55%] whitespace-pre-wrap rounded-2xl bg-white px-4 py-2.5 text-left text-sm text-[#034F46] shadow-sm"
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
                  className="flex w-full items-center gap-2 rounded-full bg-white p-2 shadow-lg shadow-[#034F46]/5"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="It's my best friend's birthday tomorrow. She loves mystery novels and coffee. Budget ₹3,000."
                    className="flex-1 bg-transparent px-4 py-2 text-sm text-[#034F46] placeholder:text-[#034F46]/40 focus:outline-none"
                    disabled={isStreaming}
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={isStreaming || !input.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#034F46] text-[#FFFFEB] transition hover:brightness-110 disabled:opacity-40"
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
