// artifacts/vanilla-betting-mvp/src/csv-parser.ts

import type { BacktestRow } from "./types";

// ── Column-name mappings ───────────────────────────────────────────────────────
// Football-data.co.uk files use varying header names across seasons/leagues.
// Each entry lists acceptable aliases in priority order.

const COL = {
  date:   ["Date"],
  home:   ["HomeTeam", "Home Team", "HT"],
  away:   ["AwayTeam", "Away Team", "AT"],
  result: ["FTR", "Res"],
  oddsH:  ["B365H", "BbAvH", "AvgH", "MaxH", "WHH", "IWH"],
  oddsD:  ["B365D", "BbAvD", "AvgD", "MaxD", "WHD", "IWD"],
  oddsA:  ["B365A", "BbAvA", "AvgA", "MaxA", "WHA", "IWA"],
  psH:    ["PSCH", "PSH"],
  psD:    ["PSCD", "PSD"],
  psA:    ["PSCA", "PSA"],
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Return the first header that matches one of the candidate names (case-insensitive). */
function pickCol(
  headers: string[],
  candidates: readonly string[]
): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Convert DD/MM/YYYY → YYYY-MM-DD.  Returns null on invalid input. */
function normaliseDate(raw: string): string | null {
  const trimmed = raw.trim();
  // Accept DD/MM/YYYY and DD/MM/YY
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const [, dd, mm, yyOrYyyy] = m;
  const yyyy =
    yyOrYyyy.length === 2
      ? String(parseInt(yyOrYyyy, 10) >= 50 ? 1900 + parseInt(yyOrYyyy, 10) : 2000 + parseInt(yyOrYyyy, 10))
      : yyOrYyyy;
  const isoDate = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  // Validate that it is a real calendar date
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  return isoDate;
}

/** Parse a decimal-odds cell.  Returns NaN when blank or non-numeric. */
function parseOdds(cell: string): number {
  const v = parseFloat(cell.trim());
  return isNaN(v) ? NaN : v;
}

// ── CSV parse ──────────────────────────────────────────────────────────────────

export interface CsvParseResult {
  rows:   BacktestRow[];
  errors: string[];
}

/**
 * Parse raw CSV text from football-data.co.uk into typed BacktestRow objects.
 *
 * - Skips the header row.
 * - Skips rows with an invalid date, unrecognised result, or missing/zero main odds.
 * - Records a human-readable warning in `errors` for every skipped row.
 * - Pinnacle odds columns (psH/psD/psA) are optional – missing values are omitted.
 */
export function parseCsv(csvText: string): CsvParseResult {
  const rows:   BacktestRow[] = [];
  const errors: string[]      = [];

  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) {
    errors.push("CSV file appears to be empty or has no data rows.");
    return { rows, errors };
  }

  // Parse the header line
  const headers = lines[0].split(",");

  const colDate   = pickCol(headers, COL.date);
  const colHome   = pickCol(headers, COL.home);
  const colAway   = pickCol(headers, COL.away);
  const colResult = pickCol(headers, COL.result);
  const colOddsH  = pickCol(headers, COL.oddsH);
  const colOddsD  = pickCol(headers, COL.oddsD);
  const colOddsA  = pickCol(headers, COL.oddsA);
  // Optional Pinnacle columns
  const colPsH    = pickCol(headers, COL.psH);
  const colPsD    = pickCol(headers, COL.psD);
  const colPsA    = pickCol(headers, COL.psA);

  // Abort early if required columns are missing
  const missing: string[] = [];
  if (colDate   === -1) missing.push("Date");
  if (colHome   === -1) missing.push("HomeTeam");
  if (colAway   === -1) missing.push("AwayTeam");
  if (colResult === -1) missing.push("FTR/Res");
  if (colOddsH  === -1) missing.push("oddsH (e.g. B365H)");
  if (colOddsD  === -1) missing.push("oddsD (e.g. B365D)");
  if (colOddsA  === -1) missing.push("oddsA (e.g. B365A)");
  if (missing.length > 0) {
    errors.push(`Required column(s) not found: ${missing.join(", ")}.`);
    return { rows, errors };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;  // skip blank lines

    const cells = line.split(",");
    const rowNum = i + 1;

    // Date
    const rawDate = cells[colDate]?.trim() ?? "";
    const date = normaliseDate(rawDate);
    if (!date) {
      errors.push(`Row ${rowNum}: invalid date "${rawDate}" – skipped.`);
      continue;
    }

    // Teams
    const home = cells[colHome]?.trim() ?? "";
    const away = cells[colAway]?.trim() ?? "";
    if (!home || !away) {
      errors.push(`Row ${rowNum}: missing team name(s) – skipped.`);
      continue;
    }

    // Result
    const rawResult = cells[colResult]?.trim().toUpperCase() ?? "";
    if (rawResult !== "H" && rawResult !== "D" && rawResult !== "A") {
      errors.push(`Row ${rowNum}: invalid result "${rawResult}" (expected H/D/A) – skipped.`);
      continue;
    }
    const result = rawResult as "H" | "D" | "A";

    // Main odds
    const oddsH = parseOdds(cells[colOddsH] ?? "");
    const oddsD = parseOdds(cells[colOddsD] ?? "");
    const oddsA = parseOdds(cells[colOddsA] ?? "");

    if (!isFinite(oddsH) || oddsH <= 0 ||
        !isFinite(oddsD) || oddsD <= 0 ||
        !isFinite(oddsA) || oddsA <= 0) {
      errors.push(`Row ${rowNum}: missing or zero odds (H=${oddsH}, D=${oddsD}, A=${oddsA}) – skipped.`);
      continue;
    }

    // Optional Pinnacle odds
    const psH = colPsH !== -1 ? parseOdds(cells[colPsH] ?? "") : NaN;
    const psD = colPsD !== -1 ? parseOdds(cells[colPsD] ?? "") : NaN;
    const psA = colPsA !== -1 ? parseOdds(cells[colPsA] ?? "") : NaN;

    const row: BacktestRow = {
      date,
      home,
      away,
      result,
      oddsH,
      oddsD,
      oddsA,
      ...(isFinite(psH) && psH > 0 ? { psH } : {}),
      ...(isFinite(psD) && psD > 0 ? { psD } : {}),
      ...(isFinite(psA) && psA > 0 ? { psA } : {}),
    };
    rows.push(row);
  }

  return { rows, errors };
}

// ── Odds helpers ───────────────────────────────────────────────────────────────

export interface NormProbs {
  pH: number;  // normalised implied probability of home win
  pD: number;  // normalised implied probability of draw
  pA: number;  // normalised implied probability of away win
}

/**
 * Convert three decimal odds into normalised implied probabilities by
 * removing the bookmaker overround (margin).
 *
 * normalised_p = (1/odds) / (1/oddsH + 1/oddsD + 1/oddsA)
 */
export function oddsToNormProb(
  oddsH: number,
  oddsD: number,
  oddsA: number
): NormProbs {
  const rawH = 1 / oddsH;
  const rawD = 1 / oddsD;
  const rawA = 1 / oddsA;
  const total = rawH + rawD + rawA;  // overround > 1 under normal conditions
  return {
    pH: rawH / total,
    pD: rawD / total,
    pA: rawA / total,
  };
}
