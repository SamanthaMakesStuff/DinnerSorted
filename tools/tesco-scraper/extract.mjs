/**
 * Pure extraction functions for Tesco product pages.
 * No I/O here — everything takes HTML/text in and returns data out, so the
 * whole module is unit-testable and fixture-drivable without a browser.
 *
 * Strategy: prefer the schema.org Product JSON-LD block (stable, structured)
 * and fall back to text heuristics for the fields JSON-LD doesn't carry
 * (ingredients, portions, cooking time).
 */

/** UK-14 allergen keyword map (keyword → canonical allergen name). */
const ALLERGEN_KEYWORDS = [
  [/\b(wheat|barley|rye|oats?|spelt|gluten)\b/i, "Cereals containing gluten"],
  [/\b(milk|cream|butter|cheese|whey|lactose|yoghurt|yogurt)\b/i, "Milk"],
  [/\begg s?\b|\beggs?\b/i, "Eggs"],
  [/\b(fish|salmon|tuna|cod|haddock|anchov)/i, "Fish"],
  [/\b(prawn|shrimp|crab|lobster|crustacean)/i, "Crustaceans"],
  [/\b(mussel|oyster|squid|scallop|mollusc|clam)/i, "Molluscs"],
  [/\b(soya?|soybean|tofu|edamame)\b/i, "Soybeans"],
  [/\bpeanuts?\b/i, "Peanuts"],
  [
    /\b(almond|hazelnut|walnut|cashew|pecan|pistachio|macadamia|brazil nut|tree nuts?|\bnuts\b)/i,
    "Tree nuts",
  ],
  [/\bcelery|celeriac\b/i, "Celery"],
  [/\bmustard\b/i, "Mustard"],
  [/\bsesame\b/i, "Sesame"],
  [/\b(sulphite|sulfite|sulphur dioxide|sulfur dioxide|e22[0-8])\b/i, "Sulphur dioxide/sulphites"],
  [/\blupin\b/i, "Lupin"],
];

export function mapTextToAllergens(text) {
  const found = new Set();
  for (const [pattern, allergen] of ALLERGEN_KEYWORDS) {
    if (pattern.test(text)) found.add(allergen);
  }
  return [...found];
}

/** Strip tags to text, preserving line-ish structure. */
export function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** All schema.org JSON-LD objects found in the page. */
export function extractJsonLd(html) {
  const blocks = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]);
      for (const obj of Array.isArray(parsed) ? parsed : [parsed]) {
        blocks.push(obj);
        if (Array.isArray(obj?.["@graph"])) blocks.push(...obj["@graph"]);
      }
    } catch {
      // ignore malformed blocks
    }
  }
  return blocks;
}

function findProductLd(html) {
  return (
    extractJsonLd(html).find(
      (b) => b?.["@type"] === "Product" || (Array.isArray(b?.["@type"]) && b["@type"].includes("Product"))
    ) ?? null
  );
}

/**
 * Product-page links from a category/listing page.
 *
 * Primary source is the server-rendered schema.org ItemList JSON-LD (stable,
 * present before client JS runs). Falls back to anchor hrefs. Handles both
 * Tesco URL shapes: the newer /shop/en-GB/products/ and the older
 * /groceries/en-GB/products/.
 */
export function extractProductLinks(html, baseUrl = "https://www.tesco.com") {
  const links = new Set();

  const addFromUrl = (url) => {
    if (typeof url !== "string") return;
    if (!/\/products\/\d+/.test(url)) return;
    const abs = url.startsWith("http") ? url : baseUrl + url;
    links.add(abs.split("?")[0]);
  };

  // 1) JSON-LD ItemList — the reliable path.
  for (const block of extractJsonLd(html)) {
    const items =
      block?.["@type"] === "ItemList" ? block.itemListElement : null;
    if (Array.isArray(items)) {
      for (const it of items) {
        addFromUrl(it?.url ?? it?.item?.["@id"] ?? it?.item?.url);
      }
    }
  }

  // 2) Anchor hrefs, either URL shape.
  const re =
    /href=["']([^"']*\/(?:shop|groceries)\/en-GB\/products\/\d+[^"']*)["']/gi;
  let m;
  while ((m = re.exec(html))) addFromUrl(m[1]);

  return [...links];
}

export function productIdFromUrl(url) {
  const m = url.match(/\/products\/(\d+)/);
  return m ? m[1] : null;
}

function sectionAfter(text, headings, stops) {
  const startRe = new RegExp(`^\\s*(${headings.join("|")})\\s*:?\\s*$`, "im");
  const start = text.match(startRe);
  if (!start || start.index == null) return "";
  const rest = text.slice(start.index + start[0].length);
  const stopRe = new RegExp(`^\\s*(${stops.join("|")})\\b.*$`, "im");
  const stop = rest.match(stopRe);
  return (stop && stop.index != null ? rest.slice(0, stop.index) : rest)
    .trim()
    .slice(0, 4000);
}

export function extractIngredients(text) {
  return sectionAfter(
    text,
    ["ingredients", "ingredients list"],
    [
      "allergy information",
      "allergy advice",
      "nutrition",
      "storage",
      "produce of",
      "preparation",
      "cooking instructions",
      "manufacturer",
      "return to",
      "net contents",
      "additives",
      "warnings",
      "using product information",
    ]
  );
}

export function extractPortions(text) {
  const m =
    text.match(/serves\s*(\d{1,2})/i) ??
    text.match(/(\d{1,2})\s*portions?\b/i) ??
    text.match(/(\d{1,2})\s*servings?\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 12 ? n : null;
}

export function extractSizeText(name, text) {
  const inName = name.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\b/i);
  if (inName) return `${inName[1]}${inName[2].toLowerCase()}`;
  const m = text.match(/net contents\s*\n?\s*(\d+(?:\.\d+)?\s*(?:g|kg|ml|l)e?)\b/i);
  return m ? m[1].replace(/\s+/g, "").toLowerCase() : "";
}

export function extractCookMinutes(text) {
  // Prefer microwave time (the low-effort route), else any "N mins".
  const micro = text.match(/micro[\s\S]{0,160}?(\d{1,2})\s*(?:-\s*\d{1,2}\s*)?min/i);
  if (micro) return parseInt(micro[1], 10);
  const oven = text.match(/oven[\s\S]{0,160}?(\d{1,2})\s*(?:-\s*\d{1,2}\s*)?min/i);
  if (oven) return parseInt(oven[1], 10);
  const any = text.match(/(\d{1,2})\s*(?:-\s*\d{1,2}\s*)?mins?\b/i);
  return any ? parseInt(any[1], 10) : null;
}

export function extractMayContain(text) {
  const m = text.match(/may (?:also )?contain[^.\n]*/i);
  return m ? mapTextToAllergens(m[0]) : [];
}

export function extractDietFlags(text) {
  const flags = [];
  if (/suitable for vegetarians|vegetarian society/i.test(text)) flags.push("vegetarian");
  if (/suitable for vegans|vegan society|\bvegan\b/i.test(text)) flags.push("vegan");
  return flags;
}

/**
 * Full product extraction from a product-page HTML string.
 * Returns null when the page doesn't look like a product page.
 */
export function extractProductFromHtml(html, url, categoryLabel = "") {
  const ld = findProductLd(html);
  const text = htmlToText(html);
  const externalId = productIdFromUrl(url);

  const name = (ld?.name ?? "").toString().trim();
  if (!name || !externalId) return null;

  let pricePence = null;
  const offers = Array.isArray(ld?.offers) ? ld.offers[0] : ld?.offers;
  const priceRaw = offers?.price ?? offers?.lowPrice;
  if (priceRaw != null && !Number.isNaN(Number(priceRaw))) {
    pricePence = Math.round(Number(priceRaw) * 100);
  }

  const ingredientsText = extractIngredients(text);
  const allergenSource = ingredientsText || text.slice(0, 6000);

  return {
    id: `tesco:${externalId}`,
    supermarket: "Tesco",
    url,
    name,
    pricePence,
    sizeText: extractSizeText(name, text),
    portions: extractPortions(text),
    ingredientsText,
    allergens: ingredientsText ? mapTextToAllergens(ingredientsText) : [],
    mayContain: extractMayContain(text),
    cookMinutes: extractCookMinutes(text),
    dietFlags: extractDietFlags(text),
    category: categoryLabel,
    imageUrl: (Array.isArray(ld?.image) ? ld.image[0] : ld?.image ?? "")
      .toString()
      .slice(0, 500),
  };
}
