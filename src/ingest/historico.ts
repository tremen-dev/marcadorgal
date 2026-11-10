import type { DayMatchesResponse } from "../lib/explorer-client.ts";
import { sanitizeGoals } from "../lib/explorer-enrichment.ts";
import {
  type Candidate,
  candidateOf,
  isSameMatch,
  rowCompetitionId,
} from "../lib/explorer-identity.ts";
import {
  pickRowInWindow,
  type RowsByDay,
  rowsInWindow,
} from "../lib/explorer-window.ts";
import type {
  AliasFile,
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
  homeTeamId: string;
  awayTeamId: string;
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
  // The Madrid day of the export the row came from (SPEC-071): the day it
  // was played, not always the one declared.
  rowDate: string;
  needsDecision: boolean;
  finalScore: { home: number; away: number } | null;
  goals: PublicGoal[];
};

// Why a local match found no row (SPEC-070 CA-9): no row of the day in its
// competition, or rows of its competition but none with both of its teams.
export type UnpairedReason = "no_competition_rows" | "no_identity";

export type DaySyncPlan = {
  date: string;
  matches: MatchSyncPlan[];
  unpaired: { matchId: string; reason: UnpairedReason }[];
  ambiguous: { matchId: string; candidates: Candidate[] }[];
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
  // SPEC-070 CA-7: what paired, what did not and what was ambiguous.
  matchesPaired: number;
  matchesUnpaired: number;
  matchesAmbiguous: number;
  // SPEC-071 CA-4: paired with a row of another day than the kickoff's.
  matchesOtherDay: number;
  // fecha · matchId · codActa · local–visitante de la fila · marcador · nº goles
  pairedLines: string[];
  unpaired: { date: string; matchId: string; reason: UnpairedReason }[];
  ambiguous: { date: string; matchId: string; candidates: Candidate[] }[];
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

// The rows of the window of each local match (SPEC-071): the export by day,
// or the rows of one day, which are then the rows of `date`.
export function planDaySync(
  date: string,
  localMatches: readonly MatchToSync[],
  explorerMatches: DayMatchesResponse["matches"] | RowsByDay,
  aliases: AliasFile | null = null,
): DaySyncPlan {
  const plans: MatchSyncPlan[] = [];
  const unpaired: DaySyncPlan["unpaired"] = [];
  const ambiguous: DaySyncPlan["ambiguous"] = [];
  const rowsByDay: RowsByDay = Array.isArray(explorerMatches)
    ? new Map([[date, explorerMatches]])
    : (explorerMatches as RowsByDay);

  for (const lm of localMatches) {
    const pairing = pickRowInWindow(
      rowsByDay,
      (row) => isSameMatch(lm, row, aliases),
      lm.kickoff,
    );
    if (pairing.kind === "ambiguous") {
      ambiguous.push({
        matchId: lm.matchId,
        candidates: pairing.candidates.map((c) => candidateOf(c.row)),
      });
      continue;
    }
    if (pairing.kind === "unpaired") {
      const inCompetition = rowsInWindow(rowsByDay, lm.kickoff).some(
        ({ row }) => rowCompetitionId(row, aliases) === lm.competitionId,
      );
      unpaired.push({
        matchId: lm.matchId,
        reason: inCompetition ? "no_identity" : "no_competition_rows",
      });
      continue;
    }
    const em = pairing.row;

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
      rowDate: pairing.date,
      needsDecision,
      finalScore,
      goals,
    });
  }

  return {
    date,
    matches: plans,
    unpaired,
    ambiguous,
  };
}

// One line per paired match (SPEC-070 CA-7); the day of the row after the
// declared one when they differ (SPEC-071 CA-4).
export function pairedLine(date: string, p: MatchSyncPlan): string {
  const row = candidateOf(p.explorerMatch);
  const home = p.explorerMatch.homeScore ?? p.explorerMatch.golesLocal ?? null;
  const away =
    p.explorerMatch.awayScore ?? p.explorerMatch.golesVisitante ?? null;
  const score = home === null || away === null ? "—" : `${home}-${away}`;
  return [
    p.rowDate === date ? date : `${date} → ${p.rowDate}`,
    p.match.matchId,
    row.codActa ?? "sen acta",
    `${row.home ?? "?"}–${row.away ?? "?"}`,
    score,
    `${p.goals.length} goles`,
  ].join(" · ");
}
