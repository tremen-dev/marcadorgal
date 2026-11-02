#!/usr/bin/env node
// The rfef report of SPEC-039 CA-1. The shell and nothing more: it reads
// DATABASE_URL (read only), the exports of explorer and the external evidence
// the owner saved in _qa/SPEC-039/, and writes one page of Markdown. Every
// number comes from the pure src/ingest/informe-rfef.ts. Zero requests: not to
// explorer, not to the RFEF, not to API-Football.
//
// Usage: npm run informe:rfef -- <desde> <hasta> [--export <f…>] [--acta <f…>] [--evidencia <f>] [--salida <f>]
//   <desde> <hasta>  ISO-8601 instants: the matchday is every match whose
//                    kickoff falls between them.
//   --export <f…>    exports of explorer taken at the close of each day
//                    (GET /api/export/matches?date=…): strategy and
//                    discardedReadings (CA-1 f). The newest per date counts.
//   --acta <f…>      the same dates exported the day after: FINISHED is the
//                    closed acta (CA-2).
//   --evidencia <f>  JSON with explorer's figures at the close and the log of
//                    manual interventions (CA-3, CA-4 iii/v). Without it both
//                    conditions fail: never 50 by omission.
//   --salida <f>     by default docs/epicas/EPIC-004-fuente-rfef/_qa/SPEC-039/<fecha>-informe.md
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createSql } from "../src/db/connect.ts";
import { loadAliasFile } from "../src/ingest/aliases.ts";
import { REDACTED, secretosDelEntorno } from "../src/ingest/informe.ts";
import { informeRfef, parseEvidencia } from "../src/ingest/informe-rfef.ts";
import { informeRfefFilas } from "../src/ingest/informe-rfef-db.ts";
import { SOURCES } from "../src/sources/registry.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const QA_DIR = "docs/epicas/EPIC-004-fuente-rfef/_qa/SPEC-039";
const USAGE =
  "Uso: npm run informe:rfef -- <desde> <hasta> [--export <f…>] [--acta <f…>] [--evidencia <f>] [--salida <f>]";

function parseArgs(argv) {
  const positional = [];
  const flags = { export: [], acta: [], evidencia: null, salida: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--export" || arg === "--acta") {
      const list = flags[arg.slice(2)];
      while (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) {
        list.push(argv[i + 1]);
        i += 1;
      }
      if (list.length === 0) throw new Error(`${arg} necesita ficheros`);
    } else if (arg === "--evidencia" || arg === "--salida") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--"))
        throw new Error(`${arg} necesita un fichero`);
      flags[arg.slice(2)] = value;
      i += 1;
    } else if (arg.startsWith("--")) throw new Error(`opción desconocida: ${arg}`);
    else positional.push(arg);
  }
  // With --export/--acta greedy, the instants must come first.
  if (positional.length !== 2) throw new Error("faltan <desde> y <hasta>");
  const [desde, hasta] = positional.map((value) => {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) throw new Error(`'${value}' no es un instante ISO-8601`);
    return new Date(ms).toISOString();
  });
  if (desde >= hasta) throw new Error("<desde> tiene que ser anterior a <hasta>");
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

const leer = (f) => ({ fichero: path.basename(f), contenido: readFileSync(f, "utf8") });
const competiciones = [...new Set(SOURCES.flatMap((s) => s.competitions))];
const secrets = secretosDelEntorno(process.env);

const sql = createSql(process.env);
try {
  const filas = await informeRfefFilas(sql, args.desde, args.hasta);
  if (filas.seasons.length > 1)
    throw new Error(`la jornada cruza temporadas: ${filas.seasons.join(", ")}`);
  const season = filas.seasons[0] ?? "2026-27";
  const { texto, avisos } = informeRfef({
    desde: args.desde,
    hasta: args.hasta,
    competiciones,
    matches: filas.matches,
    observations: filas.observations,
    alerts: filas.alerts,
    attempts: filas.attempts,
    exportsDelDia: args.export.map(leer),
    exportsActa: args.acta.map(leer),
    aliases: loadAliasFile(season, "rfef"),
    evidencia:
      args.evidencia === null
        ? null
        : parseEvidencia(readFileSync(args.evidencia, "utf8")),
  });
  // ingest_attempts.error and alerts.details travel as they came (as in
  // informe:jornada): no value of the environment reaches the page.
  let limpio = texto;
  for (const s of secrets) limpio = limpio.replaceAll(s, REDACTED);
  const salida =
    args.salida ?? path.join(QA_DIR, `${args.desde.slice(0, 10)}-informe.md`);
  mkdirSync(path.dirname(salida), { recursive: true });
  writeFileSync(salida, `${limpio}\n`);
  for (const a of avisos) console.error(`aviso: ${a}`);
  if (args.export.length === 0) console.error("aviso: sin --export, (f) y (iv) quedan sin filas");
  if (args.acta.length === 0) console.error("aviso: sin --acta, todo partido queda sin acta");
  if (args.evidencia === null) console.error("aviso: sin --evidencia, (iii) y (v) no se cumplen");
  console.error(`escrito en ${salida} (0 peticiones a explorer ni a proveedores)`);
} catch (e) {
  console.error(message(e));
  process.exitCode = 1;
} finally {
  await sql.end();
}
