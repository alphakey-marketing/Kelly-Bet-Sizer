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