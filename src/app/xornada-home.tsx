import type { Metadata } from "next";
import { boardEtag } from "@/board/http";
import { readPublicXornada, seasonOf } from "@/board/reader";
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

async function snapshot(now: Instant): Promise<PublicMatch[] | null> {
  try {
    return await readPublicXornada(now);
  } catch (e) {
    console.error(
      `xornada: read failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}

export async function HomeXornada({ locale }: { locale: Locale }) {
  const now = nowInstant();
  const matches = await snapshot(now);
  return (
    <XornadaScreen
      locale={locale}
      competitions={matches === null ? [] : buildXornada(matches)}
      days={matches === null ? [] : xornadaDays(matches, now)}
      paths={HOME_PATHS}
      unavailable={matches === null}
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
