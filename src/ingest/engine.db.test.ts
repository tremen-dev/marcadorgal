import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { createSql } from "../db/connect.ts";
import { SOURCES } from "../sources/registry.ts";
import type { IngestTx } from "./db.ts";
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
