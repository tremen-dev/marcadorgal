const EXPLORER_URL =
  process.env.EXPLORER_BASE_URL ||
  process.env.RFEF_EXPLORER_URL ||
  "https://marcadorgal-explorer.vercel.app";

const API_TOKEN =
  process.env.RFEF_EXPLORER_TOKEN ||
  process.env.EXPLORER_API_KEY ||
  process.env.EXPLORER_TOKEN ||
  "";

export type OfficialCalendarResponse = {
  competition: string;
  season: string;
  exportedAt: string;
  teams: Array<{ externalId: string; externalName: string }>;
  matches: Array<{
    externalId: string;
    round: number;
    kickoff: string;
    home: string;
    away: string;
    timeConfirmed: boolean;
  }>;
  ignoredRounds: Record<string, unknown>;
};

export type DayMatchesResponse = {
  date: string;
  exportedAt: string;
  matches: Array<{
    matchKey?: string;
    codActa?: string | null;
    canonicalCompetitionId?: string;
    canonicalHomeTeamId?: string;
    canonicalAwayTeamId?: string;
    homeTeam?: string;
    awayTeam?: string;
    equipoLocal?: string;
    equipoVisitante?: string;
    homeScore?: number | null;
    awayScore?: number | null;
    golesLocal?: number | null;
    golesVisitante?: number | null;
    estado:
      | "SCHEDULED"
      | "LIVE_PROVISIONAL"
      | "FINISHED"
      | "POSTPONED"
      | "SUSPENDED";
    liveProvider?: "marca" | "rfef";
    goals?: Array<{
      team: "home" | "away";
      player: string;
      minute: number;
      penalty?: boolean;
      ownGoal?: boolean;
    }>;
    minute?: number | null;
    addedMinute?: number | null;
    halfTime?: boolean;
  }>;
};

export type StandingsResponse = {
  competition: string;
  season: string;
  updatedAt: string;
  isLive?: boolean;
  standings: Array<{
    position: number;
    teamId: string;
    teamName: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
    form?: string[];
  }>;
};

export type ScorersResponse = {
  competition: string;
  season?: string;
  scorers: Array<{
    rank: number;
    player: string;
    teamId: string;
    goals: number;
    penalties?: number;
  }>;
};

export type GoalkeepersResponse = {
  competition: string;
  season?: string;
  minMatches: number;
  goalkeepers: Array<{
    rank: number;
    player: string;
    teamId: string;
    goalsConceded: number;
    matchesPlayed: number;
    coefficient: number;
    qualified: boolean;
  }>;
};

export async function fetchExplorer<T>(
  path: string,
  params?: Record<string, string>,
  customFetch: typeof fetch = fetch,
): Promise<T> {
  const url = new URL(path, EXPLORER_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await customFetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
    },
    // Next.js ISR revalidation when called in server components
    ...(typeof fetch !== "undefined" && "next" in customFetch
      ? { next: { revalidate: 15 } }
      : {}),
  });

  if (!res.ok) {
    throw new Error(`[explorer] Error ${res.status} en ${path}`);
  }

  return res.json() as Promise<T>;
}

// 1. Calendario oficial (reemplaza API-Football)
export async function getOfficialCalendar(
  competition: string,
  season: string = "2026-27",
  customFetch?: typeof fetch,
): Promise<OfficialCalendarResponse> {
  return fetchExplorer<OfficialCalendarResponse>(
    "/api/export/calendar",
    { competition, season },
    customFetch,
  );
}

// 2. Partidos con goles en directo embebidos
export async function getDayMatches(
  date: string,
  customFetch?: typeof fetch,
): Promise<DayMatchesResponse> {
  return fetchExplorer<DayMatchesResponse>(
    "/api/export/matches",
    { date },
    customFetch,
  );
}

// 3. Clasificación
export async function getStandings(
  competition: string,
  season: string = "2026-27",
  customFetch?: typeof fetch,
): Promise<StandingsResponse> {
  return fetchExplorer<StandingsResponse>(
    "/api/export/standings",
    { competition, season },
    customFetch,
  );
}

// 4. Pichichi (Goleadores)
export async function getScorers(
  competition: string,
  season: string = "2026-27",
  customFetch?: typeof fetch,
): Promise<ScorersResponse> {
  return fetchExplorer<ScorersResponse>(
    "/api/export/stats/scorers",
    { competition, season },
    customFetch,
  );
}

// 5. Zamora (Porteros menos goleados)
export async function getGoalkeepers(
  competition: string,
  minMatches: number = 10,
  season: string = "2026-27",
  customFetch?: typeof fetch,
): Promise<GoalkeepersResponse> {
  return fetchExplorer<GoalkeepersResponse>(
    "/api/export/stats/goalkeepers",
    {
      competition,
      season,
      minMatches: minMatches.toString(),
    },
    customFetch,
  );
}
