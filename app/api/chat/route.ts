import Groq from "groq-sdk";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SYSTEM_PROMPT, STAGE_LABELS, TOOLS } from "@/lib/agent";
import { runTool, giftsForModel, type GiftCandidate } from "@/lib/gifts";
import { getUpcomingOccasions, formatEventsForAgent } from "@/lib/calendar";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
// Longest single-turn chain: analyze_recipient, analyze_occasion,
// analyze_budget, find_gifts, present_gifts, then a final text-only round
// (write_letter now happens on its own turn, after the user confirms they
// want a note) — 6 is the exact minimum, 8 gives headroom.
const MAX_TOOL_ROUNDS = 6;
const FALLBACK_GIFT_COUNT = 4;
// Tiny cosmetic beat so stage chips don't flash by — the analyzers that used to
// pad the chain are gone, so a turn is now ~2 rounds (find_gifts → present_gifts).
const STAGE_PACING_MS = 120;
const MAX_COMPLETION_RETRIES = 2;

type IncomingMessage = { role: "user" | "assistant"; content: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Groq returns a 429 both for short-lived burst rate limits and for a hard
// daily token quota — the two need different messaging since only one is
// worth retrying soon.
function describeGroqError(err: unknown): string | null {
  if (!(err instanceof Groq.APIError) || err.status !== 429) return null;
  const raw = err.message || "";
  if (/tokens per day/i.test(raw)) {
    const match = raw.match(/try again in (?:(\d+)m)?([\d.]+)s/i);
    const wait = match ? `${match[1] ? `${match[1]}m ` : ""}${Math.ceil(Number(match[2]))}s` : null;
    return `Memento's hit its daily usage limit for now${wait ? ` — try again in about ${wait}` : ", please try again later"}.`;
  }
  return "Memento's getting a lot of requests right now — give it a few seconds and try again.";
}

// Groq's open-weight models occasionally emit a malformed tool call
// (e.g. "<function=...>" text instead of a structured tool_calls block),
// which the API rejects with a 400 tool_use_failed. It's usually a
// one-off sampling quirk, not a real request problem — retrying the
// identical request almost always succeeds.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_COMPLETION_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable =
        err instanceof Groq.APIError &&
        (err.status === 400 || err.status === 429 || (err.status ?? 0) >= 500);
      if (!isRetryable || attempt === MAX_COMPLETION_RETRIES) break;
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: "GROQ_API_KEY is not set on the server. Add it to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  const { messages } = (await req.json()) as { messages: IncomingMessage[] };

  // Silently look up the signed-in user and inject their upcoming calendar
  // occasions as a system-level context block so the agent can proactively
  // reference them. Fails gracefully — chat still works without calendar access.
  let calendarContext = "";
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const events = await getUpcomingOccasions(supabase, user.id, 30);
      calendarContext = formatEventsForAgent(events);
    }
  } catch {
    // Non-fatal — proceed without calendar context.
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const convo: any[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...(calendarContext
            ? [{ role: "system", content: calendarContext }]
            : []),
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ];

        // candidatePool: the full pool find_gifts returned (up to 8).
        // finalGifts: what actually gets shown — narrowed by present_gifts,
        // defaulting to the top few of the pool if the model never calls it.
        let candidatePool: GiftCandidate[] | null = null;
        let finalGifts: GiftCandidate[] | null = null;
        let letterContent: string | null = null;
        // Clickable choice chips (Running / Sneakers …) from present_options,
        // shown with the assistant's final message on this turn.
        let optionsToShow: { prompt: string; options: { label: string; value: string }[] } | null = null;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const completion = await withRetry(() =>
            groq.chat.completions.create({
              model: MODEL,
              messages: convo,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tools: TOOLS as any,
              tool_choice: "auto",
            })
          );

          const choice = completion.choices[0];
          const message = choice.message;

          if (choice.finish_reason === "tool_calls" && message.tool_calls?.length) {
            convo.push(message);

            for (const call of message.tool_calls) {
              const toolName = call.function.name;
              const label = STAGE_LABELS[toolName] ?? "Working on it…";

              send({ type: "stage", tool: toolName, label, status: "active" });
              await sleep(STAGE_PACING_MS);

              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(call.function.arguments || "{}");
              } catch {
                args = {};
              }

              let result: unknown;
              if (toolName === "present_gifts") {
                // Local to this request's state (candidatePool) — doesn't go
                // through runTool, which stays a pure function of its args.
                const ids = Array.isArray(args.gift_ids)
                  ? (args.gift_ids as unknown[]).map((id) => String(id))
                  : [];
                const chosen = candidatePool?.filter((g) => ids.includes(g.id)) ?? [];
                if (chosen.length > 0) finalGifts = chosen;
                result = { ok: true, shown: chosen.length };
              } else if (toolName === "write_letter") {
                const letter = typeof args.letter === "string" ? args.letter.trim() : "";
                if (letter) letterContent = letter;
                result = { ok: true };
              } else if (toolName === "present_options") {
                // Show clickable chips with the reply. Local UI state — a bare
                // ack goes back to the model so it doesn't re-ask in prose.
                const prompt = typeof args.prompt === "string" ? args.prompt : "";
                const rawOptions = Array.isArray(args.options) ? args.options : [];
                const opts = rawOptions
                  .map((o) => {
                    const oo = o as { label?: unknown; value?: unknown };
                    return { label: String(oo.label ?? ""), value: String(oo.value ?? oo.label ?? "") };
                  })
                  .filter((o) => o.label && o.value)
                  .slice(0, 4);
                if (prompt && opts.length > 0) optionsToShow = { prompt, options: opts };
                result = { ok: true, shown: opts.length };
              } else {
                result = await runTool(toolName, args);
                if (toolName === "find_gifts") {
                  const raw = result as { items: GiftCandidate[]; pastGifts?: unknown[] };
                  const items = raw.items;
                  // Keep the FULL items (with variants) for the client; the
                  // safe default shows cards even if present_gifts is skipped.
                  candidatePool = items;
                  finalGifts = items.slice(0, FALLBACK_GIFT_COUNT);
                  // Send the model only a compact projection (variant arrays
                  // would burn tokens) plus the recipient's past gifts so it
                  // can avoid repeats.
                  result = { items: giftsForModel(items), pastGifts: raw.pastGifts ?? [] };
                }
              }

              convo.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(result),
              });

              send({ type: "stage", tool: toolName, label, status: "done" });
            }
            continue;
          }

          send({ type: "message", content: message.content ?? "" });
          if (finalGifts && finalGifts.length > 0) {
            send({ type: "gifts", items: finalGifts });
          }
          if (optionsToShow) {
            send({ type: "options", prompt: optionsToShow.prompt, options: optionsToShow.options });
          }
          if (letterContent) {
            send({ type: "letter", content: letterContent });
          }
          send({ type: "done" });
          finish();
          return;
        }

        send({
          type: "message",
          content: "I'm having trouble narrowing this down — could you give me a bit more to go on?",
        });
        send({ type: "done" });
        finish();
      } catch (err) {
        console.error("chat route error:", err);
        send({
          type: "error",
          message:
            describeGroqError(err) ??
            "I got tripped up putting that together — mind trying that again, maybe with a bit less in one message?",
        });
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
