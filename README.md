# DinnerSorted

A weekly meal planner for neurodivergent and disabled people, built to remove
the daily "what's for dinner" decision. You tell it your safe meals, sensory
needs, energy levels and budget once; it plans a predictable week and writes
the shopping list.

**Core design principle: predictability and low cognitive load beat variety
and novelty.** The app never surprises you with unrequested change — new
foods are opt-in (default off), rotation is user-controlled, and nothing is
ever shuffled unless you press "Surprise me".

## What's built

### P0 — MVP (complete)

- **Preference intake** covering the full data model: the 14 UK regulated
  allergens plus free text, each with *avoid* vs *medical/dangerous* severity
  and a cross-contamination flag; diet type; foods/flavours to avoid; texture,
  temperature, visual and smell sensory preferences; **energy level per day**
  (not per week); recipe complexity limits (steps / ingredients / pans);
  kitchen equipment; emergency zero-effort backup meals; weekly and per-meal
  budget caps; supermarkets and household size; optional (clearly marked)
  medication/appetite timing.
- **Weekly menu generation** — deterministic and rule-based:
  - Medical allergies are hard exclusions. No swap suggestions, no override.
  - Each day is matched to that day's energy level.
  - Preference-level exclusions are visible ("why isn't this offered?") with
    a **show anyway** override, so the system never feels opaque.
  - A fixed small number of choices per day (2–3, user's choice).
  - Weekly budget checked with a warning before overspend.
- **Safe meals** — fully user-curated, with an optional quick-add starter
  library (nothing is added without the user choosing it). Meals can be
  pinned to a fixed day ("same dinner every Tuesday").
- **Shopping list** grouped by shop section, with tick-off checkboxes and
  copy/download as plain text.
- **Export / import** — one JSON file containing everything, with validation
  and plain-language errors. This is the guest-mode "account" and remains a
  permanent backup/portability feature alongside login.
- **Guest privacy**: without an account, data lives in `sessionStorage` only
  (gone when the tab closes) — health-adjacent data is never persisted
  client-side.

### P1 — Accounts & persistence (complete)

- Email + password via **Auth.js (NextAuth v5)** with bcrypt hashing,
  CSRF protection, and an optional **"stay signed in"** long session (60
  days vs 1 day) — chosen deliberately because re-authenticating is a real
  friction point for ADHD users.
- **Durable login rate limiting** in Postgres (5 failures → 15-minute
  lockout, enforced across serverless instances; correct passwords are also
  rejected during lockout).
- Preferences/meals/history stored server-side as one validated JSONB
  document per user — the same shape as the JSON export.
- **Plan history** ("Past weeks") and a one-tap **"Repeat last week"**.
- **Account deletion** with an export-everything-first flow.
- First sign-in adopts any guest-session data automatically.

### P2 — Enhancements (partial, by owner decision)

Implemented:

- **Supermarket deep-links** on the shopping list: every item links straight
  to the product search of the user's chosen supermarkets (Tesco,
  Sainsbury's, Asda, Morrisons, Aldi, Lidl, Waitrose, Co-op, Iceland, Ocado,
  Cook), primary shop first. *Honest scope note:* UK supermarkets don't
  offer public "add to basket" APIs, so a true one-click basket export isn't
  possible — this is one click per item to a pre-filled search, and the UI
  says so rather than pretending otherwise.
- **Substitution suggestions** when an item is unavailable: per-item swap
  ideas filtered against the user's allergen list (medical *and* avoid
  level) and their foods-to-avoid list. An unknown ingredient or a
  fully-filtered list returns *no* suggestions — empty beats unsafe.

Added beyond the spec (owner request):

- **Supermarket catalogue + real meal recommendations**: a companion
  scraper CLI (`tools/tesco-scraper` — see its README) runs weekly from the
  owner's own computer and fills a shared `products` table with Tesco
  ready meals: name, price, size, portions, full ingredients, UK-14
  allergens detected from the ingredients, "may contain" traces, cooking
  time, vegetarian/vegan flags and availability. The app then provides:
  a **Ready meals** browse page (pre-filtered by the user's allergy and
  sensory settings via the same engine as everything else, with visible
  "why is this hidden" reasons), one-tap add-to-safe-foods with price and
  allergens carried over, and — only when the user has opted in to new
  foods — the weekly plan's occasional suggestion becomes a **real
  supermarket ready meal** instead of a generic recipe. Suggested meals are
  embedded in the plan itself, so history and the shopping list stay
  self-contained. Runs from a residential machine because supermarket
  sites block datacentre traffic; the tool is deliberately polite and
  low-volume. Create the table once with `npm run db:push`.

- **Receipt import** (`/safe-meals/receipt`): paste an online-shopping
  receipt, or upload a screenshot or PDF of one, then tick items to add to
  the safe-foods list. Prices, quantities, totals, payment and loyalty
  lines are stripped; recognisably non-food items (cleaning products,
  toiletries, pet food, carrier bags…) are set aside **visibly, with a
  reason and a "this is food" rescue button** — never silently deleted.
  All reading happens on-device: pasted text is parsed in the page,
  screenshots are OCR'd with a self-hosted tesseract.js (no CDN), and PDFs
  are read with pdf.js. Receipts are never uploaded or stored anywhere.

Intentionally not included (project owner's decision):

- **Freezer / batch-cook stock tracking** and **meal-time reminders** from
  the spec's P2 list were explicitly descoped. The stored data model keeps
  the `freezer` and `reminders` fields (and the plan generator already
  understands freezer stock), so adding them later needs no data migration.
- **⚠ If reminders are ever added:** they cannot be fully server-scheduled
  on Vercel Hobby — Hobby cron runs **at most once per day**, within the
  scheduled hour, so same-day meal-time reminders would need (a) a single
  daily digest, (b) client-side notifications while the app is open, or
  (c) Vercel Pro. Flagged here so it's a conscious decision at that point.

## Accessibility

WCAG 2.1 AA is treated as a hard requirement on every screen, not a final
pass:

- Semantic HTML with proper landmarks, one logical heading structure, and a
  skip-to-content link on every page.
- Every control is a native element (inputs, selects, radios, checkboxes,
  `<details>`) — full keyboard operability with no custom widgets, and
  visible focus indicators at all times (including for mouse users).
- Accessible names match visible labels throughout, so Voice Control /
  Dragon / Voice Access can target controls by their on-screen text.
- Light, dark and **high-contrast** themes; **dyslexia-friendly font**
  option; adjustable text size — applied before first paint, no flash.
- AA contrast throughout; information is never conveyed by colour alone.
- `prefers-reduced-motion` respected (no animation, no autoplay anywhere).
- Errors are specific, plain-language, and programmatically associated with
  their fields (`aria-describedby` + `role="alert"`); status updates use
  polite live regions.
- No time limits, no diet-culture patterns: no calories, goals, streaks or
  guilt framing. Emergency backup meals are always shown as a fully valid
  choice.

## Tech stack

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | Frontend + API routes in one Vercel-native deploy |
| Database | Postgres (Neon or Supabase) via Drizzle ORM + postgres-js | Vercel has no persistent DB; client configured for serverless poolers (`max: 1`, `prepare: false`) |
| Auth | Auth.js (NextAuth v5), credentials + bcrypt | Free, self-hosted, no extra service; fits Hobby tier |
| Validation | zod | One schema validates imports, sync payloads and session restores |
| Styling | Hand-written CSS custom properties | Full control over contrast, focus and motion for WCAG AA |
| Tests | Vitest | Generation rules (allergy exclusions etc.) and import validation |

Everything runs as on-demand serverless functions — no long-running server,
no background processes, all API work completes in well under Hobby's
function time limit (menu generation is pure in-process computation).

> **Hobby fair-use note:** Vercel's Hobby tier is for personal,
> non-commercial use. Fine for personal use or a soft launch; monetising or
> opening it to many users means moving to a Pro team.

## Running locally

```bash
npm install
npm run dev          # guest mode — no database needed
```

Guest mode is fully functional (everything except sign-in). To enable
accounts locally, create `.env.local` from `.env.example`:

```bash
DATABASE_URL=postgres://...   # any Postgres
AUTH_SECRET=$(openssl rand -base64 32)
```

then create the tables and start:

```bash
npm run db:push
npm run dev
```

```bash
npm test             # unit tests
npm run build        # production build
```

## Deploying to Vercel (Hobby)

1. Push this repo to GitHub and import it in Vercel (framework auto-detects
   as Next.js). Preview deployments appear on every PR automatically.
2. Create a free Postgres database:
   - **Neon** (recommended): available directly in Vercel Marketplace →
     Storage → Neon, which injects `DATABASE_URL` automatically. Use the
     **pooled** connection string.
   - **Supabase**: use the **transaction pooler** string (port 6543).
3. Set environment variables in Vercel → Project → Settings:
   - `DATABASE_URL` — pooled Postgres connection string
   - `AUTH_SECRET` — output of `openssl rand -base64 32`
4. Create the tables once, from your machine:
   `DATABASE_URL="<pooled-url>" npm run db:push`
5. Deploy. If both env vars are absent the site still works fully in guest
   (export/import) mode — sign-in simply stays hidden.

## Data protection

Collected data is minimised to what meal planning needs. The medication/
appetite section is optional and clearly marked. The Data & backup page
states in plain language what is stored and why. Users can export everything
as JSON at any time, and account deletion (with an export-first step) removes
the user row and all stored data in one cascade. Guest data never touches the
server. Neon and Supabase both encrypt data at rest; all traffic is HTTPS on
Vercel.
