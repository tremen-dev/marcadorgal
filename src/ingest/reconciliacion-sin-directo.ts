import {
  type AliasFile,
  type DecisionRule,
  type Instant,
  type MatchStatus,
  Observation,
  type SourceAdapter,
} from "../model/index.ts";
import { storeCapture } from "../raw/capture.ts";
import type { RawStore } from "../raw/store.ts";
import type { CapturaPorIds } from "./contraste.ts";
import type { IngestDb } from "./db.ts";
import type { AfterInsert } from "./tick.ts";
import { isInWindow } from "./window.ts";

// SPEC-018 CA-7, authorised once by the owner (ADR-013 H-6, SPEC-018 N-2,
// 2026-10-04): the two matches of dev the source never gave live and whose
// final came after +150, when the window had closed. They are left behind by
// the time edge and the extension of ADR-013 only helps the matches after it,
// so this is a written exception and not a path: nothing here runs from the
// tick, and once they are no longer scheduled it refuses to ask anything.
//
// The path of SPEC-013 CA-6 (reconciliacion.ts), whose guard asks for a forced
// finish and therefore cannot serve here: an ids= capture through an injected
// builder, the raw stored before parse (RN-09), the Observations inserted and
// the engine hook run in one transaction. One capture for every match, so the
// two go in one ids= request. The Decision is the engine's (D-5): RN-01,
// finished provisional.

export type VigenteSinDirecto = {
  matchId: string;
  status: MatchStatus;
  rule: DecisionRule | null;
  kickoff: Instant;
};

export type ReconciliarSinDirectoOptions = {
  matchIds: readonly string[];
  // The current Decision of each match, as board has it, with its kickoff.
  vigentes: readonly VigenteSinDirecto[];
  aliases: AliasFile;
  adapter: SourceAdapter;
  capturar: CapturaPorIds;
  store: RawStore;
  db: IngestDb;
  afterInsert: AfterInsert;
  now: Instant;
  // Stands where the tick puts its attempt id in the raw key: this is not an
  // attempt of the tick and writes no ingest_attempts row.
  etiqueta: string;
};

export type ReconciliacionSinDirecto = {
  rawRef: string;
  filas: {
    matchId: string;
    fixtureId: string;
    status: MatchStatus;
    marcador: string;
  }[];
};

// Everything is checked before the request: a match without its fixture id,
// no longer scheduled (already reconciled, say) or still audible by the tick
// stops the run with nothing asked and nothing stored.
function plan({
  matchIds,
  vigentes,
  aliases,
  now,
}: ReconciliarSinDirectoOptions) {
  const fixtureOf = new Map<string, string>(
    Object.entries(aliases.matches ?? {}).map(([ext, id]) => [id, ext]),
  );
  return matchIds.map((matchId) => {
    const fixtureId = fixtureOf.get(matchId);
    if (fixtureId === undefined)
      throw new Error(`${matchId} no tiene alias de fixture`);
    const vigente = vigentes.find((v) => v.matchId === matchId);
    if (vigente === undefined)
      throw new Error(`${matchId} no tiene Decision vigente`);
    if (vigente.status !== "scheduled")
      throw new Error(
        `${matchId} no está en scheduled (vigente ${vigente.status} ${vigente.rule}): nada que reconciliar`,
      );
    if (
      Date.parse(vigente.kickoff) > Date.parse(now) ||
      isInWindow(
        { kickoff: vigente.kickoff, status: "scheduled", forcedFinish: null },
        now,
      )
    )
      throw new Error(
        `${matchId} está todavía en ventana (kickoff ${vigente.kickoff}): lo oye el tick`,
      );
    return { matchId, fixtureId };
  });
}

export async function reconciliarSinDirecto(
  options: ReconciliarSinDirectoOptions,
): Promise<ReconciliacionSinDirecto> {
  const { adapter, capturar, store, db, afterInsert, now, etiqueta } = options;
  const planned = plan(options);
  const capture = await capturar(planned.map((p) => p.fixtureId));
  // Raw before parse, in the strong sense (D-6, RN-09, ADR-007 §6).
  const rawRef = await storeCapture(store, capture, etiqueta);
  // The engine only sees what already happened at now (SPEC-013 CA-6).
  if (Date.parse(capture.capturedAt) > Date.parse(now))
    throw new Error(
      `la captura (${capture.capturedAt}) es posterior a now (${now}): el motor no la vería · raw_ref ${rawRef}`,
    );
  const parsed = adapter.parse(capture);
  const wanted = new Set(planned.map((p) => p.matchId));
  // The core owns id, sourceId, receivedAt and rawRef (SPEC-005 N-1), as in
  // the tick; only the matches asked about are taken.
  const observations = parsed.observations
    .filter((o) => wanted.has(o.matchId))
    .map((o) =>
      Observation.parse({
        ...o,
        id: crypto.randomUUID(),
        sourceId: capture.sourceId,
        observedAt: o.observedAt ?? capture.capturedAt,
        receivedAt: now,
        rawRef,
      }),
    );
  // All or nothing: decisions has to grow by exactly one per match (CA-7).
  // A match the answer does not close is not inserted (a scheduled one would
  // publish a sen_sinal, not a final); the raw stays for the ledger.
  const filas = planned.map(({ matchId, fixtureId }) => {
    const final = observations.find(
      (o) => o.matchId === matchId && o.status === "finished",
    );
    if (final === undefined || final.score === null)
      throw new Error(
        `${matchId} (fixture ${fixtureId}) sin finished en la respuesta: no se inserta nada · raw_ref ${rawRef}`,
      );
    return {
      matchId,
      fixtureId,
      status: final.status,
      marcador: `${final.score.home}-${final.score.away}`,
    };
  });
  const finals = observations.filter((o) => o.status === "finished");
  await db.transaction(async (tx) => {
    await tx.insertObservations(finals);
    await afterInsert(tx, finals);
  });
  return { rawRef, filas };
}
