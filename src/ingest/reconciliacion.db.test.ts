import type { Sql, TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import {
  AliasFile,
  type Instant,
  MINUTE_MS,
  type RawCapture,
  shiftInstant,
} from "@/model";
import { createSql } from "../db/connect.ts";
import { createMemoryRawStore } from "../raw/memory.ts";
import { createApiFootballResults } from "../sources/api-football/results.ts";
import { SOURCES } from "../sources/registry.ts";
import type { IngestTx } from "./db.ts";
import { createIngestDb } from "./db.ts";
import { createEngineHook, decideMatches } from "./engine.ts";
import { reconciliarCierres } from "./reconciliacion.ts";

// SPEC-013 CA-6 against the real schema, always rolled back: a match forced
// closed days ago gets the provider's final through ids=, and the engine —not
// the hand— publishes it with RN-12. decisions grows by exactly one.
const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");

const KICKOFF = "2026-09-26T12:00:00.000Z" as Instant;
const at = (minutes: number): Instant =>
  shiftInstant(KICKOFF, minutes * MINUTE_MS);
// Days after: the window of the match expired long ago (H-1).
const NOW = "2026-09-29T10:00:00.000Z" as Instant;

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

const dbIn = (tx: TransactionSql) =>
  createIngestDb(
    Object.assign(tx, { begin: tx.savepoint.bind(tx) }) as unknown as Sql,
  );

const engineTx = (tx: TransactionSql): IngestTx => ({
  sql: tx,
  insertObservations: () => Promise.reject(new Error("not used here")),
  openUnresolvedAlerts: () => Promise.resolve(0),
});

afterAll(() => sql.end());

describe("SPEC-013 CA-6 the reconciliation through the database", () => {
  it("adds one RN-12 Decision with the provider's final and keeps forced_finish open", () =>
    rollback(async (tx) => {
      const matchId = `segunda-division-2026-27-j99-${crypto.randomUUID()}-test-home-test-away`;
      await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
        on conflict do nothing`;
      await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
        values (${matchId}, 'segunda-division', '2026-27', 99, ${KICKOFF}, 'test-home', 'test-away')`;
      await tx`insert into observations (match_id, source_id, status, home_score,
          away_score, minute, observed_at, received_at, raw_ref)
        values (${matchId}, 'api-football', 'live', 2, 1, 90, ${at(115)}, ${at(115)},
          'raw/api-football/2026-09-26/x.json.gz')`;
      await decideMatches(engineTx(tx), [matchId], at(115), SOURCES);
      await decideMatches(engineTx(tx), [matchId], at(121), SOURCES);

      const aliases = AliasFile.parse({
        source: "api-football",
        season: "2026-27",
        teams: [
          { externalId: "1", externalName: "Home", teamId: "test-home" },
          { externalId: "2", externalName: "Away", teamId: "test-away" },
        ],
        matches: { "990001": matchId },
      });
      const capture = (ids: readonly string[]): RawCapture => ({
        sourceId: "api-football" as RawCapture["sourceId"],
        capturedAt: NOW,
        requests: [
          {
            url: `https://v3.football.api-sports.io/fixtures?ids=${ids.join("-")}`,
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              response: [
                {
                  fixture: {
                    id: 990001,
                    status: { short: "FT", elapsed: 90, extra: null },
                  },
                  league: { id: 141 },
                  teams: {
                    home: { id: 1, name: "Home" },
                    away: { id: 2, name: "Away" },
                  },
                  goals: { home: 3, away: 1 },
                },
              ],
            }),
          },
        ],
      });

      const [before] = await tx`select count(*)::int as n from decisions`;
      const [filas] = await reconciliarCierres({
        matchIds: [matchId],
        vigentes: [
          { matchId, status: "finished", rule: "RN-02", forcedFinish: true },
        ],
        aliases,
        adapter: createApiFootballResults({ aliases, apiKey: "clave" }),
        capturar: async (ids) => capture(ids),
        store: createMemoryRawStore(),
        db: dbIn(tx),
        afterInsert: createEngineHook(SOURCES, NOW),
        now: NOW,
        etiqueta: "SPEC-013-CA-6",
      });
      const [after] = await tx`select count(*)::int as n from decisions`;
      expect(after.n - before.n).toBe(1);

      const [board] = await tx`select b.status, b.home_score, b.away_score,
          b.qualifier, d.rule, d.observation_ids, o.raw_ref
        from board b join decisions d on d.id = b.decision_id
        join observations o on o.id = d.observation_ids[1]
        where b.match_id = ${matchId}`;
      expect(board).toMatchObject({
        status: "finished",
        home_score: 3,
        away_score: 1,
        qualifier: "confirmado",
        rule: "RN-12",
        raw_ref: filas.rawRef,
      });
      const open =
        await tx`select kind, resolved_at from alerts where match_id = ${matchId}`;
      expect(open.map((a) => [a.kind, a.resolved_at])).toEqual([
        ["forced_finish", null],
      ]);
    }));
});
