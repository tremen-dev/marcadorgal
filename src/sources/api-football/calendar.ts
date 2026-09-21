import { z } from "zod";
import {
  type CalendarImporter,
  type ImportedCalendar,
  type ImportedMatch,
  type ImportedTeam,
  SourceId,
} from "../../model/index.ts";

const BASE_URL = "https://v3.football.api-sports.io";

// competition_id -> API-Football league id (SPEC-004 CA-4).
export const LEAGUES: Readonly<Record<string, number>> = {
  "primera-division": 140,
  "segunda-division": 141,
  "primera-rfef-g1": 435,
  "segunda-rfef-g1": 875,
  "tercera-rfef-g1": 439,
};

const ROUND = /^(Regular Season|Group \d+) - (\d+)$/;
const UNCONFIRMED = new Set(["TBD", "PST"]);

const ProviderTeam = z.looseObject({
  id: z.union([z.int(), z.string().min(1)]),
  name: z.string().min(1),
});

const ProviderFixture = z.looseObject({
  fixture: z.looseObject({
    date: z.string().min(1),
    status: z.looseObject({ short: z.string() }),
  }),
  league: z.looseObject({ round: z.string() }),
  teams: z.looseObject({ home: ProviderTeam, away: ProviderTeam }),
});

const ProviderResponse = z.looseObject({
  response: z.array(ProviderFixture),
});

const providerSeason = (season: string): string => season.slice(0, 4);

const toInstant = (date: string): string => {
  const ms = Date.parse(date);
  if (Number.isNaN(ms)) throw new Error(`unparseable fixture.date ${date}`);
  return new Date(ms).toISOString().replace(/\.000Z$/, "Z");
};

export const apiFootballCalendar: CalendarImporter = {
  id: SourceId.parse("api-football"),

  covers(competitionId) {
    return competitionId in LEAGUES;
  },

  async fetch(competitionId, season, ctx) {
    const league = LEAGUES[competitionId];
    if (league === undefined)
      throw new Error(`api-football does not cover ${competitionId}`);
    const url = `${BASE_URL}/fixtures?league=${league}&season=${providerSeason(season)}`;
    const res = await ctx.fetch(url, {
      method: "GET",
      headers: { "x-apisports-key": ctx.apiKey, "User-Agent": ctx.userAgent },
    });
    if (!res.ok) throw new Error(`api-football responded ${res.status}`);
    return res.json();
  },

  parse(raw): ImportedCalendar {
    const { response } = ProviderResponse.parse(raw);
    const teams = new Map<string, ImportedTeam>();
    const matches: ImportedMatch[] = [];
    const ignoredRounds: Record<string, number> = {};
    for (const f of response) {
      const round = f.league.round.match(ROUND);
      if (!round) {
        ignoredRounds[f.league.round] =
          (ignoredRounds[f.league.round] ?? 0) + 1;
        continue;
      }
      const home = String(f.teams.home.id);
      const away = String(f.teams.away.id);
      teams.set(home, { externalId: home, externalName: f.teams.home.name });
      teams.set(away, { externalId: away, externalName: f.teams.away.name });
      matches.push({
        round: Number(round[2]),
        kickoff: toInstant(f.fixture.date),
        home,
        away,
        timeConfirmed: !UNCONFIRMED.has(f.fixture.status.short),
      });
    }
    return {
      teams: [...teams.values()].sort((a, b) =>
        a.externalId.localeCompare(b.externalId),
      ),
      matches,
      ignoredRounds,
    };
  },
};
