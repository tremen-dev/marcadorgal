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

// weekOf is pure and its inputs repeat (the medians of the rounds of a
// season): a bounded memo spares the Intl formatting on every render.
const WEEK_OF = new Map<number, string>();
const WEEK_OF_MAX = 4096;

// The civil date in Madrid, then civil arithmetic in UTC: the change of
// time moves the instant of Tuesday 00:00, never the date.
export function weekOf(instant: Instant | number): string {
  const at = typeof instant === "number" ? instant : Date.parse(instant);
  const known = WEEK_OF.get(at);
  if (known !== undefined) return known;
  if (WEEK_OF.size >= WEEK_OF_MAX) WEEK_OF.clear();
  const week = civilWeekOf(at);
  WEEK_OF.set(at, week);
  return week;
}

function civilWeekOf(instant: number): string {
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

// The index is read-only (readonly everywhere): one render asks the weeks
// of the same index several times, so they are kept per array.
const ROUND_WEEKS = new WeakMap<readonly Entry[], Map<string, string>>();

function roundWeeks(index: readonly Entry[]): Map<string, string> {
  const known = ROUND_WEEKS.get(index);
  if (known !== undefined) return known;
  const weeks = computeRoundWeeks(index);
  ROUND_WEEKS.set(index, weeks);
  return weeks;
}

function computeRoundWeeks(index: readonly Entry[]): Map<string, string> {
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

// The same array when it is already the season of now (the usual case),
// so that the weeks kept per array serve the whole render.
const inSeason = <T extends Entry>(
  index: readonly T[],
  now: Instant,
): readonly T[] => {
  const season = seasonOf(now);
  return index.every((e) => e.season === season)
    ? index
    : index.filter((e) => e.season === season);
};

// The rounds currentRound chooses per competition in the season of now
// (SPEC-020 CA-5), as roundKey.
function chosenRounds(season: readonly Entry[], now: Instant): Set<string> {
  const byCompetition = new Map<string, Entry[]>();
  for (const e of season) {
    const group = byCompetition.get(e.competitionId) ?? [];
    group.push(e);
    byCompetition.set(e.competitionId, group);
  }
  const chosen = new Set<string>();
  for (const group of byCompetition.values()) {
    const round = currentRound(group, now);
    const e = group.find((x) => x.round === round);
    if (e !== undefined) chosen.add(roundKey(e));
  }
  return chosen;
}

type Home = { shown: string[]; home: string | null };

// SPEC-092 CA-1 (H-1, amends SPEC-027 CA-2). S: the weeks of the chosen
// rounds, ascending, without repeats; more than one is a mix. H, the week
// of / and /es: without a mix, the only week shown; with a mix, the only
// covered week shown (all of its rounds chosen, so / paints it whole);
// null if there is none or more than one, and for an empty season.
function homeOf(index: readonly Entry[], now: Instant): Home {
  const season = inSeason(index, now);
  const weeks = roundWeeks(season);
  const chosen = chosenRounds(season, now);
  const shown = [
    ...new Set([...chosen].map((key) => weeks.get(key) as string)),
  ].sort();
  if (shown.length <= 1) return { shown, home: shown[0] ?? null };
  const covered = shown.filter((week) =>
    [...weeks].every(([key, w]) => w !== week || chosen.has(key)),
  );
  return { shown, home: covered.length === 1 ? covered[0] : null };
}

export function homeWeeks(index: readonly Entry[], now: Instant): string[] {
  return homeOf(index, now).shown;
}

export function homeWeek(index: readonly Entry[], now: Instant): string | null {
  return homeOf(index, now).home;
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

const arrowsTo = (
  previous: string | null,
  next: string | null,
  home: string | null,
  locale: Locale,
): Neighbours => ({
  previous: previous === null ? null : weekHref(previous, home, locale),
  next: next === null ? null : weekHref(next, home, locale),
});

// The destinations of ‹ and › from the page of `week`, within the season of
// now; null where there is no neighbour. Only H is / (/es).
export function weekArrows(
  index: readonly Entry[],
  week: string,
  now: Instant,
  locale: Locale,
): Neighbours {
  const { previous, next } = neighbourWeeks(
    seasonWeeks(inSeason(index, now)),
    week,
  );
  return arrowsTo(previous, next, homeWeek(index, now), locale);
}

// SPEC-092 CA-2 (H-2): the destinations of ‹ and › on / and /es. With H,
// its neighbours; with a mix and no H, ‹ is the first week shown (it has
// rounds / does not paint) and › its next one. Only H is / (/es).
export function homeArrows(
  index: readonly Entry[],
  now: Instant,
  locale: Locale,
): Neighbours {
  const { shown, home: week } = homeOf(index, now);
  const from = week ?? shown[0];
  if (from === undefined) return { previous: null, next: null };
  const { previous, next } = neighbourWeeks(
    seasonWeeks(inSeason(index, now)),
    from,
  );
  if (week !== null) return arrowsTo(previous, next, week, locale);
  return arrowsTo(from, next, null, locale);
}
