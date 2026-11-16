import type { Locale } from "../i18n/index.ts";
import { withDeadline } from "./deadline.ts";
import { getDayMatches as explorerDayMatches } from "./explorer-client.ts";
import {
  EXPLORER_ENRICHMENT_TIMEOUT_MS,
  toMadridDate,
} from "./explorer-enrichment.ts";
import {
  type GroupedCompetitionMatches,
  transformExplorerMatches,
} from "./explorer-matches.ts";

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

export type DirectosRead =
  | { kind: "redirect"; location: string }
  | { kind: "page"; date: string; grouped: GroupedCompetitionMatches[] }
  | { kind: "unavailable"; date: string };

export type DirectosDeps = {
  // The explorer client; injected by the tests (never the network).
  getDayMatches?: typeof explorerDayMatches;
  timeoutMs?: number;
};

const PATH: Record<Locale, string> = { gl: "/directos", es: "/es/directos" };

// CA-2..CA-5: what /directos renders. An invalid date redirects to the same
// path without query and never asks explorer. The day read carries the
// deadline of the front page (SPEC-085), enforced here too for an injected
// client; a failure is logged and is "unavailable", never an empty day (D-9).
export async function readDirectos(
  raw: string | string[] | undefined,
  now: string,
  locale: Locale,
  deps: DirectosDeps = {},
): Promise<DirectosRead> {
  const date = directosDate(raw, now);
  if (date === null) return { kind: "redirect", location: PATH[locale] };
  const getDay = deps.getDayMatches ?? explorerDayMatches;
  const timeoutMs = deps.timeoutMs ?? EXPLORER_ENRICHMENT_TIMEOUT_MS;
  try {
    const day = await withDeadline(
      getDay(date, undefined, { timeoutMs }),
      timeoutMs,
      "directos",
    );
    if (!Array.isArray(day?.matches))
      throw new Error("[explorer] the export has no matches array");
    return { kind: "page", date, grouped: transformExplorerMatches(day) };
  } catch (e) {
    console.error(
      `directos: explorer failed for ${date}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return { kind: "unavailable", date };
  }
}
