/**
 * Receipt text parsing: turn a pasted/OCR'd/PDF-extracted supermarket
 * receipt into a clean list of candidate food items.
 *
 * Philosophy: never hide silently. Lines are either offered as food, or
 * listed under "removed" WITH a reason so the user can rescue mistakes.
 * Structural junk (totals, payment lines, bare prices) is dropped outright —
 * rescuing "TOTAL £43.20" is never useful.
 */

export interface RemovedItem {
  name: string;
  reason: string;
}

export interface ReceiptParseResult {
  food: string[];
  removed: RemovedItem[];
}

/* Lines that are receipt machinery, not items — dropped without appeal. */
const STRUCTURAL_PATTERNS: RegExp[] = [
  /^[\d\s.,£$*x×@:/-]+$/i, // prices, quantities, dates with no words
  /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/, // starts with a date
  /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+\d/i, // "Saturday 5 July ..."
  /\b(sub)?total\b/i,
  /\bbalance\b|\bamount due\b|\bto pay\b/i,
  /\b(visa|mastercard|maestro|amex|contactless|debit|credit|cash|change|card number|auth code|gift card)\b/i,
  /\b(vat|invoice|receipt|order (no|number|ref|summary)|customer|till|checkout|operator|store|branch)\b/i,
  /\b(clubcard|nectar|sparks|lidl plus|loyalty|points|reward)\b/i,
  /\b(voucher|coupon|promo|promotion|multibuy|meal deal saving|savings?|offers? applied|price cut)\b/i,
  /\b(deliver\w*|minimum basket|service charge|driver|slot|pick(ed|ing)? (by|time)|substitut\w*|out of stock|unavailable|refund\w*)\b/i,
  /\b(thank you|thanks for|welcome|opening hours|www\.|\.co\.uk|\.com|tel[:.]|phone)\b/i,
  /\bqty\b\s*$/i,
  /^page \d/i,
  /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/, // bare postcode
  // a line that is ONLY a supermarket name is a header, not an item
  // ("Tesco Cheddar 350g" is untouched — this needs the whole line to match)
  /^(tesco|sainsbury'?s?|asda|morrisons|aldi|lidl|waitrose|co-?op(erative)?( food)?|iceland|ocado|cook|m\s?&\s?s|marks\s?&\s?spencer)(\s+(express|extra|local|daily|metro|superstore|supermarkets?|stores?|plc|ltd|group))*\s*$/i,
];

/* Recognisably not food — removed, but shown with a reason and rescuable. */
const NON_FOOD_RULES: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\b(carrier bags?|bags? for life|bag charge)\b/i,
    reason: "carrier bag charge",
  },
  {
    pattern:
      /\b(toilet (roll|paper|tissue)|kitchen (roll|towel)|tissues?|cotton wool|kitchen foil|tin foil|cling film|baking (paper|parchment)|greaseproof|bin (bag|liner)s?|freezer bags?|sandwich bags?|paper towels?)\b/i,
    reason: "household paper/wrap, not food",
  },
  {
    pattern:
      /\b(washing[- ]up|dishwasher|laundry|detergent|fabric (softener|conditioner)|stain remover|bleach|disinfectant|antibac|surface (spray|cleaner|wipes)|cleaner|cleaning|polish|air freshener|descaler|sponges?|scourers?|rubber gloves)\b/i,
    reason: "cleaning product",
  },
  {
    pattern:
      /\b(shampoo|conditioner|shower gel|body wash|bubble bath|soap|hand wash|toothpaste|toothbrush|mouthwash|floss|deodorant|antiperspirant|razors?|shaving|moisturiser|suncream|sun cream|lip balm|make[- ]?up|mascara|cotton buds)\b/i,
    reason: "toiletries",
  },
  {
    pattern:
      /\b(sanitary|tampons?|panty ?liners?|incontinence|nappy|nappies|baby wipes|wet wipes|wipes)\b/i,
    reason: "personal care",
  },
  {
    pattern:
      /\b(paracetamol|ibuprofen|aspirin|antihistamine|plasters?|bandage|vitamins?|supplements?|cod liver oil|first aid)\b/i,
    reason: "medicine/supplement",
  },
  {
    pattern:
      /\b(cat (food|litter)|dog (food|treats?)|pet food|bird seed|pouch(es)? in (jelly|gravy)|litter)\b/i,
    reason: "pet product",
  },
  {
    pattern:
      /\b(batteries|light ?bulbs?|candles?|matches|firelighters|magazines?|newspapers?|greetings? cards?|wrapping paper|stationery|biros?|pens?|socks|tights|t[- ]?shirt)\b/i,
    reason: "general merchandise",
  },
  {
    pattern: /\b(flowers?|bouquet|plants?|compost)\b/i,
    reason: "flowers/garden",
  },
];

/** Strip quantity prefixes, price suffixes and receipt decorations. */
export function cleanReceiptLine(raw: string): string {
  let s = raw.trim();
  // bullets/markers
  s = s.replace(/^[-–•*✓>]+\s*/, "");
  // leading quantity: "2 x ", "1x", "3 × ", "QTY 2 "
  s = s.replace(/^qty\s*\d+\s*[:.]?\s*/i, "");
  s = s.replace(/^\d+\s*[x×]\s+/i, "");
  // trailing unit-price notes: "@ £1.20 each", "2 @ 0.85"
  s = s.replace(/\s*\d*\s*@\s*£?\d+([.,]\d{1,2})?( each)?\s*$/i, "");
  // trailing prices, possibly several columns: "… 1.75 1.75" or "… £2.50*"
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\s+[£$]?\d+[.,]\d{2}\s*[a-z*]?$/i, "");
  }
  // trailing "each"/star markers
  s = s.replace(/\s+(each|ea|per kg)\s*$/i, "");
  s = s.replace(/\s*[*]+\s*$/, "");
  // trailing quantity suffix: "x2", "x 3"
  s = s.replace(/\s+[x×]\s*\d+\s*$/i, "");
  return s.replace(/\s{2,}/g, " ").trim();
}

function isStructural(line: string): boolean {
  return STRUCTURAL_PATTERNS.some((p) => p.test(line));
}

function nonFoodReason(line: string): string | null {
  for (const rule of NON_FOOD_RULES) {
    if (rule.pattern.test(line)) return rule.reason;
  }
  return null;
}

const MAX_ITEMS = 300;

export function parseReceiptText(text: string): ReceiptParseResult {
  const food: string[] = [];
  const removed: RemovedItem[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/).slice(0, 2000)) {
    const line = rawLine.trim();
    if (line.length < 2) continue;
    if (isStructural(line)) continue;

    const cleaned = cleanReceiptLine(line);
    // Nothing left after stripping prices/quantities, or no letters at all
    if (cleaned.length < 2 || !/[a-z]{2,}/i.test(cleaned)) continue;
    if (isStructural(cleaned)) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const reason = nonFoodReason(cleaned);
    if (reason) {
      removed.push({ name: cleaned, reason });
    } else if (food.length < MAX_ITEMS) {
      food.push(cleaned);
    }
  }

  return { food, removed };
}
