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
| **1. MVP Core** | Validate the Kelly math & workflow | - Input: Odds, Win %, Bankroll<br>- Output: Stake (Half-Kelly)<br>- **Save bets** (localStorage)<br>- **Win/Lose** buttons & auto-updated bankroll | 🟢 Low | 1–2 Days |
| **2a. Data Management** | Track live performance | - **Bet History Table** (filter by status)<br>- **Bankroll Chart** (ROI, Drawdown)<br>- **Edge Display** (show % edge)<br>- Export to CSV | 🟢 Low | 1 Day |
| **2b. Backtesting Engine** | Validate strategy on real history before risking money | - **CSV Import** (football-data.co.uk)<br>- **Strategy Selector** (flat / market-implied)<br>- **Edge Threshold Filter** (e.g. only bet if edge > 3%)<br>- **Simulate** → same chart + stats panel | 🟡 Medium | 2–3 Days |
| **3. Manual Crawler** | Stop typing odds manually | - **Python Script**: Scrape 1 site (OddsPortal)<br>- **Auto-fill Form**: Paste JSON → Pre-fill odds<br>- **Batch Calc**: Calculate 10 bets at once<br>- **Value Filter**: only show edge > 5% | 🟡 Medium | 3–5 Days |
| **4. Backend API** | Decouple UI from logic, sync across devices | - **FastAPI Server** (Python)<br>- REST Endpoints: `/odds`, `/kelly`, `/history`<br>- **Database** (SQLite → PostgreSQL)<br>- User Auth (optional) | 🟠 High | 1 Week |
| **5. Full Automation** | The "Quant" System | - **Scheduler**: Check odds every 15 mins<br>- **Auto-Alerts**: Telegram/Discord bot for value bets<br>- **Auto-Bet** (if exchange API exists)<br>- **Pro Dashboard** (Vite + React) | 🔴 Very High | 2–4 Weeks |

***

## 🚀 Detailed Breakdown by Phase

### Phase 1: MVP Core ✅ Nearly Complete
**Goal:** A functional tool you can use today on Replit without any servers.
**Current Status:** ✅ Calculator works, ✅ Save button works, ✅ HKD currency, ⏳ Win/Lose logic pending push.

**Features:**
1. **Win/Lose Resolution:**
   - "💚 Win" and "❤️ Lose" buttons on every active bet in the history list
   - **Win:** `New Bankroll = Old Bankroll + (Stake × (Odds − 1))`
   - **Lose:** `New Bankroll = Old Bankroll − Stake`
   - Bet moves from Active → Won/Lost after resolution
2. **Persistent Bankroll Display:**
   - Current bankroll shown prominently at the top (e.g. `HKD 10,950`)
   - Updates instantly on every Win/Lose click, survives page refresh
3. **Reset Bankroll:**
   - Input + button to set a new starting bankroll at any time

**✅ Success Metric:** Open the page, add 3 bets, resolve 1 as win and 1 as loss, refresh — bankroll is correct and history is intact.

***

### Phase 2a: Data Management & Insights
**Goal:** Understand your live performance over time.
**Status:** Not started.

**Features:**
1. **Advanced History Table:**
   - Filter buttons: All / Active / Won / Lost
   - Each card shows: Date, Label, Odds, Win%, Edge%, Stake, P&L, Status
2. **Visual Analytics:**
   - **Bankroll Growth Chart:** SVG line graph, one dot per resolved bet, green dot = win, red dot = loss
   - **Stats Grid:** Win Rate, Total P&L, ROI, Avg Edge, Max Drawdown, Current Streak
3. **Export:**
   - "⬇ Export CSV" button — downloads full history as `kelly-bets-YYYY-MM-DD.csv`

**✅ Success Metric:** You can see your bankroll growth curve, your ROI, and export your data to Google Sheets in one click.

***

### Phase 2b: Backtesting Engine 🆕
**Goal:** Prove the strategy works on real historical data **before risking real money**.
**Status:** Not started.

**Why this comes before Phase 3:** If the backtest fails, you do not need to build the scraper. If it succeeds, you have hard evidence your edge is real.

**Features:**
1. **CSV Import:**
   - Upload a historical odds CSV from [football-data.co.uk](https://www.football-data.co.uk) (free, covers 20+ leagues, 20+ years)
   - Parser reads: Date, Home Team, Away Team, Result, Best Available Odds
2. **Strategy Selector:**
   - **Flat model:** You define a fixed win probability for all home/draw/away bets and test if the bookmaker's pricing is systematically off
   - **Market-implied model:** Use Pinnacle closing odds as the "true" probability, find value against soft bookmaker odds in the same file
3. **Simulation Controls:**
   - Starting bankroll (e.g. HKD 10,000)
   - Minimum edge threshold (e.g. only simulate bets where edge > 3%)
   - Kelly fraction selector (Full / Half / Quarter)
4. **Results Panel:**
   - Exact same bankroll chart + stats grid from Phase 2a, but populated with simulated data
   - Key outputs: Final Bankroll, ROI, Max Drawdown, Total Bets Simulated, Win Rate

**The "Training vs Test Split" safeguard:**
- You define a **cutoff date** (e.g. Jan 2025)
- Data before cutoff = training (tune your strategy here)
- Data after cutoff = test (validate without changing anything)
- If test ROI is within 30% of training ROI → strategy is robust

**✅ Success Metric:** Upload 2 seasons of EPL data, run the simulation, see a chart showing what your bankroll would look like today. ROI > 5% on the test set = proceed to Phase 3 with confidence.

***

### Phase 3: The Manual Crawler (The "Semi-Auto" Leap)
**Goal:** Stop typing odds from betting sites manually.
**Status:** Not started.

**Features:**
1. **Python Scraper Script:**
   - Script: `scripts/scrape_odds.py`
   - Target: OddsPortal (or football-data.co.uk live feed)
   - Output: `odds_today.json` — array of today's matches with best available odds
2. **JSON Import Button:**
   - "📋 Paste JSON" button in the UI
   - Loads all today's matches into a batch calculation queue
   - Runs Kelly on each match automatically using your probability model
3. **Value Filter:**
   - Only display bets where calculated edge > your threshold (e.g. 5%)
   - Remainder are hidden with a count: "14 bets below threshold hidden"
4. **Batch Save:**
   - "Save all value bets" button saves the entire filtered list in one click

**✅ Success Metric:** Run one Python command → UI shows today's EPL value bets pre-calculated. You just click "Save All" and your tracker is up to date.

***

### Phase 4: Backend API & Database
**Goal:** Move from browser storage to a real system that syncs across devices.
**Status:** Not started.

**Features:**
1. **FastAPI Server** (`artifacts/api-server/`):
   - `GET /odds` — Return today's scraped odds
   - `POST /bet` — Record a new bet
   - `PATCH /bet/{id}/resolve` — Mark as Won/Lost
   - `GET /stats` — Return chart + stats data
   - `GET /backtest` — Run backtest server-side on large datasets
2. **Database:**
   - Start with **SQLite** (zero config, file-based)
   - Migrate to **PostgreSQL** when you need multi-user or cloud hosting
   - Tables: `bets`, `bankroll_snapshots`, `backtest_runs`
3. **Frontend Switch:**
   - Replace all `localStorage` calls in `main.ts` with `fetch('/api/...')`
   - Add a `USE_LOCAL` toggle for offline fallback

**✅ Success Metric:** Open the app on your phone and laptop simultaneously — same bankroll, same history, synced in real time.

***

### Phase 5: Full Automation (The "Quant" Dream)
**Goal:** System finds value bets, alerts you, and optionally places them — while you sleep.
**Status:** Future/Research.

**Features:**
1. **Scheduler (Cron Job):**
   - Scraper runs every 15 mins
   - Calculates edge on all upcoming matches
   - Saves any new value bets (edge > threshold) to database
2. **Telegram Bot Alerts:**
   - Message format: `🚨 VALUE BET: Arsenal vs Chelsea @ 1.90 | Your p: 62% | Edge: +7.3% | Kelly Stake: HKD 865`
   - You tap "✅ Confirm" in Telegram → bet is saved to your tracker
3. **Auto-Betting (Optional / Advanced):**
   - Connect to Betfair Exchange API (cannot ban winning accounts)
   - Kelly stake is placed automatically when edge > threshold
   - Hard daily loss limit as a safety circuit breaker
4. **Pro Dashboard:**
   - If Vanilla TS UI becomes too complex, rebuild frontend in React using the `artifacts/betting-dashboard` scaffold already in your repo
   - Multi-league view, portfolio-style bankroll management

**✅ Success Metric:** Wake up, check Telegram, see 3 value bets found overnight. One tap confirms each. Your bankroll tracker updates automatically.

***

## 📅 Recommended Schedule

| Week | Phase | Deliverable | Gate to Next Phase |
|---|---|---|---|
| **Week 1** | **Phase 1** | Win/Lose logic + persistent bankroll | App works end-to-end manually |
| **Week 2** | **Phase 2a** | Charts, stats panel, CSV export | Can see ROI + drawdown on live bets |
| **Week 3** | **Phase 2b** | Backtesting engine + CSV import | Backtest shows ROI > 5% on test set |
| **Week 4** | **Phase 3** | Python scraper + JSON import + batch save | Can populate a full day's bets in < 2 mins |
| **Week 5** | **Phase 4** | FastAPI + SQLite + cross-device sync | Data accessible on phone + laptop |
| **Week 6+** | **Phase 5** | Telegram alerts + optional auto-bet | System runs itself |

> ⚠️ **The Gate Rule:** Do not start the next phase until the current phase's success metric is met. Phase 2b is the most important gate — if the backtest does not show positive ROI on historical data, stop and re-examine your probability model before building anything more complex.