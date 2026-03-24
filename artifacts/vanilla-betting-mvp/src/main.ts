// artifacts/vanilla-betting-mvp/src/main.ts

import { halfKelly } from "./kelly";
import {
  loadBets,
  saveBet,
  clearBets,
  resolveBet,
  loadBankroll,
  resetBankroll,
} from "./storage";
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
const historyList        = document.getElementById("historyList")       as HTMLUListElement;
const emptyMsg           = document.getElementById("emptyMsg")          as HTMLParagraphElement;
const bankrollDisplay    = document.getElementById("bankrollDisplay")   as HTMLParagraphElement;
const resetBankrollBtn   = document.getElementById("resetBankrollBtn")  as HTMLButtonElement;
const resetBankrollInput = document.getElementById("resetBankrollInput")as HTMLInputElement;

// ── State ──────────────────────────────────────────────────────────────────────

let lastResult: KellyResult | null = null;
let lastInputs: BetInputs  | null = null;

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

// ── UI Helpers ─────────────────────────────────────────────────────────────────

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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Bankroll Display ───────────────────────────────────────────────────────────

function renderBankroll(): void {
  const current = loadBankroll();
  bankrollDisplay.textContent = fmt$(current);
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
}

// ── Win / Lose Resolution ──────────────────────────────────────────────────────

function handleResolve(e: Event): void {
  const btn     = e.currentTarget as HTMLButtonElement;
  const id      = btn.dataset["id"]!;
  const outcome = btn.dataset["outcome"] as "won" | "lost";

  const newBankroll = resolveBet(id, outcome);
  bankrollDisplay.textContent = fmt$(newBankroll);
  renderHistory();
}

// ── History ────────────────────────────────────────────────────────────────────

function renderHistory(): void {
  const bets = loadBets();
  historyList.innerHTML = "";

  if (bets.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");

  for (const bet of bets) {
    const li = document.createElement("li");
    li.className =
      "rounded-xl bg-gray-900 border border-gray-800 px-4 py-3 " +
      "flex items-start justify-between gap-4";

    const date     = new Date(bet.savedAt).toLocaleString();
    const label    = bet.label ?? "Unnamed bet";
    const isActive = bet.status === "active";

    // Status badge
    const badge = isActive
      ? `<span class="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Active</span>`
      : bet.status === "won"
      ? `<span class="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">✅ Won</span>`
      : `<span class="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">❌ Lost</span>`;

    // P&L row (only for resolved bets)
    const pnlHtml =
      !isActive && bet.pnl !== undefined
        ? `<p class="text-xs font-semibold mt-1 ${bet.pnl >= 0 ? "text-green-400" : "text-red-400"}">
             P&amp;L: ${bet.pnl >= 0 ? "+" : ""}${fmt$(bet.pnl)}
           </p>`
        : "";

    // Action buttons (only for active bets) or resolved timestamp
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
      : `<p class="text-xs text-gray-600 shrink-0">
           ${new Date(bet.resolvedAt!).toLocaleString()}
         </p>`;

    li.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="text-sm font-medium text-white truncate">${escapeHtml(label)}</p>
          ${badge}
        </div>
        <p class="text-xs text-gray-400 mt-0.5">${date}</p>
        <p class="text-xs text-gray-500 mt-1">
          Bankroll: ${fmt$(bet.bankroll)} · p=${(bet.winProbability * 100).toFixed(1)}% · odds=${bet.decimalOdds}
        </p>
        ${pnlHtml}
      </div>
      <div class="flex flex-col items-end gap-1 shrink-0 ml-2">
        <p class="text-sm font-bold text-indigo-300">${fmt$(bet.result.recommendedBetAmount)}</p>
        <p class="text-xs text-gray-500">${fmtPct(bet.result.halfKellyFraction)}</p>
        ${actionHtml}
      </div>
    `;

    historyList.appendChild(li);
  }

  // Attach Win/Lose listeners after rendering
  document.querySelectorAll<HTMLButtonElement>(".resolve-btn").forEach((btn) => {
    btn.addEventListener("click", handleResolve);
  });
}

// ── Event Listeners ────────────────────────────────────────────────────────────

calcBtn.addEventListener("click", calculate);
saveBtn.addEventListener("click", save);

clearBtn.addEventListener("click", () => {
  if (!confirm("Clear ALL bet history? This cannot be undone.")) return;
  clearBets();
  lastResult = null;
  lastInputs = null;
  renderHistory();
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
renderHistory();
