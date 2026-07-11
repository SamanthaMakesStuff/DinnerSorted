#!/usr/bin/env node
/**
 * DinnerSorted Tesco catalogue scraper.
 *
 * Run this from YOUR OWN machine (residential IP, real browser), not from a
 * server — see README.md in this folder. It is deliberately polite: one
 * page at a time, randomised multi-second delays, and it only visits
 * product pages it hasn't seen or that need refreshing.
 *
 * Usage:
 *   npm run scrape                      # full run into the database
 *   node scrape.mjs --limit 10          # first 10 products only (testing)
 *   node scrape.mjs --dry-run           # no DB writes; writes products.json
 *   node scrape.mjs --fixtures ./dir    # parse saved .html files instead of
 *                                       # the live site (debugging/tests)
 *   node scrape.mjs --headed            # watch the browser as it works
 *
 * DATABASE_URL is read from the environment, or from ../../.env /
 * ../../.env.development.local (the web app's files).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractProductFromHtml,
  extractProductLinks,
} from "./extract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.json"), "utf8")
);

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const LIMIT = opt("--limit") ? parseInt(opt("--limit"), 10) : null;
const DRY_RUN = flag("--dry-run");
const FIXTURES = opt("--fixtures");
const HEADED = flag("--headed");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const file of [".env.development.local", ".env"]) {
    const p = path.join(__dirname, "..", "..", file);
    if (!fs.existsSync(p)) continue;
    const m = fs
      .readFileSync(p, "utf8")
      .match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/m);
    if (m) return m[1].trim();
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const politeDelay = () =>
  sleep(
    config.minDelayMs + Math.random() * (config.maxDelayMs - config.minDelayMs)
  );

async function upsertProduct(sql, p) {
  await sql`
    insert into products (
      id, supermarket, url, name, price_pence, size_text, portions,
      ingredients_text, allergens, may_contain, cook_minutes, diet_flags,
      category, image_url, available, first_seen_at, last_seen_at
    ) values (
      ${p.id}, ${p.supermarket}, ${p.url}, ${p.name}, ${p.pricePence},
      ${p.sizeText}, ${p.portions}, ${p.ingredientsText},
      ${sql.json(p.allergens)}, ${sql.json(p.mayContain)},
      ${p.cookMinutes}, ${sql.json(p.dietFlags)}, ${p.category},
      ${p.imageUrl}, true, now(), now()
    )
    on conflict (url) do update set
      name = excluded.name,
      price_pence = excluded.price_pence,
      size_text = excluded.size_text,
      portions = excluded.portions,
      ingredients_text = excluded.ingredients_text,
      allergens = excluded.allergens,
      may_contain = excluded.may_contain,
      cook_minutes = excluded.cook_minutes,
      diet_flags = excluded.diet_flags,
      category = excluded.category,
      image_url = excluded.image_url,
      available = true,
      last_seen_at = now()
  `;
}

async function main() {
  const products = [];
  const runStart = new Date();

  if (FIXTURES) {
    // Offline mode: every .html file in the folder is treated as a saved
    // product page. Great for testing extraction without touching Tesco.
    const files = fs
      .readdirSync(FIXTURES)
      .filter((f) => f.endsWith(".html"))
      .slice(0, LIMIT ?? Infinity);
    for (const f of files) {
      const html = fs.readFileSync(path.join(FIXTURES, f), "utf8");
      const canonical =
        html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
        html.match(/href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1] ??
        `https://www.tesco.com/groceries/en-GB/products/${f.replace(/\D/g, "") || "0"}`;
      const p = extractProductFromHtml(html, canonical, config.categoryLabel);
      if (p) {
        products.push(p);
        console.log(`  parsed: ${p.name} (£${((p.pricePence ?? 0) / 100).toFixed(2)})`);
      } else {
        console.warn(`  skipped ${f}: not recognisable as a product page`);
      }
    }
  } else {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: !HEADED });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      locale: "en-GB",
    });

    // 1) Collect product links from the category pages.
    const links = new Set();
    for (const categoryUrl of config.categoryUrls) {
      for (let pageNo = 1; pageNo <= config.maxCategoryPages; pageNo++) {
        const url =
          pageNo === 1 ? categoryUrl : `${categoryUrl}?page=${pageNo}`;
        console.log(`category: ${url}`);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        // cookie banner, first page only
        try {
          await page
            .getByRole("button", { name: /accept all/i })
            .first()
            .click({ timeout: 4000 });
        } catch {
          /* no banner — fine */
        }
        await sleep(1500);
        const before = links.size;
        for (const l of extractProductLinks(await page.content())) links.add(l);
        console.log(`  products so far: ${links.size}`);
        if (links.size === before) break; // no new products → past last page
        if (links.size >= (LIMIT ?? config.maxProducts)) break;
        await politeDelay();
      }
      if (links.size >= (LIMIT ?? config.maxProducts)) break;
    }

    // 2) Visit each product page and extract.
    const productLinks = [...links].slice(0, LIMIT ?? config.maxProducts);
    console.log(`\nvisiting ${productLinks.length} product pages…`);
    let done = 0;
    for (const url of productLinks) {
      await politeDelay();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        const p = extractProductFromHtml(
          await page.content(),
          url,
          config.categoryLabel
        );
        done++;
        if (p) {
          products.push(p);
          console.log(`  [${done}/${productLinks.length}] ${p.name}`);
        } else {
          console.warn(`  [${done}/${productLinks.length}] could not parse ${url}`);
        }
      } catch (e) {
        console.warn(`  failed ${url}: ${String(e).slice(0, 120)}`);
      }
    }
    await browser.close();
  }

  console.log(`\nextracted ${products.length} products`);

  if (DRY_RUN) {
    const out = path.join(__dirname, "products.json");
    fs.writeFileSync(out, JSON.stringify(products, null, 2));
    console.log(`dry run: wrote ${out}, no database writes`);
    return;
  }

  const dbUrl = loadDatabaseUrl();
  if (!dbUrl) {
    console.error(
      "No DATABASE_URL found (env var, ../../.env or ../../.env.development.local). " +
        "Use --dry-run to test without a database."
    );
    process.exit(1);
  }
  const { default: postgres } = await import("postgres");
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    for (const p of products) await upsertProduct(sql, p);
    console.log(`saved ${products.length} products to the database`);

    // A FULL run (no --limit, no fixtures) is the source of truth for
    // availability: anything not seen this run has left the shelves.
    if (!LIMIT && !FIXTURES) {
      const gone = await sql`
        update products set available = false
        where supermarket = ${config.supermarket} and last_seen_at < ${runStart}
      `;
      console.log(`marked ${gone.count} previously-seen products unavailable`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
