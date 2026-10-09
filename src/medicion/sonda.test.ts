import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSonda, unirSondas } from "./sonda.ts";

// SPEC-025 CA-3 (H-2): the pure parser of the probe's JSONL, over a fixture of
// the repo.
const texto = readFileSync(
  new URL("./fixtures/sonda-2026-10-17.jsonl", import.meta.url),
  "utf8",
);
const ID = "segunda-division-2026-27-j10-deportivo-racing";

describe("SPEC-025 CA-3 parseSonda", () => {
  const sonda = parseSonda(texto, "sonda-2026-10-17.jsonl");

  it("reads the paints in file order, with version, score, status and the probe's clock", () => {
    expect(sonda.pinturas).toEqual([
      {
        origen: "sonda-2026-10-17.jsonl",
        ruta: "/",
        matchId: ID,
        version: 3,
        marcador: "0-0",
        estado: "live",
        paintedAt: "2026-10-17T16:00:01.400Z",
        inicial: true,
      },
      {
        origen: "sonda-2026-10-17.jsonl",
        ruta: "/es",
        matchId: ID,
        version: 3,
        marcador: "0-0",
        estado: "live",
        paintedAt: "2026-10-17T16:00:01.600Z",
        inicial: true,
      },
      {
        origen: "sonda-2026-10-17.jsonl",
        ruta: "/",
        matchId: ID,
        version: 4,
        marcador: "1-0",
        estado: "live",
        paintedAt: "2026-10-17T16:01:02.450Z",
        inicial: false,
      },
    ]);
  });

  it("reads every /api/board response: status, Age in seconds, x-vercel-cache, Date as an Instant", () => {
    expect(sonda.respuestas).toEqual([
      {
        origen: "sonda-2026-10-17.jsonl",
        ruta: "/",
        estado: 200,
        age: null,
        xVercelCache: "MISS",
        date: "2026-10-17T16:00:01.000Z",
        instante: "2026-10-17T16:00:01.250Z",
      },
      {
        origen: "sonda-2026-10-17.jsonl",
        ruta: "/",
        estado: 304,
        age: 12,
        xVercelCache: "HIT",
        date: "2026-10-17T16:00:31.000Z",
        instante: "2026-10-17T16:00:31.900Z",
      },
      {
        origen: "sonda-2026-10-17.jsonl",
        ruta: "/",
        estado: 200,
        age: 4,
        xVercelCache: "STALE",
        date: "2026-10-17T16:01:02.000Z",
        instante: "2026-10-17T16:01:02.300Z",
      },
    ]);
  });

  it("keeps the visibility checks and counts the ones that were not visible", () => {
    expect(sonda.visibilidad.map((v) => [v.ruta, v.estado])).toEqual([
      ["/", "visible"],
      ["/es", "hidden"],
    ]);
    expect(sonda.noVisibles).toBe(1);
  });

  it("start, end and the probe's own errors", () => {
    expect(sonda.inicios).toEqual(["2026-10-17T16:00:00.000Z"]);
    expect(sonda.fines).toEqual(["2026-10-17T16:06:00.000Z"]);
    expect(sonda.erroresSonda).toEqual([
      {
        ruta: "/es",
        mensaje: "page crashed",
        instante: "2026-10-17T16:02:00.000Z",
      },
    ]);
  });

  it("a line it cannot read is reported with its number, never dropped in silence", () => {
    expect(sonda.lineasInvalidas.map((l) => l.linea)).toEqual([10, 11]);
    expect(sonda.lineasInvalidas[0].fichero).toBe("sonda-2026-10-17.jsonl");
  });

  it("an empty file is an empty probe", () => {
    expect(parseSonda("", "x").pinturas).toEqual([]);
  });
});

describe("SPEC-025 CA-3 unirSondas", () => {
  it("joins several files, paints and responses ordered by the probe's clock", () => {
    const a = parseSonda(texto, "a");
    const b = parseSonda(
      `${JSON.stringify({ tipo: "pintura", ruta: "/", matchId: ID, version: 4, marcador: "1-0", estado: "live", paintedAt: "2026-10-17T16:01:01.000Z", inicial: false })}\n`,
      "b",
    );
    const u = unirSondas([a, b]);
    expect(u.pinturas.map((p) => p.paintedAt)).toEqual([
      "2026-10-17T16:00:01.400Z",
      "2026-10-17T16:00:01.600Z",
      "2026-10-17T16:01:01.000Z",
      "2026-10-17T16:01:02.450Z",
    ]);
    expect(u.respuestas).toHaveLength(3);
    expect(u.lineasInvalidas).toHaveLength(2);
    expect(u.noVisibles).toBe(1);
  });
});
