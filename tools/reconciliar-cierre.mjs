#!/usr/bin/env node
// SPEC-013 CA-6: the one-off reconciliation of the two matches of the measured
// matchday whose forced finish froze a wrong score (H-1, authorised by Alberto
// Fojo on 2026-09-29). The shell and nothing more: every step is
// src/ingest/reconciliacion.ts. Not a path: the two matches are written here
// and nowhere else, and the run refuses to ask anything once they are no
// longer in forced finish, so it cannot be repeated.
//
// Usage: npm run reconciliar:cierre -- [--aplicar]
//   without --aplicar  prints the plan, the current board, the counts and the
//                      URLs it would ask for, with no request and no write.
//   --aplicar          one ids= capture per match, raw stored before parse
//                      (RN-09), the Observation inserted and the engine hook
//                      run; the engine publishes RN-12.
import { nowInstant } from "../src/clock.ts";
import { createSql } from "../src/db/connect.ts";
import { loadAliasFile } from "../src/ingest/aliases.ts";
import { createIngestDb } from "../src/ingest/db.ts";
import { createEngineHook } from "../src/ingest/engine.ts";
import { reconciliarCierres } from "../src/ingest/reconciliacion.ts";
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

// H-1: these two and no other.
const MATCH_IDS = [
  "segunda-division-2026-27-j7-ceuta-real-sociedad-b",
  "primera-rfef-g1-2026-27-j5-merida-logrones",
];
const SEASON = "2026-27";
const ETIQUETA = "SPEC-013-CA-6";

const args = process.argv.slice(2);
if (args.some((a) => a !== "--aplicar")) {
  console.error("Uso: npm run reconciliar:cierre -- [--aplicar]");
  process.exit(1);
}
const aplicar = args.includes("--aplicar");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const message = (e) => (e instanceof Error ? e.message : String(e));

async function vigentes(sql) {
  return sql`select b.match_id, b.status, b.home_score, b.away_score,
      b.qualifier, b.decision_version, d.rule
    from board b join decisions d on d.id = b.decision_id
    where b.match_id = any(${MATCH_IDS}) order by b.match_id`;
}

async function conteos(sql) {
  const [row] = await sql`select
      (select count(*)::int from decisions) as decisions,
      (select count(*)::int from observations) as observations,
      (select count(*)::int from alerts) as alerts,
      (select count(*)::int from alerts where resolved_at is null) as alerts_abiertas,
      (select count(*)::int from ingest_attempts) as ingest_attempts`;
  return row;
}

const fila = (r) =>
  `  ${r.match_id}  ${r.status} ${r.home_score}-${r.away_score}  ${r.qualifier}  ${r.rule}  v${r.decision_version}`;

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
  }));

  if (!aplicar) {
    // The whole run over doubles: a fetch that records and answers nothing,
    // a store that keeps nothing, a db that writes nothing. It proves the
    // guard and prints the URLs; nothing leaves this machine.
    const urls = [];
    const recording = async (url) => {
      urls.push(String(url));
      return new Response('{"response":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const filas = await reconciliarCierres({
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
    console.log("peticiones que haría:");
    for (const url of urls) console.log(`  ${url}`);
    for (const f of filas)
      console.log(`  ${f.matchId} → fixture ${f.fixtureId}`);
    console.log("En seco: no se ha pedido ni escrito nada (sin --aplicar).");
  } else {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set");
    const filas = await reconciliarCierres({
      matchIds: MATCH_IDS,
      vigentes: planVigentes,
      aliases,
      adapter: createApiFootballResults({ aliases, apiKey }),
      capturar: (fixtureIds) =>
        apiFootballByIds({
          fixtureIds,
          apiKey,
          userAgent: config.userAgent,
          now: nowInstant(),
          fetch,
        }),
      store: createStorageRawStore({ ...rawStoreEnv(process.env), fetch }),
      db: createIngestDb(sql),
      afterInsert: createEngineHook(SOURCES, now),
      now,
      etiqueta: ETIQUETA,
    });
    for (const f of filas)
      console.log(
        `  ${f.matchId}  fixture ${f.fixtureId}  observaciones ${f.observaciones}  raw_ref ${f.rawRef}`,
      );
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
