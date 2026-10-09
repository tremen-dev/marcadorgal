import type { Metadata } from "next";
import { boardEtag } from "@/board/http";
import { publicXornadaReader, seasonOf } from "@/board/reader";
import { readHome } from "@/board/week-read";
import type { Neighbours } from "@/board/weeks";
import { nowInstant } from "@/clock";
import { XornadaScreen } from "@/components/xornada/XornadaScreen";
import { type Locale, t } from "@/i18n";
import type { Instant, PublicMatch } from "@/model";
import { buildXornada, xornadaDays } from "@/xornada/view";

// / and /es (SPEC-020 CA-6): the snapshot of the current xornada, rendered on
// the server from web.xornada through the public reader only. Not indexed
// until the published xornada (H-3).
export const HOME_PATHS: Readonly<Record<Locale, string>> = {
  gl: "/",
  es: "/es",
};

export function homeMetadata(locale: Locale): Metadata {
  return {
    title: `${t(locale, "xornada.title")} · ${t(locale, "common.title")}`,
    robots: { index: false, follow: false },
  };
}

// SPEC-027: the same reads as before (index, then the rows of the current
// xornada) and, from that index, the arrows of the home week.
async function snapshot(
  now: Instant,
  locale: Locale,
): Promise<{ matches: PublicMatch[]; arrows: Neighbours } | null> {
  const reader = publicXornadaReader();
  if (reader === null) return null;
  try {
    return await readHome(reader, now, locale);
  } catch (e) {
    console.error(
      `xornada: read failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}

export async function HomeXornada({ locale }: { locale: Locale }) {
  const now = nowInstant();
  const read = await snapshot(now, locale);
  const matches = read?.matches ?? null;
  return (
    <XornadaScreen
      locale={locale}
      competitions={matches === null ? [] : buildXornada(matches)}
      days={matches === null ? [] : xornadaDays(matches, now)}
      paths={HOME_PATHS}
      unavailable={matches === null}
      arrows={read?.arrows}
      // SPEC-024: the client keeps it up to date from the served state.
      live={{
        matches: matches ?? [],
        servedAt: now,
        season: seasonOf(now),
        etag: matches === null ? null : boardEtag(matches),
      }}
    />
  );
}
