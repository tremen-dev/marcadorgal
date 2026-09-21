import type { TransactionSql } from "postgres";
import type {
  AlertDraft,
  DecisionDraft,
  EngineMatch,
} from "../decide/index.ts";
import { decide, SILENCE_MINUTES } from "../decide/index.ts";
import {
  type AlertKind,
  type CompetitionId,
  type Decision,
  type DecisionId,
  type DecisionRule,
  type Instant,
  type MatchId,
  type MatchState,
  type MatchStatus,
  MINUTE_MS,
  type Observation,
  type ObservationId,
  OPERATOR_PRIORITY,
  type Qualifier,
  type SourceConfig,
  type SourceId,
  shiftInstant,
} from "../model/index.ts";
import type { IngestDb, IngestTx, WindowRow } from "./db.ts";
import type { AfterInsert } from "./tick.ts";

// The adapter of the engine (N-2): src/decide/ does not know a database
// exists, so every statement of the motor lives here, and so does every
// conversion of a timestamptz into an Instant. No Date leaves this file.

export type EngineCounts = {
  matches: number;
  decisions: number;
  alerts: number;
  resolved: number;
};

const empty = (): EngineCounts => ({
  matches: 0,
  decisions: 0,
  alerts: 0,
  resolved: 0,
});

type StateRow = {
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  minute: number | null;
  added_minute: number | null;
};

type MatchRow = { id: string; competition_id: string; kickoff: Date };

type DecisionRow = StateRow & {
  id: string;
  match_id: string;
  version: number;
  qualifier: Qualifier;
  rule: DecisionRule;
  observation_ids: string[];
  decided_at: Date;
};

type LastHeardRow = {
  match_id: string;
  observed_at: Date;
  status: MatchStatus;
};

type ObservationRow = StateRow & {
  id: string;
  match_id: string;
  source_id: string;
  observed_at: Date;
  received_at: Date;
  raw_ref: string;
};

const instant = (value: Date): Instant => value.toISOString();

// The five states out of a row, with the same shape the model demands.
function stateOf(row: StateRow): MatchState {
  if (row.status === "live")
    return {
      status: "live",
      score: { home: row.home_score ?? 0, away: row.away_score ?? 0 },
      minute: row.minute,
      addedMinute: row.added_minute,
    };
  if (row.status === "finished" || row.status === "suspended")
    return {
      status: row.status,
      score: { home: row.home_score ?? 0, away: row.away_score ?? 0 },
      minute: null,
    };
  return { status: row.status, score: null, minute: null };
}

const toDecision = (row: DecisionRow): Decision =>
  ({
    ...stateOf(row),
    id: row.id as DecisionId,
    matchId: row.match_id as MatchId,
    version: row.version,
    qualifier: row.qualifier,
    rule: row.rule,
    observationIds: row.observation_ids as ObservationId[],
    decidedAt: instant(row.decided_at),
  }) as Decision;

const toObservation = (row: ObservationRow): Observation =>
  ({
    ...stateOf(row),
    id: row.id as ObservationId,
    matchId: row.match_id as MatchId,
    sourceId: row.source_id as SourceId,
    observedAt: instant(row.observed_at),
    receivedAt: instant(row.received_at),
    rawRef: row.raw_ref,
  }) as Observation;

// The registry read per competition (RN-01). The operator is not registered
// until EPIC-004 and always outranks everyone (N-4).
export function priorityLookup(
  sources: readonly SourceConfig[],
  competitionId: string,
): (sourceId: string) => number | undefined {
  const table = new Map<string, number>();
  for (const source of sources) {
    const priority = source.priority[competitionId as CompetitionId];
    if (priority !== undefined) table.set(source.id, priority);
  }
  return (sourceId) =>
    sourceId === "operator" ? OPERATOR_PRIORITY : table.get(sourceId);
}

const scoreOf = (draft: DecisionDraft) => ({
  home: draft.score === null ? null : draft.score.home,
  away: draft.score === null ? null : draft.score.away,
});

// version and id are never written: the trigger and the default put them
// (ADR-006 §3), which is what keeps the engine replayable.
async function insertDecision(
  sql: TransactionSql,
  draft: DecisionDraft,
): Promise<void> {
  const { home, away } = scoreOf(draft);
  await sql`insert into decisions
      (match_id, status, home_score, away_score, minute, added_minute,
       qualifier, rule, observation_ids, decided_at)
    values (${draft.matchId}, ${draft.status}, ${home}, ${away},
      ${draft.minute}, ${draft.status === "live" ? draft.addedMinute : null},
      ${draft.qualifier}, ${draft.rule},
      ${sql.array(draft.observationIds as unknown as string[])}::uuid[],
      ${draft.decidedAt})`;
}

// One open alert per (kind, match) while nobody resolves it, the four kinds
// alike (N-3): a match that keeps retreating opens one alert, not one every
// thirty seconds. Same shape as openUnresolvedAlerts (SPEC-006 N-8).
async function openAlert(
  sql: TransactionSql,
  alert: AlertDraft,
): Promise<number> {
  const inserted = await sql<
    { id: string }[]
  >`insert into alerts (kind, match_id, details)
    select ${alert.kind}::text, ${alert.matchId}::text, ${sql.json(alert.details as never)}::jsonb
    where not exists (
      select 1 from alerts a
      where a.kind = ${alert.kind}
        and a.match_id = ${alert.matchId}
        and a.resolved_at is null
    )
    returning id`;
  return inserted.length;
}

// Only silence is ever resolved here (RN-05, N-3); resolved_at is the one
// mutable column of the ops tables (RN-07).
async function resolveAlerts(
  sql: TransactionSql,
  matchId: string,
  kinds: AlertKind[],
  now: Instant,
): Promise<number> {
  const updated = await sql<{ id: string }[]>`update alerts
    set resolved_at = ${now}
    where match_id = ${matchId}
      and kind = any(${sql.array(kinds as unknown as string[])})
      and resolved_at is null
    returning id`;
  return updated.length;
}

const group = <T>(rows: T[], key: (row: T) => string): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(key(row));
    if (list === undefined) map.set(key(row), [row]);
    else list.push(row);
  }
  return map;
};

// Runs the engine over a set of matches inside a transaction that is already
// open: the caller owns it (afterInsert) or opens it (the sweep).
export async function decideMatches(
  tx: IngestTx,
  matchIds: readonly string[],
  now: Instant,
  sources: readonly SourceConfig[],
): Promise<EngineCounts> {
  const counts = empty();
  const ids = [...new Set(matchIds)].sort();
  if (ids.length === 0) return counts;
  const sql = tx.sql;
  const any = sql.array(ids as string[]);

  const matches = await sql<MatchRow[]>`
    select id, competition_id, kickoff from matches where id = any(${any})`;
  if (matches.length === 0) return counts;

  // The current Decision of each match: the highest version (ADR-006 §3).
  const currents = await sql<DecisionRow[]>`
    select distinct on (match_id) id, match_id, version, status, home_score,
      away_score, minute, added_minute, qualifier, rule, observation_ids, decided_at
    from decisions where match_id = any(${any})
    order by match_id, version desc`;
  const currentOf = new Map(currents.map((row) => [row.match_id, row]));

  // Everything the engine may need: the five minute window of RN-01 lives
  // inside the fifteen of RN-05 (index observations_match_observed_idx).
  const since = shiftInstant(now, -SILENCE_MINUTES * MINUTE_MS);
  const observations = await sql<ObservationRow[]>`
    select id, match_id, source_id, status, home_score, away_score, minute,
      added_minute, observed_at, received_at, raw_ref
    from observations where match_id = any(${any}) and observed_at >= ${since}
    order by observed_at`;
  const observationsOf = group(observations, (row) => row.match_id);

  // The fourth query (N-9), with no window at all: one row per match, served
  // by the same index. A silent match has nothing inside the fifteen minutes
  // above, and it is precisely the silent match whose trace has to say when
  // it was last heard from.
  const lastHeardRows = await sql<LastHeardRow[]>`
    select distinct on (match_id) match_id, observed_at, status
    from observations where match_id = any(${any})
    order by match_id, observed_at desc`;
  const lastHeardOf = new Map(
    lastHeardRows.map((row) => [
      row.match_id,
      { observedAt: instant(row.observed_at), status: row.status },
    ]),
  );

  for (const row of matches) {
    counts.matches += 1;
    const match: EngineMatch = {
      id: row.id as MatchId,
      competitionId: row.competition_id as CompetitionId,
      kickoff: instant(row.kickoff),
    };
    const current = currentOf.get(row.id);
    const output = decide({
      match,
      current: current === undefined ? null : toDecision(current),
      observations: (observationsOf.get(row.id) ?? []).map(toObservation),
      priority: priorityLookup(sources, row.competition_id),
      lastHeard: lastHeardOf.get(row.id) ?? null,
      now,
    });
    if (output.decision !== null) {
      await insertDecision(sql, output.decision);
      counts.decisions += 1;
    }
    for (const alert of output.open)
      counts.alerts += await openAlert(sql, alert);
    if (output.resolve.length > 0)
      counts.resolved += await resolveAlerts(sql, row.id, output.resolve, now);
  }
  return counts;
}

// The hook of ADR-008 §6: inside the same transaction that inserted the
// observations, and only when there are any (SPEC-006 N-11).
export const createEngineHook =
  (sources: readonly SourceConfig[], now: Instant): AfterInsert =>
  async (tx, observations) => {
    await decideMatches(
      tx,
      observations.map((o) => o.matchId),
      now,
      sources,
    );
  };

// The second hook (H-2): once per tick, over every match in window, in its
// own transaction. What is born of the absence of observations (RN-05 and the
// forced finish of RN-02) has no other way in.
export const createEngineSweep =
  (db: IngestDb, sources: readonly SourceConfig[], now: Instant) =>
  (matches: WindowRow[]): Promise<EngineCounts> =>
    db.transaction((tx) =>
      decideMatches(
        tx,
        matches.map((m) => m.id),
        now,
        sources,
      ),
    );
