// artifacts/vanilla-betting-mvp/src/types.ts

export interface BetInputs {
  bankroll: number;
  winProbability: number;
  decimalOdds: number;
  label?: string;
}

export interface KellyResult {
  fullKellyFraction: number;
  halfKellyFraction: number;
  recommendedBetAmount: number;
}

export interface SavedBet extends BetInputs {
  id:          string;
  savedAt:     string;
  result:      KellyResult;
  status:      "active" | "won" | "lost";  // ← NEW
  resolvedAt?: string;                      // ← NEW
  pnl?:        number;                      // ← NEW: positive = profit, negative = loss
}
