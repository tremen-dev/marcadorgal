#!/usr/bin/env node
// Replays a measured matchday with the engine of today (SPEC-012 CA-4). The
// shell and nothing more: every number comes from the pure
// src/ingest/replay-jornada.ts, every query from src/ingest/replay-jornada-db.ts.
// Never asks any source for anything: it only reads observations and board.
//
// Usage: npm run replay:jornada -- <desde> <hasta> [--aplicar]
//   <desde> <hasta>  ISO-8601 instants; the matchday of SPEC-009 is
//                    2026-09-25T18:20Z 2026-09-28T21:00Z.
//   --aplicar        adds ONE Decision per divergent finished match, rule RN-02
//                    and decided_at now, in a single transaction. Without it
//                    nothing is written.
import { nowInstant } from "../src/clock.ts";
import { createSql } from "../src/db/connect.ts";
import { replayJornada } from "../src/ingest/replay-jornada.ts";
import {
  aplicarCorrecciones,
  replayJornadaFilas,
  replayPriority,
} from "../src/ingest/replay-jornada-db.ts";
import { SOURCES } from "../src/sources/registry.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const USAGE = "Uso: npm run replay:jornada -- <desde> <hasta> [--aplicar]";

function parseArgs(argv) {
  const positional = [];
  let aplicar = false;
  for (const arg of argv) {
    if (arg === "--aplicar") aplicar = true;
    else if (arg.startsWith("--")) throw new Error(`opción desconocida: ${arg}`);
    else positional.push(arg);
  }
  if (positional.length !== 2) throw new Error("faltan <desde> y <hasta>");
  const [desde, hasta] = positional.map((value) => {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) throw new Error(`'${value}' no es un instante ISO-8601`);
    return new Date(ms).toISOString();
  });
  if (Date.parse(desde) >= Date.parse(hasta))
    throw new Error("<desde> tiene que ser anterior a <hasta>");
  return { desde, hasta, aplicar };
}

const message = (e) => (e instanceof Error ? e.message : String(e));
const marcador = (s) =>
  s === null ? "—" : `${s.status} ${s.score === null ? "—" : `${s.score.home}-${s.score.away}`}`;

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

const sql = createSql(process.env);
try {
  const now = nowInstant();
  const rows = replayJornada({
    ...(await replayJornadaFilas(sql, args.desde, args.hasta)),
    priority: replayPriority(SOURCES),
    now,
  });

  console.log("| matchId | board | replay | diverge |");
  console.log("|---|---|---|---|");
  for (const r of rows)
    console.log(
      `| ${r.matchId} | ${marcador(r.board)} | ${marcador(r.replay)} | ${r.divergent ? (r.correction === null ? "sí (sin corrección)" : "sí") : "no"} |`,
    );
  const corrections = rows.filter((r) => r.correction !== null);
  console.log(
    `\n${rows.length} partidos, ${rows.filter((r) => r.divergent).length} divergen, ${corrections.length} con corrección.`,
  );

  if (!args.aplicar) console.log("En seco: no se ha escrito nada (sin --aplicar).");
  else {
    const counts = await sql.begin(async (tx) => {
      const [before] = await tx`select count(*)::int as n from decisions`;
      const added = await aplicarCorrecciones(tx, rows);
      const [after] = await tx`select count(*)::int as n from decisions`;
      return { before: before.n, added, after: after.n };
    });
    console.log(
      `--aplicar: decisions ${counts.before} → ${counts.after} (+${counts.added}), decided_at ${now}.`,
    );
  }
} catch (e) {
  console.error(message(e));
  process.exitCode = 1;
} finally {
  await sql.end();
}
