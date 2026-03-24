// artifacts/vanilla-betting-mvp/src/backtest-ui.ts

import { parseCsv }              from "./csv-parser";
import { runBacktest, isRobust } from "./backtest";
import { renderBankrollChart }   from "./chart";
import type {
  BacktestConfig,
  BacktestResult,
  StrategyModel,
  KellyFraction,
} from "./types";

// ── DOM refs ───────────────────────────────────────────────────────────────────

const btSection       = document.getElementById("backtestSection")  as HTMLElement;
const btToggleBtn     = document.getElementById("btToggleBtn")      as HTMLButtonElement;
const btFileInput     = document.getElementById("btFileInput")      as HTMLInputElement;
const btFileLabel     = document.getElementById("btFileLabel")      as HTMLElement;
const btParseErrors   = document.getElementById("btParseErrors")    as HTMLElement;
const btRowCount      = document.getElementById("btRowCount")       as HTMLElement;
const btStrategyFlat  = document.getElementById("btStrategyFlat")   as HTMLInputElement;
const btStrategyMkt   = document.getElementById("btStrategyMkt")    as HTMLInputElement;
const btFlatProbs     = document.getElementById("btFlatProbs")      as HTMLElement;
const btFlatHome      = document.getElementById("btFlatHome")       as HTMLInputElement;
const btFlatDraw      = document.getElementById("btFlatDraw")       as HTMLInputElement;
const btFlatAway      = document.getElementById("btFlatAway")       as HTMLInputElement;
const btStartBankroll = document.getElementById("btStartBankroll")  as HTMLInputElement;
const btMinEdge       = document.getElementById("btMinEdge")        as HTMLInputElement;
const btKellyFrac     = document.getElementById("btKellyFrac")      as HTMLSelectElement;
const btCutoffDate    = document.getElementById("btCutoffDate")     as HTMLInputElement;
const btRunBtn        = document.getElementById("btRunBtn")         as HTMLButtonElement;
const btRunError      = document.getElementById("btRunError")       as HTMLElement;
const btResults       = document.getElementById("btResults")        as HTMLElement;
const btRobustBadge   = document.getElementById("btRobustBadge")    as HTMLElement;
const btRobustReason  = document.getElementById("btRobustReason")   as HTMLElement;
const btTrainBets     = document.getElementById("btTrainBets")      as HTMLElement;
const btTrainWinRate  = document.getElementById("btTrainWinRate")   as HTMLElement;
const btTrainRoi      = document.getElementById("btTrainRoi")       as HTMLElement;
const btTrainPnl      = document.getElementById("btTrainPnl")       as HTMLElement;
const btTrainDrawdown = document.getElementById("btTrainDrawdown")  as HTMLElement;
const btTrainFinal    = document.getElementById("btTrainFinal")     as HTMLElement;
const btTestBets      = document.getElementById("btTestBets")       as HTMLElement;
const btTestWinRate   = document.getElementById("btTestWinRate")    as HTMLElement;
const btTestRoi       = document.getElementById("btTestRoi")        as HTMLElement;
const btTestPnl       = document.getElementById("btTestPnl")        as HTMLElement;
const btTestDrawdown  = document.getElementById("btTestDrawdown")   as HTMLElement;
const btTestFinal     = document.getElementById("btTestFinal")      as HTMLElement;
const btTotalBets     = document.getElementById("btTotalBets")      as HTMLElement;
const btTotalWinRate  = document.getElementById("btTotalWinRate")   as HTMLElement;
const btTotalRoi      = document.getElementById("btTotalRoi")       as HTMLElement;
const btTotalPnl      = document.getElementById("btTotalPnl")       as HTMLElement;
const btTotalDrawdown = document.getElementById("btTotalDrawdown")  as HTMLElement;
const btTotalFinal    = document.getElementById("btTotalFinal")     as HTMLElement;
const btChartEl       = document.getElementById("btChart")          as HTMLDivElement;
const btBetTableBody  = document.getElementById("btBetTableBody")   as HTMLTableSectionElement;
const btTableWrap     = document.getElementById("btTableWrap")      as HTMLElement;
const btShowTableBtn  = document.getElementById("btShowTableBtn")   as HTMLButtonElement;

// ── State ──────────────────────────────────────────────────────────────────────

let parsedRows: ReturnType<typeof parseCsv>["rows"] = [];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  return "HKD " + n.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function setPct(el: HTMLElement, val: number): void {
  el.textContent = fmtPct(val);
  el.className = `text-center text-xs font-semibold ${val >= 0 ? "text-green-400" : "text-red-400"}`;
}

function setMoney(el: HTMLElement, val: number): void {
  el.textContent = (val >= 0 ? "+" : "") + fmt$(val);
  el.className = `text-center text-xs font-semibold ${val >= 0 ? "text-green-400" : "text-red-400"}`;
}

function showError(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearError(el: HTMLElement): void {
  el.textContent = "";
  el.classList.add("hidden");
}

// ── Section toggle ─────────────────────────────────────────────────────────────

btToggleBtn.addEventListener("click", () => {
  const body = document.getElementById("btBody") as HTMLElement;
  const isHidden = body.classList.toggle("hidden");
  btToggleBtn.textContent = isHidden ? "▶ Show" : "▼ Hide";
});

// ── Strategy toggle ───────────────────────────────────────���────────────────────

function syncStrategyUI(): void {
  btFlatProbs.classList.toggle("hidden", !btStrategyFlat.checked);
}
btStrategyFlat.addEventListener("change", syncStrategyUI);
btStrategyMkt.addEventListener("change", syncStrategyUI);
syncStrategyUI();

// ── CSV upload ─────────────────────────────────────────────────────────────────

btFileInput.addEventListener("change", () => {
  const file = btFileInput.files?.[0];
  if (!file) return;
  btFileLabel.textContent = file.name;
  clearError(btParseErrors);
  btRowCount.textContent = "";

  const reader = new FileReader();
  reader.onload = (e) => {
    const raw = e.target?.result as string;
    const { rows, errors } = parseCsv(raw);
    parsedRows = rows;

    if (errors.length > 0) {
      showError(
        btParseErrors,
        errors.slice(0, 5).join(" | ") +
          (errors.length > 5 ? ` … and ${errors.length - 5} more` : "")
      );
    }

    if (rows.length === 0) {
      btRowCount.textContent = "⚠️ No valid rows found.";
      btRowCount.className = "text-xs text-red-400 mt-1";
    } else {
      btRowCount.textContent = `✅ ${rows.length} matches loaded (${errors.length} rows skipped)`;
      btRowCount.className = "text-xs text-green-400 mt-1";
    }
  };
  reader.readAsText(file);
});

// ── Run backtest ───────────────────────────────────────────────────────────────

btRunBtn.addEventListener("click", () => {
  clearError(btRunError);
  btResults.classList.add("hidden");

  if (parsedRows.length === 0) {
    showError(btRunError, "Upload a CSV file first.");
    return;
  }

  const startingBankroll = parseFloat(btStartBankroll.value);
  if (!isFinite(startingBankroll) || startingBankroll <= 0) {
    showError(btRunError, "Starting bankroll must be a positive number.");
    return;
  }

  const minEdgeInput = parseFloat(btMinEdge.value);
  if (!isFinite(minEdgeInput) || minEdgeInput < 0) {
    showError(btRunError, "Minimum edge must be 0 or a positive number.");
    return;
  }

  const cutoffDate = btCutoffDate.value;
  if (!cutoffDate) {
    showError(btRunError, "Select a training / test cutoff date.");
    return;
  }

  const strategy: StrategyModel = btStrategyFlat.checked ? "flat" : "market";

  const config: BacktestConfig = {
    startingBankroll,
    kellyFraction:  btKellyFrac.value as KellyFraction,
    strategy,
    minEdge:        minEdgeInput / 100,
    cutoffDate,
    flatProbHome:   strategy === "flat" ? parseFloat(btFlatHome.value) / 100 : undefined,
    flatProbDraw:   strategy === "flat" ? parseFloat(btFlatDraw.value) / 100 : undefined,
    flatProbAway:   strategy === "flat" ? parseFloat(btFlatAway.value) / 100 : undefined,
  };

  if (strategy === "flat") {
    const sumP = (config.flatProbHome ?? 0) + (config.flatProbDraw ?? 0) + (config.flatProbAway ?? 0);
    if (sumP <= 0 || sumP > 1.5) {
      showError(btRunError, "Flat probabilities look wrong — each should be between 0–100.");
      return;
    }
  }

  const result = runBacktest(parsedRows, config);

  if (result.bets.length === 0) {
    showError(btRunError, `No bets passed the edge threshold (${fmtPct(config.minEdge)}). Try lowering it.`);
    return;
  }

  renderResults(result);
});

// ── Render results ─────────────────────────────────────────────────────────────

function renderResults(result: BacktestResult): void {
  const { train, test, total } = result;
  const { robust, reason } = isRobust(result);

  btRobustBadge.textContent = robust ? "✅ ROBUST" : "⚠️ NOT ROBUST";
  btRobustBadge.className = `text-sm font-bold px-3 py-1 rounded-full ${
    robust ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
  }`;
  btRobustReason.textContent = reason;

  btTrainBets.textContent     = String(train.totalBets);
  btTrainWinRate.textContent  = fmtPct(train.winRate);
  setPct(btTrainRoi,           train.roi);
  setMoney(btTrainPnl,         train.totalPnl);
  btTrainDrawdown.textContent = fmtPct(train.maxDrawdown);
  btTrainFinal.textContent    = fmt$(train.finalBankroll);

  btTestBets.textContent      = String(test.totalBets);
  btTestWinRate.textContent   = fmtPct(test.winRate);
  setPct(btTestRoi,            test.roi);
  setMoney(btTestPnl,          test.totalPnl);
  btTestDrawdown.textContent  = fmtPct(test.maxDrawdown);
  btTestFinal.textContent     = fmt$(test.finalBankroll);

  btTotalBets.textContent     = String(total.totalBets);
  btTotalWinRate.textContent  = fmtPct(total.winRate);
  setPct(btTotalRoi,           total.roi);
  setMoney(btTotalPnl,         total.totalPnl);
  btTotalDrawdown.textContent = fmtPct(total.maxDrawdown);
  btTotalFinal.textContent    = fmt$(total.finalBankroll);

  renderBankrollChart(btChartEl, result.snapshots, result.config.startingBankroll);

  btBetTableBody.innerHTML = "";
  for (const bet of result.bets) {
    const tr = document.createElement("tr");
    tr.className = "border-t border-gray-800 text-xs";
    tr.innerHTML = `
      <td class="px-2 py-1.5 text-gray-400">${bet.date}</td>
      <td class="px-2 py-1.5 text-gray-200">${bet.label}</td>
      <td class="px-2 py-1.5 text-gray-300">${bet.odds.toFixed(2)}</td>
      <td class="px-2 py-1.5 ${bet.edge >= 0.05 ? "text-indigo-300" : "text-yellow-400"}">${(bet.edge * 100).toFixed(1)}%</td>
      <td class="px-2 py-1.5 text-gray-300">${fmt$(bet.stake)}</td>
      <td class="px-2 py-1.5 ${bet.pnl >= 0 ? "text-green-400" : "text-red-400"}">${bet.pnl >= 0 ? "+" : ""}${fmt$(bet.pnl)}</td>
      <td class="px-2 py-1.5 text-gray-300">${fmt$(bet.bankrollAfter)}</td>
      <td class="px-2 py-1.5 ${bet.split === "train" ? "text-blue-400" : "text-purple-400"}">${bet.split}</td>
    `;
    btBetTableBody.appendChild(tr);
  }

  btResults.classList.remove("hidden");
  btTableWrap.classList.add("hidden");
  btShowTableBtn.textContent = "▶ Show all bets";
}

// ── Bet table toggle ───────────────────────────────────────────────────────────

btShowTableBtn.addEventListener("click", () => {
  const hidden = btTableWrap.classList.toggle("hidden");
  btShowTableBtn.textContent = hidden ? "▶ Show all bets" : "▼ Hide bets";
});

// ── Init ───────────────────────────────────────────────────────────────────────

export function initBacktest(): void {
  btSection.classList.remove("hidden");
}