import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { decide, type EngineInput } from "@/decide";
import {
  type Instant,
  MINUTE_MS,
  type Observation,
  type SourceConfig,
  shiftInstant,
} from "@/model";
import { createSql } from "../db/connect.ts";
import { SOURCES } from "../sources/registry.ts";
import type { IngestTx } from "./db.ts";
import { decideMatches, decideRecovered } from "./engine.ts";
import { replayJornada } from "./replay-jornada.ts";
import { replayJornadaFilas, replayPriority } from "./replay-jornada-db.ts";

// SPEC-048 CA-3 and CA-4 (ADR-027 §1-§2) against the real schema, always
// rolled back: the rfef live of Primera/Segunda is stored, never decided.
// Far from any real matchday so the shared dev rows never enter the window.
const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");

const KICKOFF = "2030-02-02T18:30:00.000Z" as Instant;
const TODAY = "2030-02-06T10:00:00.000Z" as Instant;
const at = (minutes: number): Instant =>
  shiftInstant(KICKOFF, minutes * MINUTE_MS);

// The registry with the rfef line reverted (ADR-027 §3): today's behaviour.
const REVERTED: readonly SourceConfig[] = SOURCES.map((s) => ({
  ...s,
  liveObservedOnly: [],
}));

const engineTx = (tx: TransactionSql): IngestTx => ({
  sql: tx,
  insertObservations: () => Promise.reject(new Error("not used here")),
  openUnresolvedAlerts: () => Promise.resolve(0),
  lastOwnObservations: () => Promise.resolve([]),
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

async function seedMatch(
  tx: TransactionSql,
  competition: string,
): Promise<string> {
  const id = `test-${crypto.randomUUID()}`;
  await tx`insert into competitions (id, season, name, tier)
    values (${competition}, '2026-27', 'Test', 1) on conflict do nothing`;
  await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
    on conflict do nothing`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, ${competition}, '2026-27', 1, ${KICKOFF}, 'test-home', 'test-away')`;
  return id;
}

type RfefState =
  | { status: "scheduled" }
  | { status: "live"; home: number; away: number; minute: number }
  | { status: "finished"; home: number; away: number };

async function rfef(
  tx: TransactionSql,
  matchId: string,
  state: RfefState,
  observedAt: Instant,
): Promise<Observation> {
  const home = state.status === "scheduled" ? null : state.home;
  const away = state.status === "scheduled" ? null : state.away;
  const minute = state.status === "live" ? state.minute : null;
  const [row] = await tx<{ id: string }[]>`
    insert into observations (match_id, source_id, status, home_score,
      away_score, minute, observed_at, received_at, raw_ref)
    values (${matchId}, 'rfef', ${state.status}, ${home}, ${away}, ${minute},
      ${observedAt}, ${observedAt}, 'raw/rfef/2030-02-02/x.json.gz')
    returning id`;
  return {
    id: row.id,
    matchId,
    sourceId: "rfef",
    status: state.status,
    score: home === null ? null : { home, away },
    minute,
    ...(state.status === "live" ? { addedMinute: null, halfTime: false } : {}),
    observedAt,
    receivedAt: observedAt,
    rawRef: "raw/rfef/2030-02-02/x.json.gz",
  } as unknown as Observation;
}

// One rfef live 0-0 every 30 s over [from, to), minutes after kickoff.
async function frozen(
  tx: TransactionSql,
  matchId: string,
  from: number,
  to: number,
): Promise<number> {
  let n = 0;
  for (let m = from; m < to; m += 0.5) {
    await rfef(
      tx,
      matchId,
      { status: "live", home: 0, away: 0, minute: Math.min(Math.floor(m), 90) },
      at(m),
    );
    n += 1;
  }
  return n;
}

type DecisionRow = {
  status: string;
  home_score: number | null;
  away_score: number | null;
  qualifier: string;
  rule: string;
  forced_finish: boolean | null;
};

const decisions = (tx: TransactionSql, matchId: string) =>
  tx<DecisionRow[]>`
    select status, home_score, away_score, qualifier, rule, forced_finish
    from decisions where match_id = ${matchId} order by version`;

const forcedAlerts = async (tx: TransactionSql, matchId: string) =>
  (
    await tx`select 1 from alerts
      where match_id = ${matchId} and kind = 'forced_finish'`
  ).length;

// The Depor–Osasuna of 2026-11-02: scheduled, then a frozen rfef 0-0 live
// from kickoff + 2, ticks at + 15, + 120 and + 150.
async function depor(
  tx: TransactionSql,
  competition: string,
  sources: readonly SourceConfig[],
) {
  const matchId = await seedMatch(tx, competition);
  const tick = engineTx(tx);
  await rfef(tx, matchId, { status: "scheduled" }, at(-5));
  await decideMatches(tick, [matchId], at(-5), sources);
  let stored = await frozen(tx, matchId, 2, 15);
  await decideMatches(tick, [matchId], at(15), sources);
  const afterFifteen = (await decisions(tx, matchId)).at(-1);
  stored += await frozen(tx, matchId, 15, 120);
  await decideMatches(tick, [matchId], at(120), sources);
  stored += await frozen(tx, matchId, 120, 150);
  await decideMatches(tick, [matchId], at(150), sources);
  return { matchId, tick, stored, afterFifteen };
}

afterAll(() => sql.end());

describe("SPEC-048 CA-3 the engine end to end", () => {
  it("Primera: scheduled · sen_sinal, never live nor forced; the rfef final enters by RN-01", () =>
    rollback(async (tx) => {
      const { matchId, tick, stored, afterFifteen } = await depor(
        tx,
        "primera-division",
        SOURCES,
      );
      // (i) at + 15, RN-05 in scheduled.
      expect(afterFifteen).toMatchObject({
        status: "scheduled",
        qualifier: "sen_sinal",
        rule: "RN-05",
      });
      // (ii) no live, no finished, no forced finish in the whole stretch.
      const rows = await decisions(tx, matchId);
      expect(rows.filter((r) => r.status !== "scheduled")).toEqual([]);
      expect(await forcedAlerts(tx, matchId)).toBe(0);
      // (iii) every rfef observation is stored.
      const [{ n }] = await tx<{ n: number }[]>`
        select count(*)::int as n from observations
        where match_id = ${matchId} and source_id = 'rfef' and status = 'live'`;
      expect(stored).toBeGreaterThan(0);
      expect(n).toBe(stored);
      // (iv) the rfef final: finished · provisional by RN-01.
      await rfef(
        tx,
        matchId,
        { status: "finished", home: 2, away: 1 },
        at(152),
      );
      await decideMatches(tick, [matchId], at(152), SOURCES);
      expect((await decisions(tx, matchId)).at(-1)).toMatchObject({
        status: "finished",
        home_score: 2,
        away_score: 1,
        qualifier: "provisional",
        rule: "RN-01",
      });
    }));

  it("control: the same sequence in primera-rfef-g1 goes live and is forced to finish", () =>
    rollback(async (tx) => {
      const { matchId } = await depor(tx, "primera-rfef-g1", SOURCES);
      const rows = await decisions(tx, matchId);
      expect(rows.some((r) => r.status === "live")).toBe(true);
      expect(rows.at(-1)).toMatchObject({
        status: "finished",
        home_score: 0,
        away_score: 0,
        rule: "RN-02",
        forced_finish: true,
      });
      expect(await forcedAlerts(tx, matchId)).toBe(1);
    }));

  it("reversible: with liveObservedOnly empty, Primera behaves as today (live 0-0, then finished RN-02)", () =>
    rollback(async (tx) => {
      const { matchId } = await depor(tx, "primera-division", REVERTED);
      const rows = await decisions(tx, matchId);
      expect(rows.some((r) => r.status === "live")).toBe(true);
      expect(rows.at(-1)).toMatchObject({
        status: "finished",
        home_score: 0,
        away_score: 0,
        rule: "RN-02",
        forced_finish: true,
      });
      expect(await forcedAlerts(tx, matchId)).toBe(1);
    }));
});

describe("SPEC-048 CA-4 every way into the engine", () => {
  it("recovery (ADR-025 §4): of the rfef live and finished of a Primera match, only the finished counts", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx, "primera-division");
      const live = [
        await rfef(
          tx,
          matchId,
          { status: "live", home: 0, away: 0, minute: 10 },
          at(10),
        ),
        await rfef(
          tx,
          matchId,
          { status: "live", home: 0, away: 0, minute: 60 },
          at(60),
        ),
        await rfef(
          tx,
          matchId,
          { status: "live", home: 0, away: 0, minute: 95 },
          at(110),
        ),
      ];
      const final = await rfef(
        tx,
        matchId,
        { status: "finished", home: 2, away: 1 },
        at(112),
      );
      expect(
        await decideRecovered(engineTx(tx), [...live, final], SOURCES),
      ).toEqual({ matches: 1, decisions: 1, alerts: 0, resolved: 0 });
      const rows = await tx`select status, home_score, away_score, qualifier,
          rule, observation_ids from decisions where match_id = ${matchId}`;
      expect(rows).toEqual([
        {
          status: "finished",
          home_score: 2,
          away_score: 1,
          qualifier: "provisional",
          rule: "RN-01",
          observation_ids: [final.id],
        },
      ]);
    }));

  it("replay-jornada: no live Decision and no correction with the score of an excluded live", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx, "primera-division");
      await rfef(tx, matchId, { status: "scheduled" }, at(-5));
      await frozen(tx, matchId, 2, 150);
      const final = await rfef(
        tx,
        matchId,
        { status: "finished", home: 2, away: 1 },
        at(152),
      );
      await tx`insert into decisions (match_id, status, home_score, away_score,
          minute, qualifier, rule, observation_ids, decided_at)
        values (${matchId}, 'finished', 2, 1, null, 'provisional', 'RN-01',
          ${tx.array([final.id])}::uuid[], ${at(152)})`;

      const run = async (sources?: readonly SourceConfig[]) => {
        const seen: string[] = [];
        const spy = (input: EngineInput) => {
          const output = decide(input);
          const d = output.decision;
          if (d !== null)
            seen.push(
              d.score === null
                ? d.status
                : `${d.status}:${d.score.home}-${d.score.away}`,
            );
          return output;
        };
        const filas = await replayJornadaFilas(tx, at(-10), at(160), sources);
        const rows = replayJornada({
          ...filas,
          priority: replayPriority(SOURCES),
          now: TODAY,
          engine: spy,
        }).filter((r) => r.matchId === matchId);
        return { seen, rows };
      };

      const { seen, rows } = await run();
      expect(seen.filter((s) => s.startsWith("live"))).toEqual([]);
      expect(rows).toHaveLength(1);
      expect(rows[0].correction).toBeNull();
      expect(rows[0].replay).toEqual({
        status: "finished",
        score: { home: 2, away: 1 },
      });

      // The test bites: with the rfef line reverted the replay goes live 0-0.
      const reverted = await run(REVERTED);
      expect(reverted.seen).toContain("live:0-0");
    }));
});
