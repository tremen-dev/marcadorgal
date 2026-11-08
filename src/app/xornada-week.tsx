import { notFound, permanentRedirect, redirect } from "next/navigation";
import { publicXornadaReader, seasonOf } from "@/board/reader";
import { readWeekPage } from "@/board/week-read";
import { weekParam } from "@/board/week-route";
import { galicianNames } from "@/calendar/galicians";
import { nowInstant } from "@/clock";
import { SnapshotFreshness } from "@/components/xornada/SnapshotFreshness";
import { XornadaScreen } from "@/components/xornada/XornadaScreen";
import type { Locale } from "@/i18n";
import { buildXornada, xornadaDays } from "@/xornada/view";
import {
  PROVISIONAL_DISPLAY,
  RECENT_GOAL_MINUTES,
  recentGoalMark,
  showDayStrip,
} from "./config";

// SPEC-027 CA-3 (H-2..H-5): /xornada/[fecha] and /es/xornada/[fecha], the
// week of play keyed by its Saturday, rendered on the server over the
// public reader like / and kept by ISR for 10 s. A snapshot: no polling, no
// Realtime (H-4). The home week is / (307); another day of a week, its
// Saturday (308); a date outside the season of now, 404.

export async function WeekXornada({
  locale,
  fecha,
}: {
  locale: Locale;
  fecha: string;
}) {
  const now = nowInstant();
  const param = weekParam(fecha, locale, now);
  if (param.kind === "notFound") notFound();
  if (param.kind === "redirect") permanentRedirect(param.location);
  const read = await readWeekPage(
    publicXornadaReader(),
    param.week,
    locale,
    now,
  );
  if (read.kind === "notFound") notFound();
  if (read.kind === "redirect") redirect(read.location);
  const matches = read.kind === "page" ? read.matches : null;
  return (
    <XornadaScreen
      locale={locale}
      competitions={
        matches === null
          ? []
          : // SPEC-033 CA-4: the week is inside the season of now.
            buildXornada(
              matches,
              galicianNames(seasonOf(now)),
              PROVISIONAL_DISPLAY,
            )
      }
      days={matches === null ? [] : xornadaDays(matches, now)}
      provisionalDisplay={PROVISIONAL_DISPLAY}
      // SPEC-041 CA-3: a snapshot, marked at its render (H-4 of SPEC-027).
      recentGoal={{
        now,
        minutes: RECENT_GOAL_MINUTES,
        mark: recentGoalMark(process.env),
      }}
      paths={{
        gl: `/xornada/${param.week}`,
        es: `/es/xornada/${param.week}`,
      }}
      showDayStrip={showDayStrip(process.env)}
      unavailable={matches === null}
      arrows={read.kind === "page" ? read.arrows : undefined}
      freshness={
        matches === null ? undefined : (
          <SnapshotFreshness locale={locale} servedAt={now} />
        )
      }
    />
  );
}
