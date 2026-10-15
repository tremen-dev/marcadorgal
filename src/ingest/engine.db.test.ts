import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import {
  type Instant,
  MINUTE_MS,
  type Observation,
  shiftInstant,
} from "@/model";
import { createSql } from "../db/connect.ts";
import { SOURCES } from "../sources/registry.ts";
import { createIngestDb, type IngestTx } from "./db.ts";
import { decideMatches } from "./engine.ts";

// CA-11: the engine against the real schema, always rolled back.
const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");

const KICKOFF = "2026-09-25T18:30:00.000Z" as Instant;
const at = (minutes: number): Instant =>
  shiftInstant(KICKOFF, minutes * MINUTE_MS);

// decideMatches only ever touches tx.sql: the rest of the port is not its.
const engineTx = (tx: TransactionSql): IngestTx => ({
  sql: tx,
  insertObservations: () => Promise.reject(new Error("not used here")),
  openUnresolvedAlerts: () => Promise.resolve(0),
});

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

async function pgCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}

async function seedMatch(tx: TransactionSql): Promise<string> {
  const id = `test-${crypto.randomUUID()}`;
  await tx`insert into competitions (id, season, name, tier)
    values ('primera-division', '2026-27', 'Test', 1) on conflict do nothing`;
  await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
    on conflict do nothing`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, 'primera-division', '2026-27', 1, ${KICKOFF}, 'test-home', 'test-away')`;
  return id;
}

const observe = async (
  tx: TransactionSql,
  matchId: string,
  home: number,
  away: number,
  minute: number,
  observedAt: Instant,
): Promise<string> => {
  const [row] = await tx<{ id: string }[]>`
    insert into observations (match_id, source_id, status, home_score, away_score,
      minute, observed_at, received_at, raw_ref)
    values (${matchId}, 'api-football', 'live', ${home}, ${away}, ${minute},
      ${observedAt}, ${observedAt}, 'raw/2026-09-25/api-football/x.json.gz')
    returning id`;
  return row.id;
};

const decisions = (tx: TransactionSql, matchId: string) =>
  tx`select version, status, home_score, away_score, minute, qualifier, rule,
       observation_ids, home_source_id, away_source_id, forced_finish
     from decisions where match_id = ${matchId} order by version`;

const alerts = (tx: TransactionSql, matchId: string) =>
  tx`select kind, match_id, resolved_at, details from alerts
     where match_id = ${matchId} order by opened_at, kind`;

afterAll(() => sql.end());

describe("CA-11 the engine against the database", () => {
  it(
    "writes the whole life of a match: RN-01, RN-03 and the forced finish",
    () =>
      rollback(async (tx) => {
        const matchId = await seedMatch(tx);
        const tick = engineTx(tx);
        await observe(tx, matchId, 0, 0, 1, at(-2));
        const winner = await observe(tx, matchId, 1, 0, 20, at(-1));

        // One Decision, version 1, citing the winning observation (RN-06).
        expect(await decideMatches(tick, [matchId], at(0), SOURCES)).toEqual({
          matches: 1,
          decisions: 1,
          alerts: 0,
          resolved: 0,
        });
        let rows = await decisions(tx, matchId);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          version: 1,
          status: "live",
          home_score: 1,
          away_score: 0,
          minute: 20,
          qualifier: "provisional",
          rule: "RN-01",
        });
        expect(rows[0].observation_ids).toEqual([winner]);

        // The board shows it, dated by the observation it cites (RN-11).
        const [board] = await tx`select status, home_score, away_score, minute,
        qualifier, decision_version, observed_at from board where match_id = ${matchId}`;
        expect(board).toMatchObject({
          status: "live",
          home_score: 1,
          away_score: 0,
          minute: 20,
          qualifier: "provisional",
          decision_version: 1,
        });
        expect((board.observed_at as Date).toISOString()).toBe(at(-1));

        // A retreat by the source that raised the goal: since ADR-011 it is
        // published by RN-01, with no alert (SPEC-014 CA-3 (i)). The retreat
        // that is held is proved below, with an operator's goal.
        const lastHeard = at(0);
        await observe(tx, matchId, 0, 0, 21, lastHeard);
        expect(await decideMatches(tick, [matchId], at(0), SOURCES)).toEqual({
          matches: 1,
          decisions: 1,
          alerts: 0,
          resolved: 0,
        });
        rows = await decisions(tx, matchId);
        expect(rows).toHaveLength(2);
        expect(rows[1]).toMatchObject({
          version: 2,
          home_score: 0,
          away_score: 0,
          minute: 21,
          rule: "RN-01",
          home_source_id: "api-football",
          away_source_id: "api-football",
          forced_finish: false,
        });
        let open = await alerts(tx, matchId);
        expect(open).toHaveLength(0);

        // Running it again writes no row and opens no alert.
        expect(await decideMatches(tick, [matchId], at(0), SOURCES)).toEqual({
          matches: 1,
          decisions: 0,
          alerts: 0,
          resolved: 0,
        });
        expect(await decisions(tx, matchId)).toHaveLength(2);
        expect(await alerts(tx, matchId)).toHaveLength(0);

        // Nobody closed the match: RN-02 does, with its trace (H-5) and the
        // mark of the forced finish (SPEC-014 CA-8).
        expect(await decideMatches(tick, [matchId], at(121), SOURCES)).toEqual({
          matches: 1,
          decisions: 1,
          alerts: 1,
          resolved: 0,
        });
        rows = await decisions(tx, matchId);
        expect(rows).toHaveLength(3);
        expect(rows[2]).toMatchObject({
          version: 3,
          status: "finished",
          home_score: 0,
          away_score: 0,
          minute: null,
          qualifier: "provisional",
          rule: "RN-02",
          forced_finish: true,
        });
        open = await alerts(tx, matchId);
        expect(open).toHaveLength(1);
        const forced = open.find((a) => a.kind === "forced_finish");
        expect(forced?.match_id).toBe(matchId);
        // The trace names the last observation, 121 minutes old and therefore
        // outside the fifteen minute window: the fourth query of CA-9 at work.
        expect(forced?.details).toMatchObject({
          score: { home: 0, away: 0 },
          heldScore: { home: 0, away: 0 },
          minute: 21,
          kickoff: KICKOFF,
          lastObservedAt: lastHeard,
          lastStatus: "live",
        });

        // And the sweep run again neither closes it twice nor alerts twice.
        expect(await decideMatches(tick, [matchId], at(121), SOURCES)).toEqual({
          matches: 1,
          decisions: 0,
          alerts: 0,
          resolved: 0,
        });
        expect(await decisions(tx, matchId)).toHaveLength(3);
        expect(await alerts(tx, matchId)).toHaveLength(1);
      }),
    // Six runs of the engine against a remote database, four queries each.
    30_000,
  );

  it("resolves the silence when the signal comes back", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      const tick = engineTx(tx);
      await observe(tx, matchId, 1, 0, 20, at(0));
      await decideMatches(tick, [matchId], at(0), SOURCES);

      // Twenty minutes of quiet: sen_sinal and a silence alert (RN-05).
      expect(
        await decideMatches(tick, [matchId], at(20), SOURCES),
      ).toMatchObject({ decisions: 1, alerts: 1 });
      const [silent] = await tx`select qualifier, rule from decisions
        where match_id = ${matchId} order by version desc limit 1`;
      expect(silent).toMatchObject({ qualifier: "sen_sinal", rule: "RN-05" });

      // The signal is back: the alert is closed and only that one.
      await observe(tx, matchId, 1, 0, 40, at(40));
      expect(
        await decideMatches(tick, [matchId], at(40), SOURCES),
      ).toMatchObject({ decisions: 1, alerts: 0, resolved: 1 });
      const [closed] = await alerts(tx, matchId);
      expect(closed.kind).toBe("silence");
      expect(closed.resolved_at).not.toBeNull();
    }));

  it("keeps decisions append-only (RN-07)", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      await observe(tx, matchId, 1, 0, 20, at(0));
      await decideMatches(engineTx(tx), [matchId], at(0), SOURCES);
      expect(
        await pgCode(
          tx.savepoint(
            (s) =>
              s`update decisions set minute = 99 where match_id = ${matchId}`,
          ),
        ),
      ).toBe("09000"); // triggered_action_exception
    }));
});

// SPEC-013 CA-2: RN-12 exists end to end. The check of decisions.rule takes
// it, and still rejects what is not a rule: both directions.
describe("SPEC-013 CA-2 decisions.rule accepts RN-12 and nothing invented", () => {
  const insertRule = async (tx: TransactionSql, rule: string) => {
    const matchId = await seedMatch(tx);
    const observationId = await observe(tx, matchId, 3, 1, 90, at(95));
    return tx`insert into decisions (match_id, status, home_score, away_score,
        minute, qualifier, rule, observation_ids, decided_at)
      values (${matchId}, 'finished', 3, 1, null, 'confirmado', ${rule},
        ${tx.array([observationId])}::uuid[], ${at(130)})
      returning rule`;
  };

  it("inserts a Decision with rule RN-12", () =>
    rollback(async (tx) => {
      const [row] = await insertRule(tx, "RN-12");
      expect(row.rule).toBe("RN-12");
    }));

  it("still rejects an invented rule", () =>
    rollback(async (tx) => {
      expect(
        await pgCode(
          tx.savepoint((s) => insertRule(s as TransactionSql, "RN-99")),
        ),
      ).toBe("23514"); // check_violation
    }));
});

// SPEC-013 CA-4 against the real schema: forced at +120, the source confirms
// at +125, RN-12 is written and the forced_finish alert stays open.
describe("SPEC-013 CA-4 RN-12 through the database", () => {
  it("writes the confirmed final with RN-12 and keeps forced_finish open", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      const tick = engineTx(tx);
      await observe(tx, matchId, 2, 1, 90, at(115));
      await decideMatches(tick, [matchId], at(115), SOURCES);
      await decideMatches(tick, [matchId], at(121), SOURCES);
      const [{ id: confirmation }] = await tx<{ id: string }[]>`
        insert into observations (match_id, source_id, status, home_score,
          away_score, minute, observed_at, received_at, raw_ref)
        values (${matchId}, 'api-football', 'finished', 3, 1, null, ${at(125)},
          ${at(125)}, 'raw/2026-09-25/api-football/y.json.gz')
        returning id`;
      expect(
        await decideMatches(tick, [matchId], at(125), SOURCES),
      ).toMatchObject({ decisions: 1, alerts: 0, resolved: 0 });

      const rows = await decisions(tx, matchId);
      expect(rows.map((r) => [r.status, r.rule, r.qualifier])).toEqual([
        ["live", "RN-01", "provisional"],
        ["finished", "RN-02", "provisional"],
        ["finished", "RN-12", "confirmado"],
      ]);
      expect(rows.at(-1)).toMatchObject({
        home_score: 3,
        away_score: 1,
        observation_ids: [confirmation],
      });
      const open = await alerts(tx, matchId);
      expect(open.map((a) => [a.kind, a.resolved_at])).toEqual([
        ["forced_finish", null],
      ]);
    }));
});

// SPEC-014 CA-2, CA-4, CA-8 against the real schema: the owners and the mark
// exist end to end, legacy nulls included, always rolled back.
describe("SPEC-014 CA-2 CA-8 owners and mark through the database", () => {
  const insertDecision = async (
    tx: TransactionSql,
    matchId: string,
    observationId: string,
    over: {
      status?: string;
      minute?: number | null;
      rule?: string;
      home?: string | null;
      away?: string | null;
      forced?: boolean | null;
      at?: Instant;
    } = {},
  ) =>
    tx`insert into decisions (match_id, status, home_score, away_score,
        minute, qualifier, rule, observation_ids, decided_at,
        home_source_id, away_source_id, forced_finish)
      values (${matchId}, ${over.status ?? "live"}, 1, 0,
        ${over.minute === undefined ? 20 : over.minute}, 'provisional',
        ${over.rule ?? "RN-01"}, ${tx.array([observationId])}::uuid[],
        ${over.at ?? at(-1)}, ${over.home ?? null}, ${over.away ?? null},
        ${over.forced ?? null})
      returning home_source_id, away_source_id, forced_finish`;

  it("round-trips true, false and null, and the two owners", () =>
    rollback(async (tx) => {
      const values: [string | null, string | null, boolean | null][] = [
        ["operator", "api-football", true],
        ["api-football", null, false],
        [null, null, null],
      ];
      for (const [home, away, forced] of values) {
        const matchId = await seedMatch(tx);
        const o = await observe(tx, matchId, 1, 0, 20, at(-2));
        await insertDecision(tx, matchId, o, { home, away, forced });
        const [row] = await decisions(tx, matchId);
        expect([
          row.home_source_id,
          row.away_source_id,
          row.forced_finish,
        ]).toEqual([home, away, forced]);
      }
    }));

  it("holds the operator's goal against api-football and keeps its owner (RN-03)", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      const o = await observe(tx, matchId, 1, 0, 20, at(-2));
      await insertDecision(tx, matchId, o, { home: "operator", away: null });
      await observe(tx, matchId, 0, 0, 21, at(0));
      expect(
        await decideMatches(engineTx(tx), [matchId], at(0), SOURCES),
      ).toMatchObject({ decisions: 1, alerts: 1 });
      const rows = await decisions(tx, matchId);
      expect(rows.at(-1)).toMatchObject({
        home_score: 1,
        away_score: 0,
        minute: 21,
        rule: "RN-03",
        home_source_id: "operator",
        // The away side did not move (0 → 0): it keeps its owner, null.
        away_source_id: null,
        forced_finish: false,
      });
      const [regression] = await alerts(tx, matchId);
      expect(regression.kind).toBe("regression");
    }));

  it("does not reconcile a finished RN-02 without the mark (RN-12 reads the mark)", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      const o = await observe(tx, matchId, 1, 0, 90, at(110));
      await insertDecision(tx, matchId, o, {
        status: "finished",
        minute: null,
        rule: "RN-02",
        forced: null,
        at: at(120),
      });
      await tx`insert into observations (match_id, source_id, status, home_score,
          away_score, minute, observed_at, received_at, raw_ref)
        values (${matchId}, 'api-football', 'finished', 2, 0, null, ${at(125)},
          ${at(125)}, 'raw/2026-09-25/api-football/y.json.gz')`;
      await decideMatches(engineTx(tx), [matchId], at(125), SOURCES);
      const rows = await decisions(tx, matchId);
      expect(rows.map((r) => r.rule)).not.toContain("RN-12");
    }));
});

// SPEC-018 CA-5: a scheduled · sen_sinal goes to the database and back. The
// engine writes it at +20 (RN-05 in scheduled, no alert), reads it back as
// the current Decision and writes nothing more with a later scheduled
// observation; the check still rejects sen_sinal in finished.
describe("SPEC-018 CA-5 scheduled · sen_sinal round trip", () => {
  const observeScheduled = async (
    tx: TransactionSql,
    matchId: string,
    observedAt: Instant,
  ) => {
    const [row] = await tx<{ id: string }[]>`
      insert into observations (match_id, source_id, status, observed_at,
        received_at, raw_ref)
      values (${matchId}, 'api-football', 'scheduled', ${observedAt},
        ${observedAt}, 'raw/2026-09-25/api-football/x.json.gz')
      returning id`;
    return row.id;
  };

  it("writes it, reads it back and does not blink", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      const tick = engineTx(tx);
      const first = await observeScheduled(tx, matchId, at(-5));
      await decideMatches(tick, [matchId], at(-5), SOURCES);
      await observeScheduled(tx, matchId, at(19));
      expect(await decideMatches(tick, [matchId], at(20), SOURCES)).toEqual({
        matches: 1,
        decisions: 1,
        alerts: 0,
        resolved: 0,
      });
      const rows = await decisions(tx, matchId);
      expect(rows.map((r) => [r.status, r.qualifier, r.rule])).toEqual([
        ["scheduled", "provisional", "RN-01"],
        ["scheduled", "sen_sinal", "RN-05"],
      ]);
      expect(rows[1].observation_ids).toEqual([first]);
      expect(rows[1]).toMatchObject({ forced_finish: false });
      const [board] = await tx`select status, qualifier from board
        where match_id = ${matchId}`;
      expect(board).toMatchObject({
        status: "scheduled",
        qualifier: "sen_sinal",
      });

      await observeScheduled(tx, matchId, at(59));
      expect(await decideMatches(tick, [matchId], at(60), SOURCES)).toEqual({
        matches: 1,
        decisions: 0,
        alerts: 0,
        resolved: 0,
      });
      expect(await alerts(tx, matchId)).toEqual([]);
    }));

  it("still rejects sen_sinal in finished, postponed and suspended", async () => {
    for (const [status, score] of [
      ["finished", 1],
      ["postponed", null],
      ["suspended", 1],
    ] as const) {
      let code: string | undefined;
      await rollback(async (tx) => {
        const matchId = await seedMatch(tx);
        const o = await observeScheduled(tx, matchId, at(0));
        code = await pgCode(
          tx.savepoint(
            (sp) => sp`insert into decisions (match_id, status, home_score,
              away_score, qualifier, rule, observation_ids, decided_at)
            values (${matchId}, ${status}, ${score}, ${score}, 'sen_sinal',
              'RN-05', ${[o]}, ${at(20)})`,
          ),
        );
      });
      expect(code).toBe("23514");
    }
  });
});

// SPEC-021 CA-5: half_time goes in and out of the database with the engine:
// written on observations and Decisions, read back from the current Decision
// and from the observations.
describe("SPEC-021 CA-5 half_time round trip", () => {
  const observeHalfTime = async (
    tx: TransactionSql,
    matchId: string,
    halfTime: boolean,
    observedAt: Instant,
  ) => {
    await tx`insert into observations (match_id, source_id, status, home_score,
        away_score, minute, half_time, observed_at, received_at, raw_ref)
      values (${matchId}, 'api-football', 'live', 1, 0, 45, ${halfTime},
        ${observedAt}, ${observedAt}, 'raw/2026-09-25/api-football/x.json.gz')`;
  };
  const halfTimes = (tx: TransactionSql, matchId: string) =>
    tx`select version, status, minute, qualifier, rule, half_time
       from decisions where match_id = ${matchId} order by version`;

  it("writes a live Decision at half-time, reads it back and publishes no twin", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      await observeHalfTime(tx, matchId, true, at(47));
      await decideMatches(engineTx(tx), [matchId], at(47), SOURCES);
      // Same observation, next tick: the current Decision is read with its
      // half_time, so the tuple does not move.
      await observeHalfTime(tx, matchId, true, at(48));
      await decideMatches(engineTx(tx), [matchId], at(48), SOURCES);
      expect((await halfTimes(tx, matchId)).map((r) => ({ ...r }))).toEqual([
        {
          version: 1,
          status: "live",
          minute: 45,
          qualifier: "provisional",
          rule: "RN-01",
          half_time: true,
        },
      ]);
      // The second half starts: one Decision back to false.
      await observeHalfTime(tx, matchId, false, at(62));
      await decideMatches(engineTx(tx), [matchId], at(62), SOURCES);
      expect((await halfTimes(tx, matchId)).map((r) => r.half_time)).toEqual([
        true,
        false,
      ]);
    }));

  it("the silence at half-time writes sen_sinal keeping half_time", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      await observeHalfTime(tx, matchId, true, at(47));
      await decideMatches(engineTx(tx), [matchId], at(47), SOURCES);
      await decideMatches(engineTx(tx), [matchId], at(63), SOURCES);
      expect((await halfTimes(tx, matchId)).map((r) => ({ ...r }))).toEqual([
        expect.objectContaining({ version: 1, half_time: true }),
        expect.objectContaining({
          version: 2,
          qualifier: "sen_sinal",
          rule: "RN-05",
          half_time: true,
        }),
      ]);
    }));
});

// SPEC-035 (ADR-019 §1): two engines over the same match, each on its own
// real connection. These rows are committed, because a transaction that waits
// for another one only sees what that one commits; the afterAll removes them
// as replica, the only way past the append-only triggers of RN-07.
const sqlA = createSql(process.env);
const sqlB = createSql(process.env);
const sqlC = createSql(process.env);
const dbA = createIngestDb(sqlA);
const dbB = createIngestDb(sqlB);
const dbC = createIngestDb(sqlC);
const committed: string[] = [];

afterAll(async () => {
  if (committed.length > 0)
    await sqlC.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      const ids = tx.array(committed);
      await tx`delete from decisions where match_id = any(${ids})`;
      await tx`delete from alerts where match_id = any(${ids})`;
      await tx`delete from observations where match_id = any(${ids})`;
      await tx`delete from matches where id = any(${ids})`;
    });
  await Promise.all([sqlA.end(), sqlB.end(), sqlC.end()]);
});

const deferred = <T = void>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

// Seeds and commits n matches, ordered by id.
async function seedCommitted(n: number): Promise<string[]> {
  const ids: string[] = [];
  await sqlC.begin(async (tx) => {
    for (let i = 0; i < n; i += 1) ids.push(await seedMatch(tx));
  });
  ids.sort();
  committed.push(...ids);
  return ids;
}

const observeCommitted = (
  matchId: string,
  home: number,
  away: number,
  minute: number,
  observedAt: Instant,
) => sqlC.begin((tx) => observe(tx, matchId, home, away, minute, observedAt));

const pidOf = async (tx: IngestTx): Promise<number> => {
  const [row] = await tx.sql<{ pid: number }[]>`select pg_backend_pid() as pid`;
  return row.pid;
};

// Waits until the backend is waiting on a lock: the proof that it does not
// finish while the other transaction is open, without a sleep.
async function waitUntilBlocked(pid: number): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const [row] = await sqlC<{ n: number }[]>`
      select count(*)::int as n from pg_stat_activity
      where pid = ${pid} and wait_event_type = 'Lock'`;
    if (row.n > 0) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`backend ${pid} never waited on a lock`);
}

// Runs fn in a transaction and keeps it open until release is called.
function holdOpen<T>(
  db: ReturnType<typeof createIngestDb>,
  fn: (tx: IngestTx) => Promise<T>,
) {
  const ran = deferred<T>();
  const release = deferred();
  const done = db.transaction(async (tx) => {
    ran.resolve(await fn(tx));
    await release.promise;
  });
  return { ran: ran.promise, release: release.resolve, done };
}

const committedDecisions = (matchId: string) =>
  sqlC<{ version: number; home_score: number | null; minute: number | null }[]>`
    select version, home_score, minute from decisions
    where match_id = ${matchId} order by version`;

describe("SPEC-035 CA-1 one lock per match before reading", () => {
  it("the second engine waits for the first and writes nothing", async () => {
    const [m] = await seedCommitted(1);
    await observeCommitted(m, 1, 0, 20, at(-1));

    const a = holdOpen(dbA, (tx) => decideMatches(tx, [m], at(0), SOURCES));
    let b: Promise<unknown> = Promise.resolve();
    try {
      expect(await a.ran).toMatchObject({ decisions: 1 });
      const pid = deferred<number>();
      let bDone = false;
      b = dbB
        .transaction(async (tx) => {
          pid.resolve(await pidOf(tx));
          return decideMatches(tx, [m], at(0), SOURCES);
        })
        .finally(() => {
          bDone = true;
        });
      await waitUntilBlocked(await pid.promise);
      expect(bDone).toBe(false);
    } finally {
      a.release();
      await a.done;
    }
    // No 23505: B resolves, and it read A's version.
    expect(await b).toMatchObject({ decisions: 0 });
    const rows = await committedDecisions(m);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ version: 1, home_score: 1 });
  });
});

describe("SPEC-035 CA-2 no stale version (damage a)", () => {
  it("the sweep that waited does not publish the old score over the goal", async () => {
    const [m] = await seedCommitted(1);
    await observeCommitted(m, 0, 0, 10, at(10));
    await dbC.transaction((tx) => decideMatches(tx, [m], at(10), SOURCES));
    // A newer minute, still undecided: the sweep has something to write.
    await observeCommitted(m, 0, 0, 11, at(11));

    const a = holdOpen(dbA, async (tx) => {
      await observe(tx.sql, m, 1, 0, 12, at(12));
      return decideMatches(tx, [m], at(12), SOURCES);
    });
    let b: Promise<unknown> = Promise.resolve();
    try {
      expect(await a.ran).toMatchObject({ decisions: 1 });
      const pid = deferred<number>();
      b = dbB.transaction(async (tx) => {
        pid.resolve(await pidOf(tx));
        return decideMatches(tx, [m], shiftInstant(at(12), 3000), SOURCES);
      });
      await waitUntilBlocked(await pid.promise);
    } finally {
      a.release();
      await a.done;
    }
    await b;
    const rows = await committedDecisions(m);
    expect(rows[rows.length - 1]).toMatchObject({ home_score: 1, minute: 12 });
    expect(rows.filter((r) => r.version > 1 && r.home_score === 0)).toEqual([]);
  });
});

describe("SPEC-035 CA-3 no deadlock and no brake on ingest", () => {
  it("an afterInsert on m2 and a sweep on m1, m2, m3 both commit", async () => {
    const [m1, m2, m3] = await seedCommitted(3);
    for (const m of [m1, m2, m3]) await observeCommitted(m, 0, 0, 5, at(5));

    const a = holdOpen(dbA, async (tx) => {
      await observe(tx.sql, m2, 1, 0, 6, at(6));
      return decideMatches(tx, [m2], at(6), SOURCES);
    });
    let b: Promise<unknown> = Promise.resolve();
    try {
      await a.ran;
      const pid = deferred<number>();
      b = dbB.transaction(async (tx) => {
        pid.resolve(await pidOf(tx));
        return decideMatches(tx, [m1, m2, m3], at(7), SOURCES);
      });
      await waitUntilBlocked(await pid.promise);
    } finally {
      a.release();
      await a.done;
    }
    expect(await b).toMatchObject({ matches: 3 });
  });

  it("the other way round: the afterInsert inserts while the sweep holds m2", async () => {
    const [m1, m2, m3] = await seedCommitted(3);
    for (const m of [m1, m2, m3]) await observeCommitted(m, 0, 0, 5, at(5));

    const b = holdOpen(dbB, (tx) =>
      decideMatches(tx, [m1, m2, m3], at(6), SOURCES),
    );
    let a: Promise<unknown> = Promise.resolve();
    try {
      await b.ran;
      const pid = deferred<number>();
      const inserted = deferred();
      a = dbA.transaction(async (tx) => {
        pid.resolve(await pidOf(tx));
        await tx.sql`set local lock_timeout = '2s'`;
        await observe(tx.sql, m2, 1, 0, 6, at(6));
        inserted.resolve();
        return decideMatches(tx, [m2], at(6), SOURCES);
      });
      // The observation goes in at once; only the engine waits.
      // (With "for update" it would fail here on the lock_timeout.)
      await Promise.race([inserted.promise, a]);
      await waitUntilBlocked(await pid.promise);
    } finally {
      b.release();
      await b.done;
    }
    expect(await a).toMatchObject({ decisions: 1 });
    const rows = await committedDecisions(m2);
    expect(rows[rows.length - 1]).toMatchObject({ home_score: 1 });
  });

  it("an insertObservations of m1 does not wait for the lock on m1", async () => {
    const [m1] = await seedCommitted(1);
    await observeCommitted(m1, 0, 0, 5, at(5));

    const a = holdOpen(dbA, (tx) => decideMatches(tx, [m1], at(5), SOURCES));
    try {
      await a.ran;
      await dbC.transaction(async (tx) => {
        await tx.sql`set local lock_timeout = '2s'`;
        await tx.insertObservations([
          {
            id: crypto.randomUUID(),
            matchId: m1,
            sourceId: "api-football",
            status: "live",
            score: { home: 1, away: 0 },
            minute: 6,
            addedMinute: null,
            halfTime: false,
            observedAt: at(6),
            receivedAt: at(6),
            rawRef: "raw/2026-09-25/api-football/x.json.gz",
          } as unknown as Observation,
        ]);
      });
    } finally {
      a.release();
      await a.done;
    }
    const [row] = await sqlC<{ n: number }[]>`
      select count(*)::int as n from observations where match_id = ${m1}`;
    expect(row.n).toBe(2);
  });
});
