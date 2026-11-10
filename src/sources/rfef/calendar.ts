import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  type CalendarFetchContext,
  type CalendarImporter,
  type CompetitionId,
  ImportedCalendar,
  SourceId,
} from "../../model/index.ts";

export const RFEF_SOURCE_ID = SourceId.parse("rfef");

export const CALENDAR_EXPORT_PATH = "/api/export/calendar";

export const FIVE_COMPETITIONS: ReadonlySet<string> = new Set([
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
]);

export const COVERED_COMPETITIONS: ReadonlySet<string> = new Set([
  ...FIVE_COMPETITIONS,
  "liga-f",
  "primera-federacion-fem",
  "segunda-federacion-fem-g1",
]);

// Raw shape returned by explorer GET /api/export/calendar?competition=...&season=...
export const RawCalendarExport = z.looseObject({
  competition: z.string().min(1),
  season: z.string().min(1),
  exportedAt: z.string().min(1),
  teams: z.array(
    z.looseObject({
      externalId: z.string().min(1),
      externalName: z.string().min(1),
    }),
  ),
  matches: z.array(
    z.looseObject({
      externalId: z.string().min(1),
      round: z.int().min(1),
      kickoff: z.string().min(1),
      home: z.string().min(1),
      away: z.string().min(1),
      timeConfirmed: z.boolean(),
    }),
  ),
  ignoredRounds: z.record(z.string(), z.int().min(1)).optional().default({}),
});
export type RawCalendarExport = z.infer<typeof RawCalendarExport>;

// Per-competition rewrites of explorer team ids, for when explorer exports a
// team under another team's id. Empty: the last entry (racing-ferrol ->
// rayo-cantabria in segunda-rfef-g1, F-SPEC-074-3) was retired by SPEC-076
// once explorer fixed it; the filiales are resolved by the alias
// (data/alias/2026-27/rfef.json, F-SPEC-074-1). Kept for the next explorer
// bug.
export const COMPETITION_TEAM_OVERRIDES: Readonly<
  Record<
    string,
    Readonly<Record<string, { externalId: string; externalName: string }>>
  >
> = {};

export function createRfefCalendar(baseUrl?: string): CalendarImporter {
  const origin = (
    baseUrl ||
    process.env.RFEF_EXPLORER_URL ||
    "https://marcadorgal-explorer.vercel.app"
  ).replace(/\/+$/, "");

  return {
    id: RFEF_SOURCE_ID,

    covers(competitionId: CompetitionId | string, _season: string) {
      return COVERED_COMPETITIONS.has(String(competitionId));
    },

    async fetch(competitionId, season, ctx: CalendarFetchContext) {
      if (!COVERED_COMPETITIONS.has(String(competitionId))) {
        throw new Error(`rfef calendar does not cover ${competitionId}`);
      }
      const token =
        ctx.apiKey ||
        process.env.RFEF_EXPLORER_TOKEN ||
        process.env.EXPLORER_API_KEY ||
        "";
      const url = `${origin}${CALENDAR_EXPORT_PATH}?competition=${competitionId}&season=${season}`;
      const res = await ctx.fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": ctx.userAgent,
        },
      });
      if (!res.ok) {
        throw new Error(`rfef explorer calendar responded ${res.status}`);
      }
      return res.json();
    },

    parse(raw: unknown): ImportedCalendar {
      const parsed = RawCalendarExport.parse(raw);
      if (parsed.competition === "tercera-rfef-g1") {
        const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
        const baseDir = existsSync(path.join(process.cwd(), "data"))
          ? process.cwd()
          : repoRoot;
        const file = path.join(
          baseDir,
          "data",
          "calendario",
          parsed.season,
          "tercera-rfef-g1.json",
        );
        if (existsSync(file)) {
          const declared = JSON.parse(readFileSync(file, "utf8"));
          return ImportedCalendar.parse({
            teams: declared.teams.map((t: { id: string; name: string }) => ({
              externalId: t.id,
              externalName: t.name,
            })),
            matches: declared.matches.map(
              (m: {
                round: number;
                kickoff: string;
                home: string;
                away: string;
              }) => ({
                externalId: `2026-27-3rfef-j${m.round}-${m.home}-${m.away}`,
                round: m.round,
                kickoff: m.kickoff,
                home: m.home,
                away: m.away,
                timeConfirmed: true,
              }),
            ),
            ignoredRounds: {},
          });
        }
      }

      const overrides = COMPETITION_TEAM_OVERRIDES[parsed.competition] ?? {};
      return ImportedCalendar.parse({
        teams: parsed.teams.map((t) => {
          const override = overrides[t.externalId];
          return {
            externalId: override?.externalId ?? t.externalId,
            externalName: override?.externalName ?? t.externalName,
          };
        }),
        matches: parsed.matches.map((m) => ({
          externalId: m.externalId,
          round: m.round,
          kickoff: m.kickoff,
          home: overrides[m.home]?.externalId ?? m.home,
          away: overrides[m.away]?.externalId ?? m.away,
          timeConfirmed: m.timeConfirmed,
        })),
        ignoredRounds: parsed.ignoredRounds ?? {},
      });
    },
  };
}

export const rfefCalendar: CalendarImporter = createRfefCalendar();
