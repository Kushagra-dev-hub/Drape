import { NextResponse } from "next/server";
import { pollAndReport } from "@/lib/prava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/prava/result?sessionId=… — poll a Prava session and, once the
 * buyer has approved (scoped credential issued), report APPROVED so it settles
 * to `completed`. The client polls this after opening the hosted checkout.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }
  try {
    const result = await pollAndReport(sessionId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[Prava] result error:", e);
    return NextResponse.json(
      { status: "error", error: e instanceof Error ? e.message : "Payment check failed." },
      { status: 502 },
    );
  }
}
