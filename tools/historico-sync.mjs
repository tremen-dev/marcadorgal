#!/usr/bin/env node
// Back-fill of the matchdays already played from Explorer (SPEC-060,
// ADR-031): a manual tool the titular runs after reviewing the dry run, never
// periodic. The shell and nothing more: the plan and the report are
// src/ingest/historico.ts and every statement src/ingest/historico-db.ts.
// Per date: one attempt of the operator, the raw of Explorer stored before it
// is parsed (the seven days of its window ±3, SPEC-071), and the operator
// observations + the engine at the instant of
// the reading + the goals, in one transaction. No Decision is written here.
//
// Usage: npm run historico:sync -- [--desde <YYYY-MM-DD>] [--hasta <YYYY-MM-DD>] [--dry-run]
//   --desde    default 2026-08-14
//   --hasta    default yesterday (Europe/Madrid); today or later is refused
//   --dry-run  the same GETs and the same report; writes no row and no raw
// Exit != 0 if any date failed (listed at the end) or a 401/403 aborted.
import { seasonOf } from "../src/board/current.ts";
import { nowInstant } from "../src/clock.ts";
import { createSql } from "../src/db/connect.ts";
import { loadAliasFile } from "../src/ingest/aliases.ts";
import { createIngestDb } from "../src/ingest/db.ts";
import {
  formatHistoricoReport,
  HISTORICO_USAGE,
  historicoFailed,
  parseHistoricoArgs,
} from "../src/ingest/historico.ts";
import { historicoSync } from "../src/ingest/historico-db.ts";
import { getDayMatchesRaw } from "../src/lib/explorer-client.ts";
import { rawStoreEnv } from "../src/raw/env.ts";
import { createStorageRawStore } from "../src/raw/store.ts";
import { SOURCES } from "../src/sources/registry.ts";

for (const envFile of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(envFile);
    break;
  } catch {
    // continue
  }
}

const message = (e) => (e instanceof Error ? e.message : String(e));

let args;
try {
  args = parseHistoricoArgs(process.argv.slice(2), nowInstant());
} catch (e) {
  console.error(`${message(e)}\n${HISTORICO_USAGE}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = createSql(process.env);
try {
  const report = await historicoSync({
    sql,
    db: createIngestDb(sql),
    store: args.dryRun
      ? null
      : createStorageRawStore({ ...rawStoreEnv(process.env), fetch }),
    fetchDay: (date) => getDayMatchesRaw(date),
    // SPEC-070: the identity of the rfef adapter, alias of the season of
    // each date (codGrupo -> competition, name -> team).
    aliasesFor: (date) => loadAliasFile(seasonOf(`${date}T12:00:00Z`), "rfef"),
    clock: nowInstant,
    sources: SOURCES,
    args,
    progress: (line) => console.error(`[historico:sync] ${line}`),
  });

  console.log(
    `historico:sync ${args.desde} → ${args.hasta}${args.dryRun ? " (en seco: no se escribe nada)" : ""} · ${report.datesProcessed} fechas con partidos`,
  );
  for (const line of formatHistoricoReport(report)) console.log(line);
  if (historicoFailed(report)) process.exitCode = 1;
} catch (e) {
  console.error(message(e));
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
