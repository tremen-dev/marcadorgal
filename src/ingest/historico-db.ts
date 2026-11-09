import type { Sql, TransactionSql } from "postgres";
import type {
  DayMatchesResponse,
  ExplorerRawResponse,
} from "../lib/explorer-client.ts";
import { type RowsByDay, windowDaysOf } from "../lib/explorer-window.ts";
import {
  type AliasFile,
  type Instant,
  type MatchStatus,
  Observation,
  type PublicGoal,
  RawCapture,
  type SourceConfig,
} from "../model/index.ts";
import { storeCapture } from "../raw/capture.ts";
import type { RawStore } from "../raw/store.ts";
import type { IngestDb, IngestTx } from "./db.ts";
import { decideRecovered } from "./engine.ts";
import {
  HISTORICO_TOOL,
  type HistoricoArgs,
  type HistoricoReport,
  isAuthFailure,
  type MatchPlan,
  type MatchToSync,
  parseExplorerDay,
  planDaySync,
} from "./historico.ts";
import { errorMessage } from "./purge.ts";

// SPEC-060 (ADR-031), the database half of npm run historico:sync. Per
// Europe/Madrid date with declared matches: one ingest_attempt of the
// operator, one GET to Explorer whose raw is stored before it is parsed
// (ADR-031 §4, RN-09) and, in one transaction, the operator observations
// of the finals that disagree, the engine at the instant of the reading
// (decideRecovered, ADR-025 §4) and the goals of the complete matches.
// Nothing here writes a Decision: the engine does (D-5, ADR-031 §2).

export const OPERATOR_SOURCE = "operator";

type MatchDbRow = {
  match_id: string;
  competition_id: string;
  round: number;
  kickoff: Date;
  home_team_id: string;
  away_team_id: string;
  home_name: string;
  home_short_name: string | null;
  away_name: string;
  away_short_name: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  goals: {
    team: "home" | "away";
    player: string;
    minute: number;
    penalty: boolean | null;
    own_goal: boolean | null;
  }[];
};

// The Europe/Madrid dates of [desde, hasta] with at least one declared match.
export async function declaredDates(
  sql: Sql | TransactionSql,
  desde: string,
  hasta: string,
): Promise<string[]> {
  const rows = await sql<{ day: string }[]>`
    select distinct to_char(kickoff at time zone 'Europe/Madrid', 'YYYY-MM-DD') as day
    from matches
    where (kickoff at time zone 'Europe/Madrid')::date between ${desde}::date and ${hasta}::date
    order by day`;
  return rows.map((r) => r.day);
}

const toGoal = (g: MatchDbRow["goals"][number]): PublicGoal => ({
  team: g.team,
  player: g.player,
  minute: g.minute,
  ...(g.penalty === true ? { penalty: true } : {}),
  ...(g.own_goal === true ? { ownGoal: true } : {}),
});

// The declared matches of one date with their current Decision (none reads
// as scheduled) and the goals already stored.
export async function matchesOfDate(
  sql: Sql | TransactionSql,
  date: string,
): Promise<MatchToSync[]> {
  const rows = await sql<MatchDbRow[]>`
    select m.id as match_id, m.competition_id, m.round, m.kickoff,
      m.home_team_id, m.away_team_id,
      h.name as home_name, h.short_name as home_short_name,
      a.name as away_name, a.short_name as away_short_name,
      coalesce(d.status, 'scheduled') as status, d.home_score, d.away_score,
      coalesce((select json_agg(json_build_object('team', g.team,
          'player', g.player, 'minute', g.minute, 'penalty', g.penalty,
          'own_goal', g.own_goal) order by g.minute)
        from match_goals g where g.match_id = m.id), '[]'::json) as goals
    from matches m
    join teams h on h.id = m.home_team_id
    join teams a on a.id = m.away_team_id
    left join lateral (
      select d.status, d.home_score, d.away_score from decisions d
      where d.match_id = m.id order by d.version desc limit 1
    ) d on true
    where (m.kickoff at time zone 'Europe/Madrid')::date = ${date}::date
    order by m.kickoff, m.id`;
  return rows.map((r) => ({
    matchId: r.match_id,
    competitionId: r.competition_id,
    round: r.round,
    kickoff: r.kickoff.toISOString(),
    homeTeamId: r.home_team_id,
    awayTeamId: r.away_team_id,
    homeName: r.home_name,
    homeShortName: r.home_short_name,
    awayName: r.away_name,
    awayShortName: r.away_short_name,
    status: r.status,
    score:
      r.home_score === null || r.away_score === null
        ? null
        : { home: r.home_score, away: r.away_score },
    goals: r.goals.map(toGoal),
  }));
}

// The export of the seven Madrid days of the window of a date (SPEC-071),
// raw: each day asked once per run, since the windows of neighbouring dates
// overlap (SPEC-071 CA-4).
type Window = { day: string; raw: ExplorerRawResponse }[];

// CA-5: a 401/403 on any day of the window stops the run; any other non-2xx
// or a body that is not an export fails the date. An empty export of the
// date itself, with declared matches and none of them paired anywhere in
// the window, is a failed date too, not "nothing to do": Explorer said
// nothing. An empty own day whose matches paired on a neighbour is not
// (SPEC-071: they were played another day).
// A 401/403 of Explorer: the token is wrong, the rest of the run would fail
// the same way.
class AuthAbort extends Error {}

function assertNoAuthFailure(window: Window) {
  for (const { day, raw } of window)
    if (isAuthFailure(raw.status))
      throw new AuthAbort(`[explorer] respuesta ${raw.status} (${day})`);
}

function planDate(
  date: string,
  locals: readonly MatchToSync[],
  window: Window,
  aliases: AliasFile | null,
): MatchPlan[] {
  const rowsByDay = new Map<string, DayMatchesResponse["matches"]>();
  for (const { day, raw } of window)
    rowsByDay.set(day, parseExplorerDay(raw).matches);
  const plans = planDaySync(date, locals, rowsByDay as RowsByDay, aliases);
  const ownDayEmpty = (rowsByDay.get(date) ?? []).length === 0;
  const nonePaired = plans.every(
    (p) => p.kind === "unpaired" || p.kind === "ambiguous",
  );
  if (ownDayEmpty && nonePaired && locals.length > 0)
    throw new Error(
      `[explorer] 0 partidos para ${date} con ${locals.length} declarados`,
    );
  return plans;
}

type Corrected = Extract<MatchPlan, { kind: "finished" }>;
const corrected = (plans: readonly MatchPlan[]): Corrected[] =>
  plans.filter((p): p is Corrected => p.kind === "finished" && p.correct);
const withGoals = (plans: readonly MatchPlan[]): Corrected[] =>
  plans.filter((p): p is Corrected => p.kind === "finished" && p.replaceGoals);

// The writes of one date, inside its transaction: the observations of the
// operator at the instant of the reading, the engine at that instant, and
// the goals. Every write or none (CA-5).
async function applyDate(
  tx: IngestTx,
  plans: readonly MatchPlan[],
  now: Instant,
  rawRef: string,
  sources: readonly SourceConfig[],
): Promise<{ observations: number; decisions: number; goals: number }> {
  const observations = corrected(plans).map((p) =>
    Observation.parse({
      id: crypto.randomUUID(),
      matchId: p.match.matchId,
      sourceId: OPERATOR_SOURCE,
      status: "finished",
      score: p.score,
      minute: null,
      observedAt: now,
      receivedAt: now,
      rawRef,
    }),
  );
  await tx.insertObservations(observations);
  const decided = await decideRecovered(tx, observations, sources);
  // ADR-031 §2: the operator always wins, so every observation must have
  // been published. If not, the date is undone rather than half applied.
  if (decided.decisions !== observations.length)
    throw new Error(
      `el motor publicó ${decided.decisions} de ${observations.length} correcciones`,
    );

  let goals = 0;
  for (const p of withGoals(plans)) {
    await tx.sql`delete from match_goals where match_id = ${p.match.matchId}`;
    for (const g of p.goals) {
      await tx.sql`insert into match_goals
          (match_id, team, player, minute, penalty, own_goal)
        values (${p.match.matchId}, ${g.team}, ${g.player}, ${g.minute},
          ${g.penalty === true}, ${g.ownGoal === true})`;
      goals += 1;
    }
  }
  return {
    observations: observations.length,
    decisions: decided.decisions,
    goals,
  };
}

export type HistoricoOptions = {
  sql: Sql | TransactionSql;
  db: IngestDb;
  // Only read without --dry-run: the dry run stores nothing (CA-4).
  store: RawStore | null;
  fetchDay: (date: string) => Promise<ExplorerRawResponse>;
  // The rfef alias of the season of each date (SPEC-070): without it the
  // competition comes only from canonicalCompetitionId.
  aliasesFor?: (date: string) => AliasFile | null;
  // The clock of the tool (D-9): read once per date, it is the instant of
  // the reading, of the attempt, of the observations and of the engine.
  clock: () => Instant;
  sources: readonly SourceConfig[];
  args: HistoricoArgs;
  progress?: (line: string) => void;
};


export async function historicoSync(
  options: HistoricoOptions,
): Promise<HistoricoReport> {
  const { sql, db, store, fetchDay, clock, sources, args } = options;
  const progress = options.progress ?? (() => {});
  const aliasesFor = options.aliasesFor ?? (() => null);

  // Each day of the export once per run (SPEC-071 CA-4). A day that does not
  // come fails every date whose window holds it: a missing neighbour could
  // hide the FINISHED row of a replayed match.
  const days = new Map<string, Promise<ExplorerRawResponse>>();
  const dayOf = (day: string) => {
    let raw = days.get(day);
    if (!raw) {
      raw = fetchDay(day);
      days.set(day, raw);
    }
    return raw;
  };
  const windowOf = async (date: string): Promise<Window> => {
    const window: Window = [];
    for (const day of windowDaysOf(date)) {
      const raw = await dayOf(day);
      window.push({ day, raw });
      // A 401/403 stops the reading too: the next days would say the same.
      if (isAuthFailure(raw.status)) break;
    }
    return window;
  };
  const report: HistoricoReport = {
    desde: args.desde,
    hasta: args.hasta,
    dryRun: args.dryRun,
    datesProcessed: 0,
    entries: [],
    failed: [],
    aborted: null,
  };

  for (const date of await declaredDates(sql, args.desde, args.hasta)) {
    report.datesProcessed += 1;
    try {
      const plans = args.dryRun ? await dryDate(date) : await realDate(date);
      for (const plan of plans) report.entries.push({ date, plan });
      progress(`${date}: ${plans.length} partidos`);
    } catch (e) {
      const error = errorMessage(e);
      report.failed.push({ date, error });
      progress(`${date}: ERROR ${error}`);
      if (e instanceof AuthAbort) {
        report.aborted = `${date}: ${error}`;
        break;
      }
    }
  }
  return report;

  // --dry-run: the same GETs and the same plan, and not one row nor one raw
  // object written (CA-4).
  async function dryDate(date: string): Promise<MatchPlan[]> {
    const window = await windowOf(date);
    assertNoAuthFailure(window);
    return planDate(date, await matchesOfDate(sql, date), window, aliasesFor(date));
  }

  async function realDate(date: string): Promise<MatchPlan[]> {
    if (store === null) throw new Error("sin raw store no se escribe nada");
    const now = clock();
    const opened = await db.openAttempt(OPERATOR_SOURCE, now, 0);
    if ("skipped" in opened)
      throw new Error(`intento del operador no abierto (${opened.skipped})`);
    const attemptId = opened.id;
    let rawRef: string | undefined;
    try {
      const window = await windowOf(date);
      // Raw before parse, in the strong sense (ADR-007 §6, ADR-033 §4): the
      // seven days the plan of this date reads, in one capture of its
      // attempt, even if a neighbour date already stored some of them.
      rawRef = await storeCapture(
        store,
        RawCapture.parse({
          sourceId: OPERATOR_SOURCE,
          capturedAt: now,
          requests: window.map(({ raw }) => ({
            url: raw.url,
            status: raw.status,
            contentType: raw.contentType,
            body: raw.body,
          })),
        }),
        attemptId,
      );
      assertNoAuthFailure(window);
      const ref = rawRef;
      const { plans, written } = await db.transaction(async (tx) => {
        const locals = await matchesOfDate(tx.sql, date);
        const plans = planDate(date, locals, window, aliasesFor(date));
        const written = await applyDate(tx, plans, now, ref, sources);
        return { plans, written };
      });
      await db.closeAttempt(attemptId, {
        finishedAt: clock(),
        ok: true,
        rawRef: ref,
        observations: written.observations,
        details: {
          herramienta: HISTORICO_TOOL,
          fecha: date,
          partidos: plans.length,
          corregidos: written.decisions,
          goles: written.goals,
        },
      });
      return plans;
    } catch (e) {
      await db.closeAttempt(attemptId, {
        finishedAt: clock(),
        ok: false,
        error: errorMessage(e),
        rawRef,
        observations: 0,
        details: { herramienta: HISTORICO_TOOL, fecha: date },
      });
      throw e;
    }
  }
}
