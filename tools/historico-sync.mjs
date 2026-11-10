#!/usr/bin/env node
// tools/historico-sync.mjs (SPEC-060 CA-2)
// Ingesta e sincronización histórica de resultados finais e goleadores.
// One-time back-fill tool: execución manual para consolidar datos desde a
// xornada 1 ata a data actual sen custo engadido.
//
// Usage: npm run historico:sync -- [--desde <YYYY-MM-DD>] [--hasta <YYYY-MM-DD>] [--dry-run]
import postgres from "postgres";
import { seasonOf } from "../src/board/current.ts";
import { sqlOptionsFor } from "../src/db/connect.ts";
import { loadAliasFile } from "../src/ingest/aliases.ts";
import { parseHistoricoArgs, HISTORICO_USAGE } from "../src/ingest/historico.ts";
import { historicoSync } from "../src/ingest/historico-db.ts";

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
  args = parseHistoricoArgs(process.argv.slice(2));
} catch (e) {
  console.error(`${message(e)}\n${HISTORICO_USAGE}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const token =
  process.env.RFEF_EXPLORER_TOKEN ||
  process.env.EXPLORER_API_KEY ||
  process.env.EXPLORER_TOKEN;

if (!token) {
  console.warn(
    "[historico:sync] Aviso: RFEF_EXPLORER_TOKEN / EXPLORER_TOKEN non está configurado no contorno.",
  );
}

const sql = postgres(url, {
  ...sqlOptionsFor(url),
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
});

async function main() {
  console.log(
    `[historico:sync] Iniciando sincronización histórica (${args.desde} ata ${args.hasta})${
      args.dryRun ? " [DRY-RUN]" : ""
    }...`,
  );

  try {
    // SPEC-070: the identity of the rfef adapter, alias of the season of
    // each date (codGrupo -> competition, name -> team).
    const aliasesFor = (date) =>
      loadAliasFile(seasonOf(`${date}T12:00:00Z`), "rfef");
    const report = await historicoSync(sql, args, undefined, aliasesFor);

    console.log("\n=======================================================");
    console.log(
      `Resumo de sincronización histórica${args.dryRun ? " (DRY-RUN - Sen escrituras)" : ""}:`,
    );
    console.log(`  Datas procesadas:       ${report.datesProcessed}`);
    console.log(`  Partidos analizados:    ${report.matchesScanned}`);
    console.log(`  Partidos consolidados:  ${report.matchesConsolidated}`);
    console.log(`  Goles rexistrados:      ${report.goalsRecorded}`);
    console.log("-------------------------------------------------------");
    console.log("Desglose por competición:");
    for (const [comp, stats] of Object.entries(report.detailsByCompetition)) {
      console.log(
        `  - ${comp.padEnd(20)}: ${String(stats.matches).padStart(3)} partidos | ${String(
          stats.goals,
        ).padStart(3)} goles`,
      );
    }
    console.log("-------------------------------------------------------");
    console.log(`  Partidos emparejados:   ${report.matchesPaired}`);
    console.log(`  Sen emparejar:          ${report.matchesUnpaired}`);
    console.log(`  Ambiguos:               ${report.matchesAmbiguous}`);
    // SPEC-071 CA-4: paired with a row of another day of the window (±3).
    console.log(`  Noutro día (±3):        ${report.matchesOtherDay}`);
    console.log(
      "Emparejados (fecha [→ fecha da fila] · matchId · codActa · local–visitante · marcador · goles):",
    );
    for (const line of report.pairedLines) console.log(`  ${line}`);
    console.log("Sen emparejar (fecha · matchId · causa):");
    for (const u of report.unpaired)
      console.log(`  ${u.date} · ${u.matchId} · ${u.reason}`);
    console.log("Ambiguos (fecha · matchId · candidatas):");
    for (const a of report.ambiguous)
      console.log(
        `  ${a.date} · ${a.matchId} · ${a.candidates
          .map((c) => `${c.codActa ?? "sen acta"} ${c.home ?? "?"}–${c.away ?? "?"}`)
          .join("; ")}`,
      );
    console.log("=======================================================\n");
  } catch (err) {
    console.error("[historico:sync] Erro durante a execución:", err);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
