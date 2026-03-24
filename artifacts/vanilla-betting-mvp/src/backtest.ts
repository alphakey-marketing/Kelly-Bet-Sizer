// artifacts/vanilla-betting-mvp/src/backtest.ts

import type { BacktestRow, BacktestConfig, BacktestResult, BacktestTrade } from "./types";
import { oddsToNormProb } from "./csv-parser";

/**
 * Simulate a betting strategy over historical match rows using Kelly staking.
 *
 * Probability estimation:
 *   - When Pinnacle/sharp odds (psH/psD/psA) are present they are used as the
 *     probability source (closing-line value approach).
 *   - Otherwise the normalised implied probability from the market odds is used.
 *
 * Staking:
 *   - Bets are always placed at the market odds (oddsH/oddsD/oddsA).
 *   - Kelly fraction controls how aggressive the stake is relative to full-Kelly.
 *   - Only bets with edge >= config.minEdge are placed.
 */
export function runBacktest(rows: BacktestRow[], config: BacktestConfig): BacktestResult {
  const { startingBankroll, betSide, kellyFraction, minEdge } = config;

  let bankroll     = startingBankroll;
  let peakBankroll = startingBankroll;
  let maxDrawdown  = 0;
  let totalEdge    = 0;
  let totalStaked  = 0;
  let betsSkipped  = 0;
  let wins         = 0;
  let losses       = 0;

  const trades: BacktestTrade[] = [];

  for (const row of rows) {
    // Market odds for the chosen side (used for actual payout)
    const marketOdds =
      betSide === "home" ? row.oddsH :
      betSide === "draw" ? row.oddsD :
      row.oddsA;

    // Probability source: Pinnacle odds if available, else market odds
    const probH = row.psH ?? row.oddsH;
    const probD = row.psD ?? row.oddsD;
    const probA = row.psA ?? row.oddsA;
    const { pH, pD, pA } = oddsToNormProb(probH, probD, probA);
    const prob =
      betSide === "home" ? pH :
      betSide === "draw" ? pD :
      pA;

    // Edge = estimated_prob * market_odds - 1
    const edge = prob * marketOdds - 1;

    if (edge < minEdge) {
      betsSkipped++;
      continue;
    }

    // Full-Kelly fraction: f* = (p*b - q) / b
    const b         = marketOdds - 1;
    const q         = 1 - prob;
    const fullKelly = (prob * b - q) / b;
    const stake     = Math.max(0, bankroll * fullKelly * kellyFraction);

    if (stake <= 0) {
      betsSkipped++;
      continue;
    }

    // Cap stake at current bankroll to avoid negative balance
    const actualStake = Math.min(stake, bankroll);

    // Determine outcome
    const won =
      (betSide === "home" && row.result === "H") ||
      (betSide === "draw" && row.result === "D") ||
      (betSide === "away" && row.result === "A");

    const pnl = won ? actualStake * b : -actualStake;
    bankroll  += pnl;
    totalStaked += actualStake;
    totalEdge   += edge;

    if (won) wins++;
    else     losses++;

    // Track peak-to-trough drawdown
    if (bankroll > peakBankroll) peakBankroll = bankroll;
    const drawdown = (bankroll - peakBankroll) / peakBankroll;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;

    trades.push({
      date:     row.date,
      match:    `${row.home} vs ${row.away}`,
      betSide,
      odds:     marketOdds,
      edge,
      stake:    actualStake,
      pnl,
      bankroll,
    });
  }

  const betsPlaced = wins + losses;
  const winRate    = betsPlaced > 0 ? wins / betsPlaced : 0;
  const totalPnl   = bankroll - startingBankroll;
  const roi        = totalStaked > 0 ? totalPnl / totalStaked : 0;
  const avgEdge    = betsPlaced > 0 ? totalEdge / betsPlaced : 0;

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
    finalBankroll: bankroll,
    startingBankroll,
    avgEdge,
  };
}

/**
 * Heuristic check: a result is considered "robust" when it meets all of:
 *  - at least 30 bets placed (statistically meaningful sample)
 *  - positive ROI
 *  - maximum drawdown shallower than -50 %
 *  - win rate of at least 25 %
 */
export function isRobust(result: BacktestResult): boolean {
  return (
    result.betsPlaced >= 30 &&
    result.roi > 0 &&
    result.maxDrawdown > -0.5 &&
    result.winRate >= 0.25
  );
}
