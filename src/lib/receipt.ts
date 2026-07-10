/**
 * Receipt text parsing: turn a pasted/OCR'd/PDF-extracted supermarket
 * receipt into a clean list of candidate food items with prices.
 *
 * Philosophy: never hide silently. Lines are either offered as food, or
 * listed under "removed" WITH a reason so the user can rescue mistakes.
 * Structural junk (totals, payment lines, greetings, bare prices) is
 * dropped outright — rescuing "TOTAL £43.20" is never useful.
 *
 * Price-anchored mode: when a document has several priced lines (true of
 * virtually every real receipt), any line WITHOUT a price is treated as
 * prose — greetings, delivery blurb, marketing — and dropped. This is what
 * keeps PDF order confirmations clean.
 */

export interface ReceiptItem {
  name: string;
  /** Per-item price in pounds, when one could be read from the line. */
  price: number | null;
}

export interface RemovedItem {
  name: string;
  reason: string;
  price: number | null;
}

export interface ReceiptParseResult {
  food: ReceiptItem[];
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
  // greetings and sign-offs in order-confirmation emails/PDFs
  /^(dear|hello|hi)\b/i,
  /\b(kind regards|best wishes|see you soon|happy shopping|your order|questions\??|need help|get in touch|contact us|terms (and|&) conditions|privacy policy|unsubscribe)\b/i,
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

interface ParsedLine {
  name: string;
  price: number | null;
  qty: number;
}

const PRICE_TOKEN = /[£$]?(\d{1,4})[.,](\d{2})\b/g;

/**
 * Split a receipt line into item name, per-item price, and quantity.
 * "2 x Heinz Baked Beans 415g £1.90" → { name: "Heinz Baked Beans 415g",
 * price: 0.95, qty: 2 } (the line price divided across the quantity).
 */
export function parseReceiptLine(raw: string): ParsedLine {
  let s = raw.trim();
  // bullets/markers
  s = s.replace(/^[-–•*✓>]+\s*/, "");

  // leading quantity: "2 x ", "1x", "3 × ", "QTY 2 "
  let qty = 1;
  const qtyMatch = s.match(/^(?:qty\s*)?(\d{1,2})\s*[x×]\s+/i);
  if (qtyMatch) {
    qty = Math.max(1, parseInt(qtyMatch[1], 10));
    s = s.slice(qtyMatch[0].length);
  } else {
    s = s.replace(/^qty\s*\d+\s*[:.]?\s*/i, "");
  }

  // Find the last plausible price on the line BEFORE stripping decorations.
  // Weight-priced lines ("1.2kg @ £0.78 each") deliberately use the unit
  // price — it's the closest thing to a per-item figure. Kept in pence to
  // avoid float drift when dividing across quantities.
  let pence: number | null = null;
  for (const m of s.matchAll(PRICE_TOKEN)) {
    const value = parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
    if (value > 0 && value < 100000) pence = value;
  }

  // Column-format receipts (e.g. M&S PDFs): "name  qty  £  total" or
  // "name  qty  unit  total". The quantity column is only recognised when
  // followed by a DETACHED currency symbol or two price columns — so pack
  // sizes in names ("Free Range Eggs 6 £1.95") are left alone.
  const col = s.match(
    /\s(\d{1,2})\s+(?:[£$€]\s+\d{1,4}[.,]\d{2}|\d{1,4}[.,]\d{2}\s+[£$€]?\s*\d{1,4}[.,]\d{2})\s*$/
  );
  if (col && qty === 1) {
    const q = parseInt(col[1], 10);
    if (q >= 1 && q <= 24) {
      qty = q;
      s = s.slice(0, col.index);
    }
  }

  // trailing unit-price notes: "@ £1.20 each", "2 @ 0.85"
  s = s.replace(/\s*\d*\s*@\s*£?\d+([.,]\d{1,2})?( each)?\s*$/i, "");
  // trailing prices, possibly several columns: "… 1.75 1.75" or "… £2.50*"
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\s+[£$]?\d+[.,]\d{2}\s*[a-z*]?$/i, "");
  }
  // a currency symbol left dangling by column layouts ("… 1 £")
  s = s.replace(/\s+[£$€]\s*$/, "");
  // trailing "each"/star markers
  s = s.replace(/\s+(each|ea|per kg)\s*$/i, "");
  s = s.replace(/\s*[*]+\s*$/, "");
  // trailing quantity suffix: "x2", "x 3"
  s = s.replace(/\s+[x×]\s*\d+\s*$/i, "");

  const name = s.replace(/\s{2,}/g, " ").trim();
  const perItem = pence == null ? null : Math.round(pence / qty) / 100;
  return { name, price: perItem, qty };
}

/** Back-compat helper: just the cleaned name. */
export function cleanReceiptLine(raw: string): string {
  return parseReceiptLine(raw).name;
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

/** Long, wordy, unpriced lines are prose (greetings, blurb), not items. */
function looksLikeProse(name: string, price: number | null): boolean {
  if (price != null) return false;
  const words = name.split(/\s+/).length;
  if (words >= 9) return true;
  if (words >= 5 && /[.!?]$/.test(name)) return true;
  return false;
}

const MAX_ITEMS = 300;
/** Priced lines needed before unpriced lines are treated as prose. */
const PRICE_ANCHOR_THRESHOLD = 4;

export function parseReceiptText(text: string): ReceiptParseResult {
  const food: ReceiptItem[] = [];
  const removed: RemovedItem[] = [];
  const seen = new Set<string>();

  const parsed: ParsedLine[] = [];
  for (const rawLine of text.split(/\r?\n/).slice(0, 2000)) {
    const line = rawLine.trim();
    if (line.length < 2) continue;
    if (isStructural(line)) continue;

    const p = parseReceiptLine(line);
    // Nothing left after stripping prices/quantities, or no letters at all
    if (p.name.length < 2 || !/[a-z]{2,}/i.test(p.name)) continue;
    if (isStructural(p.name)) continue;
    if (looksLikeProse(p.name, p.price)) continue;
    parsed.push(p);
  }

  // Price-anchored mode: real receipts price almost every item, so once
  // several priced lines exist, unpriced leftovers are prose/noise.
  const pricedCount = parsed.filter((p) => p.price != null).length;
  const priceAnchored = pricedCount >= PRICE_ANCHOR_THRESHOLD;

  for (const p of parsed) {
    if (priceAnchored && p.price == null) continue;

    const key = p.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const reason = nonFoodReason(p.name);
    if (reason) {
      removed.push({ name: p.name, reason, price: p.price });
    } else if (food.length < MAX_ITEMS) {
      food.push({ name: p.name, price: p.price });
    }
  }

  return { food, removed };
}
