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
       observation_ids from decisions where match_id = ${matchId} order by version`;

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

        // A retreat: the published score holds and an alert is opened (RN-03).
        const lastHeard = at(0);
        await observe(tx, matchId, 0, 0, 21, lastHeard);
        expect(await decideMatches(tick, [matchId], at(0), SOURCES)).toEqual({
          matches: 1,
          decisions: 1,
          alerts: 1,
          resolved: 0,
        });
        rows = await decisions(tx, matchId);
        expect(rows).toHaveLength(2);
        expect(rows[1]).toMatchObject({
          version: 2,
          home_score: 1,
          away_score: 0,
          minute: 21,
          rule: "RN-03",
        });
        let open = await alerts(tx, matchId);
        expect(open).toHaveLength(1);
        expect(open[0]).toMatchObject({
          kind: "regression",
          resolved_at: null,
        });
        expect(open[0].details).toMatchObject({
          sourceId: "api-football",
          current: { home: 1, away: 0 },
          proposed: { home: 0, away: 0 },
        });

        // Running it again writes no row and opens no second alert.
        expect(await decideMatches(tick, [matchId], at(0), SOURCES)).toEqual({
          matches: 1,
          decisions: 0,
          alerts: 0,
          resolved: 0,
        });
        expect(await decisions(tx, matchId)).toHaveLength(2);
        expect(await alerts(tx, matchId)).toHaveLength(1);

        // Nobody closed the match: RN-02 does, with its trace (H-5).
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
          home_score: 1,
          away_score: 0,
          minute: null,
          qualifier: "provisional",
          rule: "RN-02",
        });
        open = await alerts(tx, matchId);
        expect(open).toHaveLength(2);
        const forced = open.find((a) => a.kind === "forced_finish");
        expect(forced?.match_id).toBe(matchId);
        // The trace names the last observation, 121 minutes old and therefore
        // outside the fifteen minute window: the fourth query of CA-9 at work.
        expect(forced?.details).toMatchObject({
          score: { home: 1, away: 0 },
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
        expect(await alerts(tx, matchId)).toHaveLength(2);
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
