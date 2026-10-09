import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { type Instant, shiftInstant } from "@/model";
import { createSql } from "../db/connect.ts";
import { rawStoreEnv } from "../raw/env.ts";
import { createStorageRawStore } from "../raw/store.ts";
import { latenciaFilas } from "./latencia-db.ts";

// SPEC-025 CA-4/CA-7: the reads of the measurement against the real schema,
// always rolled back. Read only: nothing here writes outside the test's own
// transaction, except the one Storage object of the clock check, removed.

const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");
const KICKOFF = "2027-07-18T16:00:00.000Z" as Instant;
const s = (seconds: number): Instant => shiftInstant(KICKOFF, seconds * 1000);
const DESDE = s(-600);
const HASTA = s(150 * 60);

afterAll(() => sql.end());

async function rollback(fn: (tx: TransactionSql) => Promise<void>) {
  await sql
    .begin(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    })
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });
}

describe("SPEC-025 CA-4 latenciaFilas", () => {
  it("reads matches, observations, decisions with recorded_at, attempts with opened_at and the raw objects", () =>
    rollback(async (tx) => {
      const matchId = `test-${crypto.randomUUID()}`;
      await tx`insert into competitions (id, season, name, tier)
        values ('segunda-division', '2026-27', 'Segunda División', 2) on conflict do nothing`;
      await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
        on conflict do nothing`;
      await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
        values (${matchId}, 'segunda-division', '2026-27', 1, ${KICKOFF}, 'test-home', 'test-away')`;
      const key = `api-football/2027-07-18/${crypto.randomUUID()}.json.gz`;
      const rawRef = `raw/${key}`;
      await tx`insert into storage.objects (bucket_id, name) values ('raw', ${key})`;
      await tx`insert into ingest_attempts (source_id, started_at, raw_ref, details)
        values ('test-spec025', ${s(60)}, ${rawRef}, ${tx.json({ requests: 2 })})`;
      const [o] = await tx<{ id: string }[]>`
        insert into observations (match_id, source_id, status, home_score, away_score,
          minute, observed_at, received_at, raw_ref)
        values (${matchId}, 'api-football', 'live', 1, 0, 20, ${s(60)}, ${s(60)}, ${rawRef})
        returning id`;
      await tx`insert into decisions (match_id, status, home_score, away_score, minute,
          qualifier, rule, observation_ids, decided_at)
        values (${matchId}, 'live', 1, 0, 20, 'confirmado', 'RN-01',
          ${tx.array([o.id])}::uuid[], ${s(60)})`;

      const filas = await latenciaFilas(tx, DESDE, HASTA);

      expect(filas.matches).toContainEqual({
        id: matchId,
        competitionId: "segunda-division",
        season: "2026-27",
      });
      expect(filas.observations).toEqual([
        {
          id: o.id,
          matchId,
          observedAt: s(60),
          total: 1,
          rawRef,
          status: "live",
        },
      ]);
      const [d] = filas.decisions.filter((x) => x.matchId === matchId);
      expect(d).toMatchObject({
        matchId,
        version: 1,
        total: 1,
        decidedAt: s(60),
        observationIds: [o.id],
      });
      expect(d.recordedAt).toMatch(/Z$/);
      const attempt = filas.attempts.find((a) => a.rawRef === rawRef);
      expect(attempt?.startedAt).toBe(s(60));
      expect(attempt?.openedAt).toMatch(/Z$/);
      expect(filas.rawObjects).toEqual([
        { rawRef, createdAt: expect.stringMatching(/Z$/) },
      ]);
      expect(filas.peticionesPorDia).toContainEqual({
        dia: "2027-07-18",
        total: 2,
      });
    }));

  it("an empty window is empty, never an error", () =>
    rollback(async (tx) => {
      const filas = await latenciaFilas(
        tx,
        "2027-07-25T00:00:00.000Z",
        "2027-07-25T01:00:00.000Z",
      );
      expect(filas.matches).toEqual([]);
      expect(filas.observations).toEqual([]);
      expect(filas.rawObjects).toEqual([]);
    }));
});

// The supposition of ADR-016 §3, checked locally: storage.objects.created_at
// is the database's clock. The Storage API inserts the row without
// created_at (storage-api v1.72.1, pg.js upsertObject), so the column's
// default now() seals it: the clock of Postgres, at the start of the Storage
// API's own transaction.
describe("SPEC-025 CA-1 storage.objects.created_at is Postgres's clock", () => {
  it("lies between two clock_timestamp() of the base taken around the upload", async () => {
    const store = createStorageRawStore({ ...rawStoreEnv(process.env), fetch });
    const key = `test-spec025/${crypto.randomUUID()}.json.gz`;
    const [{ before }] = await sql<
      { before: Date }[]
    >`select clock_timestamp() as before`;
    await store.put(key, new Uint8Array([1, 2, 3]), "application/gzip");
    try {
      const [{ after }] = await sql<
        { after: Date }[]
      >`select clock_timestamp() as after`;
      const [{ created_at }] = await sql<{ created_at: Date }[]>`
        select created_at from storage.objects where bucket_id = 'raw' and name = ${key}`;
      expect(created_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(created_at.getTime()).toBeLessThanOrEqual(after.getTime());
      const [{ column_default }] = await sql<{ column_default: string }[]>`
        select column_default from information_schema.columns
        where table_schema = 'storage' and table_name = 'objects'
          and column_name = 'created_at'`;
      expect(column_default).toBe("now()");
    } finally {
      await store.remove([key]);
    }
  });
});
