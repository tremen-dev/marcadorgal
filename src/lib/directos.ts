import { toMadridDate } from "./explorer-enrichment.ts";

// SPEC-087: /directos and /es/directos read one day of the explorer export.
// now is always a parameter (the page reads it from @/clock), so the logic
// is testable with a fixed instant.

// How far from today (Madrid) a ?date= may go, both ways (CA-1).
export const DIRECTOS_RANGE_DAYS = 7;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

// The day of a real calendar date as UTC milliseconds, or null.
function calendarDay(raw: string): number | null {
  const m = DATE_RE.exec(raw);
  if (m === null) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d
  )
    return null;
  return ms;
}

// CA-1: the day /directos shows. Without date, today in Europe/Madrid; a real
// YYYY-MM-DD at most DIRECTOS_RANGE_DAYS from today, that date; anything else
// (a repeated value, another shape, an impossible or far date), null.
export function directosDate(
  raw: string | string[] | undefined,
  now: string,
): string | null {
  const today = toMadridDate(now);
  if (raw === undefined) return today;
  if (typeof raw !== "string") return null;
  const day = calendarDay(raw);
  const base = calendarDay(today);
  if (day === null || base === null) return null;
  return Math.abs(day - base) / DAY_MS <= DIRECTOS_RANGE_DAYS ? raw : null;
}
