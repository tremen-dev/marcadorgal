import { nowInstant } from "../clock.ts";
import { getGalicianClub } from "../model/clubs.ts";
import {
  type CompetitionCode,
  type CompetitionMetadata,
  getCompetitionMetadata,
} from "../model/competitions.ts";
import { CompetitionId, MatchId } from "../model/ids.ts";
import { Instant } from "../model/instant.ts";
import { PublicMatch } from "../model/public.ts";
import {
  getDayMatches,
  getOfficialCalendar,
  type OfficialCalendarResponse,
} from "./explorer-client.ts";
import { toMadridDate } from "./explorer-enrichment.ts";
import {
  candidateOf,
  type ExplorerRow,
  isSameMatch,
  pickRow,
} from "./explorer-identity.ts";

export const WOMEN_COMPETITIONS: readonly CompetitionCode[] = [
  "liga-f",
  "primera-federacion-fem",
  "segunda-federacion-fem-g1",
];

const WOMEN_TEAM_NAMES: Readonly<
  Record<string, { name: string; shortName: string }>
> = {
  // Liga F
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

  // 1ª Federación Femenina
  "alaves-gloriosas": {
    name: "Deportivo Alavés Gloriosas",
    shortName: "Alavés",
  },
  "albacete-femenino": { name: "CD Alba Fundación", shortName: "Albacete" },
  "alhama-cf": { name: "Alhama CF ElPozo", shortName: "Alhama" },
  "athletic-b": { name: "Athletic Club B", shortName: "Athletic B" },
  "atletico-madrid-b": {
    name: "Atlético de Madrid B",
    shortName: "Atlético B",
  },
  "barcelona-b": { name: "FC Barcelona B", shortName: "Barcelona B" },
  "cacereno-femenino": { name: "CP Cacereño", shortName: "Cacereño" },
  "getafe-femenino": { name: "Getafe CF Femenino", shortName: "Getafe" },
  "madrid-cff-b": { name: "Madrid CFF B", shortName: "Madrid CFF B" },
  "osasuna-femenino": { name: "CA Osasuna", shortName: "Osasuna" },
  "real-madrid-b": { name: "Real Madrid B", shortName: "Real Madrid B" },
  "se-aem": { name: "SE AEM Lleida", shortName: "AEM" },
  "sporting-gijon-femenino": {
    name: "Real Sporting de Gijón",
    shortName: "Sporting",
  },
  "villarreal-femenino": { name: "Villarreal CF", shortName: "Villarreal" },

  // 2ª Federación Femenina - G1 (Galegas e rivais)
  "as-celtas": {
    name: "RC Celta Femenino (As Celtas)",
    shortName: "As Celtas",
  },
  "depor-abanca-b": { name: "Deportivo ABANCA B", shortName: "Depor ABANCA B" },
  "lugo-femenino": { name: "CD Lugo Femenino", shortName: "Lugo Fem." },
  "pm-friol": { name: "Peluquería Mixta Friol", shortName: "PM Friol" },
  "sardoma-cf": { name: "Sárdoma CF", shortName: "Sárdoma" },
  "viajes-interrias-ff": {
    name: "Viajes InterRías FF",
    shortName: "InterRías",
  },
  "victoria-cf": { name: "Victoria CF", shortName: "Victoria CF" },
  "aviles-stadium-femenino": {
    name: "Avilés Stadium CF",
    shortName: "Avilés",
  },
  "bizkerre-club": { name: "Bizkerre Club", shortName: "Bizkerre" },
  "burgos-cf-femenino": { name: "Burgos CF", shortName: "Burgos" },
  "cd-arratia": { name: "CD Arratia", shortName: "Arratia" },
  "eibar-b": { name: "SD Eibar B", shortName: "Eibar B" },
  "osasuna-b": { name: "CA Osasuna B", shortName: "Osasuna B" },
  "racing-santander-femenino": {
    name: "Racing de Santander",
    shortName: "Racing",
  },
  "real-oviedo-femenino": {
    name: "Real Oviedo Femenino",
    shortName: "Oviedo",
  },
  "sporting-gijon-b": { name: "Real Sporting B", shortName: "Sporting B" },
};

function resolveTeamNames(teamId: string, fallbackName?: string) {
  const galician = getGalicianClub(teamId);
  if (galician) {
    return { name: galician.name, shortName: galician.shortName };
  }
  const known = WOMEN_TEAM_NAMES[teamId];
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
    const calendarResults = await Promise.allSettled(
      WOMEN_COMPETITIONS.map(async (comp) => {
        const cal = await getOfficialCalendar(comp, season);
        return { comp, cal };
      }),
    );

    const compDataList: Array<{
      comp: CompetitionCode;
      meta: CompetitionMetadata | undefined;
      roundMatches: OfficialCalendarResponse["matches"];
      teamsMap: Map<string, string>;
    }> = [];

    const allDates = new Set<string>([nowIso.slice(0, 10)]);

    for (const res of calendarResults) {
      if (
        res.status !== "fulfilled" ||
        !res.value.cal?.matches ||
        res.value.cal.matches.length === 0
      ) {
        continue;
      }
      const { comp, cal } = res.value;
      const round = findActiveRound(cal, nowIso);
      const roundMatches = cal.matches.filter((m) => m.round === round);
      if (roundMatches.length === 0) continue;

      for (const m of roundMatches) {
        allDates.add(toMadridDate(m.kickoff));
      }

      const meta = getCompetitionMetadata(comp);
      const teamsMap = new Map(
        (cal.teams || []).map((t) => [t.externalId, t.externalName]),
      );

      compDataList.push({
        comp,
        meta,
        roundMatches,
        teamsMap,
      });
    }

    if (compDataList.length === 0) {
      return [];
    }

    // Every row of each day, never keyed by teams alone: a Map by
    // home-away kept the last row of any competition (SPEC-070 CA-6).
    const rowsByDate = new Map<string, ExplorerRow[]>();
    await Promise.all(
      [...allDates].map(async (d) => {
        try {
          const res = await getDayMatches(d);
          if (res?.matches) rowsByDate.set(d, res.matches);
        } catch (_e) {
          // Ignore per-day errors
        }
      }),
    );

    const results: PublicMatch[] = [];

    for (const { comp, meta, roundMatches, teamsMap } of compDataList) {
      const competitionName = meta?.name || meta?.officialName || comp;
      const tier = (meta?.tier ?? 1) as 1 | 2 | 3 | 4 | 5;

      for (const m of roundMatches) {
        const homeNames = resolveTeamNames(m.home, teamsMap.get(m.home));
        const awayNames = resolveTeamNames(m.away, teamsMap.get(m.away));

        // Identity of SPEC-070 without alias: the competition of the row is
        // its canonicalCompetitionId and each side a canonical id equal to
        // the calendar's (or the calendar's without -femenino).
        const homeIds = [m.home, m.home.replace(/-femenino$/, "")];
        const pairing = pickRow(
          rowsByDate.get(toMadridDate(m.kickoff)) ?? [],
          (row) =>
            homeIds.some((homeTeamId) =>
              isSameMatch(
                { competitionId: comp, homeTeamId, awayTeamId: m.away },
                row,
                null,
              ),
            ),
          m.kickoff,
        );
        if (pairing.kind === "ambiguous") {
          console.warn(
            `[explorer-xornada] ${m.externalId}: varias filas do export cumpren a identidade, sen datos do día:`,
            pairing.candidates
              .map((r) => {
                const c = candidateOf(r);
                return `${c.codActa ?? "sen acta"} ${c.home ?? "?"}–${c.away ?? "?"}`;
              })
              .join("; "),
          );
        }
        const dayMatch = pairing.kind === "paired" ? pairing.row : null;

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
        const competitionId = CompetitionId.parse(comp);

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
          tier,
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
              minute: null,
              ...baseFields,
            }),
          );
        } else if (status === "postponed") {
          results.push(
            PublicMatch.parse({
              status: "postponed",
              score: null,
              minute: null,
              ...baseFields,
            }),
          );
        } else if (status === "suspended") {
          results.push(
            PublicMatch.parse({
              status: "suspended",
              score: { home: homeScore ?? 0, away: awayScore ?? 0 },
              minute: null,
              ...baseFields,
            }),
          );
        } else {
          results.push(
            PublicMatch.parse({
              status: "scheduled",
              score: null,
              minute: null,
              ...baseFields,
            }),
          );
        }
      }
    }

    return results;
  } catch (e) {
    console.error("fetchWomenXornadaMatches failed:", e);
    return [];
  }
}
