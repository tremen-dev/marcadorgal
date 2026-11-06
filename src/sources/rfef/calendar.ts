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

export function createRfefCalendar(baseUrl?: string): CalendarImporter {
  const origin = (
    baseUrl ||
    process.env.RFEF_EXPLORER_URL ||
    "https://marcadorgal-explorer.vercel.app"
  ).replace(/\/+$/, "");

  return {
    id: RFEF_SOURCE_ID,

    covers(competitionId: CompetitionId | string, _season: string) {
      return FIVE_COMPETITIONS.has(String(competitionId));
    },

    async fetch(competitionId, season, ctx: CalendarFetchContext) {
      if (!FIVE_COMPETITIONS.has(String(competitionId))) {
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
      return ImportedCalendar.parse({
        teams: parsed.teams.map((t) => ({
          externalId: t.externalId,
          externalName: t.externalName,
        })),
        matches: parsed.matches.map((m) => ({
          externalId: m.externalId,
          round: m.round,
          kickoff: m.kickoff,
          home: m.home,
          away: m.away,
          timeConfirmed: m.timeConfirmed,
        })),
        ignoredRounds: parsed.ignoredRounds ?? {},
      });
    },
  };
}

export const rfefCalendar: CalendarImporter = createRfefCalendar();
