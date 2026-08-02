import { randomUUID } from "node:crypto";

// Minimal client for Shopify's Universal Commerce Protocol (UCP) over MCP
// JSON-RPC. Stateless single-shot HTTPS POSTs — no session/initialize
// handshake needed. Every tools/call must carry a `meta.ucp-agent.profile`
// URL the merchant fetches to negotiate capabilities; we use Shopify's own
// publicly-hosted reference profile so we don't have to host one ourselves.
const DEFAULT_PROFILE_URL =
  "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";

// find_gifts fans out to every merchant in parallel and waits for all to
// settle, so the whole search is bounded by the slowest store — keep this
// tight so one sluggish merchant can't stall the reply.
const SEARCH_TIMEOUT_MS = 2500;

/** A single option assignment on a variant, e.g. { name: "Size", label: "UK-09" }. */
export type LiveVariantOption = { name: string; label: string };

export type LiveVariant = {
  id: string;
  title?: string;
  price: { amount: number; currency: string };
  media?: { type: string; url: string }[];
  /** Per-variant option assignments (Color / Size), as returned by Shopify UCP. */
  options?: LiveVariantOption[];
  availability?: { available?: boolean };
  checkout_url: string;
};

/** A product-level option group, e.g. { name: "Size", values: [{label:"UK-06"}, …] }. */
export type LiveProductOption = { name: string; values: { label: string }[] };

export type LiveProduct = {
  id: string;
  title: string;
  description?: { html?: string };
  price_range: { min: { amount: number; currency: string } };
  /** Option groups (Color, Size) so the agent can offer size/colour choices. */
  options?: LiveProductOption[];
  variants: LiveVariant[];
};

type McpContentBlock = { type: string; text?: string };

type McpToolCallResult = {
  structuredContent?: unknown;
  content?: McpContentBlock[];
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: McpToolCallResult;
  error?: { code: number; message: string };
};

function unwrapToolCallResult(result: McpToolCallResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const textBlock = result.content?.find((block) => block.type === "text" && typeof block.text === "string");
  if (!textBlock?.text) return undefined;
  try {
    return JSON.parse(textBlock.text);
  } catch {
    return undefined;
  }
}

export async function searchCatalog(endpoint: string, query: string): Promise<LiveProduct[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "search_catalog",
        arguments: {
          catalog: { query: trimmed },
          meta: {
            "ucp-agent": { profile: DEFAULT_PROFILE_URL },
            "idempotency-key": randomUUID(),
          },
        },
      },
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`UCP search_catalog HTTP ${res.status} from ${endpoint}`);
  }

  const raw = (await res.json()) as JsonRpcResponse;
  if (raw.error) {
    throw new Error(`UCP search_catalog RPC error from ${endpoint}: ${raw.error.message}`);
  }
  if (!raw.result) {
    throw new Error(`UCP search_catalog returned no result from ${endpoint}`);
  }

  const payload = unwrapToolCallResult(raw.result) as { products?: LiveProduct[] } | undefined;
  return payload?.products ?? [];
}
