import type { Sql, TransactionSql } from "postgres";
import type {
  Details,
  Instant,
  MatchStatus,
  Observation,
  Score,
  Unresolved,
  WindowMatch,
} from "../model/index.ts";
import { shiftInstant } from "../model/index.ts";
import { CADENCE_JITTER_SECONDS } from "./constants.ts";
import {
  isInRecovery,
  isInWindow,
  recoveryKickoffRange,
  type WindowInput,
  windowKickoffRange,
} from "./window.ts";

// The port of ADR-008 §5. The tick knows only this interface, so CI proves it
// with doubles and npm run test:db proves the postgres.js implementation.

// forcedFinish: the mark of the current Decision (SPEC-014 CA-8).
// lastObservationAt: received_at of the newest observation of the match, from
// any source, or null; it paces the extension of the window (SPEC-018 CA-2).
export type WindowRow = WindowMatch & {
  status: MatchStatus;
  forcedFinish: boolean | null;
  lastObservationAt: Instant | null;
};

// Moved to the model (SPEC-007 CA-2) and re-exported here: every importer of
// the port keeps working.
export type { Details, Json } from "../model/index.ts";

export type OpenedAttempt =
  | { id: string }
  | { skipped: "cadence"; lastStartedAt: Instant }
  | { skipped: "locked" };

export type AttemptClose = {
  finishedAt: Instant;
  ok: boolean;
  error?: string;
  rawRef?: string;
  observations: number;
  details: Details;
};

export type PurgeClose = {
  finishedAt: Instant;
  ok: boolean;
  deleted: number;
  error?: string;
};

// The newest observation of a source for a match (SPEC-044 CA-5, ADR-025
// §5): what planRecovery compares a recovered observation with.
export type LastOwnObservation = {
  matchId: string;
  observedAt: Instant;
  status: MatchStatus;
  score: Score | null;
};

export interface IngestTx {
  insertObservations(observations: Observation[]): Promise<void>;
  openUnresolvedAlerts(
    sourceId: string,
    rawRef: string,
    items: Unresolved[],
  ): Promise<number>;
  // One row per match at most, the newest by observed_at of that source,
  // read inside the transaction that is about to insert (ADR-025 §5).
  lastOwnObservations(
    sourceId: string,
    matchIds: readonly string[],
  ): Promise<LastOwnObservation[]>;
  sql: TransactionSql;
}

export interface IngestDb {
  windowMatches(now: Instant): Promise<WindowRow[]>;
  // The recovery set of ADR-025 §2 at now for a horizon in hours: the board
  // narrowed by recoveryKickoffRange and filtered with isInRecovery
  // (SPEC-044 CA-5).
  recoveryMatches(now: Instant, horizonHours: number): Promise<WindowRow[]>;
  // When this source last opened an attempt that carried
  // details.recuperacion, at or after since; null if none (ADR-025 §5).
  lastRecoveryAttemptAt(
    sourceId: string,
    since: Instant,
  ): Promise<Instant | null>;
  openAttempt(
    sourceId: string,
    now: Instant,
    minIntervalSeconds: number,
  ): Promise<OpenedAttempt>;
  closeAttempt(id: string, result: AttemptClose): Promise<void>;
  transaction<T>(fn: (tx: IngestTx) => Promise<T>): Promise<T>;
  lastPurge(): Promise<{ startedAt: Instant; ok: boolean } | null>;
  openPurge(now: Instant): Promise<string>;
  closePurge(id: string, result: PurgeClose): Promise<void>;
  staleRawKeys(before: Instant, limit: number): Promise<string[]>;
}

// Every instant becomes an Instant here: no Date leaves this layer (D-9).
const instant = (value: Date): Instant => value.toISOString();

// One row of observations; added_minute only in live (SPEC-005 N-8), and
// half_time only true in live (SPEC-021: absent is false).
const observationRow = (o: Observation) => ({
  id: o.id,
  match_id: o.matchId,
  source_id: o.sourceId,
  status: o.status,
  home_score: o.score === null ? null : o.score.home,
  away_score: o.score === null ? null : o.score.away,
  minute: o.minute,
  added_minute: o.status === "live" ? o.addedMinute : null,
  half_time: o.status === "live" && o.halfTime === true,
  observed_at: o.observedAt,
  received_at: o.receivedAt,
  raw_ref: o.rawRef,
});

const alertDetails = (
  sourceId: string,
  rawRef: string,
  item: Unresolved,
): Details => ({
  sourceId,
  rawRef,
  reason: item.reason,
  externalCompetition: item.externalCompetition,
  externalMatchId: item.externalMatchId,
  home: item.home,
  away: item.away,
  status: item.status,
});

function ingestTx(tx: TransactionSql): IngestTx {
  return {
    sql: tx,

    async lastOwnObservations(sourceId, matchIds) {
      if (matchIds.length === 0) return [];
      const rows = await tx<
        {
          match_id: string;
          observed_at: Date;
          status: MatchStatus;
          home_score: number | null;
          away_score: number | null;
        }[]
      >`select distinct on (match_id) match_id, observed_at, status,
          home_score, away_score
        from observations
        where source_id = ${sourceId}
          and match_id = any(${tx.array([...matchIds])})
        order by match_id, observed_at desc, id desc`;
      return rows.map((r) => ({
        matchId: r.match_id,
        observedAt: instant(r.observed_at),
        status: r.status,
        score:
          r.home_score === null || r.away_score === null
            ? null
            : { home: r.home_score, away: r.away_score },
      }));
    },

    async insertObservations(observations) {
      if (observations.length === 0) return;
      const rows = observations.map(observationRow);
      await tx`insert into observations ${tx(rows)}`;
    },

    // RN-10: one open alert per (source, external match) while nobody resolves
    // it, so a team without alias does not alert every 30 s (N-8). With no
    // external match id there is no key, so it is never deduplicated.
    async openUnresolvedAlerts(sourceId, rawRef, items) {
      let opened = 0;
      for (const item of items) {
        const details = alertDetails(sourceId, rawRef, item);
        const external = item.externalMatchId;
        const inserted =
          external === null
            ? await tx`insert into alerts (kind, match_id, details)
                values ('unresolved_team', null, ${tx.json(details)})
                returning id`
            : await tx`insert into alerts (kind, match_id, details)
                select 'unresolved_team', null, ${tx.json(details)}
                where not exists (
                  select 1 from alerts a
                  where a.kind = 'unresolved_team'
                    and a.resolved_at is null
                    and a.details->>'sourceId' = ${sourceId}
                    and a.details->>'externalMatchId' = ${external}
                )
                returning id`;
        opened += inserted.length;
      }
      return opened;
    },
  };
}

type BoardRow = {
  match_id: string;
  competition_id: string;
  season: string;
  kickoff: Date;
  home_team_id: string;
  away_team_id: string;
  status: MatchStatus;
  forced_finish: boolean | null;
  decided_at: Date | null;
  last_observation_at: Date | null;
};

const windowInput = (r: BoardRow): WindowInput => ({
  kickoff: instant(r.kickoff),
  status: r.status,
  forcedFinish: r.forced_finish,
  decidedAt: r.decided_at === null ? null : instant(r.decided_at),
});

// decided_at only feeds isInWindow and isInRecovery (SPEC-018 CA-2): the
// row the tick gets keeps its shape.
const windowRow = (r: BoardRow): WindowRow =>
  ({
    id: r.match_id,
    competitionId: r.competition_id,
    season: r.season,
    kickoff: instant(r.kickoff),
    homeTeamId: r.home_team_id,
    awayTeamId: r.away_team_id,
    status: r.status,
    forcedFinish: r.forced_finish,
    lastObservationAt:
      r.last_observation_at === null ? null : instant(r.last_observation_at),
  }) as WindowRow;

// The board is the current state (ADR-008 §2), narrowed by kickoff: the
// pure functions of window.ts decide afterwards.
const boardBetween = (sql: Sql, from: Instant, to: Instant) =>
  sql<BoardRow[]>`select b.match_id, b.competition_id, b.season, b.kickoff,
      b.home_team_id, b.away_team_id, b.status, d.forced_finish, d.decided_at,
      (select max(o.received_at) from observations o
        where o.match_id = b.match_id) as last_observation_at
    from board b left join decisions d on d.id = b.decision_id
    where b.kickoff >= ${from} and b.kickoff <= ${to}
    order by b.kickoff, b.match_id`;

export function createIngestDb(sql: Sql): IngestDb {
  return {
    // The query narrows by kickoff and isInWindow decides, so both halves
    // of the window live in one pure function.
    async windowMatches(now) {
      const { from, to } = windowKickoffRange(now);
      const rows = await boardBetween(sql, from, to);
      return rows.filter((r) => isInWindow(windowInput(r), now)).map(windowRow);
    },

    // The same board, the half of ADR-025 §2: back to now minus the horizon
    // and filtered with isInRecovery (SPEC-044 CA-5).
    async recoveryMatches(now, horizonHours) {
      if (horizonHours <= 0) return [];
      const { from, to } = recoveryKickoffRange(now, horizonHours);
      const rows = await boardBetween(sql, from, to);
      return rows
        .filter((r) => isInRecovery(windowInput(r), now, horizonHours))
        .map(windowRow);
    },

    async lastRecoveryAttemptAt(sourceId, since) {
      const [row] = await sql<{ started_at: Date }[]>`
        select started_at from ingest_attempts
        where source_id = ${sourceId}
          and started_at >= ${since}
          and details ? 'recuperacion'
        order by started_at desc limit 1`;
      return row === undefined ? null : instant(row.started_at);
    },

    // Cadence guard and insert in one transaction behind an advisory lock
    // (ADR-008 §3): two overlapping ticks produce one call to the provider.
    // The lock is tried, never awaited (SPEC-029 CA-1, H-1 = A): whoever holds
    // it, another tick or a leaked web_reader (ADR-015 §1), the source is
    // skipped this time and the tick goes on.
    async openAttempt(sourceId, now, minIntervalSeconds) {
      const guardMs = (minIntervalSeconds - CADENCE_JITTER_SECONDS) * 1000;
      const since = shiftInstant(now, -guardMs);
      return sql.begin(async (tx) => {
        const [{ locked }] = await tx<{ locked: boolean }[]>`
          select pg_try_advisory_xact_lock(hashtext(${`ingest_attempts:${sourceId}`})) as locked`;
        if (!locked) return { skipped: "locked" as const };
        const [last] = await tx<{ started_at: Date }[]>`
          select started_at from ingest_attempts
          where source_id = ${sourceId} order by started_at desc limit 1`;
        if (last !== undefined && last.started_at.getTime() > Date.parse(since))
          return {
            skipped: "cadence" as const,
            lastStartedAt: instant(last.started_at),
          };
        const [row] = await tx<{ id: string }[]>`
          insert into ingest_attempts (source_id, started_at)
          values (${sourceId}, ${now}) returning id`;
        return { id: row.id };
      }) as Promise<OpenedAttempt>;
    },

    async closeAttempt(id, result) {
      await sql`update ingest_attempts set
          finished_at = ${result.finishedAt},
          ok = ${result.ok},
          error = ${result.error ?? null},
          raw_ref = ${result.rawRef ?? null},
          observations = ${result.observations},
          details = ${sql.json(result.details)}
        where id = ${id}`;
    },

    transaction<T>(fn: (tx: IngestTx) => Promise<T>): Promise<T> {
      return sql.begin((tx) => fn(ingestTx(tx))) as Promise<T>;
    },

    async lastPurge() {
      const [row] = await sql<{ started_at: Date; ok: boolean }[]>`
        select started_at, ok from raw_purges order by started_at desc limit 1`;
      return row === undefined
        ? null
        : { startedAt: instant(row.started_at), ok: row.ok };
    },

    async openPurge(now) {
      const [row] = await sql<{ id: string }[]>`
        insert into raw_purges (started_at) values (${now}) returning id`;
      return row.id;
    },

    async closePurge(id, result) {
      await sql`update raw_purges set
          finished_at = ${result.finishedAt},
          ok = ${result.ok},
          deleted = ${result.deleted},
          error = ${result.error ?? null}
        where id = ${id}`;
    },

    // The catalogue says what exists; the objects themselves are deleted by
    // the Storage API, never with SQL (ADR-007 §5).
    async staleRawKeys(before, limit) {
      const rows = await sql<{ name: string | null }[]>`
        select name from storage.objects
        where bucket_id = 'raw' and created_at < ${before}
        order by created_at limit ${limit}`;
      return rows
        .map((r) => r.name)
        .filter((name): name is string => name !== null);
    },
  };
}
