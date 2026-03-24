// artifacts/vanilla-betting-mvp/src/chart.ts

import type { BankrollSnapshot } from "./types";

export function renderBankrollChart(
  container: HTMLElement,
  snapshots: BankrollSnapshot[],
  startingBankroll: number
): void {
  container.innerHTML = "";

  if (snapshots.length === 0) {
    container.innerHTML = `<p class="text-center text-xs text-gray-600 py-8">
      Resolve at least one bet to see your chart.
    </p>`;
    return;
  }

  const W = 480, H = 200;
  const PAD = { top: 20, right: 16, bottom: 32, left: 64 };
  const iW  = W - PAD.left - PAD.right;
  const iH  = H - PAD.top  - PAD.bottom;

  // Prepend the starting point
  const allPoints = [
    { bankroll: startingBankroll, outcome: "won" as const, label: "Start", pnl: 0, date: "" },
    ...snapshots,
  ];

  const values   = allPoints.map((p) => p.bankroll);
  const minVal   = Math.min(...values);
  const maxVal   = Math.max(...values);
  const valRange = maxVal - minVal || 1;

  const toX = (i: number) =>
    PAD.left + (i / (allPoints.length - 1)) * iW;
  const toY = (v: number) =>
    PAD.top + iH - ((v - minVal) / valRange) * iH;

  // Line + area
  const pts    = allPoints.map((p, i) => `${toX(i)},${toY(p.bankroll)}`).join(" ");
  const lastX  = toX(allPoints.length - 1);
  const baseY  = PAD.top + iH;
  const area   =
    `M ${toX(0)},${toY(allPoints[0].bankroll)} ` +
    allPoints.map((p, i) => `L ${toX(i)},${toY(p.bankroll)}`).join(" ") +
    ` L ${lastX},${baseY} L ${PAD.left},${baseY} Z`;

  const growing   = allPoints[allPoints.length - 1].bankroll >= startingBankroll;
  const lineColor = growing ? "#818cf8" : "#f87171";

  // Y-axis: 3 grid lines
  const gridLines = [minVal, (minVal + maxVal) / 2, maxVal].map((v) => {
    const y = toY(v);
    const lbl = "HKD " + Math.round(v).toLocaleString("en-HK");
    return `
      <line x1="${PAD.left}" y1="${y}" x2="${PAD.left + iW}" y2="${y}"
            stroke="#1f2937" stroke-width="1" stroke-dasharray="4,3"/>
      <text x="${PAD.left - 6}" y="${y + 4}" text-anchor="end"
            style="font-size:9px;fill:#6b7280;font-family:monospace">${lbl}</text>`;
  }).join("");

  // Dots for each resolved bet
  const dots = snapshots.map((p, i) => {
    const x    = toX(i + 1);
    const y    = toY(p.bankroll);
    const fill = p.outcome === "won" ? "#4ade80" : "#f87171";
    const sign = p.pnl >= 0 ? "+" : "";
    return `<circle cx="${x}" cy="${y}" r="4.5"
      fill="${fill}" stroke="#030712" stroke-width="1.5">
      <title>${p.label}&#10;${sign}HKD ${Math.round(p.pnl).toLocaleString()}&#10;Balance: HKD ${Math.round(p.bankroll).toLocaleString()}</title>
    </circle>`;
  }).join("");

  // Starting dot
  const startDot = `<circle cx="${toX(0)}" cy="${toY(startingBankroll)}" r="3.5"
    fill="#6b7280" stroke="#030712" stroke-width="1.5">
    <title>Starting Bankroll: HKD ${Math.round(startingBankroll).toLocaleString()}</title>
  </circle>`;

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="w-full" style="overflow:visible">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${lineColor}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${lineColor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${area}" fill="url(#areaGrad)"/>
      <polyline points="${pts}" fill="none"
        stroke="${lineColor}" stroke-width="2.5" stroke-linejoin="round"/>
      ${startDot}
      ${dots}
      <line x1="${PAD.left}" y1="${PAD.top + iH}"
            x2="${PAD.left + iW}" y2="${PAD.top + iH}"
            stroke="#374151" stroke-width="1"/>
    </svg>`;
}