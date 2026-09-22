#!/usr/bin/env node
// Writes the matchday report of SPEC-009. The shell and nothing more: it reads
// DATABASE_URL, runs the queries, optionally asks the provider once for the
// contrast, and prints the Markdown. Every number is computed by the pure
// src/ingest/informe.ts, the same split as src/ingest/salud.ts +
// tools/tick-salud.mjs.
//
// Usage: npm run informe:jornada -- <desde> <hasta> [--referencias <fichero>] [--contrastar]
//   <desde> <hasta>    ISO-8601 instants; the window of N-1 is
//                      2026-09-25T18:20Z 2026-09-28T21:00Z.
//   --referencias <f>  referencias.csv of CA-3 (matchId,marcador,instante,fuente).
//                      An empty file is fine: the block prints with n = 0.
//   --contrastar       one round of ids= against the provider (CA-5), once, when
//                      the matchday is over and outside every window (RN-08).
//   --salida <f>       where to write it; by default it only prints.
import { readFileSync, writeFileSync } from "node:fs";
import { nowInstant } from "../src/clock.ts";
import { createSql } from "../src/db/connect.ts";
import { loadAliasFile } from "../src/ingest/aliases.ts";
import { contrastarMarcadores } from "../src/ingest/contraste.ts";
import { informeJornada, parseReferencias } from "../src/ingest/informe.ts";
import { informeFilas } from "../src/ingest/informe-db.ts";
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

const USAGE =
  "Uso: npm run informe:jornada -- <desde> <hasta> [--referencias <fichero>] [--contrastar] [--salida <fichero>]";

function parseArgs(argv) {
  const positional = [];
  const flags = { contrastar: false, referencias: null, salida: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--contrastar") flags.contrastar = true;
    else if (arg === "--referencias" || arg === "--salida") {
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
    // Normalised to UTC with Z: the model has no other spelling (D-9).
    return new Date(ms).toISOString();
  });
  if (Date.parse(desde) >= Date.parse(hasta))
    throw new Error("<desde> tiene que ser anterior a <hasta>");
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

// Every value that must never appear in the report, whatever row carried it.
const secrets = [
  process.env.API_FOOTBALL_KEY,
  process.env.DATABASE_URL,
  process.env.INGEST_TICK_TOKEN,
  process.env.CRON_SECRET,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
].filter((v) => typeof v === "string" && v.length > 0);

// The five competitions of D-3, taken from the registry and not written here
// again: the report counts how many of them a matchday actually measured.
const competicionesDeclaradas = [
  ...new Set(SOURCES.flatMap((s) => s.competitions)),
];

// An absent file and an empty file are the same thing (CA-1): no rows.
function leeReferencias(file) {
  if (file === null) return { filas: [], noCasadas: [] };
  let csv;
  try {
    csv = readFileSync(file, "utf8");
  } catch {
    throw new Error(`no se pudo leer ${file}`);
  }
  return parseReferencias(csv);
}

const sql = createSql(process.env);
try {
  const filas = await informeFilas(sql, args.desde, args.hasta);
  const { filas: referencias, noCasadas } = leeReferencias(args.referencias);

  let contraste = null;
  let contrastePeticiones = 0;
  if (args.contrastar) {
    const config = SOURCES.find((s) => s.id === "api-football");
    if (config === undefined) throw new Error("no api-football en el registro");
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey)
      throw new Error(
        "API_FOOTBALL_KEY is not set: --contrastar necesita la clave",
      );

    // The alias file is per season, so the matchday is asked season by season
    // (a round almost always is one, but the window does not promise it).
    const seasonRows = await sql`select match_id, season from board
      where kickoff >= ${args.desde} and kickoff <= ${args.hasta}`;
    const season = new Map(seasonRows.map((r) => [r.match_id, r.season]));
    contraste = [];
    for (const temporada of [...new Set(season.values())].sort()) {
      const aliases = loadAliasFile(temporada, config.id);
      const salida = await contrastarMarcadores({
        matches: filas.matches.filter((m) => season.get(m.id) === temporada),
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
      });
      contraste.push(...salida.filas);
      contrastePeticiones += salida.peticiones;
      for (const id of salida.sinAlias)
        console.error(`aviso: ${id} no tiene alias de fixture y no se contrastó`);
    }
  }

  const { texto } = informeJornada({
    desde: args.desde,
    hasta: args.hasta,
    secrets,
    competicionesDeclaradas,
    ...filas,
    referencias,
    referenciasNoCasadas: noCasadas,
    contraste,
    contrastePeticiones,
  });
  if (args.salida !== null) {
    writeFileSync(args.salida, `${texto}\n`);
    console.error(`escrito en ${args.salida}`);
  } else console.log(texto);
} catch (e) {
  console.error(message(e));
  process.exitCode = 1;
} finally {
  await sql.end();
}
