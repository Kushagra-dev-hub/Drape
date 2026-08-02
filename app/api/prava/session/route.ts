import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPravaSession } from "@/lib/prava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/prava/session — open a Prava sandbox checkout for a gift.
 * Body: { amountMinor, description, quantity?, orderRef?, merchantName?, merchantUrl? }
 * The signed-in user's id/email scope the session so it's THEIR card + wallet.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body: {
    amountMinor?: number;
    currency?: string;
    description?: string;
    quantity?: number;
    orderRef?: string;
    merchantName?: string;
    merchantUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.amountMinor || !body.description) {
    return NextResponse.json(
      { error: "amountMinor and description are required." },
      { status: 400 },
    );
  }

  const proto = (req.headers.get("x-forwarded-proto") || "http").split(",")[0];
  const host = req.headers.get("host") || "localhost:3000";

  try {
    const session = await createPravaSession({
      amountMinor: body.amountMinor,
      currency: body.currency || "INR",
      description: body.description,
      quantity: body.quantity || 1,
      orderRef: body.orderRef,
      userId: user?.id || user?.email || "drape-guest",
      userEmail: user?.email || "guest@drape.gift",
      merchant: { name: body.merchantName || "Drape Gift", url: body.merchantUrl, countryCode: "IN" },
      callbackBase: `${proto}://${host}`,
    });
    return NextResponse.json(session);
  } catch (e) {
    console.error("[Prava] session error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start Prava checkout." },
      { status: 502 },
    );
  }
}
