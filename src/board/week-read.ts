import type { Locale } from "../i18n/index.ts";
import type { Instant, PublicMatch } from "../model/index.ts";
import { currentXornada, seasonOf } from "./current.ts";
import type { XornadaIndexEntry } from "./row.ts";
import { weekPage } from "./week-route.ts";
import { homeWeek, type Neighbours, weekArrows } from "./weeks.ts";

// SPEC-027 (N-1): the pages read as today, the index of the season of now
// and then the rows by id, through the reader they are given (the public
// one in the app). No new query, no clock.

export type IndexReader = {
  index(season: string): Promise<XornadaIndexEntry[]>;
  matches(ids: readonly string[]): Promise<PublicMatch[]>;
};

const NO_ARROWS: Neighbours = { previous: null, next: null };

// / and /es: the current xornada (SPEC-020 CA-5) and the arrows of the home
// week. A failed read throws and the page decides, as before.
export async function readHome(
  reader: IndexReader,
  now: Instant,
  locale: Locale,
): Promise<{ matches: PublicMatch[]; arrows: Neighbours }> {
  const index = await reader.index(seasonOf(now));
  const matches = await reader.matches(
    currentXornada(index, now).map((e) => e.matchId),
  );
  const home = homeWeek(index, now);
  return {
    matches,
    arrows: home === null ? NO_ARROWS : weekArrows(index, home, now, locale),
  };
}

export type WeekRead =
  | Exclude<ReturnType<typeof weekPage>, { kind: "page" }>
  | { kind: "page"; matches: PublicMatch[]; arrows: Neighbours };

const failed = (e: unknown): WeekRead => {
  console.error(
    `xornada: read failed: ${e instanceof Error ? e.message : String(e)}`,
  );
  return { kind: "unavailable" };
};

// /xornada/[fecha] once the date is a week key (weekParam).
export async function readWeekPage(
  reader: IndexReader | null,
  week: string,
  locale: Locale,
  now: Instant,
): Promise<WeekRead> {
  // No reader: unavailable, as weekPage says for a null index.
  if (reader === null) return { kind: "unavailable" };
  let index: XornadaIndexEntry[];
  try {
    index = await reader.index(seasonOf(now));
  } catch (e) {
    return failed(e);
  }
  const decision = weekPage(week, locale, now, index);
  if (decision.kind !== "page") return decision;
  try {
    return {
      kind: "page",
      matches: await reader.matches(decision.matchIds),
      arrows: decision.arrows,
    };
  } catch (e) {
    return failed(e);
  }
}
