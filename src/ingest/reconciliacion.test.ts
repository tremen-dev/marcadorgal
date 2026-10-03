import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  AliasFile,
  type Instant,
  type Observation,
  type RawCapture,
  type SourceAdapter,
} from "@/model";
import { createMemoryRawStore } from "../raw/memory.ts";
import { createApiFootballResults } from "../sources/api-football/results.ts";
import { createMemoryIngestDb } from "./memory.ts";
import { reconciliarCierres, type Vigente } from "./reconciliacion.ts";

// SPEC-013 CA-6. The one-off reconciliation of the two matches of the measured
// matchday (H-1): ids= through the path of contraste.ts, raw stored before
// parse (RN-09), the Observation inserted and the engine hook run inside the
// same transaction, exactly as the tick does. The adapter is the real one;
// only the capture is faked, and nothing touches the network.

const AHORA = "2026-09-29T10:00:00.000Z" as Instant;
const CEUTA = "segunda-division-2026-27-j7-ceuta-real-sociedad-b";
const MERIDA = "primera-rfef-g1-2026-27-j5-merida-logrones";

const aliases = AliasFile.parse({
  source: "api-football",
  season: "2026-27",
  teams: [
    { externalId: "1", externalName: "Ceuta", teamId: "ceuta" },
    {
      externalId: "2",
      externalName: "Real Sociedad B",
      teamId: "real-sociedad-b",
    },
    { externalId: "3", externalName: "Mérida", teamId: "merida" },
    { externalId: "4", externalName: "Logroñés", teamId: "logrones" },
  ],
  matches: { "1569939": CEUTA, "1570756": MERIDA },
});

const FIXTURES: Record<string, unknown> = {
  "1569939": {
    fixture: { id: 1569939, status: { short: "FT", elapsed: 90, extra: null } },
    league: { id: 141 },
    teams: { home: { id: 1, name: "Ceuta" }, away: { id: 2, name: "RS B" } },
    goals: { home: 3, away: 1 },
  },
  "1570756": {
    fixture: { id: 1570756, status: { short: "FT", elapsed: 90, extra: null } },
    league: { id: 435 },
    teams: { home: { id: 3, name: "Mérida" }, away: { id: 4, name: "Log" } },
    goals: { home: 3, away: 5 },
  },
};

const captura = (fixtureIds: readonly string[]): RawCapture => ({
  sourceId: "api-football" as RawCapture["sourceId"],
  capturedAt: AHORA,
  requests: [
    {
      url: `https://v3.football.api-sports.io/fixtures?ids=${fixtureIds.join("-")}`,
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        response: fixtureIds.flatMap((id) =>
          FIXTURES[id] === undefined ? [] : [FIXTURES[id]],
        ),
      }),
    },
  ],
});

const forced = (matchId: string) => ({
  matchId,
  status: "finished" as const,
  rule: "RN-02" as const,
});

function setup(capture = captura) {
  const log: string[] = [];
  const store = createMemoryRawStore(log);
  const db = createMemoryIngestDb(log);
  const real = createApiFootballResults({ aliases, apiKey: "clave-de-prueba" });
  const adapter: SourceAdapter = {
    ...real,
    parse: (c) => {
      log.push("parse");
      return real.parse(c);
    },
  };
  const capturar = vi.fn(async (ids: readonly string[]) => {
    log.push(`capturar:${ids.join("-")}`);
    return capture(ids);
  });
  const afterInsert = vi.fn(async (_tx: unknown, obs: Observation[]) => {
    log.push(`afterInsert:${obs.map((o) => o.matchId).join(",")}`);
  });
  const run = (
    vigentes: Vigente[] = [forced(CEUTA), forced(MERIDA)],
    matchIds = [CEUTA, MERIDA],
  ) =>
    reconciliarCierres({
      matchIds,
      vigentes,
      aliases,
      adapter,
      capturar,
      store,
      db,
      afterInsert,
      now: AHORA,
      etiqueta: "SPEC-013-CA-6",
    });
  return { log, store, db, capturar, afterInsert, run };
}

describe("SPEC-013 CA-6 reconciliarCierres", () => {
  it("asks each match by ids=, one capture per match, and stores the raw before parsing it", async () => {
    const { log, run, store } = setup();
    const filas = await run();

    expect(log).toEqual([
      "capturar:1569939",
      expect.stringMatching(/^put:api-football\/2026-09-29\/.*SPEC-013-CA-6/),
      "parse",
      "begin",
      "insertObservations:1",
      `afterInsert:${CEUTA}`,
      "commit",
      "capturar:1570756",
      expect.stringMatching(/^put:api-football\/2026-09-29\/.*SPEC-013-CA-6/),
      "parse",
      "begin",
      "insertObservations:1",
      `afterInsert:${MERIDA}`,
      "commit",
    ]);
    expect(filas.map((f) => [f.matchId, f.fixtureId, f.observaciones])).toEqual(
      [
        [CEUTA, "1569939", 1],
        [MERIDA, "1570756", 1],
      ],
    );
    // Two captures, two raw_refs, and each one holds what the provider said.
    expect(new Set(filas.map((f) => f.rawRef)).size).toBe(2);
    for (const f of filas) {
      const key = f.rawRef.replace(/^raw\//, "");
      const stored = store.objects.get(key);
      expect(stored).toBeDefined();
      const body = JSON.parse(
        gunzipSync(stored?.body ?? new Uint8Array()).toString(),
      );
      expect(body.requests[0].url).toContain(`ids=${f.fixtureId}`);
    }
  });

  it("inserts the Observation as the tick does: the source's, now, and citing its raw_ref", async () => {
    const { db, run } = setup();
    const filas = await run();
    expect(db.observations).toHaveLength(2);
    expect(db.observations[0]).toMatchObject({
      matchId: CEUTA,
      sourceId: "api-football",
      status: "finished",
      score: { home: 3, away: 1 },
      observedAt: AHORA,
      receivedAt: AHORA,
      rawRef: filas[0].rawRef,
    });
    expect(db.observations[1]).toMatchObject({
      matchId: MERIDA,
      score: { home: 3, away: 5 },
      rawRef: filas[1].rawRef,
    });
  });

  it("never asks anything when a match is no longer in forced finish", async () => {
    const { run, capturar, store } = setup();
    await expect(
      run([
        forced(CEUTA),
        { matchId: MERIDA, status: "finished", rule: "RN-12" },
      ]),
    ).rejects.toThrow(/primera-rfef-g1-2026-27-j5-merida-logrones.*RN-12/);
    expect(capturar).not.toHaveBeenCalled();
    expect(store.objects.size).toBe(0);
  });

  it("never asks anything when a match has no fixture alias or no Decision", async () => {
    const { run, capturar } = setup();
    await expect(
      run([forced(CEUTA), forced("x-sin-alias")], [CEUTA, "x-sin-alias"]),
    ).rejects.toThrow(/x-sin-alias/);
    await expect(run([forced(CEUTA)], [CEUTA, MERIDA])).rejects.toThrow(
      /merida-logrones/,
    );
    expect(capturar).not.toHaveBeenCalled();
  });

  it("keeps the raw and inserts nothing when the provider does not answer for the match", async () => {
    const { run, db, store, afterInsert } = setup((ids) =>
      captura(ids.filter((id) => id !== "1570756")),
    );
    const filas = await run();
    expect(filas[1]).toMatchObject({ matchId: MERIDA, observaciones: 0 });
    expect(store.objects.size).toBe(2);
    expect(db.observations.map((o) => o.matchId)).toEqual([CEUTA]);
    expect(afterInsert).toHaveBeenCalledTimes(1);
  });
  // Found in the one real run (2026-09-29): the tool took now before asking
  // and the capture was stamped later, so the Observation was in the future
  // of the engine, which drops it (only what already happened). The capture
  // must share the engine's now, as in the tick; otherwise it stops after
  // keeping the raw and before inserting anything the engine cannot see.
  it("stops, raw kept and nothing inserted, when the capture is stamped after now", async () => {
    const { run, db, store, afterInsert } = setup((ids) => ({
      ...captura(ids),
      capturedAt: "2026-09-29T10:00:01.000Z",
    }));
    await expect(run()).rejects.toThrow(/posterior a now/);
    expect(store.objects.size).toBe(1);
    expect(db.observations).toEqual([]);
    expect(afterInsert).not.toHaveBeenCalled();
  });
});
