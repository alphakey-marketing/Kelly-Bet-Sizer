// artifacts/vanilla-betting-mvp/src/types.ts

// ── Live betting types ─────────────────────────────────────────────────────────

export interface BetInputs {
  bankroll:        number;
  winProbability:  number;  // 0–1
  decimalOdds:     number;
  label?:          string;
}

export interface KellyResult {
  fullKellyFraction:    number;
  halfKellyFraction:    number;
  recommendedBetAmount: number;
  edge:                 number;  // p*(odds-1) - (1-p)
}

export type BetStatus = "active" | "won" | "lost";

export interface SavedBet extends BetInputs {
  id:          string;
  savedAt:     string;
  resolvedAt?: string;
  status:      BetStatus;
  result:      KellyResult;
  pnl?:        number;
}

export interface BankrollSnapshot {
  date:     string;
  bankroll: number;
  betId:    string;
  label:    string;
  outcome:  "won" | "lost";
  pnl:      number;
}

// ── Phase 2b: Backtesting types ────────────────────────────────────────────────

export interface BacktestRow {
  date:      string;   // normalised "YYYY-MM-DD"
  homeTeam:  string;
  awayTeam:  string;
  result:    "H" | "D" | "A";
  oddsHome:  number;
  oddsDraw:  number;
  oddsAway:  number;
  pinHome?:  number;
  pinDraw?:  number;
  pinAway?:  number;
}

export type KellyFraction = "full" | "half" | "quarter";
export type StrategyModel  = "flat" | "market";

export interface BacktestConfig {
  startingBankroll: number;
  kellyFraction:    KellyFraction;
  strategy:         StrategyModel;
  minEdge:          number;    // 0–1, e.g. 0.03 = 3%
  cutoffDate:       string;    // "YYYY-MM-DD"
  flatProbHome?:    number;    // 0–1
  flatProbDraw?:    number;
  flatProbAway?:    number;
}

export interface BacktestBet {
  date:            string;
  label:           string;
  odds:            number;
  trueProbability: number;
  edge:            number;
  fraction:        number;
  stake:           number;
  pnl:             number;
  bankrollAfter:   number;
  won:             boolean;
  split:           "train" | "test";
}

export interface BacktestSummary {
  totalBets:     number;
  wins:          number;
  winRate:       number;
  totalStaked:   number;
  totalPnl:      number;
  roi:           number;
  maxDrawdown:   number;
  finalBankroll: number;
}

export interface BacktestResult {
  config:    BacktestConfig;
  bets:      BacktestBet[];
  train:     BacktestSummary;
  test:      BacktestSummary;
  total:     BacktestSummary;
  snapshots: BankrollSnapshot[];
}