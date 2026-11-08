import type { DayMatchesResponse } from "../lib/explorer-client.ts";
import { isMatchEqual, sanitizeGoals } from "../lib/explorer-enrichment.ts";
import type {
  CompetitionId,
  Instant,
  MatchId,
  PublicGoal,
  PublicMatch,
} from "../model/index.ts";

export const SEASON_START = "2026-08-14";
export const HISTORICO_USAGE =
  "Uso: npm run historico:sync -- [--desde <YYYY-MM-DD>] [--hasta <YYYY-MM-DD>] [--dry-run]";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type HistoricoArgs = {
  desde: string;
  hasta: string;
  dryRun: boolean;
};

export type MatchToSync = {
  matchId: string;
  competitionId: string;
  round: number;
  kickoff: string;
  homeName: string;
  homeShortName: string | null;
  awayName: string;
  awayShortName: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  version: number;
};

export type MatchSyncPlan = {
  match: MatchToSync;
  explorerMatch: DayMatchesResponse["matches"][number];
  needsDecision: boolean;
  finalScore: { home: number; away: number } | null;
  goals: PublicGoal[];
};

export type DaySyncPlan = {
  date: string;
  matches: MatchSyncPlan[];
};

export type HistoricoSyncReport = {
  desde: string;
  hasta: string;
  dryRun: boolean;
  datesProcessed: number;
  matchesScanned: number;
  matchesConsolidated: number;
  goalsRecorded: number;
  detailsByCompetition: Record<string, { matches: number; goals: number }>;
};

const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`);

export function parseHistoricoArgs(
  argv: readonly string[],
  nowDate?: string,
): HistoricoArgs {
  let desde: string | undefined;
  let hasta: string | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--desde" || arg === "--hasta") {
      const val = argv[i + 1];
      if (!val || !DATE_REGEX.test(val) || Number.isNaN(dayNumber(val))) {
        throw new Error(`${arg} precisa dunha data válida YYYY-MM-DD`);
      }
      if (arg === "--desde") desde = val;
      else hasta = val;
      i += 1;
    } else {
      throw new Error(`argumento descoñecido: ${arg}`);
    }
  }

  const effectiveDesde = desde ?? SEASON_START;
  const effectiveHasta =
    hasta ??
    (nowDate ? nowDate.slice(0, 10) : new Date().toISOString().slice(0, 10));

  if (dayNumber(effectiveDesde) > dayNumber(effectiveHasta)) {
    throw new Error("--desde non pode ser posterior a --hasta");
  }

  return {
    desde: effectiveDesde,
    hasta: effectiveHasta,
    dryRun,
  };
}

export function generateDateRange(desde: string, hasta: string): string[] {
  const dates: string[] = [];
  for (let t = dayNumber(desde); t <= dayNumber(hasta); t += DAY_MS) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

export function toPublicMatchMock(m: MatchToSync): PublicMatch {
  return {
    matchId: m.matchId as MatchId,
    competitionId: m.competitionId as CompetitionId,
    competitionName: m.competitionId,
    tier: 1,
    round: m.round,
    kickoff: m.kickoff as Instant,
    home: { name: m.homeName, shortName: m.homeShortName },
    away: { name: m.awayName, shortName: m.awayShortName },
    status: "scheduled",
    score: null,
    minute: null,
    qualifier: "confirmado",
    version: 0,
    observedAt: null,
    decidedAt: null,
    homeScoredAt: null,
    awayScoredAt: null,
  };
}

export function planDaySync(
  date: string,
  localMatches: readonly MatchToSync[],
  explorerMatches: DayMatchesResponse["matches"],
): DaySyncPlan {
  const plans: MatchSyncPlan[] = [];

  for (const lm of localMatches) {
    const pm = toPublicMatchMock(lm);
    const em = explorerMatches.find((candidate) => isMatchEqual(pm, candidate));
    if (!em) continue;

    const emHomeScore = em.homeScore ?? em.golesLocal ?? null;
    const emAwayScore = em.awayScore ?? em.golesVisitante ?? null;
    const isFinished =
      em.estado === "FINISHED" && emHomeScore !== null && emAwayScore !== null;

    const needsDecision =
      isFinished &&
      (lm.status !== "finished" ||
        lm.homeScore !== emHomeScore ||
        lm.awayScore !== emAwayScore);

    const goals = sanitizeGoals(em.goals ?? []);
    const finalScore =
      isFinished && emHomeScore !== null && emAwayScore !== null
        ? { home: emHomeScore, away: emAwayScore }
        : null;

    plans.push({
      match: lm,
      explorerMatch: em,
      needsDecision,
      finalScore,
      goals,
    });
  }

  return {
    date,
    matches: plans,
  };
}
