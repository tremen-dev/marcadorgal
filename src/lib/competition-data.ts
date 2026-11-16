import { BUNDLED_CALENDARS } from "../calendar/bundled.ts";
import { matchId } from "../calendar/match-id.ts";
import { CalendarFile } from "../calendar/schema.ts";
import type { CalendarViewData } from "../components/competition/CalendarView.tsx";
import { isAllowedCompetition } from "../model/index.ts";
import { COMPETITION_SOURCES } from "./competition-sources.ts";
import {
  getOfficialCalendar,
  getStandings,
  type OfficialCalendarResponse,
  type StandingsResponse,
} from "./explorer-client.ts";

export const COMPETITION_SEASON = "2026-27";

// The two explorer reads of the competition pages, injected in tests
// (SPEC-089, as SPEC-085 CA-2); the client by default.
export type CompetitionExplorer = {
  calendar(
    competition: string,
    season: string,
  ): Promise<OfficialCalendarResponse>;
  standings(competition: string, season: string): Promise<StandingsResponse>;
};

export const clientCompetitionExplorer: CompetitionExplorer = {
  calendar: (competition, season) => getOfficialCalendar(competition, season),
  standings: (competition, season) => getStandings(competition, season),
};

// ok: data to paint; unavailable: a failure (xornada.unavailable, D-9);
// notOffered: marcador.gal has no official data for it (SPEC-089 CA-4/CA-5).
export type CompetitionResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unavailable" }
  | { kind: "notOffered" };

const UNAVAILABLE = { kind: "unavailable" } as const;
const NOT_OFFERED = { kind: "notOffered" } as const;

// The declared calendar with the names of teams[].name and the ids of the
// file for shield and highlight (F-V-1); no timeConfirmed: the file does not
// say it (CA-3). An invalid file never falls to explorer.
function localCalendar(
  id: string,
  files: Readonly<Record<string, unknown>> | undefined,
): CompetitionResult<CalendarViewData> {
  const parsed = CalendarFile.safeParse(files?.[id]);
  if (!parsed.success) return UNAVAILABLE;
  const { competition, teams, matches } = parsed.data;
  const names = new Map(teams.map((team) => [team.id, team.name]));
  return {
    kind: "ok",
    data: {
      matches: matches.map((m) => ({
        externalId: matchId({
          competitionId: competition.id,
          season: competition.season,
          round: m.round,
          homeTeamId: m.home,
          awayTeamId: m.away,
        }),
        round: m.round,
        kickoff: m.kickoff,
        home: names.get(m.home) ?? m.home,
        away: names.get(m.away) ?? m.away,
        homeId: m.home,
        awayId: m.away,
      })),
    },
  };
}

// `files` overrides the bundled calendars of the season (tests only).
export async function loadCompetitionCalendar(
  id: string,
  explorer: CompetitionExplorer = clientCompetitionExplorer,
  files: Readonly<Record<string, unknown>> | undefined = BUNDLED_CALENDARS[
    COMPETITION_SEASON
  ],
): Promise<CompetitionResult<CalendarViewData>> {
  if (!isAllowedCompetition(id)) return NOT_OFFERED;
  const source = COMPETITION_SOURCES[id].calendar;
  if (source === "none") return NOT_OFFERED;
  if (source === "local") return localCalendar(id, files);
  try {
    const data = await explorer.calendar(id, COMPETITION_SEASON);
    return data.matches.length > 0 ? { kind: "ok", data } : UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}

export async function loadCompetitionStandings(
  id: string,
  explorer: CompetitionExplorer = clientCompetitionExplorer,
): Promise<CompetitionResult<StandingsResponse>> {
  if (!isAllowedCompetition(id)) return NOT_OFFERED;
  if (COMPETITION_SOURCES[id].standings === "none") return NOT_OFFERED;
  try {
    const data = await explorer.standings(id, COMPETITION_SEASON);
    return data.standings.length > 0 ? { kind: "ok", data } : UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}
