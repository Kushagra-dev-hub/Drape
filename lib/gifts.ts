import { searchCatalog, type LiveProduct } from "./ucp";
import { MERCHANTS, type Merchant } from "./merchants";

/** One purchasable colour+size combination of a product, straight from the merchant. */
export type GiftVariant = {
  id: string;
  title: string; // e.g. "COSMIC TEAL / UK-09"
  price: number; // whole ₹
  color?: string;
  size?: string;
  available: boolean;
  imageUrl?: string;
  checkoutUrl?: string;
};

/** A product-level option group the buyer chooses from, e.g. { name: "Size", values: ["UK-06", …] }. */
export type GiftOption = { name: string; values: string[] };

export type GiftCandidate = {
  id: string;
  name: string;
  category: string;
  price: number;
  merchant: string;
  deliveryDays: number;
  tags: string[];
  emoji: string;
  imageUrl?: string;
  checkoutUrl?: string;
  // Present only for configurable products (shoes, apparel): the buyer picks a
  // size + colour, which resolves to one `variant` before checkout. Absent for
  // simple items (books, mugs) so those keep the one-tap approve flow.
  options?: GiftOption[];
  variants?: GiftVariant[];
};

/**
 * Compact projection sent to the LLM for find_gifts — ids, names, prices, and a
 * one-line size/colour summary, but NOT the full per-variant array (which would
 * burn tokens the model doesn't need to present cards). The full variant data
 * goes to the client via the `gifts` SSE event instead.
 */
export function giftsForModel(items: GiftCandidate[]) {
  return items.map((g) => {
    const sizes = g.options?.find((o) => /size/i.test(o.name))?.values;
    const colors = g.options?.find((o) => /colou?r/i.test(o.name))?.values;
    return {
      id: g.id,
      name: g.name,
      price: g.price,
      merchant: g.merchant,
      ...(sizes?.length ? { sizes: sizes.join(", ") } : {}),
      ...(colors?.length ? { colors: colors.join(", ") } : {}),
    };
  });
}

// Real catalog search doesn't return shipping estimates — this is a known
// approximation for live results, named so it's greppable rather than magic.
const LIVE_DELIVERY_PLACEHOLDER_DAYS = 5;

// find_gifts returns this many scored candidates, not just the final
// display count — see the comment above the sort in findGifts for why.
const CANDIDATE_POOL_SIZE = 8;

const CATALOG: GiftCandidate[] = [
  { id: "mystery-novel-set", name: "3-Book Mystery Novel Boxset", category: "books", price: 950, merchant: "Bound & Co.", deliveryDays: 2, tags: ["books", "mystery", "reading", "novels"], emoji: "📚" },
  { id: "pour-over-coffee-kit", name: "Pour-Over Coffee Starter Kit", category: "coffee", price: 1400, merchant: "Roast Lab", deliveryDays: 3, tags: ["coffee", "caffeine", "brewing"], emoji: "☕" },
  { id: "premium-sketch-set", name: "Premium Sketching Set", category: "art", price: 1800, merchant: "Studio Supply Co.", deliveryDays: 3, tags: ["art", "sketching", "drawing", "creative"], emoji: "🎨" },
  { id: "watercolor-kit", name: "Beginner Watercolor Kit", category: "art", price: 2200, merchant: "Studio Supply Co.", deliveryDays: 3, tags: ["art", "painting", "watercolor", "creative"], emoji: "🖌️" },
  { id: "leather-journal", name: "Hand-Bound Leather Journal", category: "stationery", price: 1100, merchant: "Paper & Pine", deliveryDays: 2, tags: ["writing", "journaling", "planner", "stationery"], emoji: "📓" },
  { id: "college-planner", name: "Personalized College Planner", category: "stationery", price: 850, merchant: "Paper & Pine", deliveryDays: 2, tags: ["planner", "college", "organization", "stationery"], emoji: "🗓️" },
  { id: "ceramic-mug-set", name: "Hand-Glazed Ceramic Mug Set", category: "home", price: 700, merchant: "Kiln House", deliveryDays: 4, tags: ["coffee", "tea", "home", "mug"], emoji: "🍵" },
  { id: "succulent-trio", name: "Low-Maintenance Succulent Trio", category: "plants", price: 650, merchant: "Green Thumb", deliveryDays: 3, tags: ["plants", "gardening", "home", "greenery"], emoji: "🪴" },
  { id: "board-game-classic", name: "Strategy Board Game Night Set", category: "games", price: 1600, merchant: "Tabletop Corner", deliveryDays: 4, tags: ["games", "boardgames", "puzzles", "friends"], emoji: "🎲" },
  { id: "bluetooth-speaker", name: "Compact Bluetooth Speaker", category: "tech", price: 2800, merchant: "SoundWave", deliveryDays: 3, tags: ["music", "tech", "audio", "speaker"], emoji: "🔊" },
  { id: "scented-candle-set", name: "Botanical Scented Candle Set", category: "wellness", price: 900, merchant: "Ember & Oak", deliveryDays: 2, tags: ["candles", "relaxation", "wellness", "home"], emoji: "🕯️" },
  { id: "skincare-set", name: "Everyday Skincare Ritual Set", category: "wellness", price: 2400, merchant: "Bloom Apothecary", deliveryDays: 3, tags: ["skincare", "self-care", "wellness", "beauty"], emoji: "🧴" },
  { id: "wireless-earbuds", name: "Wireless Earbuds", category: "tech", price: 3200, merchant: "SoundWave", deliveryDays: 2, tags: ["music", "tech", "audio", "earbuds"], emoji: "🎧" },
  { id: "engraved-bracelet", name: "Engraved Minimalist Bracelet", category: "jewelry", price: 1500, merchant: "Little Things Co.", deliveryDays: 4, tags: ["jewelry", "accessories", "keepsake"], emoji: "✨" },
  { id: "canvas-tote", name: "Illustrated Canvas Tote Bag", category: "accessories", price: 550, merchant: "Paper & Pine", deliveryDays: 2, tags: ["bag", "everyday", "accessories", "college"], emoji: "👜" },
  { id: "recipe-box", name: "Curated Recipe Card Box", category: "kitchen", price: 750, merchant: "Kiln House", deliveryDays: 3, tags: ["cooking", "kitchen", "food", "home"], emoji: "🍳" },
];

// Seeded relationship memory so "avoid repeat gifts" has something real to find.
// Try recipient name "Sara" or "Mom" in the chat to see it trigger.
const RECIPIENT_MEMORY: Record<string, { item: string; occasion: string; year: number }[]> = {
  sara: [{ item: "Kindle", occasion: "Birthday", year: 2025 }],
  mom: [{ item: "Scented Candle Set", occasion: "Mother's Day", year: 2025 }],
};

export async function runTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "find_gifts":
      return await findGifts(args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

type ScoredGift = { gift: GiftCandidate; score: number };

// Exact whole-word matches count for more than a fuzzy substring overlap.
// Without this, a coincidental substring hit (e.g. "neck" inside the word
// "necklace") ties with a genuine exact match ("necklace" === "necklace")
// and can win a price tie-break it has no business winning.
function scoreWords(words: string[], interests: string[]): number {
  let score = 0;
  for (const word of words) {
    if (interests.includes(word)) {
      score += 2;
    } else if (interests.some((i) => word.includes(i) || i.includes(word))) {
      score += 1;
    }
  }
  return score;
}

// Strip numbers/punctuation and drop short tokens ("c", "e", "16%") before
// matching — real ingredient/spec tokens otherwise substring-collide with
// unrelated interests (e.g. the "c" in "Vitamin C Serum" matching "coffee").
function extractWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((word) => word.length >= 3);
}

// Many live merchants use branded/marketing titles ("Warm Spell Look") that
// never literally contain the product's actual category — a real clothing
// item can lose every tie to an unrelated item whose title happens to say
// "shoes". The description is where that real category language actually
// shows up ("regular-fit shirt", "cotton-poly blend"), so it's a second,
// weaker signal: only exact-word hits count (no substring fuzz, since prose
// is noisy), and each interest counts once no matter how often it repeats,
// so a long description can't out-score a short one just by being longer.
function scoreDescription(html: string | undefined, interests: string[]): number {
  if (!html) return 0;
  const words = new Set(extractWords(html.replace(/<[^>]+>/g, " ")));
  let score = 0;
  for (const interest of interests) {
    if (words.has(interest)) score += 1;
  }
  return score;
}

function scoreMockCatalog(interests: string[], maxBudget: number, excludeNames: string[]): ScoredGift[] {
  const affordable = CATALOG.filter((g) => g.price <= maxBudget).filter(
    (g) => !excludeNames.some((ex) => ex && g.name.toLowerCase().includes(ex))
  );

  return affordable.map((gift) => ({ gift, score: scoreWords(gift.tags, interests) }));
}

function mapLiveProductToGift(
  product: LiveProduct,
  merchant: Merchant,
  maxBudget: number,
  excludeNames: string[]
): GiftCandidate | null {
  if (product.variants.length === 0) return null;

  const cheapest = product.variants.reduce((min, v) => (v.price.amount < min.price.amount ? v : min));
  if (cheapest.price.currency !== "INR") return null;

  const price = Math.round(cheapest.price.amount / 100);
  if (price > maxBudget) return null;

  const titleLower = product.title.toLowerCase();
  if (excludeNames.some((ex) => ex && titleLower.includes(ex))) return null;

  // Surface size/colour options only for genuinely configurable products
  // (a Size or Colour group with more than one value). Books/mugs come back
  // with just a default "Title" option — those stay simple one-tap gifts.
  const options: GiftOption[] = (product.options ?? [])
    .filter((o) => o.values.length > 1 && /size|colou?r/i.test(o.name))
    .map((o) => ({ name: o.name, values: o.values.map((v) => v.label) }));

  let variants: GiftVariant[] | undefined;
  if (options.length > 0) {
    variants = product.variants.map((v) => {
      const color = v.options?.find((o) => /colou?r/i.test(o.name))?.label;
      const size = v.options?.find((o) => /size/i.test(o.name))?.label;
      return {
        id: v.id,
        title: v.title || [color, size].filter(Boolean).join(" / "),
        price: Math.round(v.price.amount / 100),
        color,
        size,
        available: v.availability?.available !== false,
        imageUrl: v.media?.[0]?.url,
        checkoutUrl: v.checkout_url,
      };
    });
  }

  return {
    id: product.id,
    name: product.title,
    category: "live",
    price,
    merchant: merchant.name,
    deliveryDays: LIVE_DELIVERY_PLACEHOLDER_DAYS,
    tags: [],
    emoji: "🎁",
    imageUrl: cheapest.media?.[0]?.url,
    checkoutUrl: cheapest.checkout_url,
    ...(options.length > 0 ? { options } : {}),
    ...(variants ? { variants } : {}),
  };
}

async function scoreLiveMerchants(
  interests: string[],
  maxBudget: number,
  excludeNames: string[]
): Promise<ScoredGift[]> {
  // Two interests keep the query focused — a longer joined string dilutes
  // relevance fast against a single-category merchant catalog.
  const query = interests.slice(0, 2).join(" ");

  const results = await Promise.allSettled(
    MERCHANTS.map(async (merchant) => {
      try {
        return { merchant, products: await searchCatalog(merchant.endpoint, query) };
      } catch (err) {
        // A dead/slow merchant must never break the chat response — log
        // server-side only and fall back to mock results via the merge below.
        console.error(`[ucp] ${merchant.id} search failed:`, err);
        return { merchant, products: [] as LiveProduct[] };
      }
    })
  );

  const scored: ScoredGift[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { merchant, products } = result.value;
    for (const product of products) {
      const gift = mapLiveProductToGift(product, merchant, maxBudget, excludeNames);
      if (!gift) continue;
      const titleScore = scoreWords(extractWords(product.title), interests);
      const descriptionScore = scoreDescription(product.description?.html, interests);
      scored.push({ gift, score: titleScore + descriptionScore });
    }
  }
  return scored;
}

async function findGifts(args: Record<string, unknown>) {
  const interests = Array.isArray(args.interests)
    ? (args.interests as string[]).map((i) => String(i).toLowerCase())
    : [];
  const maxBudget =
    typeof args.max_budget === "number" ? args.max_budget : Number(args.max_budget) || Infinity;
  const explicitExcludes = Array.isArray(args.exclude_names)
    ? (args.exclude_names as string[]).map((n) => String(n).toLowerCase())
    : [];

  // Recipient past-gift lookup (folded in from the removed analyze_recipient) —
  // avoids repeats automatically and hands the history back to the agent so it
  // can say it's skipping a repeat, all without a separate LLM round-trip.
  const recipientName =
    typeof args.recipient_name === "string" ? args.recipient_name.trim().toLowerCase() : "";
  const pastGifts = RECIPIENT_MEMORY[recipientName] ?? [];
  const excludeNames = [...explicitExcludes, ...pastGifts.map((g) => g.item.toLowerCase())];

  const mockScored = scoreMockCatalog(interests, maxBudget, excludeNames);
  const liveScored = await scoreLiveMerchants(interests, maxBudget, excludeNames);

  // Merge, don't rank live-first: an on-topic live product only outranks a
  // mock one when it's actually as good or better a match.
  //
  // Returns a wider candidate pool (not just the final 4) — keyword scoring
  // is a coarse relevance filter, not a final judge (e.g. it can't tell a
  // sleep-themed kids' book from an actual sleep product). The agent's
  // present_gifts tool call (see lib/agent.ts / app/api/chat/route.ts) does
  // the real narrowing using its own judgment over this pool.
  const items = [...liveScored, ...mockScored]
    .sort((a, b) => b.score - a.score || a.gift.price - b.gift.price)
    .slice(0, CANDIDATE_POOL_SIZE)
    .map((s) => s.gift);

  return { items, pastGifts };
}
