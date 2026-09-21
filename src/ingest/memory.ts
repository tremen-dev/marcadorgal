import type { TransactionSql } from "postgres";
import type { Instant, Observation, Unresolved } from "../model/index.ts";
import type {
  AttemptClose,
  IngestDb,
  IngestTx,
  PurgeClose,
  WindowRow,
} from "./db.ts";

export type MemoryAttempt = {
  id: string;
  sourceId: string;
  startedAt: Instant;
  close?: AttemptClose;
};

export type MemoryPurge = {
  id: string;
  startedAt: Instant;
  close?: PurgeClose;
};

export type MemoryAlert = {
  sourceId: string;
  rawRef: string;
  items: Unresolved[];
};

export type MemoryIngestDb = IngestDb & {
  matches: WindowRow[];
  attempts: MemoryAttempt[];
  cadence: Map<string, Instant>;
  observations: Observation[];
  alerts: MemoryAlert[];
  purges: MemoryPurge[];
  last: { startedAt: Instant; ok: boolean } | null;
  stale: string[];
  log: string[];
};

// The in-memory IngestDb of ADR-008 §5: CI proves the tick with it, and
// npm run test:db proves the postgres.js one. The log records begin/commit so
// a test can see that afterInsert runs inside the transaction (N-11).
export function createMemoryIngestDb(log: string[] = []): MemoryIngestDb {
  const db: MemoryIngestDb = {
    matches: [],
    attempts: [],
    cadence: new Map(),
    observations: [],
    alerts: [],
    purges: [],
    last: null,
    stale: [],
    log,

    async windowMatches() {
      log.push("windowMatches");
      return db.matches;
    },

    async openAttempt(sourceId, now) {
      log.push(`openAttempt:${sourceId}`);
      const lastStartedAt = db.cadence.get(sourceId);
      if (lastStartedAt !== undefined)
        return { skipped: "cadence" as const, lastStartedAt };
      const attempt = { id: crypto.randomUUID(), sourceId, startedAt: now };
      db.attempts.push(attempt);
      return { id: attempt.id };
    },

    async closeAttempt(id, result) {
      log.push(`closeAttempt:${result.ok}`);
      const attempt = db.attempts.find((a) => a.id === id);
      if (attempt !== undefined) attempt.close = result;
    },

    async transaction(fn) {
      log.push("begin");
      const tx: IngestTx = {
        // A double has no connection: the spec that uses tx.sql (the engine)
        // is proved against the real database.
        sql: undefined as unknown as TransactionSql,
        async insertObservations(observations) {
          log.push(`insertObservations:${observations.length}`);
          db.observations.push(...observations);
        },
        async openUnresolvedAlerts(sourceId, rawRef, items) {
          log.push(`openUnresolvedAlerts:${items.length}`);
          if (items.length > 0) db.alerts.push({ sourceId, rawRef, items });
          return items.length;
        },
      };
      try {
        const result = await fn(tx);
        log.push("commit");
        return result;
      } catch (e) {
        log.push("rollback");
        throw e;
      }
    },

    async lastPurge() {
      return db.last;
    },

    async openPurge(now) {
      const purge = { id: crypto.randomUUID(), startedAt: now };
      db.purges.push(purge);
      return purge.id;
    },

    async closePurge(id, result) {
      const purge = db.purges.find((p) => p.id === id);
      if (purge !== undefined) purge.close = result;
    },

    async staleRawKeys(_before, limit) {
      return db.stale.slice(0, limit);
    },
  };
  return db;
}
