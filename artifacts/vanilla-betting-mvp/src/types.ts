// artifacts/vanilla-betting-mvp/src/types.ts

// ── Live-betting types ─────────────────────────────────────────────────────────

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
  edge:                 number;  // p*b - q
}

export type BetStatus = "active" | "won" | "lost";

export interface SavedBet {
  id:             string;
  savedAt:        string;   // ISO timestamp
  status:         BetStatus;
  bankroll:       number;
  winProbability: number;
  decimalOdds:    number;
  label?:         string;
  result:         KellyResult;
  pnl?:           number;   // set when resolved
  resolvedAt?:    string;   // ISO timestamp
}

export interface BankrollSnapshot {
  date:     string;          // ISO timestamp
  bankroll: number;
  betId:    string;
  label:    string;
  outcome:  "won" | "lost";
  pnl:      number;
}

// ── Backtesting types ──────────────────────────────────────────────────────────

/** One parsed row from a football-data.co.uk CSV file */
export interface BacktestRow {
  date:     string;       // YYYY-MM-DD (normalised from DD/MM/YYYY)
  home:     string;       // home team name
  away:     string;       // away team name
  result:   "H" | "D" | "A";  // full-time result
  oddsH:    number;       // decimal odds for home win
  oddsD:    number;       // decimal odds for draw
  oddsA:    number;       // decimal odds for away win
  // Optional Pinnacle closing-line odds
  psH?:     number;
  psD?:     number;
  psA?:     number;
}

/** Kelly staking fraction to apply */
export type KellyFraction = "full" | "half" | "quarter";

/** Probability estimation strategy */
export type StrategyModel = "flat" | "market";

/** Configuration for a single backtest run */
export interface BacktestConfig {
  league:           string;
  season:           string;
  kellyFraction:    KellyFraction;
  strategyModel:    StrategyModel;
  /** Proportion of rows used for training (0–1) */
  trainRatio:       number;
  startingBankroll: number;
  /** Minimum edge required before placing a bet (0–1) */
  minEdge:          number;
}

/** A single bet placed during a backtest */
export interface BacktestBet {
  date:          string;
  home:          string;
  away:          string;
  selection:     "H" | "D" | "A";  // which outcome was bet on
  predictedProb: number;            // model's estimated probability
  impliedProb:   number;            // 1 / decimalOdds (no-vig)
  edge:          number;            // predictedProb - impliedProb
  decimalOdds:   number;
  kellyFrac:     number;            // fraction of bankroll staked
  stake:         number;            // absolute stake in bankroll units
  bankrollBefore: number;
  bankrollAfter:  number;
  outcome:       "won" | "lost";
  pnl:           number;
}

/** Aggregate metrics for a period (train, test, or total) */
export interface BacktestResult {
  config:    BacktestConfig;
  bets:      BacktestBet[];
  train:     BacktestPeriodStats;
  test:      BacktestPeriodStats;
  total:     BacktestPeriodStats;
  snapshots: BankrollSnapshot[];
}

/** Per-period aggregate statistics */
export interface BacktestPeriodStats {
  bets:        number;
  wins:        number;
  winRate:     number;   // 0–1
  totalStaked: number;
  totalPnl:    number;
  roi:         number;   // totalPnl / totalStaked
  maxDrawdown: number;   // e.g. -0.18 = -18%
  finalBankroll: number;
}

/** High-level summary across one or many BacktestResult runs */
export interface BacktestSummary {
  runs:        BacktestResult[];
  bestRun:     BacktestResult | null;
  worstRun:    BacktestResult | null;
  avgRoi:      number;
  avgWinRate:  number;
}