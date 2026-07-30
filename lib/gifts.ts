import { searchCatalog, type LiveProduct } from "./ucp";
import { MERCHANTS, type Merchant } from "./merchants";

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
};

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
    case "analyze_recipient":
      return analyzeRecipient(args);
    case "analyze_occasion":
      return analyzeOccasion(args);
    case "analyze_budget":
      return analyzeBudget(args);
    case "find_gifts":
      return await findGifts(args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function analyzeRecipient(args: Record<string, unknown>) {
  const name = typeof args.name === "string" ? args.name.trim().toLowerCase() : "";
  const pastGifts = RECIPIENT_MEMORY[name] ?? [];
  return {
    relationship: typeof args.relationship === "string" ? args.relationship : null,
    interests: Array.isArray(args.interests) ? args.interests : [],
    pastGifts,
  };
}

function analyzeOccasion(args: Record<string, unknown>) {
  const occasion = typeof args.occasion === "string" ? args.occasion : "";
  const lower = occasion.toLowerCase();
  let tone = "everyday";
  if (/birthday|graduation|promotion|got into|admitted|engagement|wedding/.test(lower)) {
    tone = "milestone";
  } else if (/sorry|sympathy|condolence|get well/.test(lower)) {
    tone = "supportive";
  } else if (/anniversary|valentine|date night/.test(lower)) {
    tone = "romantic";
  }
  return {
    occasion,
    timeline: typeof args.timeline === "string" ? args.timeline : null,
    tone,
  };
}

function analyzeBudget(args: Record<string, unknown>) {
  const amount = typeof args.amount === "number" ? args.amount : Number(args.amount) || 0;
  const tier = amount < 1200 ? "modest" : amount < 3000 ? "comfortable" : "generous";
  return { amount, currency: "INR", tier };
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
      // Strip numbers/punctuation and drop short tokens ("c", "e", "16%")
      // before matching — real ingredient/spec tokens in product titles
      // otherwise substring-collide with unrelated interests (e.g. the "c"
      // in "Vitamin C Serum" matching inside "coffee").
      const titleWords = (product.title.toLowerCase().match(/[a-z]+/g) ?? []).filter(
        (word) => word.length >= 3
      );
      scored.push({ gift, score: scoreWords(titleWords, interests) });
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
  const excludeNames = Array.isArray(args.exclude_names)
    ? (args.exclude_names as string[]).map((n) => String(n).toLowerCase())
    : [];

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

  return { items };
}
