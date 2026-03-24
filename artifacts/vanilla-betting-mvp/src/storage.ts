// artifacts/vanilla-betting-mvp/src/storage.ts

import type { SavedBet } from "./types";

const KEYS = {
  BETS:     "kelly_saved_bets",
  BANKROLL: "kelly_bankroll",
};

// ── Bets ──────────────────────────────────────────────────────────────────────

export function loadBets(): SavedBet[] {
  try {
    const raw = localStorage.getItem(KEYS.BETS);
    if (!raw) return [];
    return JSON.parse(raw) as SavedBet[];
  } catch {
    return [];
  }
}

export function saveBet(bet: SavedBet): void {
  const bets = loadBets();
  bets.unshift(bet);
  localStorage.setItem(KEYS.BETS, JSON.stringify(bets));
}

/**
 * Resolves an active bet as "won" or "lost".
 * Updates the bet record and recalculates the bankroll.
 * Returns the new bankroll amount.
 */
export function resolveBet(
  id: string,
  outcome: "won" | "lost"
): number {
  const bets = loadBets();
  const index = bets.findIndex((b) => b.id === id);
  if (index === -1) return loadBankroll();

  const bet = bets[index];
  const stake = bet.result.recommendedBetAmount;

  // Calculate P&L
  const pnl =
    outcome === "won"
      ? stake * (bet.decimalOdds - 1)   // net profit
      : -stake;                          // net loss

  // Update bet record
  bets[index] = {
    ...bet,
    status:     outcome,
    resolvedAt: new Date().toISOString(),
    pnl,
  };

  localStorage.setItem(KEYS.BETS, JSON.stringify(bets));

  // Update bankroll
  const newBankroll = loadBankroll() + pnl;
  saveBankroll(newBankroll);

  return newBankroll;
}

export function clearBets(): void {
  localStorage.removeItem(KEYS.BETS);
}

// ── Bankroll ──────────────────────────────────────────────────────────────────

export function loadBankroll(): number {
  const raw = localStorage.getItem(KEYS.BANKROLL);
  return raw ? parseFloat(raw) : 10000; // Default: HKD 10,000
}

export function saveBankroll(amount: number): void {
  localStorage.setItem(KEYS.BANKROLL, amount.toString());
}

export function resetBankroll(amount: number): void {
  saveBankroll(amount);
}
