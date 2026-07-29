"use client";

import { useEffect, useRef, useState } from "react";
import type { GiftCandidate } from "@/lib/gifts";
import { GiftCard } from "./components/GiftCard";
import { SendIcon } from "./components/icons";
import { Sidebar } from "./components/Sidebar";
import { ThinkingStages, type Stage } from "./components/ThinkingStages";

const QUICK_STARTS = [
  { emoji: "🎂", label: "Birthday", prefill: "It's a birthday coming up for " },
  { emoji: "🎓", label: "Graduation", prefill: "They just graduated / got into " },
  { emoji: "💐", label: "Anniversary", prefill: "It's our anniversary and I want to celebrate " },
  { emoji: "☕", label: "Just because", prefill: "No occasion — I just want to surprise " },
];

type Role = "user" | "assistant";
type Message = {
  id: string;
  role: Role;
  content: string;
  gifts?: GiftCandidate[];
};

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

type StreamEvent =
  | { type: "stage"; tool: string; label: string; status: "active" | "done" }
  | { type: "message"; content: string }
  | { type: "gifts"; items: GiftCandidate[] }
  | { type: "done" }
  | { type: "error"; message: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stages]);

  function applyEvent(event: StreamEvent, assistantId: string) {
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
        break;
      }
      case "gifts": {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, gifts: event.items } : m))
        );
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
          applyEvent(JSON.parse(jsonStr) as StreamEvent, assistantId);
        }
      }
    } catch (err) {
      setStages([]);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content:
            err instanceof Error
              ? `Something went wrong: ${err.message}`
              : "Something went wrong reaching Memento — mind trying again?",
        },
      ]);
      setIsStreaming(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
  }

  const hasStarted = messages.length > 0;

  return (
    <div className="flex min-h-screen bg-[#FFFFEB]">
      <Sidebar />

      <main className="hero-gradient flex flex-1 justify-center">
        <div className="flex w-full max-w-3xl flex-col px-4 py-8">
          {!hasStarted ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16 text-center">
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
            <>
              <div className="flex flex-1 flex-col gap-4 py-6">
                {messages.map((m) => (
                  <div key={m.id} className="flex flex-col gap-3">
                    <div className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                      <div
                        className={
                          m.role === "user"
                            ? "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-[#034F46] px-4 py-2.5 text-sm text-[#FFFFEB]"
                            : "w-full whitespace-pre-wrap rounded-2xl bg-white px-4 py-2.5 text-sm text-[#034F46] shadow-sm"
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
                  <div className="flex justify-start">
                    <ThinkingStages stages={stages} />
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              <div className="sticky bottom-4 mt-6 flex flex-col items-center gap-4">
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}
