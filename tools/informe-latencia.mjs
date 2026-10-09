#!/usr/bin/env node
// The latency report of SPEC-025 CA-5. The shell and nothing more: it reads
// DATABASE_URL (read only), the stored raw captures it needs from Storage
// (GET only, ADR-007: never the provider, zero new requests), the probe's
// JSONL and the owner's calibration CSV, and writes one page of Markdown.
// Every number comes from the pure src/medicion/*.ts.
//
// Usage: npm run informe:latencia -- <desde> <hasta> --sonda <jsonl…> [--calibracion <csv>] [--salida <f>]
//   <desde> <hasta>   ISO-8601 instants: the matchday is every match whose
//                     kickoff falls between them.
//   --sonda <f…>      one or more JSONL of tools/sonda-pantalla.mjs (the
//                     artifacts of the workflow sonda-pantalla).
//   --calibracion <f> matchId,gol,instante[,nota] (H-1); optional.
//   --salida <f>      by default docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-025/latencia-<fecha>.md
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createSql } from "../src/db/connect.ts";
import { loadAliasFile } from "../src/ingest/aliases.ts";
import { generarInforme } from "../src/medicion/generar-informe.ts";
import { rawStoreEnv } from "../src/raw/env.ts";
import { createStorageRawStore } from "../src/raw/store.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const QA_DIR = "docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-025";
const USAGE =
  "Uso: npm run informe:latencia -- <desde> <hasta> --sonda <jsonl…> [--calibracion <csv>] [--salida <fichero>]";

function parseArgs(argv) {
  const positional = [];
  const flags = { sonda: [], calibracion: null, salida: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--sonda") {
      while (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) {
        flags.sonda.push(argv[i + 1]);
        i += 1;
      }
      if (flags.sonda.length === 0) throw new Error("--sonda necesita ficheros");
    } else if (arg === "--calibracion" || arg === "--salida") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--"))
        throw new Error(`${arg} necesita un fichero`);
      flags[arg.slice(2)] = value;
      i += 1;
    } else if (arg.startsWith("--")) throw new Error(`opción desconocida: ${arg}`);
    else positional.push(arg);
  }
  if (positional.length !== 2) throw new Error("faltan <desde> y <hasta>");
  const [desde, hasta] = positional.map((value) => {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) throw new Error(`'${value}' no es un instante ISO-8601`);
    return new Date(ms).toISOString();
  });
  if (desde >= hasta) throw new Error("<desde> tiene que ser anterior a <hasta>");
  if (flags.sonda.length === 0) throw new Error("falta --sonda <jsonl…>");
  return { desde, hasta, ...flags };
}

const message = (e) => (e instanceof Error ? e.message : String(e));

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (e) {
  console.error(`${message(e)}\n${USAGE}`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sondas = args.sonda.map((f) => ({
  fichero: path.basename(f),
  texto: readFileSync(f, "utf8"),
}));
const calibracionCsv =
  args.calibracion === null ? null : readFileSync(args.calibracion, "utf8");

const sql = createSql(process.env);
try {
  const { texto, crudosLeidos, crudosAusentes } = await generarInforme({
    sql,
    store: createStorageRawStore({ ...rawStoreEnv(process.env), fetch }),
    aliasFor: (season) => loadAliasFile(season, "api-football"),
    desde: args.desde,
    hasta: args.hasta,
    sondas,
    calibracionCsv,
  });
  for (const rawRef of crudosAusentes)
    console.error(`aviso: ${rawRef} ya no está en storage (retención 30 días)`);
  const salida =
    args.salida ?? path.join(QA_DIR, `latencia-${args.desde.slice(0, 10)}.md`);
  mkdirSync(path.dirname(salida), { recursive: true });
  writeFileSync(salida, `${texto}\n`);
  console.error(
    `escrito en ${salida} (${crudosLeidos} crudos leídos, 0 peticiones al proveedor)`,
  );
} catch (e) {
  console.error(message(e));
  process.exitCode = 1;
} finally {
  await sql.end();
}
