import Groq from "groq-sdk";
import { SYSTEM_PROMPT, STAGE_LABELS, TOOLS } from "@/lib/agent";
import { runTool } from "@/lib/gifts";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_TOOL_ROUNDS = 6;
const STAGE_PACING_MS = 450;
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
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ];

        let lastGifts: unknown[] | null = null;

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

              const result = runTool(toolName, args);
              if (toolName === "find_gifts") {
                lastGifts = (result as { items: unknown[] }).items;
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
          if (lastGifts && lastGifts.length > 0) {
            send({ type: "gifts", items: lastGifts });
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
