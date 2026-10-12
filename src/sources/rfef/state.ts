import type { Instant, MatchState, SkippedReason } from "../../model/index.ts";
import type { PanelRow } from "./panel.ts";

// States of a panel row (ADR-017 §4, SPEC-031 CA-5). Pure: the clock is the
// capture's capturedAt, never the machine's. The RFEF never emits scheduled.

const MIN = 60_000;
const HOUR = 60 * MIN;

// Last Sunday of a month, at 01:00 UTC (EU summer time rule).
function lastSundayAt1Utc(year: number, month: number): number {
  const lastDay = Date.UTC(year, month + 1, 0);
  // 1970-01-01 was a Thursday, so (days + 4) % 7 counts from Sunday.
  const weekday = (Math.floor(lastDay / (24 * HOUR)) + 4) % 7;
  return lastDay - weekday * 24 * HOUR + HOUR;
}

const isSummerTime = (utc: number, year: number): boolean =>
  utc >= lastSundayAt1Utc(year, 2) && utc < lastSundayAt1Utc(year, 9);

// Local Europe/Madrid wall time -> UTC ms (CET = +1, CEST = +2).
export function madridToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const summer = wall - 2 * HOUR;
  return isSummerTime(summer, year) ? summer : wall - HOUR;
}

// The row's kickoff, with the year closest to capturedAt (the panel prints
// day and month only).
export function kickoffOf(row: PanelRow, capturedAt: Instant): number {
  const now = Date.parse(capturedAt);
  const year = Number(capturedAt.slice(0, 4));
  let best = Number.NaN;
  for (const y of [year - 1, year, year + 1]) {
    const k = madridToUtc(y, row.month, row.day, row.hour, row.minute);
    if (Number.isNaN(best) || Math.abs(k - now) < Math.abs(best - now))
      best = k;
  }
  return best;
}

export type RowState = MatchState | SkippedReason | null;

// null: the row says nothing ("-"), it does not appear anywhere.
export function rowState(row: PanelRow, capturedAt: Instant): RowState {
  const { score, status } = row.cell;
  if (status !== null) {
    if (status === "Aplazado")
      return { status: "postponed", score: null, minute: null };
    if (status === "Suspendido")
      return score === null
        ? "suspended_without_score"
        : { status: "suspended", score, minute: null };
    return "unsupported_status";
  }
  if (score === null) return null;
  if (row.acta?.kind === "closed")
    return { status: "finished", score, minute: null };
  const now = Date.parse(capturedAt);
  const kickoff = kickoffOf(row, capturedAt);
  if (!row.cell.blinking && now >= kickoff + 100 * MIN)
    return { status: "finished", score, minute: null };
  if (
    row.cell.blinking &&
    now >= kickoff - 10 * MIN &&
    now < kickoff + 110 * MIN
  )
    return { status: "live", score, minute: null, addedMinute: null };
  return "ambiguous_state";
}
