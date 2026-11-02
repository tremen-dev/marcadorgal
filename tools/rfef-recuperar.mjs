#!/usr/bin/env node
// Recovers the finals the rfef has for the declared matches of a range of
// Europe/Madrid dates (SPEC-044 CA-6, ADR-025 §6): a path, not an exception.
// The shell and nothing more: the plan is src/ingest/recuperacion-rfef.ts and
// every statement src/ingest/recuperacion-rfef-db.ts. It asks only explorer
// (a service of our own, ADR-023 §3), through the registered adapter of the
// rfef, under its cadence, with one attempt and one raw capture like any
// tick (RN-08, RN-09). Never marcadores.rfef.es.
//
// Usage: npm run rfef:recuperar -- --desde <YYYY-MM-DD> --hasta <YYYY-MM-DD> [--dry-run]
//   --desde, --hasta  Europe/Madrid dates, inclusive, at most seven days.
//   --dry-run         GET, raw and attempt (dryRun: true), prints the plan and
//                     inserts, decides and alerts nothing.
//   without it        plan + insert + engine at the hour of the observation
//                     + conflict alerts for closed matches, in ONE
//                     transaction; prints the counts before and after.
import { nowInstant } from "../src/clock.ts";
import { createSql } from "../src/db/connect.ts";
import { adapterFor } from "../src/ingest/adapters.ts";
import { createIngestDb } from "../src/ingest/db.ts";
import {
  parseRecoveryArgs,
  RECOVERY_USAGE,
} from "../src/ingest/recuperacion-rfef.ts";
import { recuperarRfef } from "../src/ingest/recuperacion-rfef-db.ts";
import { rawStoreEnv } from "../src/raw/env.ts";
import { createStorageRawStore } from "../src/raw/store.ts";
import { madridDateOf } from "../src/sources/rfef/explorer.ts";
import { SOURCES, sourceConfig } from "../src/sources/registry.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const message = (e) => (e instanceof Error ? e.message : String(e));

let args;
try {
  args = parseRecoveryArgs(process.argv.slice(2));
} catch (e) {
  console.error(`${message(e)}\n${RECOVERY_USAGE}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const config = sourceConfig("rfef");
if (config === undefined) {
  console.error("no rfef en el registro");
  process.exit(1);
}

const counts = (c) =>
  `decisions ${c.decisions} · observations (rfef) ${c.observationsRfef} · alerts ${c.alerts} · ingest_attempts (rfef) ${c.attemptsRfef}`;

const sql = createSql(process.env);
try {
  const result = await recuperarRfef({
    sql,
    db: createIngestDb(sql),
    store: createStorageRawStore({ ...rawStoreEnv(process.env), fetch }),
    adapterFor: (c, season) => adapterFor(c, season, process.env),
    config,
    sources: SOURCES,
    fetch,
    clock: nowInstant,
    desde: args.desde,
    hasta: args.hasta,
    dryRun: args.dryRun,
  });

  console.log(
    `rfef:recuperar ${args.desde} → ${args.hasta}${args.dryRun ? " (en seco)" : ""}`,
  );
  const byDate = new Map();
  for (const c of result.candidates) {
    const day = madridDateOf(c.kickoff);
    byDate.set(day, (byDate.get(day) ?? 0) + 1);
  }
  console.log(
    `partidos declarados: ${result.candidates.length}` +
      [...byDate].map(([d, n]) => ` · ${d}: ${n}`).join(""),
  );

  if (result.outcome === "sin-partidos") {
    console.log("Nada que pedir: ningún partido declarado en el rango.");
  } else if (result.outcome === "ocupado") {
    console.error(
      `La cadencia de la rfef no dejó hueco en ${Math.round(result.waitedMs / 1000)} s: no se ha pedido nada.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`raw_ref: ${result.rawRef} (${result.requests} GET)`);
    console.log("\nplan (partido · vigente → propuesto · acción):");
    for (const line of result.lines) console.log(`  ${line}`);
    if (result.lines.length === 0) console.log("  (sin observaciones)");
    const d = result.plan.dropped;
    console.log(
      `\ninsertar ${result.plan.insert.length} · decidir ${result.plan.groups.flatMap((g) => g.matchIds).length} partidos en ${result.plan.groups.length} instantes · duplicadas ${d.duplicate} · en ventana ${d.inWindow} · live descartados ${d.live} · fuera del rango ${result.fueraDeRango}` +
        ` · cerrados: ${result.plan.closed.filter((c) => c.agrees).length} coinciden, ${result.plan.closed.filter((c) => !c.agrees).length} discrepan`,
    );
    console.log(`\nantes:   ${counts(result.before)}`);
    console.log(`después: ${counts(result.after)}`);
    if (result.outcome === "en-seco") {
      console.log(
        "En seco: GET, crudo e intento hechos; no se ha insertado, decidido ni alertado nada (sin --dry-run se aplicaría).",
      );
    } else {
      const e = result.decided;
      console.log(
        `Aplicado: ${e.decisions} Decisions sobre ${e.matches} partidos, ${result.alertsOpened} alertas conflict abiertas, ${result.plan.insert.length} observaciones insertadas.`,
      );
    }
  }
} catch (e) {
  console.error(message(e));
  process.exitCode = 1;
} finally {
  await sql.end();
}
