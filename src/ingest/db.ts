import type { Sql, TransactionSql } from "postgres";
import type {
  Instant,
  MatchStatus,
  Observation,
  Unresolved,
  WindowMatch,
} from "../model/index.ts";
import { shiftInstant } from "../model/index.ts";
import { CADENCE_JITTER_SECONDS } from "./constants.ts";
import { isInWindow, windowKickoffRange } from "./window.ts";

// The port of ADR-008 §5. The tick knows only this interface, so CI proves it
// with doubles and npm run test:db proves the postgres.js implementation.

export type WindowRow = WindowMatch & { status: MatchStatus };

// What fits in a jsonb column: details of an attempt (N-9) and of an alert.
export type Json =
  | null
  | string
  | number
  | boolean
  | readonly Json[]
  | { readonly [key: string]: Json | undefined };
export type Details = { readonly [key: string]: Json | undefined };

export type OpenedAttempt =
  | { id: string }
  | { skipped: "cadence"; lastStartedAt: Instant };

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

export interface IngestTx {
  insertObservations(observations: Observation[]): Promise<void>;
  openUnresolvedAlerts(
    sourceId: string,
    rawRef: string,
    items: Unresolved[],
  ): Promise<number>;
  sql: TransactionSql;
}

export interface IngestDb {
  windowMatches(now: Instant): Promise<WindowRow[]>;
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

// One row of observations; added_minute only in live (SPEC-005 N-8).
const observationRow = (o: Observation) => ({
  id: o.id,
  match_id: o.matchId,
  source_id: o.sourceId,
  status: o.status,
  home_score: o.score === null ? null : o.score.home,
  away_score: o.score === null ? null : o.score.away,
  minute: o.minute,
  added_minute: o.status === "live" ? o.addedMinute : null,
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

export function createIngestDb(sql: Sql): IngestDb {
  return {
    // The board is the current state (ADR-008 §2): the query narrows by
    // kickoff and isInWindow decides, so both halves of the window live in
    // one pure function.
    async windowMatches(now) {
      const { from, to } = windowKickoffRange(now);
      const rows = await sql<
        {
          match_id: string;
          competition_id: string;
          season: string;
          kickoff: Date;
          home_team_id: string;
          away_team_id: string;
          status: MatchStatus;
        }[]
      >`select match_id, competition_id, season, kickoff, home_team_id, away_team_id, status
        from board where kickoff >= ${from} and kickoff <= ${to}
        order by kickoff, match_id`;
      return rows
        .map((r) => ({
          id: r.match_id,
          competitionId: r.competition_id,
          season: r.season,
          kickoff: instant(r.kickoff),
          homeTeamId: r.home_team_id,
          awayTeamId: r.away_team_id,
          status: r.status,
        }))
        .filter((m) => isInWindow(m, now)) as WindowRow[];
    },

    // Cadence guard and insert in one transaction behind an advisory lock
    // (ADR-008 §3): two overlapping ticks produce one call to the provider.
    async openAttempt(sourceId, now, minIntervalSeconds) {
      const guardMs = (minIntervalSeconds - CADENCE_JITTER_SECONDS) * 1000;
      const since = shiftInstant(now, -guardMs);
      return sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtext(${`ingest_attempts:${sourceId}`}))`;
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
