// artifacts/vanilla-betting-mvp/src/stats.ts

import type { SavedBet, BankrollSnapshot } from "./types";

export interface PerformanceStats {
  totalBets:     number;
  resolvedBets:  number;
  wins:          number;
  losses:        number;
  winRate:       number;   // 0–1
  totalStaked:   number;
  totalPnl:      number;
  roi:           number;   // totalPnl / totalStaked
  maxDrawdown:   number;   // e.g. -0.18 = -18% peak-to-trough
  avgEdge:       number;   // average edge across all saved bets
  currentStreak: number;   // +3 = 3-win streak, -2 = 2-loss streak
}

export function calcStats(bets: SavedBet[]): PerformanceStats {
  const resolved = bets.filter((b) => b.status !== "active");
  const wins     = resolved.filter((b) => b.status === "won");
  const losses   = resolved.filter((b) => b.status === "lost");

  const totalStaked = resolved.reduce(
    (sum, b) => sum + b.result.recommendedBetAmount, 0
  );
  const totalPnl = resolved.reduce((sum, b) => sum + (b.pnl ?? 0), 0);
  const roi      = totalStaked > 0 ? totalPnl / totalStaked : 0;
  const winRate  = resolved.length > 0 ? wins.length / resolved.length : 0;
  const avgEdge  = bets.length > 0
    ? bets.reduce((sum, b) => sum + (b.result.edge ?? 0), 0) / bets.length
    : 0;

  // Max drawdown: largest peak-to-trough drop in cumulative P&L
  const chronological = [...resolved].sort(
    (a, b) => new Date(a.resolvedAt!).getTime() - new Date(b.resolvedAt!).getTime()
  );
  let peak = 0;
  let runningPnl = 0;
  let maxDrawdown = 0;
  for (const bet of chronological) {
    runningPnl += bet.pnl ?? 0;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak > 0 ? (runningPnl - peak) / peak : 0;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  // Current streak: count consecutive same outcomes from most recent
  let currentStreak = 0;
  const byRecent = [...resolved].sort(
    (a, b) => new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime()
  );
  if (byRecent.length > 0) {
    const dir = byRecent[0].status; // "won" or "lost"
    for (const b of byRecent) {
      if (b.status !== dir) break;
      currentStreak += dir === "won" ? 1 : -1;
    }
  }

  return {
    totalBets:     bets.length,
    resolvedBets:  resolved.length,
    wins:          wins.length,
    losses:        losses.length,
    winRate,
    totalStaked,
    totalPnl,
    roi,
    maxDrawdown,
    avgEdge,
    currentStreak,
  };
}

// Build time-ordered snapshots for the bankroll chart
export function buildSnapshots(
  bets: SavedBet[],
  startingBankroll: number
): BankrollSnapshot[] {
  const resolved = bets
    .filter((b) => b.status !== "active" && b.resolvedAt)
    .sort(
      (a, b) =>
        new Date(a.resolvedAt!).getTime() - new Date(b.resolvedAt!).getTime()
    );

  let running = startingBankroll;
  return resolved.map((bet) => {
    running += bet.pnl ?? 0;
    return {
      date:     bet.resolvedAt!,
      bankroll: running,
      betId:    bet.id,
      label:    bet.label ?? "Unnamed",
      outcome:  bet.status as "won" | "lost",
      pnl:      bet.pnl ?? 0,
    };
  });
}