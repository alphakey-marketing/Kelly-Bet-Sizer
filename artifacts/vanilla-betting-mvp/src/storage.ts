import type { SavedBet } from "./types";

const STORAGE_KEY = "kelly_saved_bets";

export function loadBets(): SavedBet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedBet[];
  } catch {
    return [];
  }
}

export function saveBet(bet: SavedBet): void {
  const bets = loadBets();
  bets.unshift(bet);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}

export function clearBets(): void {
  localStorage.removeItem(STORAGE_KEY);
}
