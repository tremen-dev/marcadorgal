import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { createSql } from "../db/connect.ts";
import { SOURCES } from "../sources/registry.ts";
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
          minute, qualifier, rule, observation_ids, decided_at
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
