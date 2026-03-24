// artifacts/vanilla-betting-mvp/src/types.ts

export interface BetInputs {
  bankroll:        number;
  winProbability:  number;  // 0–1
  decimalOdds:     number;
  label?:          string;
}

export interface KellyResult {
  fullKellyFraction:  number;  // 0–1
  halfKellyFraction:  number;  // 0–1
  recommendedBetAmount: number;
  edge:               number;  // (p * (odds-1) - (1-p)) / 1
}

export type BetStatus = "active" | "won" | "lost";

export interface SavedBet extends BetInputs {
  id:          string;
  savedAt:     string;   // ISO 8601
  resolvedAt?: string;   // ISO 8601, set when resolved
  status:      BetStatus;
  result:      KellyResult;
  pnl?:        number;   // set when resolved
}

export interface BankrollSnapshot {
  date:     string;   // ISO 8601 (resolvedAt of the bet)
  bankroll: number;   // running bankroll after this bet
  betId:    string;
  label:    string;
  outcome:  "won" | "lost";
  pnl:      number;
}

// ── Backtesting types ──────────────────────────────────────────────────────────

/** One row parsed from a football-data.co.uk CSV file. */
export interface BacktestRow {
  date:    string;          // ISO 8601 (YYYY-MM-DD)
  home:    string;
  away:    string;
  result:  "H" | "D" | "A";  // full-time result: Home / Draw / Away
  oddsH:   number;            // market home-win decimal odds (e.g. B365H)
  oddsD:   number;            // market draw decimal odds
  oddsA:   number;            // market away-win decimal odds
  psH?:    number;            // Pinnacle/sharp home-win odds (optional)
  psD?:    number;            // Pinnacle/sharp draw odds (optional)
  psA?:    number;            // Pinnacle/sharp away-win odds (optional)
}

/** Configuration for a backtest run. */
export interface BacktestConfig {
  startingBankroll: number;                              // initial bankroll amount
  betSide:          "home" | "draw" | "away" | "best";  // "best" = auto-select highest-edge side per match
  kellyFraction:    number;                              // e.g. 0.5 = half-Kelly
  minEdge:          number;                              // minimum edge (decimal) to place a bet, e.g. 0.02
  minStakeAmount:   number;                              // minimum stake floor (0 = no floor)
  dateFrom?:        string;                              // ISO YYYY-MM-DD — only include matches on/after this date
  dateTo?:          string;                              // ISO YYYY-MM-DD — only include matches on/before this date
}

/** A single simulated bet produced by the backtester. */
export interface BacktestTrade {
  date:     string;                            // ISO 8601 date of the match
  match:    string;                            // "Home vs Away"
  betSide:  "home" | "draw" | "away";
  odds:     number;                            // odds at which the bet was placed
  edge:     number;                            // estimated edge (decimal)
  stake:    number;                            // amount staked
  pnl:      number;                            // profit / loss on this bet
  bankroll: number;                            // bankroll after this bet
}

/** Aggregated results returned by runBacktest(). */
export interface BacktestResult {
  trades:           BacktestTrade[];
  betsPlaced:       number;
  betsSkipped:      number;
  wins:             number;
  losses:           number;
  winRate:          number;    // wins / betsPlaced  (0–1)
  roi:              number;    // totalPnl / totalStaked  (decimal)
  totalPnl:         number;
  maxDrawdown:      number;    // peak-to-trough, expressed as negative decimal (e.g. -0.25)
  finalBankroll:    number;
  startingBankroll: number;
  avgEdge:          number;    // mean edge across all placed bets (decimal)
  hasPinnacleOdds:  boolean;   // whether any row had PS odds (CLV source)
  skipReason?:      string;    // set when the run was aborted before placing any bets
  robustnessFlags:  string[];  // list of failed robustness checks (empty = robust)
}