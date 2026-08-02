import OpenAI from "openai";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SYSTEM_PROMPT } from "@/lib/agent";
import { runAgentTurn, describeOpenAIError, type AgentConvo } from "@/lib/agent-runtime";
import { getUpcomingOccasions, formatEventsForAgent } from "@/lib/calendar";

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not set on the server. Add it to .env.local and restart the dev server." },
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

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
        const convo: AgentConvo = [
          { role: "system", content: SYSTEM_PROMPT },
          ...(calendarContext
            ? [{ role: "system", content: calendarContext }]
            : []),
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ];

        // Only "stage" is forwarded live — gifts/options/letter must arrive
        // AFTER "message", since the client creates the assistant bubble on
        // the message event and can't attach to one that doesn't exist yet.
        // Sent from the return value below, in the original order, instead.
        const result = await runAgentTurn(client, convo, {
          onEvent: (e) => {
            if (e.type === "stage") send(e);
          },
        });

        send({ type: "message", content: result.message });
        if (result.gifts && result.gifts.length > 0) {
          send({ type: "gifts", items: result.gifts });
        }
        if (result.options) {
          send({ type: "options", prompt: result.options.prompt, options: result.options.options });
        }
        if (result.letter) {
          send({ type: "letter", content: result.letter });
        }
        send({ type: "done" });
        finish();
      } catch (err) {
        console.error("chat route error:", err);
        send({
          type: "error",
          message:
            describeOpenAIError(err) ??
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
