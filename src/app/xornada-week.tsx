import { notFound, permanentRedirect, redirect } from "next/navigation";
import { publicXornadaReader } from "@/board/reader";
import { readWeekPage } from "@/board/week-read";
import { weekParam } from "@/board/week-route";
import { nowInstant } from "@/clock";
import { SnapshotFreshness } from "@/components/xornada/SnapshotFreshness";
import { XornadaScreen } from "@/components/xornada/XornadaScreen";
import type { Locale } from "@/i18n";
import { buildXornada, xornadaDays } from "@/xornada/view";

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
  const param = weekParam(fecha, locale);
  if (param.kind === "notFound") notFound();
  if (param.kind === "redirect") permanentRedirect(param.location);
  const now = nowInstant();
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
      competitions={matches === null ? [] : buildXornada(matches)}
      days={matches === null ? [] : xornadaDays(matches, now)}
      paths={{
        gl: `/xornada/${param.week}`,
        es: `/es/xornada/${param.week}`,
      }}
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
