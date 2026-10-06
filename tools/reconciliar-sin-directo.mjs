#!/usr/bin/env node
// SPEC-018 CA-7: the one-off reconciliation of the two matches of dev that
// the source never gave live and whose final came after +150 (ADR-013 H-6,
// authorised by Alberto Fojo on 2026-10-04, SPEC-018 N-2). The shell and
// nothing more: every step is src/ingest/reconciliacion-sin-directo.ts. Not a
// path: the two matches are written here and nowhere else, and the run
// refuses to ask anything once they are no longer scheduled, so it cannot be
// repeated. If it fails, there is no second request without a new
// authorisation (N-2).
//
// Usage: npm run reconciliar:sin-directo -- [--aplicar]
//   without --aplicar  prints the plan, the current board, the counts and the
//                      URL it would ask for, with no request and no write;
//                      every read is read only with a statement_timeout.
//   --aplicar          ONE ids= request for both, raw stored before parse
//                      (RN-09), the Observations inserted and the engine hook
//                      run; the engine publishes finished provisional RN-01.
import { nowInstant } from "../src/clock.ts";
import { createSql } from "../src/db/connect.ts";
import { loadAliasFile } from "../src/ingest/aliases.ts";
import { createIngestDb } from "../src/ingest/db.ts";
import { createEngineHook } from "../src/ingest/engine.ts";
import { reconciliarSinDirecto } from "../src/ingest/reconciliacion-sin-directo.ts";
import { rawStoreEnv } from "../src/raw/env.ts";
import { createStorageRawStore } from "../src/raw/store.ts";
import {
  apiFootballByIds,
  createApiFootballResults,
} from "../src/sources/api-football/results.ts";
import { SOURCES } from "../src/sources/registry.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

// ADR-013 H-6: these two and no other.
const MATCH_IDS = [
  "segunda-rfef-g1-2026-27-j5-bergantinos-coruxo",
  "tercera-rfef-g1-2026-27-j5-barco-pontevedra-b",
];
const SEASON = "2026-27";
const ETIQUETA = "SPEC-018-CA-7";
const STATEMENT_TIMEOUT = "30s";

const args = process.argv.slice(2);
if (args.some((a) => a !== "--aplicar")) {
  console.error("Uso: npm run reconciliar:sin-directo -- [--aplicar]");
  process.exit(1);
}
const aplicar = args.includes("--aplicar");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const message = (e) => (e instanceof Error ? e.message : String(e));

// Every read in its own read only transaction, with a statement_timeout.
const leer = (sql, query) =>
  sql.begin("read only", async (tx) => {
    await tx.unsafe(`set local statement_timeout = '${STATEMENT_TIMEOUT}'`);
    return query(tx);
  });

const vigentes = (sql) =>
  leer(
    sql,
    (tx) => tx`select b.match_id, b.status, b.kickoff, b.home_score, b.away_score,
      b.qualifier, b.decision_version, d.rule
    from board b left join decisions d on d.id = b.decision_id
    where b.match_id = any(${MATCH_IDS}) order by b.match_id`,
  );

const conteos = async (sql) => {
  const [row] = await leer(
    sql,
    (tx) => tx`select
      (select count(*)::int from decisions) as decisions,
      (select count(*)::int from observations) as observations,
      (select count(*)::int from alerts) as alerts,
      (select count(*)::int from ingest_attempts) as ingest_attempts`,
  );
  return row;
};

const fila = (r) =>
  `  ${r.match_id}  ${r.status} ${r.home_score ?? "-"}-${r.away_score ?? "-"}  ${r.qualifier ?? "-"}  ${r.rule ?? "-"}  v${r.decision_version ?? "-"}`;

const config = SOURCES.find((s) => s.id === "api-football");
const sql = createSql(process.env);
try {
  if (config === undefined) throw new Error("no api-football en el registro");
  const aliases = loadAliasFile(SEASON, config.id);
  const now = nowInstant();

  const antes = await vigentes(sql);
  console.log(`now: ${now}\nboard antes:`);
  for (const r of antes) console.log(fila(r));
  console.log(`conteos antes: ${JSON.stringify(await conteos(sql))}`);

  const planVigentes = antes.map((r) => ({
    matchId: r.match_id,
    status: r.status,
    rule: r.rule,
    kickoff: r.kickoff.toISOString(),
  }));

  if (!aplicar) {
    // The whole run over doubles: a fetch that records and answers nothing,
    // a store that keeps nothing, a db that writes nothing. It proves the
    // guard and prints the URL; nothing leaves this machine.
    const urls = [];
    const recording = async (url) => {
      urls.push(String(url));
      return new Response('{"response":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    try {
      await reconciliarSinDirecto({
        matchIds: MATCH_IDS,
        vigentes: planVigentes,
        aliases,
        adapter: createApiFootballResults({ aliases, apiKey: "en-seco" }),
        capturar: (fixtureIds) =>
          apiFootballByIds({
            fixtureIds,
            apiKey: "en-seco",
            userAgent: config.userAgent,
            now,
            fetch: recording,
          }),
        store: { put: async () => {}, get: async () => null, remove: async () => {} },
        db: {
          transaction: () => {
            throw new Error("en seco no se escribe");
          },
        },
        afterInsert: async () => {},
        now,
        etiqueta: ETIQUETA,
      });
    } catch (e) {
      // The empty answer of the double always ends here once the guard has
      // passed: what matters is the URL it asked for.
      if (urls.length === 0) throw e;
    }
    console.log("petición que haría:");
    for (const url of urls) console.log(`  ${url}`);
    console.log("En seco: no se ha pedido ni escrito nada (sin --aplicar).");
  } else {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set");
    const { rawRef, filas } = await reconciliarSinDirecto({
      matchIds: MATCH_IDS,
      vigentes: planVigentes,
      aliases,
      adapter: createApiFootballResults({ aliases, apiKey }),
      capturar: (fixtureIds) =>
        apiFootballByIds({
          fixtureIds,
          apiKey,
          userAgent: config.userAgent,
          // The engine's now, as in the tick (SPEC-013 CA-6).
          now,
          fetch,
        }),
      store: createStorageRawStore({ ...rawStoreEnv(process.env), fetch }),
      db: createIngestDb(sql),
      afterInsert: createEngineHook(SOURCES, now),
      now,
      etiqueta: ETIQUETA,
    });
    console.log(`raw_ref: ${rawRef}`);
    for (const f of filas)
      console.log(`  ${f.matchId}  fixture ${f.fixtureId}  ${f.status} ${f.marcador}`);
    console.log("board después:");
    for (const r of await vigentes(sql)) console.log(fila(r));
    console.log(`conteos después: ${JSON.stringify(await conteos(sql))}`);
  }
} catch (e) {
  console.error(message(e));
  process.exitCode = 1;
} finally {
  await sql.end();
}
