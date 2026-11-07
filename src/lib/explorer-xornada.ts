import { nowInstant } from "../clock.ts";
import { getGalicianClub } from "../model/clubs.ts";
import { getCompetitionMetadata } from "../model/competitions.ts";
import { CompetitionId, MatchId } from "../model/ids.ts";
import { Instant } from "../model/instant.ts";
import { PublicMatch } from "../model/public.ts";
import {
  type DayMatchesResponse,
  getDayMatches,
  getOfficialCalendar,
  type OfficialCalendarResponse,
} from "./explorer-client.ts";

const LIGA_F_TEAM_NAMES: Readonly<
  Record<string, { name: string; shortName: string }>
> = {
  "rc-deportivo": { name: "Deportivo ABANCA", shortName: "Depor ABANCA" },
  "depor-abanca": { name: "Deportivo ABANCA", shortName: "Depor ABANCA" },
  "fc-barcelona": { name: "FC Barcelona", shortName: "Barcelona" },
  "barcelona-femenino": { name: "FC Barcelona", shortName: "Barcelona" },
  "real-madrid-femenino": { name: "Real Madrid", shortName: "Real Madrid" },
  "atletico-madrid": { name: "Atlético de Madrid", shortName: "Atlético" },
  "atletico-madrid-femenino": {
    name: "Atlético de Madrid",
    shortName: "Atlético",
  },
  "athletic-femenino": { name: "Athletic Club", shortName: "Athletic" },
  "sevilla-fc": { name: "Sevilla FC", shortName: "Sevilla" },
  "valencia-cf": { name: "Valencia CF", shortName: "Valencia" },
  "espanyol-femenino": { name: "RCD Espanyol", shortName: "Espanyol" },
  "real-sociedad-femenino": {
    name: "Real Sociedad",
    shortName: "Real Sociedad",
  },
  "eibar-femenino": { name: "SD Eibar", shortName: "Eibar" },
  "granada-femenino": { name: "Granada CF", shortName: "Granada" },
  "logrono-united": { name: "Logroño United", shortName: "Logroño" },
  "madrid-cff": { name: "Madrid CFF", shortName: "Madrid CFF" },
  "badalona-women": { name: "Levante Badalona", shortName: "Badalona" },
  "levante-badalona": { name: "Levante Badalona", shortName: "Badalona" },
  "costa-adeje-tenerife": {
    name: "Costa Adeje Tenerife",
    shortName: "Tenerife",
  },
  alaves: { name: "Deportivo Alavés", shortName: "Alavés" },
};

function resolveTeamNames(teamId: string, fallbackName?: string) {
  const galician = getGalicianClub(teamId);
  if (galician) {
    return { name: galician.name, shortName: galician.shortName };
  }
  const known = LIGA_F_TEAM_NAMES[teamId];
  if (known) {
    return known;
  }
  const name = fallbackName || teamId;
  return { name, shortName: name };
}

export function findActiveRound(
  calendar: OfficialCalendarResponse,
  nowIso: string,
): number {
  const nowMs = new Date(nowIso).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const byRound = new Map<number, Array<{ kickoff: string }>>();

  for (const m of calendar.matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }

  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  // Find first round having at least one match playing now or in the near future
  for (const round of rounds) {
    const matches = byRound.get(round) ?? [];
    const hasUpcoming = matches.some(
      (m) => new Date(m.kickoff).getTime() >= nowMs - oneDayMs,
    );
    if (hasUpcoming) {
      return round;
    }
  }

  // Fallback to highest round or 1
  return rounds[rounds.length - 1] ?? 1;
}

export async function fetchWomenXornadaMatches(
  nowIso: string = nowInstant(),
  season: string = "2026-27",
): Promise<PublicMatch[]> {
  try {
    const calendar = await getOfficialCalendar("liga-f", season);
    if (!calendar?.matches || calendar.matches.length === 0) {
      return [];
    }

    const round = findActiveRound(calendar, nowIso);
    const roundMatches = calendar.matches.filter((m) => m.round === round);
    if (roundMatches.length === 0) {
      return [];
    }

    const dates = [
      ...new Set(
        roundMatches
          .map((m) => m.kickoff.slice(0, 10))
          .concat(nowIso.slice(0, 10)),
      ),
    ];

    const dayMatchesMap = new Map<
      string,
      DayMatchesResponse["matches"][number]
    >();
    await Promise.all(
      dates.map(async (d) => {
        try {
          const res = await getDayMatches(d);
          if (res?.matches) {
            for (const match of res.matches) {
              const key = match.canonicalHomeTeamId
                ? `${match.canonicalHomeTeamId}-${match.canonicalAwayTeamId}`
                : match.matchKey || "";
              if (key) {
                dayMatchesMap.set(key, match);
              }
            }
          }
        } catch (_e) {
          // Ignore per-day errors
        }
      }),
    );

    const meta = getCompetitionMetadata("liga-f");
    const competitionName = meta?.officialName || "Liga F Moeve";

    const results: PublicMatch[] = [];

    for (const m of roundMatches) {
      const homeNames = resolveTeamNames(m.home);
      const awayNames = resolveTeamNames(m.away);

      const dayMatch =
        dayMatchesMap.get(`${m.home}-${m.away}`) ||
        dayMatchesMap.get(`${m.home.replace(/-femenino$/, "")}-${m.away}`) ||
        null;

      const rawStatus = dayMatch?.estado;
      let status:
        | "scheduled"
        | "live"
        | "finished"
        | "postponed"
        | "suspended" = "scheduled";
      let halfTime = false;
      let homeScore: number | null = null;
      let awayScore: number | null = null;
      let minute: number | null = null;
      let addedMinute: number | null = null;

      if (rawStatus === "LIVE_PROVISIONAL") {
        status = "live";
        halfTime = dayMatch?.halfTime ?? false;
        homeScore = dayMatch?.homeScore ?? dayMatch?.golesLocal ?? 0;
        awayScore = dayMatch?.awayScore ?? dayMatch?.golesVisitante ?? 0;
        minute = dayMatch?.minute ?? null;
        addedMinute = dayMatch?.addedMinute ?? null;
      } else if (rawStatus === "FINISHED") {
        status = "finished";
        homeScore = dayMatch?.homeScore ?? dayMatch?.golesLocal ?? 0;
        awayScore = dayMatch?.awayScore ?? dayMatch?.golesVisitante ?? 0;
      } else if (rawStatus === "POSTPONED") {
        status = "postponed";
      } else if (rawStatus === "SUSPENDED") {
        status = "suspended";
        homeScore = dayMatch?.homeScore ?? null;
        awayScore = dayMatch?.awayScore ?? null;
      }

      const matchId = MatchId.parse(m.externalId);
      const competitionId = CompetitionId.parse("liga-f");

      const goals = (dayMatch?.goals || []).map((g) => ({
        team: g.team,
        player: g.player,
        minute: g.minute,
        penalty: g.penalty,
        ownGoal: g.ownGoal,
      }));

      const baseFields = {
        matchId,
        competitionId,
        competitionName,
        tier: 1 as const,
        round: m.round,
        kickoff: Instant.parse(m.kickoff),
        home: {
          name: homeNames.name,
          shortName: homeNames.shortName,
        },
        away: {
          name: awayNames.name,
          shortName: awayNames.shortName,
        },
        qualifier: "confirmado" as const,
        version: 1,
        observedAt: Instant.parse(nowIso),
        decidedAt: Instant.parse(nowIso),
        homeScoredAt: null,
        awayScoredAt: null,
        goals: goals.length > 0 ? goals : undefined,
      };

      if (status === "live") {
        results.push(
          PublicMatch.parse({
            status: "live",
            halfTime,
            score: { home: homeScore ?? 0, away: awayScore ?? 0 },
            minute,
            addedMinute,
            ...baseFields,
          }),
        );
      } else if (status === "finished") {
        results.push(
          PublicMatch.parse({
            status: "finished",
            score: { home: homeScore ?? 0, away: awayScore ?? 0 },
            ...baseFields,
          }),
        );
      } else if (status === "postponed") {
        results.push(
          PublicMatch.parse({
            status: "postponed",
            ...baseFields,
          }),
        );
      } else if (status === "suspended") {
        results.push(
          PublicMatch.parse({
            status: "suspended",
            score:
              homeScore !== null && awayScore !== null
                ? { home: homeScore, away: awayScore }
                : null,
            ...baseFields,
          }),
        );
      } else {
        results.push(
          PublicMatch.parse({
            status: "scheduled",
            ...baseFields,
          }),
        );
      }
    }

    return results;
  } catch (_e) {
    return [];
  }
}
