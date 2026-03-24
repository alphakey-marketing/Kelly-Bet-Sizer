# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Artifacts

### `artifacts/vanilla-betting-mvp` (`@workspace/vanilla-betting-mvp`)

Vanilla TypeScript + Vite betting calculator with Half-Kelly position sizing.

- Entry: `index.html` — UI template with Tailwind via CDN
- `src/main.ts` — Core DOM logic & event listeners
- `src/kelly.ts` — Half-Kelly math (`halfKelly()` function)
- `src/storage.ts` — LocalStorage wrapper (load/save/clear bets)
- `src/types.ts` — TypeScript interfaces (`BetInputs`, `KellyResult`, `SavedBet`)
- Preview: `/vanilla-betting-mvp/`
- `pnpm --filter @workspace/vanilla-betting-mvp run dev` — dev server

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

Here is a clear, phase-by-phase **development roadmap** for your **Kelly Bet Sizer**.

This roadmap takes you from a **simple calculator** to a **full automation system** (the "High-End" version you mentioned earlier with crawlers and APIs).

***

## 🗺️ The 5-Phase Roadmap

| Phase | Goal | Key Features | Complexity | Time Estimate |
|---|---|---|---|---|
| **1. MVP Core** | Validate the Kelly math & workflow | -  Input: Odds, Win %, Bankroll<br>-  Output: Stake (Half-Kelly)<br>-  **Save bets** (localStorage)<br>-  **Win/Lose** buttons & auto-updated bankroll | 🟢 Low | 1–2 Days |
| **2. Data Management** | Track history & performance | -  **Bet History Table** (filter by date/result)<br>-  **Bankroll Chart** (ROI, Drawdown)<br>-  **Edge Display** (show % edge)<br>-  Export to CSV | 🟢 Low | 1 Day |
| **3. Manual Crawler** | Stop typing odds manually | -  **Python Script**: Scrape 1 site (OddsPortal)<br>-  **Auto-fill Form**: Paste HTML → Pre-fill odds<br>-  **Batch Calc**: Calculate 10 bets at once | 🟡 Medium | 3–5 Days |
| **4. Backend API** | Decouple UI from Logic | -  **FastAPI Server** (Python)<br>-  REST Endpoints: `/odds`, `/kelly`, `/history`<br>-  **Database** (SQLite → PostgreSQL)<br>-  User Auth (optional) | 🟠 High | 1 Week |
| **5. Full Automation** | The "Quant" System | -  **Scheduler**: Check odds every 5 mins<br>-  **Auto-Alerts**: Telegram/Discord bot for value bets<br>-  **Auto-Bet** (if exchange API exists)<br>-  **Dashboard** (Vite + React) | 🔴 Very High | 2–4 Weeks |

***

## 🚀 Detailed Breakdown by Phase

### Phase 1: MVP Core (🔴 START HERE / YOU ARE NOW)
**Goal:** A functional tool you can use *today* on Replit without any servers.
**Current Status:** ✅ Calculator works, ✅ Save button works, ❌ No Win/Lose logic yet.

**Features to Build Now:**
1.  **Win/Lose Resolution:**
    *   Add "💚 Win" and "❤️ Lose" buttons to every saved bet in the history list.
    *   *Logic:*
        *   **Win:** `New Bankroll = Old Bankroll + (Stake * Odds - Stake)`
        *   **Lose:** `New Bankroll = Old Bankroll - Stake`
    *   Remove the bet from the "Active" list after resolution.
2.  **Persistent Display:**
    *   Show the **Current Bankroll** prominently at the top (e.g., `HKD 10,950`).
    *   Update it instantly when a bet is resolved.
3.  **Edge Indicator:**
    *   Show the calculated **Edge** (e.g., `+8.2%`) next to the recommendation so you know *why* it was a good bet.

**✅ Success Metric:** You can open the page, add 3 bets, resolve 1 as a win and 1 as a loss, and see your bankroll change correctly after a page refresh.

***

### Phase 2: Data Management & Insights
**Goal:** Understand your performance over time.
**Status:** Not started.

**Features:**
1.  **Advanced History Table:**
    *   Columns: Date, Match, Odds, Stake, Result (Win/Loss), P&L, ROI.
    *   Filters: "Show only Wins", "Show Last 7 Days".
2.  **Visual Analytics:**
    *   **Bankroll Growth Chart:** Line graph of your bankroll over time.
    *   **Drawdown Widget:** Show max loss streak (e.g., "Max down: -8%").
3.  **Export:**
    *   Button: "Download Export.csv" to analyze in Excel/Sheets.

**✅ Success Metric:** You can see a graph of your bankroll growing (hopefully!) over the last month.

***

### Phase 3: The Manual Crawler (The "Semi-Auto" Leap)
**Goal:** Stop typing odds from betting sites manually.
**Status:** Not started.

**Features:**
1.  **Python Scraper Script:**
    *   Script: `scripts/scrape_pl.py`
    *   Target: OddsPortal (or similar).
    *   Output: JSON file `odds_today.json` with matches + odds.
2.  **Browser Extension / Pre-fill Button:**
    *   Option A: A simple "Paste JSON" button in your UI to load matches instantly.
    *   Option B: A Chrome extension that reads the current page and fills your form fields.
3.  **Value Filter:**
    *   The scraper + your model auto-calculates edge.
    *   Only show bets where `Edge > 5%`.

**✅ Success Metric:** You run one Python command, and the UI instantly populates with 20 potential bets without you typing a single number.

***

### Phase 4: Backend API & Database
**Goal:** Move from "Browser Storage" to "Real System".
**Status:** Not started.

**Features:**
1.  **FastAPI Server:**
    *   Endpoints:
        *   `GET /odds` (Return today's scraped odds)
        *   `POST /bet` (Record a new bet)
        *   `PATCH /bet/{id}/resolve` (Mark as Win/Lose)
        *   `GET /stats` (Return chart data)
2.  **Database (PostgreSQL/SQLite):**
    *   Replace `localStorage` with a real DB.
    *   Tables: `bets`, `bankroll_history`, `users`.
3.  **Frontend Switch:**
    *   Update `main.ts` to call `fetch('/api/...')` instead of `localStorage`.

**✅ Success Metric:** You can open the app on your phone and your laptop, and the history/bankroll syncs because it's in the DB, not the browser.

***

### Phase 5: Full Automation (The "Quant" Dream)
**Goal:** System runs itself, alerts you, maybe even bets for you.
**Status:** Future/Research.

**Features:**
1.  **Scheduler (Cron):**
    *   Script runs every 15 mins: Scrape → Calculate → Check Edge.
2.  **Alerts:**
    *   Telegram Bot: "🚨 VALUE BET FOUND: Arsenal vs Chelsea @ 1.90 (Edge +7%)"
3.  **Auto-Betting (Risky):**
    *   Connect to a Betting Exchange API (e.g., Betfair, Pinnacle if allowed).
    *   Automatically place the Kelly stake.
4.  **Pro Dashboard (React):**
    *   If the UI gets too complex for Vanilla TS, rebuild the frontend in React (using the `betting-dashboard` scaffold we made earlier).

**✅ Success Metric:** You wake up, check your Telegram, and see 3 profitable bets were found (and maybe even placed) while you slept.

***

## 📅 Recommended Schedule

| Week | Focus | Deliverable |
|---|---|---|
| **Week 1** | **Phase 1** | MVP with Win/Lose logic & Bankroll tracking. |
| **Week 2** | **Phase 2** | Charts, History Table, CSV Export. |
| **Week 3** | **Phase 3** | Python Scraper for 1 League + Auto-fill. |
| **Week 4** | **Phase 4** | FastAPI Backend + Database integration. |
| **Week 5+** | **Phase 5** | Telegram Alerts & Automation (Optional). |

***
