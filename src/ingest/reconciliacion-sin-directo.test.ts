import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import type { Instant, Observation, SourceAdapter } from "@/model";
import { createMemoryRawStore } from "../raw/memory.ts";
import {
  apiFootballByIds,
  createApiFootballResults,
} from "../sources/api-football/results.ts";
import { loadAliasFile } from "./aliases.ts";
import { createMemoryIngestDb } from "./memory.ts";
import {
  reconciliarSinDirecto,
  type VigenteSinDirecto,
} from "./reconciliacion-sin-directo.ts";

// SPEC-018 CA-7 (ADR-013 H-6, N-2): the two matches of dev that the source
// never gave live and whose final came after +150, reconciled once by the
// path of SPEC-013 CA-6. One ids= request for both, raw stored before parse,
// the Observations inserted and the engine hook run in one transaction. Here
// with doubles only: a fetch that answers the H-5 body kept in the repo, a
// raw store and a db in memory. The real alias file of 2026-27 is used.

const AHORA = "2026-10-06T20:00:00.000Z" as Instant;
const BERGANTINOS = "segunda-rfef-g1-2026-27-j5-bergantinos-coruxo";
const BARCO = "tercera-rfef-g1-2026-27-j5-barco-pontevedra-b";
const URL_UNICA =
  "https://v3.football.api-sports.io/fixtures?ids=1572068-1612741";

// The body the provider gave on 2026-10-04 (H-5), read from the repo.
const H5 = JSON.parse(
  readFileSync(
    new URL(
      "../../docs/epicas/EPIC-002-ingesta-y-motor/_qa/fuente-sin-directo/h5-2026-10-04T18-56-20.580Z.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { body: string };

const aliases = loadAliasFile("2026-27", "api-football");

const scheduled = (
  matchId: string,
  kickoff: string,
  over: Partial<VigenteSinDirecto> = {},
): VigenteSinDirecto => ({
  matchId,
  status: "scheduled",
  rule: "RN-01",
  kickoff: kickoff as Instant,
  ...over,
});

const VIGENTES = [
  scheduled(BERGANTINOS, "2026-10-04T15:00:00.000Z"),
  scheduled(BARCO, "2026-10-04T15:30:00.000Z"),
];

function setup(body = H5.body) {
  const log: string[] = [];
  const urls: string[] = [];
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
  const fetch = vi.fn(async (url: string) => {
    urls.push(String(url));
    log.push("fetch");
    return new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof globalThis.fetch;
  const afterInsert = vi.fn(async (_tx: unknown, obs: Observation[]) => {
    log.push(`afterInsert:${obs.length}`);
  });
  const run = (
    vigentes: VigenteSinDirecto[] = VIGENTES,
    matchIds = [BERGANTINOS, BARCO],
  ) =>
    reconciliarSinDirecto({
      matchIds,
      vigentes,
      aliases,
      adapter,
      capturar: (fixtureIds) =>
        apiFootballByIds({
          fixtureIds,
          apiKey: "clave-de-prueba",
          userAgent: "marcador.gal test",
          now: AHORA,
          fetch,
        }),
      store,
      db,
      afterInsert,
      now: AHORA,
      etiqueta: "SPEC-018-CA-7",
    });
  return { log, urls, store, db, fetch, afterInsert, run };
}

describe("SPEC-018 CA-7 reconciliarSinDirecto", () => {
  it("asks both matches in one ids= request and stores the raw before parsing it", async () => {
    const { log, urls, run, store } = setup();
    const result = await run();
    expect(urls).toEqual([URL_UNICA]);
    const put = log.findIndex((l) => l.startsWith("put:"));
    expect(put).toBeGreaterThan(log.indexOf("fetch"));
    expect(put).toBeLessThan(log.indexOf("parse"));
    expect(result.rawRef).toMatch(
      /^raw\/api-football\/2026-10-06\/2026-10-06T20-00-00\.000Z-SPEC-018-CA-7\.json\.gz$/,
    );
    const key = result.rawRef.slice("raw/".length);
    const stored = JSON.parse(
      gunzipSync((await store.get(key)) as Uint8Array).toString(),
    );
    expect(stored.requests.map((r: { url: string }) => r.url)).toEqual([
      URL_UNICA,
    ]);
  });

  it("inserts the two finished Observations and runs the engine hook once, in one transaction", async () => {
    const { log, db, afterInsert, run } = setup();
    const result = await run();
    expect(db.observations.map((o) => [o.matchId, o.status, o.score])).toEqual([
      [BERGANTINOS, "finished", { home: 3, away: 1 }],
      [BARCO, "finished", { home: 1, away: 0 }],
    ]);
    for (const o of db.observations) {
      expect(o.rawRef).toBe(result.rawRef);
      expect(o.observedAt).toBe(AHORA);
      expect(o.receivedAt).toBe(AHORA);
      expect(o.sourceId).toBe("api-football");
    }
    expect(afterInsert).toHaveBeenCalledTimes(1);
    const begin = log.indexOf("begin");
    expect(log.slice(begin, begin + 4)).toEqual([
      "begin",
      "insertObservations:2",
      "afterInsert:2",
      "commit",
    ]);
    expect(result.filas).toEqual([
      {
        matchId: BERGANTINOS,
        fixtureId: "1572068",
        status: "finished",
        marcador: "3-1",
      },
      {
        matchId: BARCO,
        fixtureId: "1612741",
        status: "finished",
        marcador: "1-0",
      },
    ]);
  });

  it("refuses a match that is no longer scheduled, asking nothing: it cannot be repeated", async () => {
    const { fetch, store, db, run } = setup();
    await expect(
      run([
        scheduled(BERGANTINOS, "2026-10-04T15:00:00.000Z", {
          status: "finished",
        }),
        VIGENTES[1],
      ]),
    ).rejects.toThrow(/no está en scheduled/);
    expect(fetch).not.toHaveBeenCalled();
    expect(store.objects.size).toBe(0);
    expect(db.observations).toEqual([]);
  });

  it("refuses a match the tick can still hear (in its window or its extension)", async () => {
    const { fetch, run } = setup();
    await expect(
      run([scheduled(BERGANTINOS, "2026-10-06T15:00:00.000Z"), VIGENTES[1]]),
    ).rejects.toThrow(/todavía en ventana/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a match without a current Decision or without its fixture alias", async () => {
    const { fetch, run } = setup();
    await expect(run([VIGENTES[0]])).rejects.toThrow(/no tiene Decision/);
    await expect(
      run(
        [...VIGENTES, scheduled("no-such-match", "2026-10-04T15:00:00.000Z")],
        [BERGANTINOS, "no-such-match"],
      ),
    ).rejects.toThrow(/no tiene alias de fixture/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("with a final missing in the answer, keeps the raw and inserts nothing", async () => {
    const body = JSON.parse(H5.body);
    body.response[1].fixture.status.short = "NS";
    const { store, db, afterInsert, run } = setup(JSON.stringify(body));
    await expect(run()).rejects.toThrow(
      new RegExp(`${BARCO}.*sin finished.*raw/api-football/`),
    );
    expect(store.objects.size).toBe(1);
    expect(db.observations).toEqual([]);
    expect(afterInsert).not.toHaveBeenCalled();
  });
});
