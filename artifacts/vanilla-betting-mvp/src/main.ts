// artifacts/vanilla-betting-mvp/src/main.ts

import { halfKelly } from "./kelly";
import {
  loadBets, saveBet, clearBets,
  resolveBet, loadBankroll, resetBankroll,
} from "./storage";
import { calcStats, buildSnapshots } from "./stats";
import { renderBankrollChart }       from "./chart";
import { exportToCsv }               from "./export";
import type { BetInputs, KellyResult, SavedBet } from "./types";

// ── DOM refs ───────────────────────────────────────────────────────────────────

const bankrollEl         = document.getElementById("bankroll")          as HTMLInputElement;
const winProbEl          = document.getElementById("winProb")           as HTMLInputElement;
const oddsEl             = document.getElementById("odds")              as HTMLInputElement;
const betNameEl          = document.getElementById("betName")           as HTMLInputElement;
const calcBtn            = document.getElementById("calcBtn")           as HTMLButtonElement;
const saveBtn            = document.getElementById("saveBtn")           as HTMLButtonElement;
const clearBtn           = document.getElementById("clearBtn")          as HTMLButtonElement;
const errorMsg           = document.getElementById("errorMsg")          as HTMLParagraphElement;
const resultBox          = document.getElementById("result")            as HTMLDivElement;
const resultAmount       = document.getElementById("resultAmount")      as HTMLParagraphElement;
const resultFrac         = document.getElementById("resultFraction")    as HTMLParagraphElement;
const resultEdge         = document.getElementById("resultEdge")        as HTMLParagraphElement;
const historyList        = document.getElementById("historyList")       as HTMLUListElement;
const emptyMsg           = document.getElementById("emptyMsg")          as HTMLParagraphElement;
const bankrollDisplay    = document.getElementById("bankrollDisplay")   as HTMLParagraphElement;
const resetBankrollBtn   = document.getElementById("resetBankrollBtn")  as HTMLButtonElement;
const resetBankrollInput = document.getElementById("resetBankrollInput")as HTMLInputElement;
// Phase 2a
const statWinRate        = document.getElementById("statWinRate")       as HTMLElement;
const statPnl            = document.getElementById("statPnl")           as HTMLElement;
const statRoi            = document.getElementById("statRoi")           as HTMLElement;
const statAvgEdge        = document.getElementById("statAvgEdge")       as HTMLElement;
const statDrawdown       = document.getElementById("statDrawdown")      as HTMLElement;
const statStreak         = document.getElementById("statStreak")        as HTMLElement;
const chartEl            = document.getElementById("bankrollChart")     as HTMLDivElement;
const exportBtn          = document.getElementById("exportBtn")         as HTMLButtonElement;

// ── State ──────────────────────────────────────────────────────────────────────

let lastResult: KellyResult | null = null;
let lastInputs: BetInputs  | null = null;
let activeFilter: "all" | "active" | "won" | "lost" = "all";

// ── Validation ─────────────────────────────────────────────────────────────────

function validate(): BetInputs | null {
  const bankroll       = parseFloat(bankrollEl.value);
  const winProbability = parseFloat(winProbEl.value) / 100;
  const decimalOdds    = parseFloat(oddsEl.value);
  const label          = betNameEl.value.trim() || undefined;

  if (!isFinite(bankroll) || bankroll <= 0) {
    showError("Bankroll must be a positive number.");
    return null;
  }
  if (
    !isFinite(parseFloat(winProbEl.value)) ||
    parseFloat(winProbEl.value) <= 0 ||
    parseFloat(winProbEl.value) >= 100
  ) {
    showError("Win probability must be between 0 and 100 (e.g. enter 60 for 60%).");
    return null;
  }
  if (!isFinite(decimalOdds) || decimalOdds <= 1) {
    showError("Decimal odds must be greater than 1.");
    return null;
  }

  clearError();
  return { bankroll, winProbability, decimalOdds, label };
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

function showError(msg: string): void {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
  resultBox.classList.add("hidden");
}

function clearError(): void {
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");
}

function fmt$(n: number): string {
  return "HKD " + n.toLocaleString("en-HK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Bankroll display ───────────────────────────────────────────────────────────

function renderBankroll(): void {
  bankrollDisplay.textContent = fmt$(loadBankroll());
}

// ── Stats panel ────────────────────────────────────────────────────────────────

function renderStats(): void {
  const bets  = loadBets();
  const stats = calcStats(bets);

  // Back-calculate starting bankroll from current bankroll minus all P&L
  const startingBankroll = loadBankroll() - stats.totalPnl;
  const snapshots        = buildSnapshots(bets, startingBankroll);

  // Win Rate
  statWinRate.textContent = stats.resolvedBets > 0
    ? `${(stats.winRate * 100).toFixed(0)}%  (${stats.wins}W / ${stats.losses}L)`
    : "—";

  // Total P&L
  statPnl.textContent = stats.resolvedBets > 0
    ? `${stats.totalPnl >= 0 ? "+" : ""}${fmt$(stats.totalPnl)}`
    : "—";
  statPnl.className = `text-base font-bold mt-0.5 ${stats.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`;

  // ROI
  statRoi.textContent = stats.resolvedBets > 0
    ? `${stats.roi >= 0 ? "+" : ""}${(stats.roi * 100).toFixed(1)}%`
    : "—";
  statRoi.className = `text-base font-bold mt-0.5 ${stats.roi >= 0 ? "text-green-400" : "text-red-400"}`;

  // Avg Edge
  statAvgEdge.textContent = bets.length > 0
    ? `${(stats.avgEdge * 100).toFixed(1)}%`
    : "—";
  statAvgEdge.className = `text-base font-bold mt-0.5 ${stats.avgEdge > 0 ? "text-indigo-300" : "text-red-400"}`;

  // Max Drawdown
  statDrawdown.textContent = stats.resolvedBets > 0
    ? `${(stats.maxDrawdown * 100).toFixed(1)}%`
    : "—";
  statDrawdown.className = `text-base font-bold mt-0.5 ${stats.maxDrawdown < -0.1 ? "text-red-400" : "text-yellow-400"}`;

  // Streak
  statStreak.textContent =
    stats.currentStreak === 0 ? "—"
    : stats.currentStreak > 0 ? `🔥 ${stats.currentStreak}W`
    : `❄️ ${Math.abs(stats.currentStreak)}L`;
  statStreak.className = `text-base font-bold mt-0.5 ${stats.currentStreak >= 0 ? "text-green-400" : "text-red-400"}`;

  // Chart
  renderBankrollChart(chartEl, snapshots, startingBankroll);
}

// ── Calculate ──────────────────────────────────────────────────────────────────

function calculate(): void {
  const inputs = validate();
  if (!inputs) return;

  const result = halfKelly(inputs);
  lastResult   = result;
  lastInputs   = inputs;

  if (result.halfKellyFraction <= 0) {
    showError("No edge detected — Half-Kelly recommends not betting.");
    return;
  }

  resultAmount.textContent = fmt$(result.recommendedBetAmount);
  resultFrac.textContent =
    `Half-Kelly: ${fmtPct(result.halfKellyFraction)} of bankroll` +
    `  ·  Full Kelly: ${fmtPct(result.fullKellyFraction)}`;
  resultEdge.textContent  = `Edge: ${result.edge >= 0 ? "+" : ""}${(result.edge * 100).toFixed(1)}%`;
  resultEdge.className    = `text-xs font-semibold mt-1 ${result.edge >= 0.05 ? "text-green-400" : "text-yellow-400"}`;
  resultBox.classList.remove("hidden");
}

// ── Save ───────────────────────────────────────────────────────────────────────

function save(): void {
  if (!lastResult || !lastInputs) {
    showError("Calculate a bet before saving.");
    return;
  }
  const bet: SavedBet = {
    id:      crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    status:  "active",
    ...lastInputs,
    result:  lastResult,
  };
  saveBet(bet);
  renderHistory();
  renderStats();
}

// ── Resolve ────────────────────────────────────────────────────────────────────

function handleResolve(e: Event): void {
  const btn     = e.currentTarget as HTMLButtonElement;
  const id      = btn.dataset["id"]!;
  const outcome = btn.dataset["outcome"] as "won" | "lost";
  const newBankroll = resolveBet(id, outcome);
  bankrollDisplay.textContent = fmt$(newBankroll);
  renderHistory();
  renderStats();
}

// ── History ────────────────────────────────────────────────────────────────────

function renderHistory(): void {
  const allBets = loadBets();
  const bets    = activeFilter === "all"
    ? allBets
    : allBets.filter((b) => b.status === activeFilter);

  historyList.innerHTML = "";

  if (bets.length === 0) {
    emptyMsg.classList.remove("hidden");
    emptyMsg.textContent = allBets.length === 0
      ? "No saved bets yet."
      : `No ${activeFilter} bets.`;
    return;
  }
  emptyMsg.classList.add("hidden");

  for (const bet of bets) {
    const li       = document.createElement("li");
    li.className   =
      "rounded-xl bg-gray-900 border border-gray-800 px-4 py-3 " +
      "flex items-start justify-between gap-4";

    const isActive = bet.status === "active";
    const date     = new Date(bet.savedAt).toLocaleString();
    const label    = bet.label ?? "Unnamed bet";
    const edge     = bet.result.edge ?? 0;

    const badge = isActive
      ? `<span class="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Active</span>`
      : bet.status === "won"
      ? `<span class="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">✅ Won</span>`
      : `<span class="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">❌ Lost</span>`;

    const edgeBadge = `<span class="text-xs px-2 py-0.5 rounded ${
      edge >= 0.05 ? "bg-indigo-500/20 text-indigo-300"
      : edge > 0   ? "bg-yellow-500/20 text-yellow-400"
      : "bg-red-500/20 text-red-400"
    }">Edge: ${edge >= 0 ? "+" : ""}${(edge * 100).toFixed(1)}%</span>`;

    const pnlHtml = !isActive && bet.pnl !== undefined
      ? `<p class="text-xs font-semibold mt-1 ${bet.pnl >= 0 ? "text-green-400" : "text-red-400"}">
           P&amp;L: ${bet.pnl >= 0 ? "+" : ""}${fmt$(bet.pnl)}
         </p>`
      : "";

    const actionHtml = isActive
      ? `<div class="flex flex-col gap-1 shrink-0">
           <button data-id="${bet.id}" data-outcome="won"
             class="resolve-btn text-xs bg-green-500/20 text-green-400
                    hover:bg-green-500/40 px-3 py-1 rounded transition-colors">
             💚 Win
           </button>
           <button data-id="${bet.id}" data-outcome="lost"
             class="resolve-btn text-xs bg-red-500/20 text-red-400
                    hover:bg-red-500/40 px-3 py-1 rounded transition-colors">
             ❤️ Lose
           </button>
         </div>`
      : `<p class="text-xs text-gray-600 shrink-0 text-right">
           ${new Date(bet.resolvedAt!).toLocaleString()}
         </p>`;

    li.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <p class="text-sm font-medium text-white truncate">${escapeHtml(label)}</p>
          ${badge}
          ${edgeBadge}
        </div>
        <p class="text-xs text-gray-400">${date}</p>
        <p class="text-xs text-gray-500 mt-1">
          Bankroll: ${fmt$(bet.bankroll)} · p=${(bet.winProbability * 100).toFixed(1)}% · odds=${bet.decimalOdds}
        </p>
        ${pnlHtml}
      </div>
      <div class="flex flex-col items-end gap-1 shrink-0 ml-2">
        <p class="text-sm font-bold text-indigo-300">${fmt$(bet.result.recommendedBetAmount)}</p>
        <p class="text-xs text-gray-500">${fmtPct(bet.result.halfKellyFraction)}</p>
        ${actionHtml}
      </div>`;

    historyList.appendChild(li);
  }

  document.querySelectorAll<HTMLButtonElement>(".resolve-btn").forEach((btn) => {
    btn.addEventListener("click", handleResolve);
  });
}

// ── Filter buttons ─────────────────────────────────────────────────────────────

document.querySelectorAll<HTMLButtonElement>(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset["filter"] as typeof activeFilter;
    document.querySelectorAll(".filter-btn").forEach((b) => {
      b.classList.remove("bg-indigo-600", "text-white");
      b.classList.add("bg-gray-800", "text-gray-400");
    });
    btn.classList.add("bg-indigo-600", "text-white");
    btn.classList.remove("bg-gray-800", "text-gray-400");
    renderHistory();
  });
});

// ── Event listeners ────────────────────────────────────────────────────────────

calcBtn.addEventListener("click", calculate);
saveBtn.addEventListener("click", save);
exportBtn.addEventListener("click", () => exportToCsv(loadBets()));

clearBtn.addEventListener("click", () => {
  if (!confirm("Clear ALL bet history? This cannot be undone.")) return;
  clearBets();
  lastResult = null;
  lastInputs = null;
  renderHistory();
  renderStats();
});

resetBankrollBtn.addEventListener("click", () => {
  const amount = parseFloat(resetBankrollInput.value);
  if (!isFinite(amount) || amount <= 0) {
    showError("Enter a valid amount to reset bankroll.");
    return;
  }
  resetBankroll(amount);
  renderBankroll();
  resetBankrollInput.value = "";
});

[bankrollEl, winProbEl, oddsEl, betNameEl].forEach((el) => {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") calculate();
  });
});

// ── Init ───────────────────────────────────────────────────────────────────────

renderBankroll();
renderStats();
renderHistory();