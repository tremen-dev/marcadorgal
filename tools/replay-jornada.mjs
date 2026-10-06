#!/usr/bin/env node
// Replays a measured matchday with the engine of today (SPEC-012 CA-4). The
// shell and nothing more: every number comes from the pure
// src/ingest/replay-jornada.ts, every query from src/ingest/replay-jornada-db.ts.
// Never asks any source for anything: it only reads observations and board.
//
// SPEC-014 CA-6: it also replays with the engine of main before ADR-011
// (frozen at 11a7159, a fixture) and prints, per match and in total, the live
// ticks in which the published score is not the source's, with both engines.
// Without --aplicar every read runs in one read only transaction with a
// statement_timeout, and the count of decisions is printed before and after.
//
// Usage: npm run replay:jornada -- <desde> <hasta> [--aplicar]
//   <desde> <hasta>  ISO-8601 instants; the matchday of SPEC-009 is
//                    2026-09-25T18:20Z 2026-09-28T21:00Z.
//   --aplicar        adds ONE Decision per divergent finished match, rule RN-02
//                    and decided_at now, in a single transaction. Without it
//                    nothing is written.
import { nowInstant } from "../src/clock.ts";
import { createSql } from "../src/db/connect.ts";
import { decide as decideAt11a7159 } from "../src/decide/fixtures/engine-11a7159.ts";
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

// No statement of a dry run may hang the shell (SPEC-014 CA-6).
const STATEMENT_TIMEOUT = "120s";

const sql = createSql(process.env);
try {
  const now = nowInstant();
  const read = async (tx) => {
    await tx.unsafe(`set local statement_timeout = '${STATEMENT_TIMEOUT}'`);
    const [count] = await tx`select count(*)::int as n from decisions`;
    const filas = await replayJornadaFilas(tx, args.desde, args.hasta);
    return { decisions: count.n, filas };
  };
  // The reads are read only with or without --aplicar: the only write is
  // aplicarCorrecciones, in its own transaction below.
  const { decisions: before, filas } = await sql.begin("read only", read);
  console.error(
    `leídos ${filas.matches.length} partidos y ${filas.observations.length} observaciones; decisions = ${before}`,
  );
  const priority = replayPriority(SOURCES);
  const rows = replayJornada({ ...filas, priority, now });
  const main = new Map(
    replayJornada({ ...filas, priority, now, engine: decideAt11a7159 }).map(
      (r) => [r.matchId, r.liveTicks],
    ),
  );

  console.log("| matchId | board | replay | diverge | ticks live ≠ fuente (main → ADR-011) |");
  console.log("|---|---|---|---|---|");
  for (const r of rows)
    console.log(
      `| ${r.matchId} | ${marcador(r.board)} | ${marcador(r.replay)} | ${r.divergent ? (r.correction === null ? "sí (sin corrección)" : "sí") : "no"} | ${main.get(r.matchId)} → ${r.liveTicks} |`,
    );
  const corrections = rows.filter((r) => r.correction !== null);
  const total = (values) => values.reduce((a, b) => a + b, 0);
  console.log(
    `\n${rows.length} partidos, ${rows.filter((r) => r.divergent).length} divergen, ${corrections.length} con corrección.`,
  );
  console.log(
    `Ticks live con el marcador publicado distinto del de la fuente: ${total([...main.values()])} (motor de main, 11a7159) → ${total(rows.map((r) => r.liveTicks))} (motor de ADR-011), en ${rows.filter((r) => (main.get(r.matchId) ?? 0) > 0).length} → ${rows.filter((r) => r.liveTicks > 0).length} partidos.`,
  );

  if (!args.aplicar) {
    const [after] = await sql.begin("read only", async (tx) => {
      await tx.unsafe(`set local statement_timeout = '${STATEMENT_TIMEOUT}'`);
      return tx`select count(*)::int as n from decisions`;
    });
    console.log(
      `En seco: no se ha escrito nada (sin --aplicar). decisions ${before} → ${after.n}.`,
    );
  } else {
    const counts = await sql.begin(async (tx) => {
      const [b] = await tx`select count(*)::int as n from decisions`;
      const added = await aplicarCorrecciones(tx, rows);
      const [a] = await tx`select count(*)::int as n from decisions`;
      return { before: b.n, added, after: a.n };
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
