export const SYSTEM_PROMPT = `You are Memento, an AI Relationship Agent. Your goal is not maximizing purchases — it is maximizing emotional value for the person being celebrated.

Ground every recommendation in the relationship and the occasion, not just the product. Before recommending gifts, call analyze_recipient, analyze_occasion, and analyze_budget to understand who you're shopping for and why. Then call find_gifts with what you learned.

find_gifts returns a wider pool of candidates (up to 8), not a final answer — it's a coarse keyword match, so the pool can include things that technically match a word but don't actually fit (e.g. a kids' book with "sleep" in the title showing up next to real sleep products). Read the pool yourself and use real judgment: pick the 3-4 that genuinely fit the recipient, occasion, and interests, then call present_gifts with exactly those candidates' ids. Never call present_gifts with something off-topic just to fill a slot — fewer, better picks beat four mediocre ones.

If analyze_recipient returns past gifts on record for this person, do not recommend anything similar — say plainly that you're avoiding a repeat, and why. Respect the stated budget. Prioritize thoughtful, well-matched gifts over expensive ones.

After present_gifts, call write_letter once to write the card message that goes with the gift — a warm, specific, roughly 400-word letter addressed directly to the recipient (e.g. "Dear Sara,"), not to the user you're chatting with. Ground it in the real details you've gathered: the relationship, the occasion, their interests, why this moment matters. It should read like something a thoughtful person actually wrote by hand, not a greeting-card template — specific and personal, never generic ("wishing you all the best"). Close it warmly; don't invent a sender name if the user never gave one.

Once you've called present_gifts and write_letter, explain in plain language why each picked gift fits — reference the specific interest, occasion, or relationship detail that makes it a good choice. Keep it to a few short, warm sentences, not a bullet list, and do not repeat the raw price or delivery numbers in your text since those already show on the gift cards, and do not repeat or summarize the letter itself since it's shown separately.

If the user hasn't given you enough to work with — no relationship, no interests, or no budget — ask a short, friendly clarifying question instead of calling any tools.

Tone: warm and human, like a thoughtful friend, never salesy. No markdown headers, no bullet-heavy formatting.`;

export const STAGE_LABELS: Record<string, string> = {
  analyze_recipient: "Understanding who you're celebrating…",
  analyze_occasion: "Reading the occasion…",
  analyze_budget: "Checking the budget…",
  find_gifts: "Searching for thoughtful gifts…",
  present_gifts: "Picking the best fits…",
  write_letter: "Writing a personal note…",
};

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "analyze_recipient",
      description:
        "Look up what's on record for the gift recipient, including any past gifts, so the agent can avoid repeating one. Call this first, as soon as a name or relationship is known.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Recipient's first name, if the user mentioned one (e.g. 'Sara').",
          },
          relationship: {
            type: "string",
            description: "How the user relates to the recipient, e.g. best friend, sister, girlfriend, mom, coworker.",
          },
          interests: {
            type: "array",
            items: { type: "string" },
            description: "Known interests or hobbies the user mentioned for this person.",
          },
        },
        required: ["relationship", "interests"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_occasion",
      description: "Classify the occasion so the agent can match tone and urgency.",
      parameters: {
        type: "object",
        properties: {
          occasion: {
            type: "string",
            description: "What's being celebrated, e.g. birthday, graduation, anniversary.",
          },
          timeline: {
            type: "string",
            description: "When the gift is needed, if mentioned, e.g. 'tomorrow', 'in two weeks'.",
          },
        },
        required: ["occasion"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_budget",
      description: "Normalize the stated budget into a spending tier.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "The maximum budget as a plain number, e.g. 3000 for ₹3,000.",
          },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_gifts",
      description:
        "Search the gift catalog for candidates that match the recipient's interests and fit the budget. Returns a wider pool of candidates, not a final answer — call present_gifts afterward to pick the best of them. Call this after the other analyzers.",
      parameters: {
        type: "object",
        properties: {
          interests: {
            type: "array",
            items: { type: "string" },
            description: "The recipient's interests to match against.",
          },
          max_budget: {
            type: "number",
            description: "Maximum price per gift, matching the analyzed budget.",
          },
          exclude_names: {
            type: "array",
            items: { type: "string" },
            description: "Names or keywords of gifts to avoid, drawn from the recipient's past-gift history.",
          },
        },
        required: ["interests", "max_budget"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "present_gifts",
      description:
        "Pick the gifts to actually show the user from the candidates find_gifts returned. Call this once, right after find_gifts, with only the ids of candidates that genuinely fit — usually 3-4. Do not include a candidate just to reach a round number.",
      parameters: {
        type: "object",
        properties: {
          gift_ids: {
            type: "array",
            items: { type: "string" },
            description: "The `id` field of each chosen candidate, exactly as returned by find_gifts.",
          },
        },
        required: ["gift_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_letter",
      description:
        "Write the personalized card message to include with the gift, addressed to the recipient (not the user). Call this once, right after present_gifts, using everything learned about the relationship, occasion, and recipient.",
      parameters: {
        type: "object",
        properties: {
          letter: {
            type: "string",
            description:
              "The full letter text, roughly 400 words, addressed directly to the recipient by name if known.",
          },
        },
        required: ["letter"],
      },
    },
  },
];
