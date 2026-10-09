import type { Locale } from "../i18n/index.ts";
import type { Instant, MatchId } from "../model/index.ts";
import { seasonOf } from "./current.ts";
import type { XornadaIndexEntry } from "./row.ts";
import {
  homeWeek,
  type Neighbours,
  seasonWeeks,
  weekArrows,
  weekHref,
  weekOf,
  weekXornada,
} from "./weeks.ts";

// SPEC-027 CA-3 (H-2, H-3, H-5): the answer of /xornada/[fecha] and
// /es/xornada/[fecha]. Pure, in two steps: the date (and the season of now)
// decides 404 and 308 (nothing is read); the week over the index of the season of now
// decides 307, 404 or the page.

export type WeekParam =
  | { kind: "notFound" }
  | { kind: "redirect"; status: 308; location: string }
  | { kind: "week"; week: string };

export type WeekPage =
  | { kind: "notFound" }
  | { kind: "redirect"; status: 307; location: string }
  // No reader, or the read failed: said in words, as on / (D-9).
  | { kind: "unavailable" }
  | { kind: "page"; matchIds: MatchId[]; arrows: Neighbours };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isDate(fecha: string): boolean {
  const m = DATE.exec(fecha);
  if (m === null) return false;
  const [year, month, day] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// The calendar years a season can play in: 2026-27 → 2026 and 2027. A week
// key outside them is never one of seasonWeeks (H-5), so it is answered
// 404 without reading: otherwise every valid Saturday would be a new ISR
// key and one index read (F-4 of the verification).
function inSeasonYears(week: string, now: Instant): boolean {
  const start = Number(seasonOf(now).slice(0, 4));
  const year = Number(week.slice(0, 4));
  return year === start || year === start + 1;
}

export function weekParam(
  fecha: string,
  locale: Locale,
  now: Instant,
): WeekParam {
  if (!isDate(fecha)) return { kind: "notFound" };
  // Noon UTC is the same civil date in Madrid all year.
  const week = weekOf(`${fecha}T12:00:00Z`);
  if (week !== fecha)
    return {
      kind: "redirect",
      status: 308,
      location: weekHref(week, null, locale),
    };
  if (!inSeasonYears(week, now)) return { kind: "notFound" };
  return { kind: "week", week };
}

export function weekPage(
  week: string,
  locale: Locale,
  now: Instant,
  index: readonly XornadaIndexEntry[] | null,
): WeekPage {
  if (index === null) return { kind: "unavailable" };
  const season = index.filter((e) => e.season === seasonOf(now));
  const home = homeWeek(season, now);
  if (week === home)
    return {
      kind: "redirect",
      status: 307,
      location: weekHref(week, home, locale),
    };
  if (!seasonWeeks(season).includes(week)) return { kind: "notFound" };
  return {
    kind: "page",
    matchIds: weekXornada(season, week).map((e) => e.matchId),
    arrows: weekArrows(season, week, now, locale),
  };
}
