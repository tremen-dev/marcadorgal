import { currentRound, median } from "../calendar/current-round.ts";
import type { Locale } from "../i18n/index.ts";
import type { Instant } from "../model/index.ts";
import { seasonOf } from "./current.ts";
import type { XornadaIndexEntry } from "./row.ts";

// SPEC-027 (H-1, H-3): the week of play, the key of navigation between
// xornadas. Pure: no clock, no db. A week is the window Tuesday 00:00 →
// Tuesday 00:00 Europe/Madrid, keyed by its Saturday (YYYY-MM-DD). A round
// (competition + round) lives in the week of its median kickoff, the same
// median of currentRound; the xornada stays the round (dominio.md).

type Entry = Pick<
  XornadaIndexEntry,
  "competitionId" | "season" | "round" | "kickoff"
>;

const MADRID_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DAY_MS = 86_400_000;

// The civil date in Madrid, then civil arithmetic in UTC: the change of
// time moves the instant of Tuesday 00:00, never the date.
export function weekOf(instant: Instant | number): string {
  const parts = MADRID_DATE.formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const date = Date.UTC(part("year"), part("month") - 1, part("day"));
  // Days since the Tuesday that opens the week (Tuesday 0 … Monday 6).
  const sinceTuesday = (new Date(date).getUTCDay() + 5) % 7;
  return new Date(date + (4 - sinceTuesday) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

const roundKey = (e: Entry): string =>
  `${e.season}\u0000${e.competitionId}\u0000${e.round}`;

function roundWeeks(index: readonly Entry[]): Map<string, string> {
  const kickoffs = new Map<string, number[]>();
  for (const e of index) {
    const key = roundKey(e);
    const list = kickoffs.get(key) ?? [];
    list.push(Date.parse(e.kickoff));
    kickoffs.set(key, list);
  }
  return new Map(
    [...kickoffs].map(([key, list]) => [key, weekOf(median(list))]),
  );
}

// Every match of the rounds of that week, whatever its state (no live rule
// of another round: that belongs to the home only).
export function weekXornada<T extends Entry>(
  index: readonly T[],
  week: string,
): T[] {
  const weeks = roundWeeks(index);
  return index.filter((e) => weeks.get(roundKey(e)) === week);
}

// The weeks with at least one round, ascending.
export function seasonWeeks(index: readonly Entry[]): string[] {
  return [...new Set(roundWeeks(index).values())].sort();
}

const inSeason = <T extends Entry>(index: readonly T[], now: Instant): T[] => {
  const season = seasonOf(now);
  return index.filter((e) => e.season === season);
};

// The week of / and /es: the latest week among the rounds currentRound
// chooses per competition (SPEC-020 CA-5). null for an empty season.
export function homeWeek(index: readonly Entry[], now: Instant): string | null {
  const byCompetition = new Map<string, Entry[]>();
  for (const e of inSeason(index, now)) {
    const group = byCompetition.get(e.competitionId) ?? [];
    group.push(e);
    byCompetition.set(e.competitionId, group);
  }
  let home: string | null = null;
  for (const group of byCompetition.values()) {
    const round = currentRound(group, now);
    const [week] = seasonWeeks(group.filter((e) => e.round === round));
    if (week !== undefined && (home === null || week > home)) home = week;
  }
  return home;
}

export type Neighbours = { previous: string | null; next: string | null };

// The week of `weeks` just before and just after; empty weeks are not in
// `weeks`, so they are skipped.
export function neighbourWeeks(
  weeks: readonly string[],
  week: string,
): Neighbours {
  let previous: string | null = null;
  let next: string | null = null;
  for (const w of weeks) {
    if (w < week && (previous === null || w > previous)) previous = w;
    if (w > week && (next === null || w < next)) next = w;
  }
  return { previous, next };
}

const PREFIX: Readonly<Record<Locale, string>> = { gl: "", es: "/es" };

// The home week has no page of its own: it is / (/es).
export function weekHref(
  week: string,
  home: string | null,
  locale: Locale,
): string {
  if (week === home) return PREFIX[locale] || "/";
  return `${PREFIX[locale]}/xornada/${week}`;
}

// The destinations of ‹ and › from `week` (on / it is homeWeek), within the
// season of now; null where there is no neighbour.
export function weekArrows(
  index: readonly Entry[],
  week: string,
  now: Instant,
  locale: Locale,
): Neighbours {
  const home = homeWeek(index, now);
  const { previous, next } = neighbourWeeks(
    seasonWeeks(inSeason(index, now)),
    week,
  );
  return {
    previous: previous === null ? null : weekHref(previous, home, locale),
    next: next === null ? null : weekHref(next, home, locale),
  };
}
