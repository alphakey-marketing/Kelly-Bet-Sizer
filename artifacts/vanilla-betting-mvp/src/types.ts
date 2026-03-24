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
  id: string;
  savedAt: string;
  result: KellyResult;
}
