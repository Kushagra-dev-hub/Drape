import { randomUUID } from "node:crypto";

// Minimal client for Shopify's Universal Commerce Protocol (UCP) over MCP
// JSON-RPC. Stateless single-shot HTTPS POSTs — no session/initialize
// handshake needed. Every tools/call must carry a `meta.ucp-agent.profile`
// URL the merchant fetches to negotiate capabilities; we use Shopify's own
// publicly-hosted reference profile so we don't have to host one ourselves.
const DEFAULT_PROFILE_URL =
  "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";

const SEARCH_TIMEOUT_MS = 3500;

export type LiveVariant = {
  id: string;
  price: { amount: number; currency: string };
  media?: { type: string; url: string }[];
  checkout_url: string;
};

export type LiveProduct = {
  id: string;
  title: string;
  price_range: { min: { amount: number; currency: string } };
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
