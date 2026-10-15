import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { createSql } from "../db/connect.ts";
import { SOURCES } from "../sources/registry.ts";
import { lockMatches } from "./engine.ts";
import { replayJornada } from "./replay-jornada.ts";
import {
  aplicarCorrecciones,
  replayJornadaFilas,
  replayPriority,
} from "./replay-jornada-db.ts";

// SPEC-012 CA-4 against the real schema, always rolled back. The window is
// far from any real matchday so the shared dev rows never enter it.
const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");

const KICKOFF = "2030-01-05T18:30:00.000Z" as Instant;
const DESDE = shiftInstant(KICKOFF, -10 * MINUTE_MS);
const HASTA = shiftInstant(KICKOFF, 150 * MINUTE_MS);
const TODAY = "2030-01-09T10:00:00.000Z" as Instant;
const at = (minutes: number): Instant =>
  shiftInstant(KICKOFF, minutes * MINUTE_MS);

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

async function seedMatch(tx: TransactionSql): Promise<string> {
  const id = `test-${crypto.randomUUID()}`;
  await tx`insert into competitions (id, season, name, tier)
    values ('segunda-division', '2026-27', 'Test', 2) on conflict do nothing`;
  await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
    on conflict do nothing`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, 'segunda-division', '2026-27', 1, ${KICKOFF}, 'test-home', 'test-away')`;
  return id;
}

const observe = async (
  tx: TransactionSql,
  matchId: string,
  status: "live" | "finished",
  home: number,
  away: number,
  minutes: number,
): Promise<string> => {
  const [row] = await tx<{ id: string }[]>`
    insert into observations (match_id, source_id, status, home_score, away_score,
      minute, observed_at, received_at, raw_ref)
    values (${matchId}, 'api-football', ${status}, ${home}, ${away},
      ${status === "live" ? minutes : null}, ${at(minutes)}, ${at(minutes)},
      'raw/api-football/2030-01-05/x.json.gz')
    returning id`;
  return row.id;
};

// What the engine of the matchday left behind: a finished 2-1 held by RN-03.
const decideHeld = (tx: TransactionSql, matchId: string, obs: string) =>
  tx`insert into decisions (match_id, status, home_score, away_score, minute,
      qualifier, rule, observation_ids, decided_at)
    values (${matchId}, 'finished', 2, 1, null, 'provisional', 'RN-03',
      ${tx.array([obs])}::uuid[], ${at(113)})`;

afterAll(() => sql.end());

describe("SPEC-012 CA-4 the replay of a matchday against the database", () => {
  it("reads the window, corrects by adding one Decision, and only once", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      await observe(tx, matchId, "live", 2, 0, 40);
      await observe(tx, matchId, "live", 2, 1, 75);
      await observe(tx, matchId, "live", 2, 0, 76);
      const final = await observe(tx, matchId, "finished", 2, 0, 113);
      await decideHeld(tx, matchId, final);

      const filas = await replayJornadaFilas(tx, DESDE, HASTA);
      expect(filas.matches.map((m) => m.match.id)).toEqual([matchId]);
      expect(filas.matches[0].board).toEqual({
        status: "finished",
        score: { home: 2, away: 1 },
      });
      expect(filas.observations).toHaveLength(4);

      const rows = replayJornada({
        ...filas,
        priority: replayPriority(SOURCES),
        now: TODAY,
      });
      expect(rows[0]).toMatchObject({
        divergent: true,
        replay: { status: "finished", score: { home: 2, away: 0 } },
      });

      const before = await tx`select count(*)::int as n from decisions`;
      expect(await aplicarCorrecciones(tx, rows)).toBe(1);
      const after = await tx`select count(*)::int as n from decisions`;
      expect(after[0].n - before[0].n).toBe(1);

      const [added] = await tx`select version, status, home_score, away_score,
          minute, qualifier, rule, observation_ids, decided_at, forced_finish
        from decisions where match_id = ${matchId} order by version desc limit 1`;
      expect(added).toMatchObject({
        version: 2,
        status: "finished",
        home_score: 2,
        away_score: 0,
        minute: null,
        qualifier: "provisional",
        rule: "RN-02",
        observation_ids: [final],
        // SPEC-014 CA-8: a correction is not a close.
        forced_finish: false,
      });
      expect((added.decided_at as Date).toISOString()).toBe(TODAY);

      // The first Decision is still there, untouched (RN-07).
      const [first] = await tx`select home_score, away_score, rule
        from decisions where match_id = ${matchId} and version = 1`;
      expect(first).toEqual({ home_score: 2, away_score: 1, rule: "RN-03" });

      // A second run finds board and replay agreeing and writes nothing.
      const again = replayJornada({
        ...(await replayJornadaFilas(tx, DESDE, HASTA)),
        priority: replayPriority(SOURCES),
        now: TODAY,
      });
      expect(again[0].divergent).toBe(false);
      expect(await aplicarCorrecciones(tx, again)).toBe(0);
    }));
});

// SPEC-035 CA-8 (ADR-019 §6): the corrections of --aplicar under the lock of
// ADR-019 §1. These rows are committed, because a transaction that waits for
// another one only sees what that one commits; the afterAll removes them as
// replica, past the append-only triggers of RN-07. Each case has its own
// matchday, so neither reads the other's matches.
const sqlA = createSql(process.env);
const sqlB = createSql(process.env);
const sqlW = createSql(process.env);
const committed: string[] = [];

afterAll(async () => {
  if (committed.length > 0)
    await sqlW.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      const ids = tx.array(committed);
      await tx`delete from decisions where match_id = any(${ids})`;
      await tx`delete from alerts where match_id = any(${ids})`;
      await tx`delete from observations where match_id = any(${ids})`;
      await tx`delete from matches where id = any(${ids})`;
      await tx`delete from teams t where t.id in ('test-home', 'test-away')
        and not exists (select 1 from matches m
          where t.id in (m.home_team_id, m.away_team_id))`;
    });
  await Promise.all([sqlA.end(), sqlB.end(), sqlW.end()]);
});

// The matchday of SPEC-012 CA-4, committed, shifted by days: n matches, each
// a finished 2-1 held by RN-03 that the replay corrects to 2-0.
async function seedHeldDay(days: number, n: number) {
  const shift = (m: number) =>
    shiftInstant(KICKOFF, (days * 24 * 60 + m) * MINUTE_MS);
  const ids: string[] = [];
  await sqlW.begin(async (tx) => {
    for (let i = 0; i < n; i += 1) {
      const id = `test-${crypto.randomUUID()}`;
      await tx`insert into competitions (id, season, name, tier)
        values ('segunda-division', '2026-27', 'Test', 2) on conflict do nothing`;
      await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
        on conflict do nothing`;
      await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
        values (${id}, 'segunda-division', '2026-27', 1, ${shift(0)}, 'test-home', 'test-away')`;
      let last = "";
      for (const [status, home, away, m] of [
        ["live", 2, 0, 40],
        ["live", 2, 1, 75],
        ["live", 2, 0, 76],
        ["finished", 2, 0, 113],
      ] as const) {
        const [row] = await tx<{ id: string }[]>`
          insert into observations (match_id, source_id, status, home_score, away_score,
            minute, observed_at, received_at, raw_ref)
          values (${id}, 'api-football', ${status}, ${home}, ${away},
            ${status === "live" ? m : null}, ${shift(m)}, ${shift(m)},
            'raw/api-football/2030-01-05/x.json.gz')
          returning id`;
        last = row.id;
      }
      await tx`insert into decisions (match_id, status, home_score, away_score, minute,
          qualifier, rule, observation_ids, decided_at)
        values (${id}, 'finished', 2, 1, null, 'provisional', 'RN-03',
          ${tx.array([last])}::uuid[], ${shift(113)})`;
      ids.push(id);
    }
  });
  committed.push(...ids);
  const filas = await sqlW.begin((tx) =>
    replayJornadaFilas(tx, shift(-10), shift(150)),
  );
  const rows = replayJornada({
    ...filas,
    priority: replayPriority(SOURCES),
    now: TODAY,
  });
  expect(rows.map((r) => r.matchId).sort()).toEqual([...ids].sort());
  expect(rows.every((r) => r.correction !== null)).toBe(true);
  return { ids, rows };
}

const versions = async (matchId: string) =>
  (
    await sqlW<{ version: number; home_score: number; away_score: number }[]>`
      select version, home_score, away_score from decisions
      where match_id = ${matchId} order by version`
  ).map((r) => `${r.version}:${r.home_score}-${r.away_score}`);

// Waits until the backend is waiting on a lock (two seconds at most, inside
// the five of the test), without a sleep standing in for the proof.
async function waitUntilBlocked(pid: number): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    const [row] = await sqlW<{ n: number }[]>`
      select count(*)::int as n from pg_stat_activity
      where pid = ${pid} and wait_event_type = 'Lock'`;
    if (row.n > 0) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`backend ${pid} never waited on a lock`);
}

describe("SPEC-035 CA-8 the corrections of --aplicar under the lock", () => {
  it("waits for a transaction that holds the match, then corrects it", async () => {
    const { ids, rows } = await seedHeldDay(30, 1);
    const [m] = ids;

    let release!: () => void;
    const released = new Promise<void>((r) => {
      release = r;
    });
    let held!: () => void;
    const holding = new Promise<void>((r) => {
      held = r;
    });
    const holder = sqlA.begin(async (tx) => {
      await lockMatches(tx, [m]);
      held();
      await released;
    });
    let applied: Promise<number> = Promise.resolve(-1);
    try {
      await holding;
      let pidOf!: (pid: number) => void;
      const pid = new Promise<number>((r) => {
        pidOf = r;
      });
      applied = sqlB.begin(async (tx) => {
        const [row] = await tx<
          { pid: number }[]
        >`select pg_backend_pid() as pid`;
        pidOf(row.pid);
        return aplicarCorrecciones(tx, rows);
      });
      await waitUntilBlocked(await pid);
    } finally {
      release();
      await holder;
    }
    expect(await applied).toBe(1);
    expect(await versions(m)).toEqual(["1:2-1", "2:2-0"]);
  });

  it("drops the correction of a match whose board changed after the read, and writes the rest", async () => {
    const { ids, rows } = await seedHeldDay(31, 2);
    const [changed, untouched] = ids;
    // Between the read and --aplicar, another Decision of one match commits.
    await sqlW`insert into decisions (match_id, status, home_score, away_score, minute,
        qualifier, rule, observation_ids, decided_at)
      values (${changed}, 'finished', 3, 1, null, 'provisional', 'RN-03',
        array[(select id from observations where match_id = ${changed}
          order by observed_at desc limit 1)], ${TODAY})`;

    expect(await sqlW.begin((tx) => aplicarCorrecciones(tx, rows))).toBe(1);
    expect(await versions(changed)).toEqual(["1:2-1", "2:3-1"]);
    expect(await versions(untouched)).toEqual(["1:2-1", "2:2-0"]);
  });
});
