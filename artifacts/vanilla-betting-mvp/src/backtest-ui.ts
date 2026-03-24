// artifacts/vanilla-betting-mvp/src/backtest-ui.ts

import { parseCsv } from "./csv-parser";
import { runBacktest, isRobust } from "./backtest";
import { renderBankrollChart } from "./chart";
import type { BacktestConfig, BacktestResult, BacktestTrade, BankrollSnapshot } from "./types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function fmt$(n: number): string {
  return "HKD " + n.toLocaleString("en-HK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(n: number, decimals = 1): string {
  return (n * 100).toFixed(decimals) + "%";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Result renderer ────────────────────────────────────────────────────────────

function renderResults(result: BacktestResult): void {
  const btResults    = $("btResults");
  const btRobust     = $("btRobustBadge");
  const btBetsPlaced = $("btBetsPlaced");
  const btWinRate    = $("btWinRate");
  const btRoi        = $("btRoi");
  const btPnl        = $("btPnl");
  const btDrawdown   = $("btDrawdown");
  const btAvgEdge    = $("btAvgEdge");
  const btChart      = $("btChart") as HTMLDivElement;
  const btTrades     = $("btTradesTable");

  btResults.classList.remove("hidden");

  // Robustness badge
  const robust = isRobust(result);
  btRobust.textContent = robust
    ? "✅ Strategy appears robust"
    : "⚠️ Strategy may not be robust (too few bets, negative ROI, or high drawdown)";
  btRobust.className = robust
    ? "rounded-xl px-4 py-2 text-center text-sm font-semibold bg-green-500/20 text-green-400"
    : "rounded-xl px-4 py-2 text-center text-sm font-semibold bg-yellow-500/20 text-yellow-400";

  // Stats
  btBetsPlaced.textContent =
    `${result.betsPlaced} (${result.betsSkipped} skipped)`;

  btWinRate.textContent = result.betsPlaced > 0
    ? `${fmtPct(result.winRate, 0)}  (${result.wins}W / ${result.losses}L)`
    : "—";

  btRoi.textContent = result.betsPlaced > 0
    ? `${result.roi >= 0 ? "+" : ""}${fmtPct(result.roi)}`
    : "—";
  btRoi.className =
    `text-base font-bold mt-0.5 ${result.roi >= 0 ? "text-green-400" : "text-red-400"}`;

  btPnl.textContent = result.betsPlaced > 0
    ? `${result.totalPnl >= 0 ? "+" : ""}${fmt$(result.totalPnl)}`
    : "—";
  btPnl.className =
    `text-base font-bold mt-0.5 ${result.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`;

  btDrawdown.textContent = result.betsPlaced > 0
    ? fmtPct(result.maxDrawdown)
    : "—";
  btDrawdown.className =
    `text-base font-bold mt-0.5 ${result.maxDrawdown < -0.1 ? "text-red-400" : "text-yellow-400"}`;

  btAvgEdge.textContent = result.betsPlaced > 0
    ? `${result.avgEdge >= 0 ? "+" : ""}${fmtPct(result.avgEdge)}`
    : "—";
  btAvgEdge.className =
    `text-base font-bold mt-0.5 ${result.avgEdge > 0 ? "text-indigo-300" : "text-red-400"}`;

  // Bankroll chart – convert trades to BankrollSnapshot[]
  const snapshots: BankrollSnapshot[] = result.trades.map((t: BacktestTrade) => ({
    date:     t.date,
    bankroll: t.bankroll,
    betId:    `${t.date}-${t.match}`,
    label:    t.match,
    outcome:  t.pnl >= 0 ? "won" : "lost",
    pnl:      t.pnl,
  }));
  renderBankrollChart(btChart, snapshots, result.startingBankroll);

  // Recent trades (last 10, newest first)
  const recent = result.trades.slice(-10).reverse();
  btTrades.innerHTML = recent.length === 0
    ? `<p class="text-xs text-gray-600 py-2 text-center">No trades placed.</p>`
    : recent.map((t: BacktestTrade) => `
        <div class="flex items-center justify-between rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs">
          <div class="min-w-0">
            <p class="text-gray-200 truncate">${escapeHtml(t.match)}</p>
            <p class="text-gray-500 mt-0.5">${t.date} · odds ${t.odds.toFixed(2)} · edge ${(t.edge * 100).toFixed(1)}%</p>
          </div>
          <div class="text-right shrink-0 ml-3">
            <p class="font-semibold ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}">
              ${t.pnl >= 0 ? "+" : ""}${fmt$(t.pnl)}
            </p>
            <p class="text-gray-500">bal. ${fmt$(t.bankroll)}</p>
          </div>
        </div>`).join("");
}

// ── Init ───────────────────────────────────────────────────────────────────────

export function initBacktest(): void {
  const csvInput = $("btCsvInput")  as HTMLInputElement;
  const runBtn   = $("btRunBtn")    as HTMLButtonElement;
  const errorMsg = $("btErrorMsg")  as HTMLParagraphElement;
  const btResults = $("btResults");

  function showError(msg: string): void {
    errorMsg.textContent = msg;
    errorMsg.classList.remove("hidden");
    btResults.classList.add("hidden");
  }

  function clearError(): void {
    errorMsg.textContent = "";
    errorMsg.classList.add("hidden");
  }

  runBtn.addEventListener("click", () => {
    clearError();

    const file = csvInput.files?.[0];
    if (!file) {
      showError("Please select a CSV file first.");
      return;
    }

    const startingBankroll = parseFloat(($("btBankroll") as HTMLInputElement).value);
    if (!isFinite(startingBankroll) || startingBankroll <= 0) {
      showError("Starting bankroll must be a positive number.");
      return;
    }

    const betSide       = ($("btBetSide")   as HTMLSelectElement).value as "home" | "draw" | "away";
    const kellyFraction = parseFloat(($("btKellyFrac") as HTMLSelectElement).value);
    const minEdgeRaw    = parseFloat(($("btMinEdge")   as HTMLInputElement).value);
    const minEdge       = isFinite(minEdgeRaw) ? minEdgeRaw / 100 : 0;

    const config: BacktestConfig = {
      startingBankroll,
      betSide,
      kellyFraction,
      minEdge,
    };

    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, errors } = parseCsv(text);

      if (rows.length === 0) {
        showError(
          errors.length > 0
            ? `CSV parse failed: ${errors[0]}`
            : "No valid rows found in the CSV file."
        );
        return;
      }

      if (errors.length > 0) {
        console.warn("CSV parse warnings:", errors);
      }

      const result = runBacktest(rows, config);

      if (result.betsPlaced === 0) {
        showError(
          `No bets were placed with min edge ${(minEdge * 100).toFixed(1)}%. ` +
          `Try lowering the Min Edge threshold, or use a CSV with Pinnacle (PS) odds columns for value detection.`
        );
        return;
      }

      renderResults(result);
    };

    reader.onerror = () => showError("Failed to read the CSV file.");
    reader.readAsText(file);
  });
}
