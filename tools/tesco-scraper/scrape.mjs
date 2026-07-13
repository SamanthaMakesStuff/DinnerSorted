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
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  extractProductFromHtml,
  extractProductLinks,
  splitByFreshness,
} from "./extract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.json"), "utf8")
);
// Categories to crawl: new shape is categories: [{url, label}]; the old
// categoryUrls + categoryLabel shape still works.
const CATEGORIES =
  config.categories ??
  (config.categoryUrls ?? []).map((url) => ({
    url,
    label: config.categoryLabel ?? "",
  }));
const PER_CATEGORY_CAP = config.maxProductsPerCategory ?? config.maxProducts ?? 400;

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
// --full ignores freshness and re-visits every product page.
const FULL = flag("--full");

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

/** Pause the run and wait for the user to press Enter in the terminal. */
function waitForEnter(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(message, () => {
    rl.close();
    resolve();
  }));
}

/** True when a page looks like an Akamai/bot "Access Denied" block. */
async function looksBlocked(page) {
  const title = (await page.title().catch(() => "")).toLowerCase();
  if (title.includes("access denied") || title.includes("are you a robot"))
    return true;
  const body = await page
    .textContent("body")
    .catch(() => "");
  return /access denied|you don't have permission|edgesuite\.net|unusual traffic|verify you are human/i.test(
    body ?? ""
  );
}

async function upsertProduct(sql, p) {
  await sql`
    insert into products (
      id, supermarket, url, name, price_pence, size_text, portions,
      ingredients_text, allergens, may_contain, cook_minutes,
      cooking_instructions, cook_tools, diet_flags,
      category, image_url, available, first_seen_at, last_seen_at
    ) values (
      ${p.id}, ${p.supermarket}, ${p.url}, ${p.name}, ${p.pricePence},
      ${p.sizeText}, ${p.portions}, ${p.ingredientsText},
      ${sql.json(p.allergens)}, ${sql.json(p.mayContain)},
      ${p.cookMinutes}, ${p.cookingInstructions ?? ""},
      ${sql.json(p.cookTools ?? [])}, ${sql.json(p.dietFlags)}, ${p.category},
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
      cooking_instructions = excluded.cooking_instructions,
      cook_tools = excluded.cook_tools,
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
      const p = extractProductFromHtml(html, canonical, CATEGORIES[0]?.label ?? "");
      if (p) {
        products.push(p);
        console.log(`  parsed: ${p.name} (£${((p.pricePence ?? 0) / 100).toFixed(2)})`);
      } else {
        console.warn(`  skipped ${f}: not recognisable as a product page`);
      }
    }
  } else {
    const { chromium } = await import("playwright");

    // Use a persistent profile in a REAL Chrome where possible, with the
    // automation fingerprint stripped. This is what gives the best chance
    // against Akamai bot protection: a returning-looking profile whose
    // clearance cookies persist between runs, plus a human fallback below.
    const profileDir = path.join(__dirname, "chrome-profile");
    const launchOpts = {
      headless: !HEADED,
      viewport: { width: 1366, height: 900 },
      locale: "en-GB",
      timezoneId: "Europe/London",
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
    };
    let context;
    try {
      // Real installed Chrome — far less fingerprintable than bundled Chromium.
      context = await chromium.launchPersistentContext(profileDir, {
        channel: "chrome",
        ...launchOpts,
      });
    } catch {
      console.warn(
        "Couldn't launch your installed Chrome (channel: chrome); " +
          "falling back to bundled Chromium, which is easier for sites to block."
      );
      context = await chromium.launchPersistentContext(profileDir, launchOpts);
    }
    // Mask the most obvious automation signal.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    const page = context.pages()[0] ?? (await context.newPage());

    // Prime the session on the Tesco homepage first (sets Akamai cookies the
    // way a normal visit would) before jumping to a deep category URL.
    await page.goto("https://www.tesco.com/", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    }).catch(() => {});
    try {
      await page.getByRole("button", { name: /accept all/i }).first().click({ timeout: 5000 });
    } catch {
      /* no banner */
    }
    await sleep(1500);

    // 1) Collect product links from the category pages, remembering which
    //    category each product came from.
    const linkLabels = new Map(); // product url -> category label
    let aborted = false;
    for (const { url: categoryUrl, label } of CATEGORIES) {
      let categoryCount = 0;
      console.log(`\n=== ${label} ===`);
      for (let pageNo = 1; pageNo <= config.maxCategoryPages; pageNo++) {
        const url =
          pageNo === 1 ? categoryUrl : `${categoryUrl}?page=${pageNo}`;
        console.log(`category: ${url}`);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

        // Bot-block handling. In headed mode, hand control to the user to
        // solve the challenge once; the persistent profile remembers it.
        if (await looksBlocked(page)) {
          if (HEADED) {
            await waitForEnter(
              "\n  ⚠ Tesco is showing a block/verification page.\n" +
                "  In the Chrome window that opened: solve any 'are you human'\n" +
                "  challenge, or just browse to the ready-meals category so a\n" +
                "  normal page loads. Then come back here and press Enter…"
            );
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
          }
          if (await looksBlocked(page)) {
            const debugPath = path.join(__dirname, "debug-category.html");
            fs.writeFileSync(debugPath, await page.content());
            console.warn(
              `  Still blocked by Tesco (Akamai). Saved ${debugPath}.\n` +
                (HEADED
                  ? "  The automated browser is being detected. See the README's\n" +
                    "  'If Tesco keeps blocking it' section for options."
                  : "  Re-run with --headed to solve the check manually once.")
            );
            aborted = true;
            break;
          }
        }

        // cookie banner (first category page)
        try {
          await page.getByRole("button", { name: /accept all/i }).first().click({ timeout: 4000 });
        } catch {
          /* none */
        }
        // product tiles can render after initial load — wait for one
        try {
          await page.waitForSelector('a[href*="/products/"]', {
            timeout: 15000,
          });
        } catch {
          /* handled by zero-link diagnostics below */
        }
        await sleep(1500);
        const before = linkLabels.size;
        const html = await page.content();
        for (const l of extractProductLinks(html)) {
          if (!linkLabels.has(l)) {
            linkLabels.set(l, label);
            categoryCount++;
          }
        }
        console.log(`  ${label}: ${categoryCount} products so far`);
        if (categoryCount === 0 && pageNo === 1) {
          const debugPath = path.join(__dirname, "debug-category.html");
          fs.writeFileSync(debugPath, html);
          const title = await page.title();
          console.warn(
            `  no product links found for "${label}". Page title was: "${title}".\n` +
              `  Check the category URL in config.json (copy it from your\n` +
              `  browser's address bar). Saved the page to ${debugPath}.`
          );
        }
        if (linkLabels.size === before) break; // no new products → past last page
        if (categoryCount >= PER_CATEGORY_CAP) break;
        if (LIMIT && linkLabels.size >= LIMIT) break;
        await politeDelay();
      }
      if (aborted || (LIMIT && linkLabels.size >= LIMIT)) break;
    }

    // 2) Incremental mode: products scraped within refreshDays don't need
    //    their pages re-visited — the listing already proves they're still
    //    stocked, so just bump their availability. Weekly runs then only
    //    visit new or stale products. --full forces visiting everything.
    let productLinks = [...linkLabels.keys()].slice(
      0,
      LIMIT ?? CATEGORIES.length * PER_CATEGORY_CAP
    );
    if (!DRY_RUN && !FULL) {
      const dbUrl = loadDatabaseUrl();
      if (dbUrl) {
        const { default: postgres } = await import("postgres");
        const sqlEarly = postgres(dbUrl, { max: 1, prepare: false });
        try {
          const rows = await sqlEarly`
            select url, last_seen_at from products
            where supermarket = ${config.supermarket}
          `;
          const existing = new Map(rows.map((r) => [r.url, r.last_seen_at]));
          const { visit, refreshOnly } = splitByFreshness(
            productLinks,
            existing,
            config.refreshDays ?? 14
          );
          for (let i = 0; i < refreshOnly.length; i += 100) {
            const chunk = refreshOnly.slice(i, i + 100);
            await sqlEarly`
              update products set last_seen_at = now(), available = true
              where url in ${sqlEarly(chunk)}
            `;
          }
          if (refreshOnly.length > 0) {
            console.log(
              `\n${refreshOnly.length} products scraped within the last ` +
                `${config.refreshDays ?? 14} days — availability refreshed ` +
                `without visiting (use --full to force re-visits)`
            );
          }
          productLinks = visit;
        } finally {
          await sqlEarly.end();
        }
      }
    }

    if (productLinks.length > 0)
      console.log(`\nvisiting ${productLinks.length} product pages…`);
    let done = 0;
    for (const url of productLinks) {
      await politeDelay();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        if (await looksBlocked(page)) {
          console.warn(`  blocked on ${url} — skipping`);
          continue;
        }
        const p = extractProductFromHtml(
          await page.content(),
          url,
          linkLabels.get(url) ?? ""
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
    await context.close();
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
