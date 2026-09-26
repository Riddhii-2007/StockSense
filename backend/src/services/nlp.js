/**
 * Natural-language -> structured intent.
 *
 * Two paths, same output shape:
 *   1. A deterministic parser, which always works with no API key.
 *   2. Claude, when ANTHROPIC_API_KEY is set, for phrasing the rules miss.
 *
 * IMPORTANT: whatever this module returns is untrusted input. It is fed to the
 * same validateOperation() as a typed form, and nothing here writes to stock.
 */

const NUM_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  hundred: 100,
};

const TYPE_PATTERNS = [
  [/\b(transfer|move|shift|relocate)\b/i, 'transfer'],
  [/\b(receive|receipt|receipts|intake|inbound|add|stock in)\b/i, 'receipt'],
  [/\b(deliver|delivery|deliveries|dispatch|issue|ship|outbound)\b/i, 'delivery'],
  [/\b(adjust|adjustment|correct|fix|write off|writeoff|damage|shrink)\b/i, 'adjustment'],
];

function parseNumber(text) {
  const digits = text.match(/-?\d+(?:\.\d+)?/);
  if (digits) return Number(digits[0]);
  for (const [word, value] of Object.entries(NUM_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) return value;
  }
  return null;
}

function stripLeadingVerb(text) {
  let out = text;
  for (const [re] of TYPE_PATTERNS) out = out.replace(re, ' ');
  return out.replace(/\b(all|some|please|stock|units|unit|pieces|pcs|of|the|qty|quantity)\b/gi, ' ');
}

/**
 * Deterministic parser. Intentionally conservative: when it is not confident
 * it returns a low confidence score so the UI asks the user to confirm rather
 * than guessing at stock.
 */
export function parseDeterministic(text) {
  const raw = String(text ?? '').trim();
  if (!raw) {
    return { type: null, quantity: null, product: null, sourceLocation: null, destLocation: null, confidence: 0, parser: 'rules' };
  }

  let type = null;
  for (const [re, t] of TYPE_PATTERNS) {
    if (re.test(raw)) {
      type = t;
      break;
    }
  }

  let quantity = parseNumber(raw);
  let direction = null;

  // "adjust X by -5" / "reduce X by 5"
  if (type === 'adjustment') {
    const down = /\b(reduce|decrease|remove|short|damage|shrink|loss)\b/i.test(raw);
    const up = /\b(increase|add|found|correct up)\b/i.test(raw);
    if (down && !up) direction = 'OUT';
    else if (up && !down) direction = 'IN';
    if (quantity != null && quantity < 0) {
      direction = 'OUT';
      quantity = Math.abs(quantity);
    }
  }

  // Locations: "from A to B" is unambiguous; otherwise fall back to from/into.
  let sourceLocation = null;
  let destLocation = null;
  const fromTo = raw.match(/\bfrom\s+([a-z0-9 \-]+?)\s+to\s+([a-z0-9 \-]+?)(?=\s*(?:$|[.,;]|\bfor\b|\bbecause\b|\bto\b.*\bby\b))/i);
  if (fromTo) {
    sourceLocation = fromTo[1].trim();
    destLocation = fromTo[2].trim();
  } else {
    const from = raw.match(/\bfrom\s+([a-z0-9 \-]+?)(?=\s*(?:$|[.,;]|\bfor\b|\bto\b|\bin\b))/i);
    const into = raw.match(/\b(?:into|to|in)\s+([a-z0-9 \-]+?)(?=\s*(?:$|[.,;]|\bfor\b|\bbecause\b|\bby\b))/i);
    if (from) sourceLocation = from[1].trim();
    if (into) destLocation = into[1].trim();
  }

  // What is left after removing verbs, quantity, and location phrases is the product.
  let rest = stripLeadingVerb(raw);
  if (fromTo) {
    rest = rest.replace(fromTo[0], ' ');
  } else {
    if (from) rest = rest.replace(from[0], ' ');
    const into = rest.match(/\b(?:into|to|in)\s+([a-z0-9 \-]+?)(?=\s*(?:$|[.,;]))/i);
    if (into) rest = rest.replace(into[0], ' ');
  }
  rest = rest.replace(/-?\d+(?:\.\d+)?/g, ' ');
  const product = rest.replace(/\s{2,}/g, ' ').replace(/^[\s,.\-]+|[\s,.\-]+$/g, '').trim() || null;

  let confidence = 0;
  if (type) confidence += 0.4;
  if (quantity != null) confidence += 0.25;
  if (product) confidence += 0.2;
  if (sourceLocation || destLocation) confidence += 0.15;
  if (type === 'transfer' && !(sourceLocation && destLocation)) confidence -= 0.3;
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));

  return {
    type,
    quantity,
    product,
    sourceLocation,
    destLocation,
    direction,
    confidence,
    parser: 'rules',
    raw,
  };
}

const SYSTEM_PROMPT = `You extract inventory operations from plain English.

Return ONLY a JSON object with these keys:
  type: one of receipt, delivery, transfer, adjustment
  quantity: a positive number
  product: the product name or SKU, copied from the user's words
  sourceLocation: where stock leaves from, or null
  destLocation: where stock arrives, or null
  direction: for adjustment only, "IN" or "OUT"; otherwise null

Rules:
- transfer requires both sourceLocation and destLocation, and they must differ.
- receipt sets destLocation only.
- delivery sets sourceLocation only.
- adjustment sets sourceLocation to the location being adjusted.
- Never invent a product, SKU or location that is not in the user's text.
- Never guess a quantity that is not stated. Use null if it is missing.

Example input: "move 20 steel rods from main store to production rack"
Example output: {"type":"TRANSFER","quantity":20,"product":"steel rods","sourceLocation":"main store","destLocation":"production rack","direction":null}`;

/** Ask Claude for a structured intent. Returns null if unavailable or malformed. */
export async function parseWithClaude(text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: String(text) }],
      }),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const block = payload?.content?.find((c) => c.type === 'text');
    if (!block?.text) return null;
    const json = block.text.match(/\{[\s\S]*\}/);
    if (!json) return null;
    const parsed = JSON.parse(json[0]);
    if (!parsed?.type) return null;
    return {
      type: String(parsed.type).toLowerCase(),
      quantity: parsed.quantity == null ? null : Number(parsed.quantity),
      product: parsed.product ?? null,
      sourceLocation: parsed.sourceLocation ?? null,
      destLocation: parsed.destLocation ?? null,
      direction: parsed.direction ?? null,
      confidence: 0.9,
      parser: 'claude',
      raw: String(text),
    };
  } catch {
    return null;
  }
}

/** Claude first when a key is present, deterministic rules as the floor. */
export async function parseIntent(text) {
  const rules = parseDeterministic(text);
  if (rules.confidence >= 0.8) return rules;
  const claude = await parseWithClaude(text);
  return claude ?? rules;
}
