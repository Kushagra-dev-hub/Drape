// ============================================================================
// Prava — agentic checkout. Ported verbatim from the Pounce/ShopVerse flow:
// create a payment session → buyer approves on Prava's hosted page with a
// passkey → Prava issues a scoped one-time credential → we report APPROVED so
// the transaction settles to `completed`. The buyer's real card number never
// touches Drape or the merchant. Sandbox: no real money moves.
// ============================================================================

const PRAVA_BASE = process.env.PRAVA_API_BASE || "https://sandbox.api.prava.space";

function sk(): string {
  const k = process.env.PRAVA_SK;
  if (!k) throw new Error("PRAVA_SK not configured");
  return k;
}

function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = { authorization: `Bearer ${sk()}` };
  if (json) h["content-type"] = "application/json";
  return h;
}

/** Retry Prava's transient sandbox 5xx (e.g. DB_INFRASTRUCTURE_ERROR). */
export async function pravaFetch(
  url: string,
  init: RequestInit,
  tries = 0,
): Promise<Response> {
  const r = await fetch(url, init);
  if (r.status >= 500 && tries < 2) {
    await new Promise((res) => setTimeout(res, 600 * (tries + 1)));
    return pravaFetch(url, init, tries + 1);
  }
  return r;
}

export type SessionInput = {
  amountMinor: number;
  currency?: string;
  description?: string;
  quantity?: number;
  orderRef?: string;
  userId: string;
  userEmail: string;
  merchant: { name: string; url?: string; countryCode?: string };
  /** Origin the callback returns to, e.g. `http://localhost:3000` (forced https). */
  callbackBase: string;
};

export type PravaSession = {
  sessionId: string;
  iframeUrl: string;
  orderId: string | null;
};

/** POST /v1/sessions — open a hosted checkout for one merchant/order. */
export async function createPravaSession(input: SessionInput): Promise<PravaSession> {
  const unit = (input.amountMinor / 100).toFixed(2);
  // Prava requires an https callback; we poll for the result rather than rely
  // on it, so on http localhost we just force the scheme so validation passes.
  const callback = `${input.callbackBase.replace(/^http:/, "https:")}/`;
  const body = {
    user_id: input.userId,
    user_email: input.userEmail,
    total_amount: unit,
    currency: (input.currency || "INR").toUpperCase().slice(0, 3),
    integration_type: "full_checkout",
    callback_url: callback,
    external_order_ref: input.orderRef || `DRAPE-${Date.now()}`,
    purchase_context: [
      {
        merchant_details: {
          name: input.merchant.name,
          url: input.merchant.url || "https://drape.gift",
          country_code_iso2: (input.merchant.countryCode || "IN").slice(0, 2).toUpperCase(),
        },
        product_details: [
          { description: input.description || input.merchant.name, unit_price: unit, quantity: input.quantity || 1 },
        ],
      },
    ],
  };
  const r = await pravaFetch(`${PRAVA_BASE}/v1/sessions`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`prava_${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return {
    sessionId: j.session_id,
    iframeUrl: j.iframe_url,
    orderId: j.order_id ?? null,
  };
}

export type PravaResult = { status: string; txnRefId?: string; orderId?: string };

/**
 * Poll the session; once the buyer has paid (scoped credential issued at
 * `awaiting_result`), report APPROVED so the transaction settles to
 * `completed`. Without this report step the session never finishes.
 */
export async function pollAndReport(sessionId: string): Promise<PravaResult> {
  const r = await pravaFetch(
    `${PRAVA_BASE}/v1/sessions/${encodeURIComponent(sessionId)}/payment-result`,
    { headers: authHeaders() },
  );
  const j = await r.json().catch(() => ({} as Record<string, unknown>));
  // Tolerate flat + nested (transactions[].line_items[]) shapes.
  const txn = (j.transactions as Array<Record<string, unknown>> | undefined)?.[0];
  const line = (txn?.line_items as Array<Record<string, unknown>> | undefined)?.[0];
  let status = (j.status || j.payment_status || txn?.status || "pending") as string;
  const txnRefId = (j.txn_ref_id || j.transaction_id || line?.txn_ref_id) as string | undefined;
  const token = (j.token || line?.token) as string | undefined;

  if (status === "awaiting_result" && txnRefId && token) {
    const rep = await pravaFetch(
      `${PRAVA_BASE}/v1/sessions/${encodeURIComponent(sessionId)}/report-status`,
      {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ txn_ref_id: txnRefId, txn_status: "APPROVED", txn_type: "PURCHASE" }),
      },
    );
    if (rep.ok) status = "completed";
  }
  return { status, txnRefId, orderId: j.order_id as string | undefined };
}
