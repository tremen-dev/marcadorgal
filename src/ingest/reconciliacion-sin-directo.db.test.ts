import { readFileSync } from "node:fs";
import type { Sql, TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import type { Instant, MatchStatus } from "@/model";
import { createSql } from "../db/connect.ts";
import { createMemoryRawStore } from "../raw/memory.ts";
import {
  apiFootballByIds,
  createApiFootballResults,
} from "../sources/api-football/results.ts";
import { SOURCES } from "../sources/registry.ts";
import { loadAliasFile } from "./aliases.ts";
import { createIngestDb, type IngestTx } from "./db.ts";
import { createEngineHook, decideMatches } from "./engine.ts";
import { reconciliarSinDirecto } from "./reconciliacion-sin-directo.ts";

// SPEC-018 CA-7 against the real schema, always rolled back: the two matches
// of dev, seeded as dev has them (scheduled provisional RN-01, window closed
// days ago), get their final through one ids= request answered by a fetch
// double with the H-5 body, and the engine —not the hand— publishes finished
// provisional RN-01. decisions grows by exactly two.
const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");
const NOW = "2026-10-06T20:00:00.000Z" as Instant;

const H5 = JSON.parse(
  readFileSync(
    new URL(
      "../../docs/epicas/EPIC-002-ingesta-y-motor/_qa/fuente-sin-directo/h5-2026-10-04T18-56-20.580Z.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { body: string };

const MATCHES = [
  {
    id: "segunda-rfef-g1-2026-27-j5-bergantinos-coruxo",
    competition: "segunda-rfef-g1",
    tier: 4,
    home: "bergantinos",
    away: "coruxo",
    kickoff: "2026-10-04T15:00:00.000Z" as Instant,
  },
  {
    id: "tercera-rfef-g1-2026-27-j5-barco-pontevedra-b",
    competition: "tercera-rfef-g1",
    tier: 5,
    home: "barco",
    away: "pontevedra-b",
    kickoff: "2026-10-04T15:30:00.000Z" as Instant,
  },
];

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

describe("SPEC-018 CA-7 the two matches of dev through the database", () => {
  it("one ids= request, decisions + 2, board 3-1 and 1-0 finished provisional RN-01, and no second run", () =>
    rollback(async (tx) => {
      for (const m of MATCHES) {
        await tx`insert into competitions (id, season, name, tier)
          values (${m.competition}, '2026-27', ${m.competition}, ${m.tier})
          on conflict do nothing`;
        await tx`insert into teams (id, name)
          values (${m.home}, ${m.home}), (${m.away}, ${m.away})
          on conflict do nothing`;
        await tx`insert into matches (id, competition_id, season, round, kickoff,
            home_team_id, away_team_id)
          values (${m.id}, ${m.competition}, '2026-27', 5, ${m.kickoff},
            ${m.home}, ${m.away})`;
        // As dev has them: NS from kickoff − 10, one Decision scheduled RN-01.
        const ns = new Date(Date.parse(m.kickoff) - 10 * 60_000).toISOString();
        await tx`insert into observations (match_id, source_id, status,
            observed_at, received_at, raw_ref)
          values (${m.id}, 'api-football', 'scheduled', ${ns}, ${ns},
            'raw/api-football/2026-10-04/x.json.gz')`;
        await decideMatches(engineTx(tx), [m.id], ns as Instant, SOURCES);
      }
      const ids = MATCHES.map((m) => m.id);
      const vigentes = async () =>
        (
          await tx<
            {
              match_id: string;
              status: MatchStatus;
              kickoff: Date;
              rule: string | null;
            }[]
          >`select b.match_id, b.status, b.kickoff, d.rule
            from board b left join decisions d on d.id = b.decision_id
            where b.match_id = any(${ids}) order by b.match_id`
        ).map((r) => ({
          matchId: r.match_id,
          status: r.status,
          kickoff: r.kickoff.toISOString() as Instant,
          rule: r.rule as "RN-01" | null,
        }));

      const aliases = loadAliasFile("2026-27", "api-football");
      const urls: string[] = [];
      const fetch = (async (url: string) => {
        urls.push(String(url));
        return new Response(H5.body, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof globalThis.fetch;
      const run = async () =>
        reconciliarSinDirecto({
          matchIds: ids,
          vigentes: await vigentes(),
          aliases,
          adapter: createApiFootballResults({ aliases, apiKey: "clave" }),
          capturar: (fixtureIds) =>
            apiFootballByIds({
              fixtureIds,
              apiKey: "clave",
              userAgent: "marcador.gal test",
              now: NOW,
              fetch,
            }),
          store: createMemoryRawStore(),
          db: dbIn(tx),
          afterInsert: createEngineHook(SOURCES, NOW),
          now: NOW,
          etiqueta: "SPEC-018-CA-7",
        });

      const [before] = await tx`select count(*)::int as n from decisions`;
      const { rawRef } = await run();
      const [after] = await tx`select count(*)::int as n from decisions`;
      expect(after.n - before.n).toBe(2);
      expect(urls).toEqual([
        "https://v3.football.api-sports.io/fixtures?ids=1572068-1612741",
      ]);

      const board = await tx`select b.match_id, b.status, b.home_score,
          b.away_score, b.qualifier, d.rule, d.forced_finish, o.raw_ref
        from board b join decisions d on d.id = b.decision_id
        join observations o on o.id = d.observation_ids[1]
        where b.match_id = any(${ids}) order by b.match_id`;
      expect(board).toEqual([
        {
          match_id: "segunda-rfef-g1-2026-27-j5-bergantinos-coruxo",
          status: "finished",
          home_score: 3,
          away_score: 1,
          qualifier: "provisional",
          rule: "RN-01",
          forced_finish: false,
          raw_ref: rawRef,
        },
        {
          match_id: "tercera-rfef-g1-2026-27-j5-barco-pontevedra-b",
          status: "finished",
          home_score: 1,
          away_score: 0,
          qualifier: "provisional",
          rule: "RN-01",
          forced_finish: false,
          raw_ref: rawRef,
        },
      ]);
      const alerts =
        await tx`select kind from alerts where match_id = any(${ids})`;
      expect(alerts).toEqual([]);

      // Not a path: once finished, a second run asks nothing.
      await expect(run()).rejects.toThrow(/no está en scheduled/);
      expect(urls).toHaveLength(1);
    }));
});
