import type { Metadata } from "next";
import { boardEtag } from "@/board/http";
import { publicXornadaReader, seasonOf } from "@/board/reader";
import { galicianNames } from "@/calendar/galicians";
import { nowInstant } from "@/clock";
import { XornadaScreen } from "@/components/xornada/XornadaScreen";
import { type Locale, t } from "@/i18n";
import { rfefAliasesOrNull } from "@/ingest/aliases";
import { readXornadaBoard, renderExplorer } from "@/lib/xornada-board";
import { buildXornada, xornadaDays } from "@/xornada/view";
import {
  PROVISIONAL_DISPLAY,
  RECENT_GOAL_MINUTES,
  recentGoalMark,
  showDayStrip,
  showTableLink,
} from "./config";

// / and /es (SPEC-020 CA-6): the snapshot of the current xornada, rendered on
// the server from web.xornada through the public reader only. Not indexed
// until the published xornada (H-3).
export const HOME_PATHS: Readonly<Record<Locale, string>> = {
  gl: "/",
  es: "/es",
};

export function homeMetadata(locale: Locale): Metadata {
  const title = `${t(locale, "xornada.title")} · ${t(locale, "common.title")}`;
  const ogTitle = `${t(locale, "common.title")} · ${t(locale, "common.claim")}`;
  const description = t(locale, "common.description");
  const path = HOME_PATHS[locale];

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: ogTitle,
      description,
      url: path,
      siteName: t(locale, "common.title"),
      locale: locale === "es" ? "es_ES" : "gl_ES",
      type: "website",
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: ogTitle,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: ["/og.png"],
    },
  };
}

export async function HomeXornada({ locale }: { locale: Locale }) {
  const now = nowInstant();
  const season = seasonOf(now);
  // SPEC-085 CA-2: the shared read of the board (rows, scorers, women).
  const read = await readXornadaBoard(
    {
      reader: publicXornadaReader(),
      explorer: renderExplorer(),
      now,
      aliases: rfefAliasesOrNull(season),
    },
    locale,
  );
  const matches = read?.matches ?? null;
  const galicians = new Set([
    ...galicianNames(season),
    "Deportivo ABANCA",
    "Depor ABANCA",
    "As Celtas",
    "RC Celta Femenino / As Celtas",
    "RC Celta Femenino (As Celtas)",
    "Deportivo ABANCA B",
    "Depor ABANCA B",
    "Depor Abanca B",
    "CD Lugo Femenino",
    "Lugo Femenino",
    "Lugo Fem.",
    "Peluquería Mixta Friol",
    "PM Friol",
    "Pm Friol",
    "Sárdoma CF",
    "Sárdoma",
    "Sardoma Cf",
    "Viajes InterRías FF",
    "InterRías",
    "Viajes Interrias Ff",
    "Victoria CF",
    "Victoria Cf",
  ]);

  return (
    <XornadaScreen
      locale={locale}
      competitions={
        matches === null
          ? []
          : buildXornada(matches, galicians, PROVISIONAL_DISPLAY)
      }
      days={matches === null ? [] : xornadaDays(matches, now)}
      paths={HOME_PATHS}
      // SPEC-034 CA-5: to the screen and to the client of SPEC-024.
      provisionalDisplay={PROVISIONAL_DISPLAY}
      // SPEC-041 CA-3: to the screen and to the client of SPEC-024.
      recentGoal={{
        now,
        minutes: RECENT_GOAL_MINUTES,
        mark: recentGoalMark(process.env),
      }}
      showDayStrip={showDayStrip(process.env)}
      showTableLink={showTableLink(process.env)}
      unavailable={matches === null}
      arrows={read?.arrows}
      // SPEC-024: the client keeps it up to date from the served state.
      live={{
        matches: matches ?? [],
        servedAt: now,
        season,
        etag: matches === null ? null : boardEtag(matches),
        galicians: [...galicians],
      }}
    />
  );
}
