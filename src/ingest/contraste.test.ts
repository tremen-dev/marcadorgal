import { describe, expect, it } from "vitest";
import { AliasFile, type Instant, type RawCapture } from "@/model";
import { createApiFootballResults } from "../sources/api-football/results.ts";
import { contrastarMarcadores } from "./contraste.ts";

// SPEC-009 CA-5, finding V-6. Un partido del que el proveedor no contesta no es
// una discrepancia: es su silencio, y CA-5 pide comparar el `status` y el
// `score` del proveedor. Para poder decir *por qué* no vino, `contraste` tiene
// que devolver lo que el adaptador descartó —`skipped` con su `reason`,
// `unresolved` con la suya— y no solo `parsed.observations`.
//
// El adaptador es el de verdad (`createApiFootballResults`), no un doble: lo
// que se comprueba es la ruta real de `parse`, no una teoría sobre ella. Lo
// único fingido es la captura, que llega por el `capturar` inyectado y no toca
// la red.

const AHORA = "2026-09-28T20:00:00.000Z" as Instant;
const CASA = "primera-rfef-g1-2026-27-j5-a-b";
const FUERA = "primera-rfef-g1-2026-27-j5-c-d";

const aliases = AliasFile.parse({
  source: "api-football",
  season: "2026-27",
  teams: [
    { externalId: "1", externalName: "A", teamId: "a" },
    { externalId: "2", externalName: "B", teamId: "b" },
    { externalId: "3", externalName: "C", teamId: "c" },
    { externalId: "4", externalName: "D", teamId: "d" },
  ],
  matches: { "9001": CASA, "9002": FUERA },
});

type Goles = { home: number | null; away: number | null };

const fixture = (
  id: string,
  short: string,
  goals: Goles,
  teams: readonly [number, number],
) => ({
  fixture: { id: Number(id), status: { short, elapsed: null, extra: null } },
  league: { id: 435 },
  teams: {
    home: { id: teams[0], name: "Home" },
    away: { id: teams[1], name: "Away" },
  },
  goals,
});

const captura = (fixtures: readonly unknown[]): RawCapture => ({
  sourceId: "api-football" as RawCapture["sourceId"],
  capturedAt: AHORA,
  requests: [
    {
      url: "https://v3.football.api-sports.io/fixtures?ids=9001-9002",
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ response: fixtures }),
    },
  ],
});

const contrasta = (fixtures: readonly unknown[]) =>
  contrastarMarcadores({
    matches: [{ id: CASA }, { id: FUERA }],
    aliases,
    adapter: createApiFootballResults({ aliases, apiKey: "clave-de-prueba" }),
    capturar: async () => captura(fixtures),
  });

const fila = (salida: Awaited<ReturnType<typeof contrasta>>, id: string) => {
  const f = salida.filas.find((x) => x.matchId === id);
  if (f === undefined) throw new Error(`sin fila para ${id}`);
  return f;
};

describe("V-6 el silencio del proveedor vuelve con su motivo", () => {
  it("un status.short que el mapa no conoce vuelve con su reason de skipped", async () => {
    const salida = await contrasta([
      fixture("9001", "FT", { home: 2, away: 1 }, [1, 2]),
      // La ruta real de `skipped('unsupported_status')`: un código que el mapa
      // de results.ts no tiene. No es ABD/AWD/WO, que sí están mapeados.
      fixture("9002", "NUEVO", { home: 0, away: 0 }, [3, 4]),
    ]);
    expect(fila(salida, CASA).proveedor).toEqual({
      status: "finished",
      score: { home: 2, away: 1 },
    });
    expect(fila(salida, FUERA).proveedor).toBeNull();
    expect(fila(salida, FUERA).motivo).toBe(
      "el adaptador lo descartó: unsupported_status (status.short NUEVO)",
    );
  });

  it("un partido que el proveedor terminó sin marcador vuelve con missing_score", async () => {
    const salida = await contrasta([
      fixture("9001", "FT", { home: 2, away: 1 }, [1, 2]),
      fixture("9002", "FT", { home: null, away: null }, [3, 4]),
    ]);
    expect(fila(salida, FUERA).motivo).toBe(
      "el adaptador lo descartó: missing_score (status.short FT)",
    );
  });

  it("un equipo que el alias no resuelve vuelve con su reason de unresolved", async () => {
    const salida = await contrasta([
      fixture("9001", "FT", { home: 2, away: 1 }, [1, 2]),
      fixture("9002", "FT", { home: 1, away: 1 }, [3, 99]),
    ]);
    expect(fila(salida, FUERA).motivo).toBe(
      "el adaptador no resolvió su identidad: unknown_team (status.short FT)",
    );
  });

  it("un fixture que no viene en la respuesta lo dice tal cual", async () => {
    const salida = await contrasta([
      fixture("9001", "FT", { home: 2, away: 1 }, [1, 2]),
    ]);
    expect(fila(salida, FUERA).motivo).toBe(
      "el proveedor no devolvió el fixture 9002 en su respuesta",
    );
  });

  it("un partido sin alias de fixture dice que no se le preguntó", async () => {
    const salida = await contrastarMarcadores({
      matches: [{ id: CASA }, { id: "primera-rfef-g1-2026-27-j5-e-f" }],
      aliases,
      adapter: createApiFootballResults({ aliases, apiKey: "clave-de-prueba" }),
      capturar: async () =>
        captura([fixture("9001", "FT", { home: 2, away: 1 }, [1, 2])]),
    });
    expect(salida.sinAlias).toEqual(["primera-rfef-g1-2026-27-j5-e-f"]);
    expect(fila(salida, "primera-rfef-g1-2026-27-j5-e-f").motivo).toBe(
      "no tiene alias de fixture: no se le preguntó al proveedor",
    );
  });

  it("un partido que el proveedor sí contesta no lleva motivo", async () => {
    const salida = await contrasta([
      fixture("9001", "FT", { home: 2, away: 1 }, [1, 2]),
      fixture("9002", "FT", { home: 0, away: 0 }, [3, 4]),
    ]);
    expect(fila(salida, CASA).motivo).toBeUndefined();
    expect(fila(salida, FUERA).motivo).toBeUndefined();
  });
});

// El recíproco del primer caso, y la razón por la que V-6 acierta en el bug y
// se equivoca en el ejemplo: ABD, AWD y WO **están** en el mapa de estados de
// results.ts (ABD → suspended, AWD y WO → finished), así que no recorren la
// ruta de `unsupported_status`. Mapear estados nuevos del proveedor no es
// alcance de SPEC-009; dejar de tratar el silencio como discrepancia sí.
describe("V-6 ABD, AWD y WO no son estados sin mapear", () => {
  it("los tres devuelven observación y ninguno vuelve con motivo", async () => {
    for (const [short, status] of [
      ["ABD", "suspended"],
      ["AWD", "finished"],
      ["WO", "finished"],
    ] as const) {
      const salida = await contrasta([
        fixture("9001", "FT", { home: 2, away: 1 }, [1, 2]),
        fixture("9002", short, { home: 3, away: 0 }, [3, 4]),
      ]);
      expect(fila(salida, FUERA).proveedor).toEqual({
        status,
        score: { home: 3, away: 0 },
      });
      expect(fila(salida, FUERA).motivo).toBeUndefined();
    }
  });
});
