// artifacts/vanilla-betting-mvp/src/export.ts

import type { SavedBet } from "./types";

export function exportToCsv(bets: SavedBet[]): void {
  if (bets.length === 0) {
    alert("No bets to export.");
    return;
  }

  const headers = [
    "Date Saved",
    "Label",
    "Bankroll (HKD)",
    "Win Probability (%)",
    "Decimal Odds",
    "Edge (%)",
    "Full Kelly (%)",
    "Half Kelly (%)",
    "Stake (HKD)",
    "Status",
    "P&L (HKD)",
    "Date Resolved",
  ];

  const rows = bets.map((b) => [
    new Date(b.savedAt).toLocaleString(),
    b.label ?? "Unnamed",
    b.bankroll.toFixed(2),
    (b.winProbability * 100).toFixed(1),
    b.decimalOdds.toFixed(2),
    ((b.result.edge ?? 0) * 100).toFixed(2),
    (b.result.fullKellyFraction * 100).toFixed(2),
    (b.result.halfKellyFraction * 100).toFixed(2),
    b.result.recommendedBetAmount.toFixed(2),
    b.status,
    b.pnl !== undefined ? b.pnl.toFixed(2) : "",
    b.resolvedAt ? new Date(b.resolvedAt).toLocaleString() : "",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `kelly-bets-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}