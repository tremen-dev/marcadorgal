import { gunzipSync } from "node:zlib";
import type { Sql, TransactionSql } from "postgres";
import { type AliasFile, type Instant, RawCapture } from "../model/index.ts";
import type { RawStore } from "../raw/store.ts";
import { goalReferences } from "../sources/api-football/events.ts";
import {
  construirInforme,
  informeMarkdown,
  parseCalibracion,
  referenciasDe,
} from "./informe-latencia.ts";
import { medirLatencia, rawRefsDeReferencia } from "./latencia.ts";
import { latenciaFilas } from "./latencia-db.ts";
import { parseSonda, unirSondas } from "./sonda.ts";

// SPEC-025 CA-5: what tools/informe-latencia.mjs runs, here so npm run
// test:db proves it whole. Reads only: the database (latenciaFilas), the raw
// captures the tick already stored (RawStore.get, never the provider: zero new
// requests, CA-2) and the files it is handed.

export type GenerarInformeInput = {
  sql: Sql | TransactionSql;
  store: Pick<RawStore, "get">;
  aliasFor: (season: string) => Pick<AliasFile, "matches">;
  desde: Instant;
  hasta: Instant;
  sondas: readonly { fichero: string; texto: string }[];
  calibracionCsv: string | null;
};

export type GenerarInformeOutput = {
  texto: string;
  crudosLeidos: number;
  crudosAusentes: string[];
};

export async function generarInforme(
  input: GenerarInformeInput,
): Promise<GenerarInformeOutput> {
  const sonda = unirSondas(
    input.sondas.map((s) => parseSonda(s.texto, s.fichero)),
  );
  const calibracion =
    input.calibracionCsv === null
      ? { filas: [], noCasadas: [] }
      : parseCalibracion(input.calibracionCsv);
  const filas = await latenciaFilas(input.sql, input.desde, input.hasta);

  const captures: RawCapture[] = [];
  const crudosAusentes: string[] = [];
  for (const rawRef of rawRefsDeReferencia(filas.observations)) {
    // raw_ref = bucket + key (ADR-007 §3); any other bucket is not ours.
    const body = rawRef.startsWith("raw/")
      ? await input.store.get(rawRef.slice("raw/".length))
      : null;
    if (body === null) {
      crudosAusentes.push(rawRef);
      continue;
    }
    captures.push(
      RawCapture.parse(JSON.parse(gunzipSync(body).toString("utf8"))),
    );
  }

  const fixtureToMatch = new Map<string, string>();
  for (const season of new Set(filas.matches.map((m) => m.season)))
    for (const [fixture, matchId] of Object.entries(
      input.aliasFor(season).matches ?? {},
    ))
      fixtureToMatch.set(fixture, matchId);
  const enVentana = new Set(filas.matches.map((m) => m.id));
  const referencias = referenciasDe(goalReferences(captures), (id) => {
    const matchId = fixtureToMatch.get(id);
    return matchId !== undefined && enVentana.has(matchId)
      ? matchId
      : undefined;
  });

  const latencia = medirLatencia({
    matches: filas.matches,
    observations: filas.observations,
    decisions: filas.decisions,
    attempts: filas.attempts,
    rawObjects: filas.rawObjects,
    referencias,
    calibracion: calibracion.filas,
    sonda,
  });
  const texto = informeMarkdown(
    construirInforme({
      desde: input.desde,
      hasta: input.hasta,
      latencia,
      sonda,
      ficherosSonda: input.sondas.map((s) => s.fichero),
      calibracionNoCasada: calibracion.noCasadas,
      peticionesPorDia: filas.peticionesPorDia,
    }),
  );
  return { texto, crudosLeidos: captures.length, crudosAusentes };
}
