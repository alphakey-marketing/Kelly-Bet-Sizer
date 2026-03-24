// artifacts/vanilla-betting-mvp/src/backtest.ts

import type { BacktestRow, BacktestConfig, BacktestResult, BacktestTrade } from "./types";
import { oddsToNormProb } from "./csv-parser";

// ── Internal helpers ───────────────────────────────────────────────────────────

interface SideCandidate {
  side:    "home" | "draw" | "away";
  odds:    number;
  prob:    number;
  edge:    number;
  won:     boolean;
}

/** Compute the three side candidates for a single row given normalised probs. */
function buildCandidates(
  row: BacktestRow,
  pH: number,
  pD: number,
  pA: number
): SideCandidate[] {
  return [
    { side: "home", odds: row.oddsH, prob: pH, edge: pH * row.oddsH - 1, won: row.result === "H" },
    { side: "draw", odds: row.oddsD, prob: pD, edge: pD * row.oddsD - 1, won: row.result === "D" },
    { side: "away", odds: row.oddsA, prob: pA, edge: pA * row.oddsA - 1, won: row.result === "A" },
  ];
}

// ── Empty result factory ───────────────────────────────────────────────────────

function emptyResult(
  startingBankroll: number,
  hasPinnacleOdds: boolean,
  skipReason: string
): BacktestResult {
  return {
    trades:           [],
    betsPlaced:       0,
    betsSkipped:      0,
    wins:             0,
    losses:           0,
    winRate:          0,
    roi:              0,
    totalPnl:         0,
    maxDrawdown:      0,
    finalBankroll:    startingBankroll,
    startingBankroll,
    avgEdge:          0,
    hasPinnacleOdds,
    skipReason,
    robustnessFlags:  [],
  };
}

// ── Main engine ────────────────────────────────────────────────────────────────

/**
 * Simulate a betting strategy over historical match rows using Kelly staking.
 *
 * Probability estimation:
 *   - Requires Pinnacle/sharp odds (psH/psD/psA) as the probability source
 *     (closing-line value approach).
 *   - If no row in the CSV has Pinnacle odds the run is aborted early and
 *     `hasPinnacleOdds = false` is set on the result.
 *
 * Staking:
 *   - Bets are always placed at the market odds (oddsH/oddsD/oddsA).
 *   - Kelly fraction controls how aggressive the stake is relative to full-Kelly.
 *   - Only bets with edge >= config.minEdge are placed.
 *   - Bets below config.minStakeAmount are skipped.
 */
export function runBacktest(rows: BacktestRow[], config: BacktestConfig): BacktestResult {
  const { startingBankroll, betSide, kellyFraction, minEdge, minStakeAmount } = config;

  // ── Fix 3: Normalise date filter strings for reliable string comparison ────
  /** Normalise a date string to YYYY-MM-DD. Accepts YYYY-MM-DD (passthrough)
   *  and DD/MM/YYYY. Returns null if the format is unrecognised. */
  function normDateFilter(raw: string): string | null {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  const normFrom = config.dateFrom ? normDateFilter(config.dateFrom) : null;
  const normTo   = config.dateTo   ? normDateFilter(config.dateTo)   : null;

  // ── Issue 6: Date-range filter ──────────────────────────────────────────────
  const filteredRows = rows.filter((r) => {
    if (normFrom && r.date < normFrom) return false;
    if (normTo   && r.date > normTo)   return false;
    return true;
  });

  // ── Issue 1: Require Pinnacle odds ──────────────────────────────────────────
  const hasPinnacleOdds = filteredRows.some(
    (r) => r.psH !== undefined || r.psD !== undefined || r.psA !== undefined
  );
  if (!hasPinnacleOdds) {
    return emptyResult(
      startingBankroll,
      false,
      "This CSV has no Pinnacle (sharp) odds. Edge cannot be reliably estimated. " +
      "Please upload a CSV with PSH/PSD/PSA or PSCH/PSCD/PSCA columns."
    );
  }

  // ── Simulation state ────────────────────────────────────────────────────────
  let bankroll     = startingBankroll;
  let peakBankroll = startingBankroll;
  let maxDrawdown  = 0;
  let totalEdge    = 0;
  let totalStaked  = 0;
  let betsSkipped  = 0;
  let wins         = 0;
  let losses       = 0;

  const trades: BacktestTrade[] = [];

  for (const row of filteredRows) {
    // Skip rows where Pinnacle odds are not fully available
    if (row.psH === undefined || row.psD === undefined || row.psA === undefined) {
      betsSkipped++;
      continue;
    }

    // Normalised probabilities from Pinnacle (sharp) closing odds
    const { pH, pD, pA } = oddsToNormProb(row.psH, row.psD, row.psA);

    // ── Issue 2: Select which side to bet ──────────────────────────────────
    let chosen: SideCandidate | undefined;

    if (betSide === "best") {
      // Evaluate all three sides and pick the one with the highest edge above minEdge
      const candidates = buildCandidates(row, pH, pD, pA)
        .filter((c) => c.edge >= minEdge)
        .sort((a, b) => b.edge - a.edge);
      chosen = candidates[0];
    } else {
      const all = buildCandidates(row, pH, pD, pA);
      const c   = all.find((x) => x.side === betSide)!;
      if (c.edge >= minEdge) chosen = c;
    }

    if (!chosen) {
      betsSkipped++;
      continue;
    }

    // ── Kelly staking ───────────────────────────────────────────────────────
    const b         = chosen.odds - 1;
    const q         = 1 - chosen.prob;
    const fullKelly = (chosen.prob * b - q) / b;
    const stake     = Math.max(0, bankroll * fullKelly * kellyFraction);

    if (stake <= 0) {
      betsSkipped++;
      continue;
    }

    // Cap stake at current bankroll
    const actualStake = Math.min(stake, bankroll);

    // ── Issue 4: Min stake floor ────────────────────────────────────────────
    if (actualStake < minStakeAmount) {
      betsSkipped++;
      continue;
    }

    // ── Outcome ─────────────────────────────────────────────────────────────
    const pnl = chosen.won ? actualStake * b : -actualStake;
    bankroll  += pnl;
    totalStaked += actualStake;
    totalEdge   += chosen.edge;

    if (chosen.won) wins++;
    else            losses++;

    // Track peak-to-trough drawdown
    if (bankroll > peakBankroll) peakBankroll = bankroll;
    const drawdown = (bankroll - peakBankroll) / peakBankroll;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;

    trades.push({
      date:     row.date,
      match:    `${row.home} vs ${row.away}`,
      betSide:  chosen.side,
      odds:     chosen.odds,
      edge:     chosen.edge,
      stake:    actualStake,
      pnl,
      bankroll: Math.max(0, bankroll),
    });

    // ── Fix 1: Ruin guard — halt simulation when bankroll is exhausted ───────
    if (bankroll <= 0) {
      bankroll = 0;
      break;
    }
  }

  const betsPlaced = wins + losses;
  const winRate    = betsPlaced > 0 ? wins / betsPlaced : 0;
  const totalPnl   = bankroll - startingBankroll;
  const roi        = totalStaked > 0 ? totalPnl / totalStaked : 0;
  const avgEdge    = betsPlaced > 0 ? totalEdge / betsPlaced : 0;

  // ── Issue 5: Robustness flags ───────────────────────────────────────────────
  const robustnessFlags: string[] = [];
  if (betsPlaced < 100) {
    robustnessFlags.push(`Insufficient sample: ${betsPlaced} bets (need 100)`);
  }
  if (roi <= 0) {
    robustnessFlags.push("Negative ROI");
  }
  if (maxDrawdown <= -0.25) {
    robustnessFlags.push(`Drawdown too deep: ${(maxDrawdown * 100).toFixed(0)}%`);
  }
  if (betsPlaced > 0 && winRate < 0.30) {
    robustnessFlags.push(`Win rate too low: ${(winRate * 100).toFixed(0)}% (need 30%)`);
  }

  // ── Fix 2: Provide a skipReason when hasPinnacleOdds=true but 0 bets placed ─
  const noBetsSkipReason = betsPlaced === 0
    ? "No bets placed. All rows were skipped due to edge/stake filters or missing Pinnacle odds on individual rows."
    : undefined;

  return {
    trades,
    betsPlaced,
    betsSkipped,
    wins,
    losses,
    winRate,
    roi,
    totalPnl,
    maxDrawdown,
    finalBankroll:    bankroll,
    startingBankroll,
    avgEdge,
    hasPinnacleOdds:  true,
    ...(noBetsSkipReason ? { skipReason: noBetsSkipReason } : {}),
    robustnessFlags,
  };
}

/**
 * A result is considered "robust" when all robustness checks pass.
 * Individual failure reasons are available in result.robustnessFlags.
 *
 * Thresholds:
 *  - at least 100 bets placed (statistically meaningful sample)
 *  - positive ROI
 *  - maximum drawdown shallower than -25 %
 *  - win rate of at least 30 %
 */
export function isRobust(result: BacktestResult): boolean {
  return result.robustnessFlags.length === 0 && result.betsPlaced > 0;
}

