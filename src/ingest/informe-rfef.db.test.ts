import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { createSql } from "../db/connect.ts";
import { informeRfefFilas } from "./informe-rfef-db.ts";

// SPEC-039 CA-1/CA-2: the queries of the rfef report against the real schema,
// always rolled back. No migration: every number comes out of a column that
// already exists (observations, alerts, ingest_attempts, storage.objects).

const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");

// July 2027: outside the declared season, so no real row enters the window.
const KICKOFF = "2027-07-04T16:00:00.000Z" as Instant;
const DESDE = shiftInstant(KICKOFF, -10 * MINUTE_MS);
const HASTA = shiftInstant(KICKOFF, 150 * MINUTE_MS);
const at = (minutes: number): Instant =>
  shiftInstant(KICKOFF, minutes * MINUTE_MS);

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

async function seedMatch(tx: TransactionSql): Promise<string> {
  const id = `tercera-rfef-g1-2026-27-t${crypto.randomUUID()}-test-home-test-away`;
  await tx`insert into competitions (id, season, name, tier)
    values ('tercera-rfef-g1', '2026-27', 'Test Tercera', 5) on conflict do nothing`;
  await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
    on conflict do nothing`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, 'tercera-rfef-g1', '2026-27', 12, ${KICKOFF}, 'test-home', 'test-away')`;
  return id;
}

describe("SPEC-039 informeRfefFilas contra la base", () => {
  it("reads matches, observations of both sources with their second clock, rfef alerts and rfef attempts", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      const ref = `raw/2027-07-04/rfef/test-${crypto.randomUUID()}.json.gz`;
      const refAf = `raw/2027-07-04/api-football/test-${crypto.randomUUID()}.json.gz`;
      await tx`insert into ingest_attempts (source_id, started_at, finished_at, ok, raw_ref, details, opened_at)
        values ('rfef', ${at(30)}, ${at(30)}, true, ${ref}, ${tx.json({ fueraDeVentana: 4 })}, ${shiftInstant(at(30), 700)}),
               ('rfef', ${at(31)}, ${at(31)}, false, null, '{}'::jsonb, ${at(31)}),
               ('rfef', ${at(32)}, null, false, null, '{}'::jsonb, ${at(32)}),
               ('api-football', ${at(30)}, ${at(30)}, true, ${refAf}, '{}'::jsonb, ${at(30)})`;
      // The raw object of the api-football capture: its created_at wins over opened_at.
      await tx`insert into storage.objects (bucket_id, name, created_at)
        values ('raw', ${refAf.slice(4)}, ${shiftInstant(at(30), 1500)})`;
      await tx`insert into observations (match_id, source_id, status, home_score, away_score,
          minute, observed_at, received_at, raw_ref)
        values (${matchId}, 'rfef', 'live', 1, 0, null, ${at(29)}, ${at(30)}, ${ref}),
               (${matchId}, 'api-football', 'live', 1, 0, 30, ${at(30)}, ${at(30)}, ${refAf}),
               (${matchId}, 'api-football', 'live', 1, 0, 30, ${at(30)}, ${at(30)}, 'raw/none')`;
      // CA-1 (c) publicado: the Decision with the rfef observation as winner.
      const [rfefObs] = await tx<{ id: string }[]>`select id from observations
        where match_id = ${matchId} and source_id = 'rfef'`;
      await tx`insert into decisions (match_id, status, home_score, away_score, minute,
          qualifier, rule, observation_ids, decided_at)
        values (${matchId}, 'live', 1, 0, null, 'provisional', 'RN-01',
          ${[rfefObs.id]}, ${at(30)})`;
      await tx`insert into alerts (kind, match_id, opened_at, resolved_at, details)
        values ('conflict', ${matchId}, ${at(40)}, ${at(42)}, ${tx.json({ winner: { sourceId: "api-football" }, rival: { sourceId: "rfef" } })}),
               ('silence', ${matchId}, ${at(40)}, null, '{}'::jsonb)`;

      const f = await informeRfefFilas(tx, DESDE, HASTA);
      const own = f.matches.filter((m) => m.id === matchId);
      expect(own).toEqual([
        expect.objectContaining({
          competitionId: "tercera-rfef-g1",
          homeTeamId: "test-home",
          awayTeamId: "test-away",
          homeName: "Home",
          round: 12,
          // The board reads the Decision seeded below.
          status: "live",
          score: { home: 1, away: 0 },
        }),
      ]);
      expect(f.seasons).toContain("2026-27");
      const obs = f.observations.filter((o) => o.matchId === matchId);
      const rfef = obs.find((o) => o.sourceId === "rfef");
      expect(rfef).toMatchObject({
        observedAt: at(29),
        receivedAt: at(30),
        recordedAt: shiftInstant(at(30), 700),
      });
      const af = obs.filter((o) => o.sourceId === "api-football");
      expect(af.map((o) => o.recordedAt).sort()).toEqual(
        [shiftInstant(at(30), 1500), null].sort(),
      );
      expect(
        f.alerts.filter((a) => a.matchId === matchId).map((a) => a.kind),
      ).toEqual(["conflict"]);
      expect(f.decisions.filter((d) => d.matchId === matchId)).toEqual([
        {
          matchId,
          version: 1,
          status: "live",
          decidedAt: at(30),
          winnerSourceId: "rfef",
        },
      ]);
      const attempts = f.attempts.filter(
        (a) => a.startedAt >= at(30) && a.startedAt <= at(32),
      );
      expect(attempts.map((a) => [a.sourceId, a.ok, a.fueraDeVentana])).toEqual(
        [
          ["rfef", true, 4],
          ["rfef", false, 0],
          ["rfef", null, 0],
        ],
      );
    }));
});
