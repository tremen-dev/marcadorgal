import type { Sql, TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import {
  DAY_MS,
  type Instant,
  MINUTE_MS,
  type Observation,
  shiftInstant,
  type Unresolved,
} from "@/model";
import { createSql } from "../db/connect.ts";
import { createIngestDb } from "./db.ts";

// CA-6: the postgres.js implementation of the port, local only.
const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");

// Inside a transaction, sql.begin has to become a savepoint: the port asks
// for begin, and everything the test writes must roll back.
const dbIn = (tx: TransactionSql) =>
  createIngestDb(
    Object.assign(tx, { begin: tx.savepoint.bind(tx) }) as unknown as Sql,
  );

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

const NOW = "2026-09-25T18:30:00.000Z" as Instant;
const at = (ms: number) => shiftInstant(NOW, ms);

async function seedMatch(tx: TransactionSql, kickoff: Instant) {
  const id = `test-${crypto.randomUUID()}`;
  await tx`insert into competitions (id, season, name, tier)
    values ('test-comp', '2026-27', 'Test', 5) on conflict do nothing`;
  await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
    on conflict do nothing`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, 'test-comp', '2026-27', 1, ${kickoff}, 'test-home', 'test-away')`;
  return id;
}

const observation = (
  matchId: string,
  rawRef: string,
  state: Partial<Observation> & Pick<Observation, "status">,
): Observation =>
  ({
    id: crypto.randomUUID(),
    matchId,
    sourceId: "test",
    observedAt: NOW,
    receivedAt: NOW,
    rawRef,
    score: null,
    minute: null,
    ...state,
  }) as Observation;

const unresolved = (externalMatchId: string | null): Unresolved => ({
  reason: "unknown_team",
  externalCompetition: "140",
  externalMatchId,
  home: { externalId: "1", externalName: "Home FC" },
  away: { externalId: "2", externalName: "Away FC" },
  status: "NS",
});

afterAll(() => sql.end());

describe("CA-6 windowMatches", () => {
  it("returns a match whose kickoff is now", () =>
    rollback(async (tx) => {
      const id = await seedMatch(tx, NOW);
      const rows = await dbIn(tx).windowMatches(NOW);
      expect(rows.map((r) => r.id)).toContain(id);
      expect(rows.find((r) => r.id === id)).toMatchObject({
        competitionId: "test-comp",
        season: "2026-27",
        kickoff: NOW,
        homeTeamId: "test-home",
        awayTeamId: "test-away",
        status: "scheduled",
      });
    }));

  it("leaves out a match whose current decision is finished", () =>
    rollback(async (tx) => {
      const id = await seedMatch(tx, NOW);
      const [{ id: oid }] = await tx`insert into observations
        (match_id, source_id, status, home_score, away_score, observed_at, raw_ref)
        values (${id}, 'test', 'finished', 1, 0, ${NOW}, 'raw/x') returning id`;
      await tx`insert into decisions
        (match_id, status, home_score, away_score, qualifier, rule, observation_ids, decided_at)
        values (${id}, 'finished', 1, 0, 'confirmado', 'operator', ${[oid]}, ${NOW})`;
      const rows = await dbIn(tx).windowMatches(NOW);
      expect(rows.map((r) => r.id)).not.toContain(id);
    }));

  it("leaves out a match that kicks off in eleven minutes", () =>
    rollback(async (tx) => {
      const id = await seedMatch(tx, at(11 * MINUTE_MS));
      const rows = await dbIn(tx).windowMatches(NOW);
      expect(rows.map((r) => r.id)).not.toContain(id);
    }));

  it("never lets a Date out of the layer", () =>
    rollback(async (tx) => {
      await seedMatch(tx, NOW);
      const rows = await dbIn(tx).windowMatches(NOW);
      for (const row of rows) expect(typeof row.kickoff).toBe("string");
    }));
});

describe("CA-6 openAttempt", () => {
  it("opens, skips inside the cadence and opens again after it", () =>
    rollback(async (tx) => {
      const db = dbIn(tx);
      const source = `test-${crypto.randomUUID()}`;
      const first = await db.openAttempt(source, NOW, 30);
      expect(first).toMatchObject({ id: expect.any(String) });

      const second = await db.openAttempt(source, at(20_000), 30);
      expect(second).toEqual({ skipped: "cadence", lastStartedAt: NOW });

      const third = await db.openAttempt(source, at(26_000), 30);
      expect(third).toMatchObject({ id: expect.any(String) });
    }));

  it("records started_at as the given now, never the server clock", () =>
    rollback(async (tx) => {
      const source = `test-${crypto.randomUUID()}`;
      const opened = await dbIn(tx).openAttempt(source, NOW, 30);
      const id = (opened as { id: string }).id;
      const [row] =
        await tx`select started_at from ingest_attempts where id = ${id}`;
      expect(row.started_at.toISOString()).toBe(NOW);
    }));
});

describe("CA-6 openAttempt under concurrency", () => {
  const source = `test-${crypto.randomUUID()}`;
  afterAll(() => sql`delete from ingest_attempts where source_id = ${source}`);

  it("opens exactly one attempt when two ticks race", async () => {
    const db = createIngestDb(sql);
    const results = await Promise.all([
      db.openAttempt(source, NOW, 30),
      db.openAttempt(source, NOW, 30),
    ]);
    const opened = results.filter((r) => "id" in r);
    const skipped = results.filter((r) => "skipped" in r);
    expect(opened).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    const [{ count }] =
      await sql`select count(*)::int as count from ingest_attempts where source_id = ${source}`;
    expect(count).toBe(1);
  });
});

describe("CA-6 closeAttempt", () => {
  it("writes the counters, the raw_ref and the error", () =>
    rollback(async (tx) => {
      const db = dbIn(tx);
      const source = `test-${crypto.randomUUID()}`;
      const opened = (await db.openAttempt(source, NOW, 30)) as { id: string };
      await db.closeAttempt(opened.id, {
        finishedAt: at(1_000),
        ok: true,
        rawRef: "raw/a/b.json.gz",
        observations: 3,
        details: { season: "2026-27", matches: 2 },
      });
      const [row] =
        await tx`select * from ingest_attempts where id = ${opened.id}`;
      expect(row).toMatchObject({
        ok: true,
        raw_ref: "raw/a/b.json.gz",
        observations: 3,
        error: null,
        details: { season: "2026-27", matches: 2 },
      });
      expect(row.finished_at.toISOString()).toBe(at(1_000));
    }));
});

describe("CA-6 insertObservations", () => {
  it("stores added_minute on live and null elsewhere", () =>
    rollback(async (tx) => {
      const db = dbIn(tx);
      const id = await seedMatch(tx, NOW);
      const live = observation(id, "raw/x", {
        status: "live",
        score: { home: 1, away: 0 },
        minute: 45,
        addedMinute: 3,
      } as Partial<Observation> & Pick<Observation, "status">);
      const finished = observation(id, "raw/x", {
        status: "finished",
        score: { home: 2, away: 0 },
        minute: null,
      } as Partial<Observation> & Pick<Observation, "status">);
      await db.transaction((t) => t.insertObservations([live, finished]));
      const rows = await tx`select id, status, added_minute, minute, home_score
        from observations where match_id = ${id} order by status`;
      expect(rows).toMatchObject([
        { status: "finished", added_minute: null, minute: null, home_score: 2 },
        { status: "live", added_minute: 3, minute: 45, home_score: 1 },
      ]);
    }));

  it("writes nothing when the list is empty", () =>
    rollback(async (tx) => {
      await expect(
        dbIn(tx).transaction((t) => t.insertObservations([])),
      ).resolves.toBeUndefined();
    }));
});

describe("CA-6 openUnresolvedAlerts", () => {
  it("opens one alert and deduplicates the second by external match id", () =>
    rollback(async (tx) => {
      const db = dbIn(tx);
      const item = unresolved(`ext-${crypto.randomUUID()}`);
      const first = await db.transaction((t) =>
        t.openUnresolvedAlerts("test", "raw/x", [item]),
      );
      const second = await db.transaction((t) =>
        t.openUnresolvedAlerts("test", "raw/x", [item]),
      );
      expect([first, second]).toEqual([1, 0]);
      const [{ count }] = await tx`select count(*)::int as count from alerts
        where kind = 'unresolved_team'
          and details->>'externalMatchId' = ${item.externalMatchId}`;
      expect(count).toBe(1);
    }));

  it("keeps the external names and the raw_ref in the details", () =>
    rollback(async (tx) => {
      const item = unresolved(`ext-${crypto.randomUUID()}`);
      await dbIn(tx).transaction((t) =>
        t.openUnresolvedAlerts("test", "raw/a.json.gz", [item]),
      );
      const [row] = await tx`select match_id, details from alerts
        where details->>'externalMatchId' = ${item.externalMatchId}`;
      expect(row.match_id).toBeNull();
      expect(row.details).toEqual({
        sourceId: "test",
        rawRef: "raw/a.json.gz",
        reason: "unknown_team",
        externalCompetition: "140",
        externalMatchId: item.externalMatchId,
        home: { externalId: "1", externalName: "Home FC" },
        away: { externalId: "2", externalName: "Away FC" },
        status: "NS",
      });
    }));

  it("never deduplicates when there is no external match id", () =>
    rollback(async (tx) => {
      const db = dbIn(tx);
      const before = await tx`select count(*)::int as count from alerts
        where kind = 'unresolved_team' and details->>'externalMatchId' is null`;
      await db.transaction((t) =>
        t.openUnresolvedAlerts("test", "raw/x", [unresolved(null)]),
      );
      await db.transaction((t) =>
        t.openUnresolvedAlerts("test", "raw/x", [unresolved(null)]),
      );
      const after = await tx`select count(*)::int as count from alerts
        where kind = 'unresolved_team' and details->>'externalMatchId' is null`;
      expect(after[0].count - before[0].count).toBe(2);
    }));
});

describe("CA-6 purges and stale keys", () => {
  it("opens and closes a purge and reads the last one", () =>
    rollback(async (tx) => {
      const db = dbIn(tx);
      const id = await db.openPurge(NOW);
      await db.closePurge(id, {
        finishedAt: at(2_000),
        ok: true,
        deleted: 12,
      });
      expect(await db.lastPurge()).toEqual({ startedAt: NOW, ok: true });
      const [row] = await tx`select * from raw_purges where id = ${id}`;
      expect(row).toMatchObject({ ok: true, deleted: 12, error: null });
    }));

  it("lists only the keys older than the retention", () =>
    rollback(async (tx) => {
      const old = `test/${crypto.randomUUID()}.json.gz`;
      const fresh = `test/${crypto.randomUUID()}.json.gz`;
      await tx`insert into storage.objects (bucket_id, name, created_at)
        values ('raw', ${old}, ${at(-31 * DAY_MS)}),
               ('raw', ${fresh}, ${at(-1 * DAY_MS)})`;
      const keys = await dbIn(tx).staleRawKeys(at(-30 * DAY_MS), 1000);
      expect(keys).toContain(old);
      expect(keys).not.toContain(fresh);
    }));

  it("honours the limit", () =>
    rollback(async (tx) => {
      const names = [1, 2, 3].map(() => `test/${crypto.randomUUID()}.json.gz`);
      for (const name of names)
        await tx`insert into storage.objects (bucket_id, name, created_at)
          values ('raw', ${name}, ${at(-40 * DAY_MS)})`;
      const keys = await dbIn(tx).staleRawKeys(at(-30 * DAY_MS), 2);
      expect(keys).toHaveLength(2);
    }));
});
