import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { galicianNames } from "@/calendar/galicians";
import { nowInstant } from "@/clock";
import { XornadaScreen } from "@/components/xornada/XornadaScreen";
import { type Locale, t } from "@/i18n";
import {
  DEMO_NOW,
  DEMO_SEASON,
  demoMatches,
  isDemoAvailable,
} from "@/xornada/demo";
import { buildXornada, xornadaDays } from "@/xornada/view";
import {
  provisionalDisplay,
  RECENT_GOAL_MINUTES,
  recentGoalMark,
  showDayStrip,
  showTableLink,
} from "./config";

// /demo/xornada and /es/demo/xornada (SPEC-019 CA-5): server content only,
// never in production, never indexed.
export const DEMO_PATHS: Readonly<Record<Locale, string>> = {
  gl: "/demo/xornada",
  es: "/es/demo/xornada",
};

export function demoMetadata(locale: Locale): Metadata {
  return {
    title: `${t(locale, "xornada.title")} · ${t(locale, "common.title")}`,
    robots: { index: false, follow: false },
  };
}

// SPEC-084 CA-3 (H-1): the search params of the demo page; only
// ?provisional= is read, and only here.
export type DemoSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export async function DemoXornada({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: DemoSearchParams;
}) {
  if (!isDemoAvailable({ VERCEL_ENV: process.env.VERCEL_ENV })) notFound();
  const mode = provisionalDisplay((await searchParams).provisional);
  // SPEC-041 CA-6: rendered per request, its goals relative to this instant.
  const now = nowInstant();
  const matches = demoMatches(now);
  return (
    <XornadaScreen
      locale={locale}
      competitions={buildXornada(matches, galicianNames(DEMO_SEASON), mode)}
      days={xornadaDays(matches, DEMO_NOW)}
      paths={DEMO_PATHS}
      provisionalDisplay={mode}
      recentGoal={{
        now,
        minutes: RECENT_GOAL_MINUTES,
        mark: recentGoalMark(process.env),
      }}
      showDayStrip={showDayStrip(process.env)}
      showTableLink={showTableLink(process.env)}
    />
  );
}
