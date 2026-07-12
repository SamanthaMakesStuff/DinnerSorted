# DinnerSorted Tesco catalogue scraper

A companion command-line tool that reads Tesco's ready-meals category into
the DinnerSorted `products` table, so the web app can recommend real
supermarket meals with real prices, ingredients and allergens.

**Run it from your own computer.** Supermarket sites block traffic from
data centres (Vercel, GitHub Actions), so this is designed for a normal
home connection with a real browser. It is deliberately polite — one page
at a time with multi-second pauses — a full run of ~400 products takes
roughly 30–45 minutes in the background.

> **Fair-use note:** Tesco's terms don't allow automated scraping, so keep
> this personal, low-volume and infrequent (weekly is plenty). If Tesco
> changes their pages the tool may need updating — run with `--limit 5`
> after a long gap to check it still parses before doing a full run.

## One-time setup (Windows PowerShell)

```powershell
cd C:\Users\Samantha\Documents\DinnerSorted\tools\tesco-scraper
npm install
npx playwright install chromium
```

Make sure the main project's `.env` (or `.env.development.local`) contains
your `DATABASE_URL` — the scraper reads it from there automatically.

Then create the new table once, from the main project folder:

```powershell
cd C:\Users\Samantha\Documents\DinnerSorted
npm run db:push
```

## Running it

```powershell
cd C:\Users\Samantha\Documents\DinnerSorted\tools\tesco-scraper
npm run scrape
```

Useful variations:

| Command | What it does |
| --- | --- |
| `node scrape.mjs --limit 5` | Quick health-check: 5 products only |
| `node scrape.mjs --dry-run` | No database writes — results go to `products.json` to inspect |
| `node scrape.mjs --headed` | Shows the browser window so you can watch/debug |
| `node scrape.mjs --fixtures ./saved` | Parses saved `.html` files instead of the live site |

## Weekly schedule (optional)

Windows Task Scheduler → Create Basic Task → Weekly → Action "Start a
program":

- Program: `cmd`
- Arguments: `/c cd /d C:\Users\Samantha\Documents\DinnerSorted\tools\tesco-scraper && npm run scrape >> scrape.log 2>&1`

## What it captures per product

Name, price, pack size, portions ("Serves 2"), full ingredients text,
UK-14 allergens detected from the ingredients, "may contain" traces,
cooking time (microwave preferred), vegetarian/vegan flags, category,
image URL, and availability (a full run marks products that have
disappeared from the category as unavailable, so the app stops
recommending them).

## If Tesco keeps blocking it

Tesco sits behind Akamai bot protection. A block shows as an **"Access
Denied"** page (reference to `edgesuite.net`). The tool tries hard to look
like a normal visitor:

- it drives your **real installed Chrome** (not a bundled browser),
- keeps a **saved profile** in `chrome-profile/` so clearance cookies
  persist between runs,
- primes the session on the Tesco homepage before opening the category,
- and, in `--headed` mode, **pauses and lets you solve any challenge by
  hand** — once you press Enter it carries on with the cleared session.

**Recommended routine when blocked:**

```powershell
node scrape.mjs --limit 5 --headed --dry-run
```

When the Chrome window shows a block or verification page, just browse
normally to the ready-meals category in that window (search "ready meals",
click through), then return to the terminal and press Enter. Because the
profile is saved, later runs — even headless `npm run scrape` — reuse that
cleared session for a while.

**If it still won't get through:** that's Akamai doing its job, and pushing
harder (proxies, fingerprint spoofing) isn't worth it for a personal tool
and strays further from the site's terms. The good fallback that needs no
scraping at all:

- **Open Food Facts** — a free, open, API-friendly database with structured
  ingredients and allergens for many UK products. It lacks live prices and
  "what's in stock this week", but your **receipt importer already captures
  real prices** from your actual shops. Ask and this tool can be pointed at
  Open Food Facts instead of scraping Tesco.

The rest of the app (browse page, catalogue-based suggestions) works
identically whichever source fills the `products` table.

## Changing scope

Edit `config.json` — `categoryUrls` is a list, so adding more Tesco
categories (pizzas, frozen meals…) is one line each. `maxProducts` caps a
run. If the ready-meals URL changes, paste the new one from your browser.
