import { seasonOf } from "../board/current.ts";
import { type IndexReader, readHome } from "../board/week-read.ts";
import type { Neighbours } from "../board/weeks.ts";
import { nowInstant } from "../clock.ts";
import type { Locale } from "../i18n/index.ts";
import type { AliasFile, Instant, PublicMatch } from "../model/index.ts";
import {
  EXPLORER_ENRICHMENT_TIMEOUT_MS,
  enrichMatchesWithGoals,
} from "./explorer-enrichment.ts";
import {
  clientExplorer,
  fetchWomenXornadaMatches,
  type WomenExplorer,
} from "./explorer-xornada.ts";

// SPEC-085 CA-2: the one read of the board behind /, /es and /api/board. The
// rows of web.xornada, their scorers from Explorer and the women xornada of
// Explorer; the women start at once, without waiting for the base or the
// scorers. Every dependency is given (reader, Explorer, now): no clock here.

export type BoardExplorer = WomenExplorer;

export type BoardReadDeps = {
  reader: IndexReader | null;
  explorer: BoardExplorer;
  now: Instant;
  aliases?: AliasFile | null;
  timeoutMs?: number;
};

export type BoardRead = { matches: PublicMatch[]; arrows: Neighbours };

// SPEC-085 CA-5: within one read, each date is asked once between the
// scorers and the women; the second asker shares the first request.
function oncePerDay(explorer: BoardExplorer): BoardExplorer {
  const days = new Map<string, ReturnType<BoardExplorer["dayMatches"]>>();
  return {
    calendar: explorer.calendar,
    dayMatches: (date) => {
      let day = days.get(date);
      if (day === undefined) {
        day = explorer.dayMatches(date);
        days.set(date, day);
      }
      return day;
    },
  };
}

// null: no reader, or the base failed (logged). A failure of Explorer never
// becomes a state (D-9): the rows stay without scorers, or without women.
export async function readXornadaBoard(
  deps: BoardReadDeps,
  locale: Locale,
): Promise<BoardRead | null> {
  const { reader, now } = deps;
  if (reader === null) return null;
  const timeoutMs = deps.timeoutMs ?? EXPLORER_ENRICHMENT_TIMEOUT_MS;
  const explorer = oncePerDay(deps.explorer);

  const women = fetchWomenXornadaMatches(now, seasonOf(now), explorer, {
    timeoutMs,
  }).catch(() => [] as PublicMatch[]);

  let read: BoardRead;
  try {
    read = await readHome(reader, now, locale);
  } catch (e) {
    console.error(
      `xornada: read failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }

  let matches = read.matches;
  try {
    matches = await enrichMatchesWithGoals(
      matches,
      explorer.dayMatches,
      deps.aliases ?? null,
      { timeoutMs },
    );
  } catch (_e) {
    // Graceful fallback: the rows without scorers.
  }

  const womenMatches = await women;
  return {
    matches: womenMatches.length > 0 ? [...matches, ...womenMatches] : matches,
    arrows: read.arrows,
  };
}

// SPEC-085 CA-4 (H-2): the official calendar of a women competition changes
// with postponements, not minute by minute (the live state comes from the
// day's matches): it is reused for an hour within the same instance.
export const WOMEN_CALENDAR_TTL_S = 3600;

type CalendarFetch = BoardExplorer["calendar"];

// The calendar by competition and season, kept for ttlS by the given clock.
// A failure is never kept: the next read asks again.
export function cachedCalendar(
  fetchCalendar: CalendarFetch,
  clock: () => Instant,
  ttlS: number = WOMEN_CALENDAR_TTL_S,
): CalendarFetch {
  const kept = new Map<
    string,
    { at: number; calendar: Awaited<ReturnType<CalendarFetch>> }
  >();
  return async (competition, season) => {
    const key = `${competition}|${season}`;
    const now = Date.parse(clock());
    const hit = kept.get(key);
    if (hit !== undefined && now - hit.at < ttlS * 1000) return hit.calendar;
    const calendar = await fetchCalendar(competition, season);
    kept.set(key, { at: now, calendar });
    return calendar;
  };
}

// Explorer as the render reads it (CA-3): every request with the deadline
// of the enrichment, which aborts the socket; the calendar from the cache of
// this instance (CA-4).
const client = clientExplorer(EXPLORER_ENRICHMENT_TIMEOUT_MS);
const renderCalendar = cachedCalendar(client.calendar, nowInstant);

export const renderExplorer = (): BoardExplorer => ({
  calendar: renderCalendar,
  dayMatches: client.dayMatches,
});
