#!/usr/bin/env node
// Runs one ingest tick with the same core as POST /api/ingest/tick, without
// HTTP: to verify and to measure (ADR-008 §9).
//
// Usage: npm run ingest:tick -- [--dry-run]
//   --dry-run  prints the matches in window per source and season and the URLs
//              the adapter would ask for, without opening an attempt and
//              without touching Storage.
import { nowInstant } from "../src/clock.ts";
import { createSql } from "../src/db/connect.ts";
import { adapterFor } from "../src/ingest/adapters.ts";
import { createIngestDb } from "../src/ingest/db.ts";
import { createEngineHook, createEngineSweep } from "../src/ingest/engine.ts";
import { runTick } from "../src/ingest/tick.ts";
import { rawStoreEnv } from "../src/raw/env.ts";
import { createStorageRawStore } from "../src/raw/store.ts";
import { SOURCES } from "../src/sources/registry.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== "--dry-run");
if (unknown.length > 0) {
  console.error("Uso: npm run ingest:tick -- [--dry-run]");
  process.exit(1);
}
const dryRun = args.includes("--dry-run");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const message = (e) => (e instanceof Error ? e.message : String(e));

// Only the keys of WindowMatch: the adapter never sees the current status.
const windowMatch = ({ id, competitionId, season, kickoff, homeTeamId, awayTeamId }) =>
  ({ id, competitionId, season, kickoff, homeTeamId, awayTeamId });

function pullPairs(matches) {
  const seasons = [...new Set(matches.map((m) => m.season))].sort();
  const pairs = [];
  for (const config of SOURCES) {
    if (config.kind !== "pull") continue;
    const covered = new Set(config.competitions);
    for (const season of seasons) {
      const own = matches.filter(
        (m) => m.season === season && covered.has(m.competitionId),
      );
      if (own.length > 0) pairs.push({ config, season, own });
    }
  }
  return pairs;
}

async function dryRunReport(db, now) {
  const matches = await db.windowMatches(now);
  console.log(`now: ${now}`);
  console.log(`partidos en ventana: ${matches.length}`);
  for (const { config, season, own } of pullPairs(matches)) {
    console.log(`\n${config.id} · ${season} · ${own.length} partido(s)`);
    for (const m of own)
      console.log(`  ${m.kickoff}  ${m.competitionId}  ${m.id}  [${m.status}]`);

    // A fetch that records and answers an empty body: no request leaves here.
    const urls = [];
    const recording = async (url) => {
      urls.push(String(url));
      return new Response('{"response":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    try {
      const adapter = adapterFor(config, season, process.env);
      await adapter.fetch({
        now,
        competitions: config.competitions.filter((c) =>
          own.some((m) => m.competitionId === c),
        ),
        matches: own.map(windowMatch),
        fetch: recording,
        userAgent: config.userAgent,
      });
    } catch (e) {
      console.log(`  error: ${message(e)}`);
    }
    console.log("  peticiones que haría:");
    for (const url of urls) console.log(`    ${url}`);
    if (urls.length === 0) console.log("    (ninguna)");
  }
}

const now = nowInstant();
const sql = createSql(process.env);
const db = createIngestDb(sql);
try {
  if (dryRun) {
    await dryRunReport(db, now);
  } else {
    const summary = await runTick({
      db,
      store: createStorageRawStore({ ...rawStoreEnv(process.env), fetch }),
      sources: SOURCES,
      adapterFor: (config, season) => adapterFor(config, season, process.env),
      fetch,
      now,
      afterInsert: createEngineHook(SOURCES, now),
      sweep: createEngineSweep(db, SOURCES, now),
    });
    console.log(JSON.stringify(summary, null, 2));
  }
} catch (e) {
  console.error(message(e));
  process.exitCode = 1;
} finally {
  await sql.end();
}
