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

// SPEC-013 CA-6, authorised once by the owner (H-1, 2026-09-29): the two
// matches of the measured matchday whose forced finish froze a wrong score.
// Their window expired days ago and RN-12 asks for an open one, so this is a
// written exception and not a path: nothing here runs from the tick.
//
// The same path as the contrast of SPEC-009 CA-5 (an ids= capture through an
// injected builder) and the same as the tick after it: raw stored before
// parse (RN-09), the Observation inserted and the engine hook run in one
// transaction. The Decision is the engine's, never written by hand (D-5).

export type Vigente = {
  matchId: string;
  status: MatchStatus;
  rule: DecisionRule;
};

export type ReconciliarOptions = {
  matchIds: readonly string[];
  // The current Decision of each match, as board has it.
  vigentes: readonly Vigente[];
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

export type ReconciliacionFila = {
  matchId: string;
  fixtureId: string;
  rawRef: string;
  observaciones: number;
};

// Everything is checked before the first request: a match without its fixture
// id, or no longer in forced finish (already reconciled, say), stops the run
// with nothing asked and nothing stored. That is what keeps it from repeating.
function plan({ matchIds, vigentes, aliases }: ReconciliarOptions) {
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
    if (vigente.status !== "finished" || vigente.rule !== "RN-02")
      throw new Error(
        `${matchId} no está en cierre forzoso (vigente ${vigente.status} ${vigente.rule}): nada que reconciliar`,
      );
    return { matchId, fixtureId };
  });
}

export async function reconciliarCierres(
  options: ReconciliarOptions,
): Promise<ReconciliacionFila[]> {
  const { adapter, capturar, store, db, afterInsert, now, etiqueta } = options;
  const filas: ReconciliacionFila[] = [];
  for (const { matchId, fixtureId } of plan(options)) {
    const capture = await capturar([fixtureId]);
    // Raw before parse, in the strong sense (D-6, RN-09, ADR-007 §6).
    // One key per match: two captures in the same millisecond never collide.
    const rawRef = await storeCapture(
      store,
      capture,
      `${etiqueta}-${fixtureId}`,
    );
    // The engine only sees what already happened at now: a capture stamped
    // later would be inserted and never decided on. Stop with the raw kept.
    if (Date.parse(capture.capturedAt) > Date.parse(now))
      throw new Error(
        `la captura de ${matchId} (${capture.capturedAt}) es posterior a now (${now}): el motor no la vería`,
      );
    const parsed = adapter.parse(capture);
    // The core owns id, sourceId, receivedAt and rawRef (SPEC-005 N-1), as
    // in the tick; only the match asked about is taken.
    const observations = parsed.observations
      .filter((o) => o.matchId === matchId)
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
    if (observations.length > 0)
      await db.transaction(async (tx) => {
        await tx.insertObservations(observations);
        await afterInsert(tx, observations);
      });
    filas.push({
      matchId,
      fixtureId,
      rawRef,
      observaciones: observations.length,
    });
  }
  return filas;
}
