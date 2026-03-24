// artifacts/vanilla-betting-mvp/src/kelly.ts

import type { BetInputs, KellyResult } from "./types";

/**
 * Full Kelly:  f* = (p*b - q) / b
 * Edge:        (p*b) - q   → positive = value bet, negative = no bet
 * Half-Kelly:  f* × 0.5    → halves stake to reduce variance
 */
export function halfKelly(inputs: BetInputs): KellyResult {
  const { bankroll, winProbability, decimalOdds } = inputs;

  const p = winProbability;
  const q = 1 - p;
  const b = decimalOdds - 1;

  const fullKellyFraction   = (p * b - q) / b;
  const halfKellyFraction   = Math.max(0, fullKellyFraction * 0.5);
  const recommendedBetAmount = bankroll * halfKellyFraction;
  const edge                = p * b - q;   // raw edge value

  return { fullKellyFraction, halfKellyFraction, recommendedBetAmount, edge };
}