// artifacts/vanilla-betting-mvp/src/backtest.ts

import type {
  BacktestRow,
  BacktestConfig,
  BacktestResult,
  BacktestBet,
  BacktestSummary,
  BankrollSnapshot,
  KellyFraction,
} from "./types";
import { oddsToNormProb } from "./csv-parser";

function fractionMultiplier(f: KellyFraction): number {
  if (f === "full")    return 1.0;
  if (f === "half")    return 0.5;
  if (f === "quarter") return 0.25;
  return 0.5;
}

function calcEdge(p: number, decimalOdds: number): number {
  return p * (decimalOdds - 1) - (1 - p);
}

function getTrueProbs(
  row: BacktestRow,
  config: BacktestConfig
): { pH: number; pD: number; pA: number } {
  if (config.strategy === "flat") {
    return {
      pH: config.flatProbHome ?? 0,
      pD: config.flatProbDraw ?? 0,
      pA: config.flatProbAway ?? 0,
    };
  }
  if (row.pinHome && row.pinDraw && row.pinAway) {
    return oddsToNormProb(row.pinHome, row.pinDraw, row.pinAway);
  }
  return oddsToNormProb(row.oddsHome, row.oddsDraw, row.oddsAway);
}

interface Candidate {
  outcome:  "H" | "D" | "A";
  odds:     number;
  trueProb: number;
  edge:     number;
}

function buildCandidates(
  row: BacktestRow,
  p: { pH: number; pD: number; pA: number }
): Candidate[] {
  return [
    { outcome: "H", odds: row.oddsHome, trueProb: p.pH, edge: calcEdge(p.pH, row.oddsHome) },
    { outcome: "D", odds: row.oddsDraw, trueProb: p.pD, edge: calcEdge(p.pD, row.oddsDraw) },
    { outcome: "A", odds: row.oddsAway, trueProb: p.pA, edge: calcEdge(p.pA, row.oddsAway) },
  ];
}

function summarise(bets: BacktestBet[], startingBankroll: number): BacktestSummary {
  if (bets.length === 0) {
    return {
      totalBets: 0, wins: 0, winRate: 0,
      totalStaked: 0, totalPnl: 0, roi: 0,
      maxDrawdown: 0, finalBankroll: startingBankroll,
    };
  }
  const wins        = bets.filter((b) => b.won).length;
  const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
  const totalPnl    = bets.reduce((s, b) => s + b.pnl,  0);
  const roi         = totalStaked > 0 ? totalPnl / totalStaked : 0;

  let peak = 0, runningPnl = 0, maxDrawdown = 0;
  for (const bet of bets) {
    runningPnl += bet.pnl;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak > 0 ? (runningPnl - peak) / peak : 0;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  return {
    totalBets:     bets.length,
    wins,
    winRate:       wins / bets.length,
    totalStaked,
    totalPnl,
    roi,
    maxDrawdown,
    finalBankroll: bets[bets.length - 1].bankrollAfter,
  };
}

function buildBacktestSnapshots(bets: BacktestBet[]): BankrollSnapshot[] {
  return bets.map((bet, i) => ({
    date:     bet.date,
    bankroll: bet.bankrollAfter,
    betId:    String(i),
    label:    bet.label,
    outcome:  bet.won ? "won" : "lost",
    pnl:      bet.pnl,
  }));
}

export function runBacktest(
  rows: BacktestRow[],
  config: BacktestConfig
): BacktestResult {
  const multiplier = fractionMultiplier(config.kellyFraction);
  const sorted     = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  let bankroll = config.startingBankroll;
  const allBets: BacktestBet[] = [];

  for (const row of sorted) {
    if (bankroll <= 0) break;

    const split: "train" | "test" =
      row.date < config.cutoffDate ? "train" : "test";
    const trueProbs  = getTrueProbs(row, config);
    const candidates = buildCandidates(row, trueProbs);

    for (const c of candidates) {
      if (c.edge <= config.minEdge) continue;

      const b        = c.odds - 1;
      const fraction = Math.min(Math.max((c.edge / b) * multiplier, 0), 0.25);
      const stake    = bankroll * fraction;
      if (stake <= 0) continue;

      const won = row.result === c.outcome;
      const pnl = won ? stake * b : -stake;
      bankroll  = Math.max(0, bankroll + pnl);

      allBets.push({
        date:            row.date,
        label:           `${row.homeTeam} vs ${row.awayTeam} (${c.outcome})`,
        odds:            c.odds,
        trueProbability: c.trueProb,
        edge:            c.edge,
        fraction,
        stake,
        pnl,
        bankrollAfter:   bankroll,
        won,
        split,
      });
    }
  }

  const trainBets = allBets.filter((b) => b.split === "train");
  const testBets  = allBets.filter((b) => b.split === "test");
  const testStart = trainBets.length > 0
    ? trainBets[trainBets.length - 1].bankrollAfter
    : config.startingBankroll;

  return {
    config,
    bets:      allBets,
    train:     summarise(trainBets, config.startingBankroll),
    test:      summarise(testBets,  testStart),
    total:     summarise(allBets,   config.startingBankroll),
    snapshots: buildBacktestSnapshots(allBets),
  };
}

export function isRobust(result: BacktestResult): { robust: boolean; reason: string } {
  const { train, test } = result;

  if (train.totalBets < 30)
    return { robust: false, reason: "Not enough training bets (< 30) to evaluate robustness." };
  if (test.totalBets < 10)
    return { robust: false, reason: "Not enough test bets (< 10) to evaluate robustness." };
  if (train.roi <= 0)
    return { robust: false, reason: "Training ROI is negative — strategy has no edge on training data." };
  if (test.roi <= 0)
    return { robust: false, reason: `Test ROI is negative (${(test.roi * 100).toFixed(1)}%) — strategy does not generalise.` };

  const drift = Math.abs(test.roi - train.roi) / Math.abs(train.roi);
  if (drift > 0.30)
    return {
      robust: false,
      reason: `Test ROI (${(test.roi * 100).toFixed(1)}%) drifts >30% from training ROI (${(train.roi * 100).toFixed(1)}%). Possible overfit.`,
    };

  return {
    robust: true,
    reason: `✅ Robust — test ROI (${(test.roi * 100).toFixed(1)}%) is within 30% of training ROI (${(train.roi * 100).toFixed(1)}%).`,
  };
}