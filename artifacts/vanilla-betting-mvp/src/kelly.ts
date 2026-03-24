import type { BetInputs, KellyResult } from "./types";

/**
 * Full Kelly Criterion formula:
 *   f* = (p * b - q) / b
 *   where:
 *     p  = probability of winning
 *     q  = 1 - p  (probability of losing)
 *     b  = net profit per unit wagered  (decimalOdds - 1)
 *
 * Half-Kelly applies a 0.5 multiplier to reduce volatility.
 * A negative fullKelly means no edge — recommended bet is $0.
 */
export function halfKelly(inputs: BetInputs): KellyResult {
  const { bankroll, winProbability, decimalOdds } = inputs;

  const p = winProbability;
  const q = 1 - p;
  const b = decimalOdds - 1;

  const fullKellyFraction = (p * b - q) / b;
  const halfKellyFraction = Math.max(0, fullKellyFraction * 0.5);
  const recommendedBetAmount = bankroll * halfKellyFraction;

  return { fullKellyFraction, halfKellyFraction, recommendedBetAmount };
}
