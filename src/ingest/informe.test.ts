import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  type Instant,
  type MatchStatus,
  MINUTE_MS,
  shiftInstant,
} from "@/model";
import { INFORME_MAX_LINEAS, INFORME_P95_MIN_SAMPLES } from "./constants.ts";
import {
  BLOQUES,
  estadisticos,
  etiquetaP95,
  type InformeInput,
  informeJornada,
  parseReferencias,
  percentil,
} from "./informe.ts";

// SPEC-009 CA-1: the arithmetic of the report, over fixed rows. No database,
// no clock, no network: informe.ts is pure and tools/informe-jornada.mjs is
// the shell that queries and writes.

const DESDE = "2026-09-25T18:20:00.000Z" as Instant;
const HASTA = "2026-09-28T21:00:00.000Z" as Instant;
const KEY = "0123456789abcdef0123456789abcdef";
const SEC = 1_000;

const at = (minutes: number): Instant =>
  shiftInstant(DESDE, minutes * MINUTE_MS);
const seg = (seconds: number): Instant => shiftInstant(DESDE, seconds * SEC);

// D-3: the five competitions of the scope, which is what "cuatro de cinco"
// is counted against.
const CINCO = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];

const MATCH = "segunda-division-2026-27-j7-racing-ferrol-deportivo";

type InformeMatchLike = InformeInput["matches"][number];
type ObsLike = InformeInput["observations"][number];
type DecLike = InformeInput["decisions"][number];
type InformeAttemptLike = InformeInput["attempts"][number];

const vacio = (over: Partial<InformeInput> = {}): InformeInput => ({
  desde: DESDE,
  hasta: HASTA,
  secrets: [KEY],
  competicionesDeclaradas: CINCO,
  matches: [],
  observations: [],
  decisions: [],
  attempts: [],
  alerts: [],
  referencias: [],
  referenciasNoCasadas: [],
  contraste: null,
  ...over,
});

// A match of the window with its current decision, as board gives it.
const partido = (over: Partial<InformeMatchLike> = {}): InformeMatchLike => ({
  id: MATCH,
  competitionId: "segunda-division",
  competitionName: "Segunda División",
  round: 7,
  kickoff: at(10),
  status: "finished",
  score: { home: 1, away: 0 },
  decidedAt: at(120),
  ...over,
});

const obs = (over: Partial<ObsLike> = {}): ObsLike => ({
  id: "o1",
  matchId: MATCH,
  observedAt: at(10),
  status: "live",
  score: { home: 0, away: 0 },
  rawRef: "raw/2026-09-25/api-football/a.json.gz",
  ...over,
});

const dec = (over: Partial<DecLike> = {}): DecLike => ({
  id: "d1",
  matchId: MATCH,
  version: 1,
  status: "live",
  score: { home: 0, away: 0 },
  rule: "RN-01",
  decidedAt: at(10),
  observationIds: ["o1"],
  ...over,
});

describe("CA-1 percentil", () => {
  it("con una sola muestra devuelve esa muestra", () => {
    expect(percentil([42], 0.5)).toBe(42);
    expect(percentil([42], 0.95)).toBe(42);
  });

  it("con dos muestras el p95 es la mayor y la mediana la menor", () => {
    expect(percentil([10, 90], 0.5)).toBe(10);
    expect(percentil([10, 90], 0.95)).toBe(90);
    // El orden de entrada no cambia nada.
    expect(percentil([90, 10], 0.95)).toBe(90);
  });

  it("con cien muestras 1..100 la mediana es 50 y el p95 es 95", () => {
    const cien = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentil(cien, 0.5)).toBe(50);
    expect(percentil(cien, 0.95)).toBe(95);
    expect(percentil(cien, 1)).toBe(100);
  });

  it("sin muestras no hay percentil", () => {
    expect(percentil([], 0.5)).toBeNull();
  });
});

describe("CA-1 estadisticos", () => {
  it("resume n, mediana, p95, máximo y mínimo", () => {
    expect(estadisticos([30 * SEC, 30 * SEC, 120 * SEC])).toEqual({
      n: 3,
      mediana: 30 * SEC,
      p95: 120 * SEC,
      maximo: 120 * SEC,
      minimo: 30 * SEC,
    });
  });

  it("sin muestras deja los estadísticos en null y n en cero", () => {
    expect(estadisticos([])).toEqual({
      n: 0,
      mediana: null,
      p95: null,
      maximo: null,
      minimo: null,
    });
  });
});

describe("CA-1/CA-3 etiquetaP95", () => {
  it("por debajo de veinte muestras no se llama p95", () => {
    expect(etiquetaP95(1)).toBe("peor caso (n=1)");
    expect(etiquetaP95(19)).toBe("peor caso (n=19)");
  });

  it("a partir de veinte muestras sí", () => {
    expect(etiquetaP95(INFORME_P95_MIN_SAMPLES)).toBe("p95");
    expect(etiquetaP95(1_240)).toBe("p95");
  });
});

describe("CA-1 el informe entero", () => {
  it("los nueve bloques son los de CA-1, con esos nombres y en ese orden", () => {
    expect(BLOQUES).toEqual([
      "## 1. Ventana y cobertura",
      "## 2. Cadencia efectiva",
      "## 3. Latencia interna",
      "## 4. Latencia extremo a extremo",
      "## 5. Peticiones al proveedor",
      "## 6. Partidos sin señal",
      "## 7. Alertas",
      "## 8. Contraste de marcadores",
      "## 9. Veredicto",
    ]);
  });

  it("imprime los nueve bloques, en orden", () => {
    const { texto } = informeJornada(vacio());
    let last = -1;
    for (const bloque of BLOQUES) {
      const pos = texto.indexOf(bloque);
      expect(pos, `falta el bloque ${bloque}`).toBeGreaterThan(last);
      last = pos;
    }
  });

  it("sin cadencia ni latencia interna el techo propio no se etiqueta, se declara ausente", () => {
    const { texto, informe } = informeJornada(vacio());
    expect(informe.techoPropio).toBeNull();
    expect(texto).toContain(
      "techo propio: n/a (hace falta cadencia y latencia interna para sumarlo)",
    );
    expect(texto).not.toContain("peor caso (n=0)");
  });

  it("recorta la lista de partidos sin señal con su desglose por competición", () => {
    const muchos = Array.from({ length: 12 }, (_, i) =>
      partido({
        id: `m${i}`,
        competitionId: i < 7 ? "tercera-rfef-g1" : "segunda-rfef-g1",
        competitionName: i < 7 ? "Tercera" : "Segunda RFEF",
      }),
    );
    const { texto } = informeJornada(vacio({ matches: muchos }));
    expect(texto).toContain("sin ninguna observación: 12");
    expect(texto).toContain("por competición: Segunda RFEF 5, Tercera 7");
    expect(texto).toContain("… y 2 más");
  });

  it("sin ninguna fila se genera entero, sin lanzar, y cada bloque vacío dice por qué", () => {
    const { texto, informe } = informeJornada(vacio());
    for (const bloque of BLOQUES) expect(texto).toContain(bloque);
    // Siete de los nueve: alertas en cero es un resultado, no una ausencia,
    // y el veredicto siempre se emite.
    expect(texto.match(/\(sin datos: /g) ?? []).toHaveLength(7);
    expect(informe.cobertura.partidos).toBe(0);
    expect(informe.cadencia.n).toBe(0);
    expect(informe.latenciaInterna.n).toBe(0);
    expect(informe.latenciaExterna.n).toBe(0);
    expect(informe.techoPropio).toBeNull();
    expect(informe.contraste).toBeNull();
  });

  it("cada estadístico lleva su n al lado", () => {
    const { texto } = informeJornada(
      vacio({
        // Cierra en su última observación: aquí se miden los huecos entre
        // observaciones y el silencio final tiene su propio caso (V-2).
        matches: [partido({ kickoff: seg(0), decidedAt: seg(60) })],
        observations: [
          obs({ id: "o1", observedAt: seg(0) }),
          obs({ id: "o2", observedAt: seg(30) }),
          obs({ id: "o3", observedAt: seg(60) }),
        ],
      }),
    );
    expect(texto).toContain("mediana: 30.0 s (n=2)");
  });

  it("ningún valor de .env aparece en la salida", () => {
    const { texto } = informeJornada(
      vacio({
        attempts: [
          {
            startedAt: DESDE,
            sourceId: "api-football",
            ok: false,
            error: `GET https://v3.football.api-sports.io/fixtures?key=${KEY} falló`,
            requests: 1,
          },
        ],
      }),
    );
    expect(texto).not.toContain(KEY);
    expect(texto).toContain("[secreto]");
  });
});

describe("CA-1 primera línea: competiciones medidas, derivadas de los partidos", () => {
  it("dice cuántas y cuáles, y nombra las que no jugaron", () => {
    const { texto, informe } = informeJornada(
      vacio({ matches: [partido(), partido({ id: "m2" })] }),
    );
    expect(texto.split("\n")[2]).toBe(
      "Se midieron una de las cinco competiciones de D-3: Segunda División (2 partidos).",
    );
    expect(informe.cobertura.competiciones).toEqual([
      { id: "segunda-division", nombre: "Segunda División", partidos: 2 },
    ]);
    expect(texto).toContain("Sin partidos en la ventana: primera-division");
  });

  it("cuatro competiciones de cinco se cuentan de los partidos, no de una constante", () => {
    const cuatro = CINCO.filter((c) => c !== "primera-division").map((c, i) =>
      partido({ id: `m${i}`, competitionId: c, competitionName: c }),
    );
    const { texto, informe } = informeJornada(vacio({ matches: cuatro }));
    expect(informe.cobertura.competiciones).toHaveLength(4);
    expect(texto).toContain(
      "Se midieron cuatro de las cinco competiciones de D-3",
    );
    // La salvedad de H-1 en el veredicto, dicha en claro.
    expect(texto).toContain(
      "criterio 5 cerrado sobre cuatro competiciones de cinco",
    );
    expect(texto).toContain("R-SPEC-009-1");
  });
});

describe("CA-2 (a) cadencia efectiva", () => {
  const conHuecos = () =>
    informeJornada(
      vacio({
        matches: [partido({ kickoff: seg(0), decidedAt: seg(180) })],
        observations: [
          obs({ id: "o1", observedAt: seg(0) }),
          obs({ id: "o2", observedAt: seg(30) }),
          obs({ id: "o3", observedAt: seg(60) }),
          obs({ id: "o4", observedAt: seg(180) }),
        ],
      }),
    );

  it("mide los huecos entre observed_at consecutivos de cada partido", () => {
    expect(conHuecos().informe.cadencia).toMatchObject({
      n: 3,
      mediana: 30 * SEC,
      maximo: 120 * SEC,
      minimo: 30 * SEC,
    });
  });

  it("señala el hueco largo con su partido y su instante", () => {
    const { texto, informe } = conHuecos();
    expect(informe.cadencia.huecosLargos).toEqual([
      {
        matchId: MATCH,
        competicion: "Segunda División",
        desde: seg(60),
        ms: 120 * SEC,
      },
    ]);
    expect(texto).toContain("huecos > 90 s: 1");
    expect(texto).toContain(`${seg(60)}  120.0 s  ${MATCH}`);
  });

  it("los huecos no cruzan de un partido a otro", () => {
    const { informe } = informeJornada(
      vacio({
        matches: [
          partido({ kickoff: seg(0), decidedAt: seg(0) }),
          partido({ id: "otro", kickoff: seg(3_600), decidedAt: seg(3_600) }),
        ],
        observations: [
          obs({ id: "o1", observedAt: seg(0) }),
          obs({ id: "o2", matchId: "otro", observedAt: seg(3_600) }),
        ],
      }),
    );
    expect(informe.cadencia.n).toBe(0);
  });
});

describe("CA-2 (b) latencia interna", () => {
  const conDecisions = () =>
    informeJornada(
      vacio({
        matches: [partido()],
        observations: [
          obs({ id: "o1", observedAt: seg(0), score: { home: 0, away: 0 } }),
          obs({ id: "o2", observedAt: seg(30), score: { home: 1, away: 0 } }),
        ],
        decisions: [
          dec({
            id: "d1",
            version: 1,
            decidedAt: seg(2),
            observationIds: ["o1"],
          }),
          dec({
            id: "d2",
            version: 2,
            score: { home: 1, away: 0 },
            decidedAt: seg(34),
            observationIds: ["o2"],
          }),
        ],
      }),
    );

  it("mide decided_at − observed_at solo de las Decisions que cambian el marcador", () => {
    const { informe } = conDecisions();
    // La v1 estrena el marcador 0-0 y la v2 lo sube a 1-0: dos cambios.
    expect(informe.latenciaInterna).toMatchObject({
      n: 2,
      maximo: 4 * SEC,
      minimo: 2 * SEC,
    });
  });

  it("dice con esas palabras que mide captura → publicación y no extremo a extremo", () => {
    const { texto } = conDecisions();
    expect(texto).toContain("captura → publicación");
    expect(texto).toContain("No es latencia extremo a extremo");
    expect(texto).toContain("observed_at = capturedAt");
  });

  it("el techo propio es p95(cadencia) + p95(latencia interna)", () => {
    const { texto, informe } = informeJornada(
      vacio({
        matches: [partido({ kickoff: seg(0), decidedAt: seg(34) })],
        observations: [
          obs({ id: "o1", observedAt: seg(0), score: { home: 0, away: 0 } }),
          obs({ id: "o2", observedAt: seg(30), score: { home: 1, away: 0 } }),
        ],
        decisions: [
          dec({
            id: "d2",
            version: 1,
            score: { home: 1, away: 0 },
            decidedAt: seg(34),
            observationIds: ["o2"],
          }),
        ],
      }),
    );
    expect(informe.cadencia.p95).toBe(30 * SEC);
    expect(informe.latenciaInterna.p95).toBe(4 * SEC);
    expect(informe.techoPropio).toBe(34 * SEC);
    expect(texto).toContain("techo propio");
  });

  it("una Decision que no cambia el marcador no cuenta", () => {
    const { informe } = informeJornada(
      vacio({
        matches: [partido()],
        observations: [obs({ id: "o1", observedAt: seg(0) })],
        decisions: [
          dec({ id: "d1", version: 1, decidedAt: seg(2) }),
          dec({
            id: "d2",
            version: 2,
            decidedAt: seg(32),
            observationIds: ["o1"],
          }),
        ],
      }),
    );
    expect(informe.latenciaInterna.n).toBe(1);
  });
});

describe("CA-3 referencias externas", () => {
  const CSV = [
    "matchId,marcador,instante,fuente",
    `${MATCH},1-0,${seg(20)},radio`,
    `${MATCH},3-3,${seg(40)},radio`,
    `no-existe,1-0,${seg(60)},TV`,
  ].join("\n");

  const cruzado = () => {
    const { filas, noCasadas } = parseReferencias(CSV);
    return informeJornada(
      vacio({
        matches: [partido()],
        observations: [obs({ id: "o2", observedAt: seg(30) })],
        decisions: [
          dec({
            id: "d2",
            version: 1,
            score: { home: 1, away: 0 },
            decidedAt: seg(34),
            observationIds: ["o2"],
          }),
        ],
        referencias: filas,
        referenciasNoCasadas: noCasadas,
      }),
    );
  };

  it("un fichero vacío no lanza y no deja filas", () => {
    expect(parseReferencias("")).toEqual({ filas: [], noCasadas: [] });
    expect(parseReferencias("matchId,marcador,instante,fuente\n")).toEqual({
      filas: [],
      noCasadas: [],
    });
  });

  it("una fila mal formada se lista como no casada, nunca se descarta en silencio", () => {
    const { filas, noCasadas } = parseReferencias(
      "matchId,marcador,instante,fuente\nm1,1-0,ayer,radio\nm2,gol,2026-09-27T15:00:00Z,radio\n",
    );
    expect(filas).toEqual([]);
    expect(noCasadas).toHaveLength(2);
    expect(noCasadas[0].motivo).toContain("instante");
    expect(noCasadas[1].motivo).toContain("marcador");
  });

  it("de tres filas casa una y lista las otras dos con su motivo", () => {
    const { texto, informe } = cruzado();
    expect(informe.latenciaExterna).toMatchObject({ n: 1, mediana: 14 * SEC });
    expect(informe.latenciaExterna.noCasadas).toEqual([
      {
        fila: `${MATCH},3-3,${seg(40)},radio`,
        motivo: "el marcador 3-3 nunca se publicó",
      },
      {
        fila: `no-existe,1-0,${seg(60)},TV`,
        motivo: "no-existe no es un partido de la ventana",
      },
    ]);
    expect(texto).toContain("referencias no casadas: 2");
    expect(texto).toContain("nunca se publicó");
  });

  it("con menos de veinte muestras imprime peor caso y no p95, y da el rango completo", () => {
    const { texto } = cruzado();
    expect(texto).toContain("peor caso (n=1)");
    expect(texto).not.toMatch(/## 4[\s\S]*?p95:/);
    expect(texto).toContain("rango: [14.0 s, 14.0 s]");
  });

  it("contrasta la mediana con los 45 s de vision.md, en segundos y no en ms", () => {
    // 14 s está por debajo de los 45: la línea dice cumple, no NO cumple.
    expect(cruzado().texto).toContain(
      "objetivo de vision.md: mediana < 45 s → cumple",
    );
  });

  it("una mediana por encima del objetivo lo dice", () => {
    const { texto } = informeJornada(
      vacio({
        matches: [partido()],
        observations: [obs({ id: "o2", observedAt: seg(30) })],
        decisions: [
          dec({
            id: "d2",
            version: 1,
            score: { home: 1, away: 0 },
            decidedAt: seg(120),
            observationIds: ["o2"],
          }),
        ],
        referencias: [
          {
            matchId: MATCH,
            marcador: "1-0",
            instante: seg(20),
            fuente: "radio",
          },
        ],
      }),
    );
    expect(texto).toContain(
      "objetivo de vision.md: mediana < 45 s → NO cumple",
    );
  });

  it("dice el tamaño esperable derivado de los partidos de la ventana", () => {
    const cuarenta = Array.from({ length: 39 }, (_, i) =>
      partido({ id: `m${i}` }),
    );
    const { texto } = informeJornada(vacio({ matches: cuarenta }));
    expect(texto).toContain(
      "39 partidos de la ventana dan del orden de 98 goles",
    );
    expect(texto).toContain("14:00Z-17:00Z");
  });
});

describe("CA-4 peticiones, partidos sin señal y alertas", () => {
  it("suma las peticiones de details, por total, por día y por minuto", () => {
    const { texto, informe } = informeJornada(
      vacio({
        attempts: [
          {
            startedAt: seg(0),
            sourceId: "api-football",
            ok: true,
            error: null,
            requests: 2,
          },
          {
            startedAt: seg(30),
            sourceId: "api-football",
            ok: true,
            error: null,
            requests: 3,
          },
          {
            startedAt: at(24 * 60),
            sourceId: "api-football",
            ok: true,
            error: null,
            requests: 1,
          },
        ],
      }),
    );
    expect(informe.peticiones.total).toBe(6);
    expect(informe.peticiones.porDia).toEqual([
      { dia: "2026-09-25", total: 5 },
      { dia: "2026-09-26", total: 1 },
    ]);
    expect(informe.peticiones.picoPorMinuto).toEqual({
      minuto: "2026-09-25T18:20Z",
      total: 5,
    });
    expect(texto).toContain("presupuesto SPEC-005 N-4");
    expect(texto).toContain("ingest_attempts.details->>'requests'");
    expect(texto).toContain("net._http_response");
  });

  it("marca el presupuesto excedido cuando el pico pasa de seis por minuto", () => {
    const { texto } = informeJornada(
      vacio({
        attempts: [
          {
            startedAt: seg(0),
            sourceId: "api-football",
            ok: true,
            error: null,
            requests: 7,
          },
        ],
      }),
    );
    expect(texto).toContain("EXCEDE");
  });

  it("lista los partidos sin observaciones y los que tienen un hueco de silencio", () => {
    const { texto, informe } = informeJornada(
      vacio({
        matches: [
          partido({ kickoff: seg(0), decidedAt: seg(30 * 60) }),
          partido({ id: "mudo", competitionName: "Tercera RFEF G1" }),
        ],
        observations: [
          obs({ id: "o1", observedAt: seg(0) }),
          obs({ id: "o2", observedAt: seg(30 * 60) }),
        ],
      }),
    );
    expect(informe.sinSenal.sinObservaciones).toEqual([
      { matchId: "mudo", competicion: "Tercera RFEF G1" },
    ]);
    expect(informe.sinSenal.conHuecoLargo).toEqual([
      { matchId: MATCH, competicion: "Segunda División", ms: 30 * 60 * SEC },
    ]);
    expect(texto).toContain("sin ninguna observación: 1");
    expect(texto).toContain("con al menos un hueco > 15 min: 1");
  });

  it("agrupa las alertas por kind, con su partido y sus details, y pide la explicación", () => {
    const { texto, informe } = informeJornada(
      vacio({
        matches: [partido()],
        alerts: [
          {
            kind: "silence",
            matchId: MATCH,
            openedAt: seg(0),
            resolvedAt: null,
            details: { a: 1 },
          },
          {
            kind: "forced_finish",
            matchId: MATCH,
            openedAt: seg(60),
            resolvedAt: null,
            details: {},
          },
        ],
      }),
    );
    expect(informe.alertas.porKind).toEqual([
      { kind: "forced_finish", count: 1 },
      { kind: "silence", count: 1 },
    ]);
    expect(informe.alertas.filas).toHaveLength(2);
    expect(texto).toContain("forced_finish: 1");
    expect(texto).toContain("silence: 1");
    expect(texto).toContain('{"a":1}');
    expect(texto).toContain("explicación:");
  });

  it("unresolved_team y conflict se esperan en cero y bajan el veredicto si aparecen", () => {
    const limpio = informeJornada(vacio({ matches: [partido()] }));
    expect(limpio.texto).toContain("unresolved_team 0, conflict 0");

    const sucio = informeJornada(
      vacio({
        matches: [partido()],
        alerts: [
          {
            kind: "conflict",
            matchId: MATCH,
            openedAt: seg(0),
            resolvedAt: null,
            details: {},
          },
        ],
      }),
    );
    expect(sucio.informe.alertas.inesperadas).toBe(1);
    expect(sucio.informe.veredicto.valor).not.toBe("válida");
  });
});

describe("CA-5 contraste de marcadores", () => {
  const conContraste = () =>
    informeJornada(
      vacio({
        matches: [
          partido(),
          partido({ id: "discrepa", score: { home: 2, away: 1 } }),
        ],
        observations: [
          obs({
            id: "o1",
            matchId: "discrepa",
            observedAt: seg(0),
            rawRef: "raw/viejo.gz",
          }),
          obs({
            id: "o2",
            matchId: "discrepa",
            observedAt: seg(30),
            rawRef: "raw/ultimo.gz",
          }),
        ],
        contraste: [
          {
            matchId: MATCH,
            proveedor: { status: "finished", score: { home: 1, away: 0 } },
          },
          {
            matchId: "discrepa",
            proveedor: { status: "finished", score: { home: 2, away: 2 } },
          },
        ],
      }),
    );

  it("cuenta los coincidentes y aparta cada discrepancia con los dos valores y el raw_ref", () => {
    const { texto, informe } = conContraste();
    expect(informe.contraste).toMatchObject({ total: 2, coinciden: 1 });
    expect(informe.contraste?.discrepancias).toEqual([
      {
        matchId: "discrepa",
        board: { status: "finished", marcador: "2-1" },
        proveedor: { status: "finished", marcador: "2-2" },
        rawRef: "raw/ultimo.gz",
      },
    ]);
    expect(texto).toContain(
      "1 de 2 partidos con `finished` y marcador coincidente",
    );
    expect(texto).toContain("raw/ultimo.gz");
  });

  it("las peticiones del contraste se anotan aparte de las del tick", () => {
    const { texto } = informeJornada(
      vacio({
        matches: [partido()],
        attempts: [
          {
            startedAt: seg(0),
            sourceId: "api-football",
            ok: true,
            error: null,
            requests: 2,
          },
        ],
        contraste: [
          {
            matchId: MATCH,
            proveedor: { status: "finished", score: { home: 1, away: 0 } },
          },
        ],
        contrastePeticiones: 3,
      }),
    );
    expect(texto).toContain("total: 2 peticiones");
    expect(texto).toContain(
      "peticiones del contraste: 3 (aparte de las del tick)",
    );
  });

  it("sin --contrastar el bloque se imprime vacío y dice por qué", () => {
    const { texto } = informeJornada(vacio({ matches: [partido()] }));
    const bloque = texto.slice(
      texto.indexOf(BLOQUES[7]),
      texto.indexOf(BLOQUES[8]),
    );
    expect(bloque).toContain(
      "(sin datos: se generó el informe sin --contrastar)",
    );
  });
});

describe("CA-10 el informe cabe en dos páginas", () => {
  it("las listas largas se recortan con su cuenta, las accionables nunca", () => {
    const muchos = Array.from({ length: 30 }, (_, i) =>
      partido({
        id: `m${i}`,
        kickoff: at(i * 30),
        decidedAt: seg(i * 1800 + 300),
      }),
    );
    const { texto } = informeJornada(
      vacio({
        matches: muchos,
        observations: muchos.flatMap((m, i) => [
          obs({ id: `a${i}`, matchId: m.id, observedAt: seg(i * 1800) }),
          obs({ id: `b${i}`, matchId: m.id, observedAt: seg(i * 1800 + 300) }),
        ]),
        contraste: muchos.map((m) => ({
          matchId: m.id,
          proveedor: {
            status: "finished" as const,
            score: { home: 9, away: 9 },
          },
        })),
      }),
    );
    // Treinta huecos largos, diez impresos y la cuenta del resto.
    expect(texto).toContain("huecos > 90 s: 30");
    expect(texto).toContain("… y 20 más");
    // Los treinta partidos sin señal se recortan, pero el desglose por
    // competición sobrevive al recorte: la forma del problema no se pierde.
    expect(texto).toContain("sin ninguna observación: 0");
    // Las treinta discrepancias se imprimen todas: son lo que hay que trabajar.
    expect(texto).toContain("discrepancias: 30");
    expect(
      texto.slice(texto.indexOf(BLOQUES[7])).match(/board: /g) ?? [],
    ).toHaveLength(30);
  });
});

describe("CA-9 veredicto", () => {
  // Una ventana de una hora con un partido: 120 slots de 30 s esperados.
  const conCobertura = (ticks: number, over: Partial<InformeInput> = {}) =>
    informeJornada(
      vacio({
        desde: DESDE,
        hasta: at(60),
        matches: [partido({ kickoff: at(10), status: "finished" })],
        observations: [
          obs({ id: "o1", observedAt: seg(0) }),
          obs({ id: "o2", observedAt: seg(30) }),
        ],
        attempts: Array.from({ length: ticks }, (_, i) => ({
          startedAt: seg(i * 30),
          sourceId: "api-football",
          ok: true,
          error: null,
          requests: 1,
        })),
        contraste: [
          {
            matchId: MATCH,
            proveedor: { status: "finished", score: { home: 1, away: 0 } },
          },
        ],
        ...over,
      }),
    );

  it("cobertura alta, marcadores coincidentes y nada raro: válida", () => {
    const { informe } = conCobertura(120);
    expect(informe.cobertura).toMatchObject({
      ticksEsperados: 120,
      porcentaje: 1,
    });
    expect(informe.veredicto.valor).toBe("válida");
  });

  it("cobertura entre el 80 % y el 95 %: válida con reservas, y lo dice", () => {
    const { texto, informe } = conCobertura(105);
    expect(informe.veredicto.valor).toBe("válida con reservas");
    expect(informe.veredicto.razones.join(" ")).toContain("cobertura");
    expect(texto).toContain("válida con reservas");
  });

  it("cobertura por debajo del 80 %: no válida, rama c1, ingesta rota", () => {
    const { texto, informe } = conCobertura(90);
    expect(informe.veredicto).toMatchObject({ valor: "no válida", rama: "c1" });
    expect(texto).toContain("ingesta rota");
    expect(texto).toContain("2026-10-02");
  });

  it("una competición sin una sola observación es rama c1", () => {
    const { informe } = conCobertura(120, {
      matches: [
        partido({ kickoff: at(10) }),
        partido({
          id: "muda",
          competitionId: "tercera-rfef-g1",
          competitionName: "Tercera",
        }),
      ],
      observations: [obs({ id: "o1", observedAt: seg(0) })],
    });
    expect(informe.veredicto).toMatchObject({ valor: "no válida", rama: "c1" });
  });

  it("ingesta sana con marcadores que no cuadran es rama c2, y no se repite la jornada", () => {
    const { texto, informe } = conCobertura(120, {
      observations: [
        obs({ id: "o1", observedAt: seg(0) }),
        obs({ id: "o2", observedAt: seg(30) }),
      ],
      contraste: [
        {
          matchId: MATCH,
          proveedor: { status: "finished", score: { home: 9, away: 9 } },
        },
      ],
    });
    expect(informe.veredicto).toMatchObject({ valor: "no válida", rama: "c2" });
    expect(texto).toContain("replay");
    expect(texto).toContain("no se repite");
  });

  it("una intervención sobre el dato invalida; sobre la plataforma solo baja el veredicto", () => {
    expect(
      conCobertura(120, {
        declaraciones: {
          intervencionSobreElDato: ["se insertó una observación a mano"],
        },
      }).informe.veredicto.valor,
    ).toBe("no válida");
    expect(
      conCobertura(120, {
        declaraciones: {
          intervencionSobreLaPlataforma: ["se despausó Supabase"],
        },
      }).informe.veredicto.valor,
    ).toBe("válida con reservas");
  });

  it("lista las declaraciones que no se derivan de la base de datos", () => {
    const { texto, informe } = conCobertura(120);
    expect(informe.veredicto.pendientes.length).toBeGreaterThan(0);
    expect(texto).toContain("declaraciones pendientes");
  });
});

// CA-1, la firma del comando: la cáscara se prueba como la de ingest:tick
// (cli.test.ts), en un cwd sin .env para que ningún secreto real entre en el
// hijo y sin que se abra una sola conexión.
describe("CA-1 npm run informe:jornada", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const cleanCwd = mkdtempSync(path.join(tmpdir(), "marcadorgal-informe-"));
  const cleanEnv = { ...process.env };
  for (const key of [
    "DATABASE_URL",
    "API_FOOTBALL_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "INGEST_TICK_TOKEN",
  ])
    delete cleanEnv[key];

  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [path.join(root, "tools", "informe-jornada.mjs"), ...args],
      { cwd: cleanCwd, env: cleanEnv, encoding: "utf8" },
    );

  it("sin desde y hasta imprime el uso y sale 1", () => {
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("faltan <desde> y <hasta>");
    expect(r.stderr).toContain(
      "<desde> <hasta> [--referencias <fichero>] [--contrastar]",
    );
    expect(r.stdout).toBe("");
  });

  it("rechaza un instante que no es ISO-8601", () => {
    const r = run("ayer", "hoy");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("'ayer' no es un instante ISO-8601");
  });

  it("rechaza una ventana del revés", () => {
    const r = run("2026-09-28T21:00Z", "2026-09-25T18:20Z");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("<desde> tiene que ser anterior a <hasta>");
  });

  it("rechaza una opción desconocida y --referencias sin fichero", () => {
    expect(
      run("2026-09-25T18:20Z", "2026-09-28T21:00Z", "--todo").stderr,
    ).toContain("opción desconocida: --todo");
    expect(
      run("2026-09-25T18:20Z", "2026-09-28T21:00Z", "--referencias").stderr,
    ).toContain("--referencias necesita un fichero");
  });

  it("con la ventana bien formada pero sin DATABASE_URL sale 1 sin abrir conexión", () => {
    const r = run("2026-09-25T18:20Z", "2026-09-28T21:00Z");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("DATABASE_URL is not set");
    expect(r.stdout).toBe("");
  });
});

// V-1. La cobertura de CA-9 se mide sobre la ventana que el tick muestrea de
// verdad: un partido sale de la ventana en cuanto tiene Decision vigente
// `finished` (isInWindow, window.ts), y el motor fuerza ese cierre en
// kickoff + FORCED_FINISH_MINUTES (120). Contar hasta kickoff + 150 mete en el
// denominador media hora por partido que no se puede muestrear nunca, y hace
// estructuralmente imposible el veredicto `válida`.
describe("CA-9 cobertura sobre la ventana efectiva de cada partido", () => {
  const KICKOFFS = [10, 150, 300];
  // Minutos tras el kickoff en que cierra cada partido: un cierre normal,
  // antes del forzoso de los 120.
  const CIERRE = 105;

  const cada30 = (from: Instant, to: Instant): Instant[] => {
    const out: Instant[] = [];
    for (let ms = Date.parse(from); ms < Date.parse(to); ms += 30 * SEC)
      out.push(new Date(ms).toISOString() as Instant);
    return out;
  };

  // Muestreo perfecto: un tick cada 30 s desde kickoff − 10 min hasta el
  // cierre de cada partido, y una observación por tick.
  const jornadaPerfecta = (over: Partial<InformeInput> = {}) => {
    const matches = KICKOFFS.map((k, i) =>
      partido({
        id: `m${i}`,
        kickoff: at(k),
        status: "finished",
        decidedAt: at(k + CIERRE),
      }),
    );
    const attempts: InformeAttemptLike[] = [];
    const observations: ObsLike[] = [];
    for (const [i, k] of KICKOFFS.entries())
      for (const [j, instante] of cada30(
        at(k - 10),
        at(k + CIERRE),
      ).entries()) {
        attempts.push({
          startedAt: instante,
          sourceId: "api-football",
          ok: true,
          error: null,
          requests: 1,
        });
        observations.push(
          obs({ id: `o${i}-${j}`, matchId: `m${i}`, observedAt: instante }),
        );
      }
    return informeJornada(
      vacio({
        matches,
        observations,
        attempts,
        contraste: matches.map((m) => ({
          matchId: m.id,
          proveedor: {
            status: "finished" as const,
            score: { home: 1, away: 0 },
          },
        })),
        ...over,
      }),
    );
  };

  it("con un muestreo perfecto la cobertura es del 100 % y el veredicto puede ser válida", () => {
    const { texto, informe } = jornadaPerfecta();
    // Tres ventanas de 115 min (kickoff − 10 → cierre) a 30 s por tick.
    expect(informe.cobertura.ticksEsperados).toBe(3 * 115 * 2);
    expect(informe.cobertura.ticksReales).toBe(3 * 115 * 2);
    expect(informe.cobertura.porcentaje).toBe(1);
    expect(informe.veredicto.valor).toBe("válida");
    expect(texto).toContain("ticks: 690 de 690 esperados (100 %)");
  });

  it("dice sobre qué ventana se calcula la cobertura, con el número del motor", () => {
    const { texto } = jornadaPerfecta();
    expect(texto).toContain(
      "cobertura sobre la ventana efectiva de cada partido: de kickoff − 10 min al",
    );
    expect(texto).toContain("kickoff + 120 min");
  });

  it("un partido que nunca cerró cuenta su ventana entera, y la cobertura no pasa del 100 %", () => {
    // postponed no sale de la ventana por estado y el cierre forzoso solo
    // dispara desde `live` (RN-02), así que el tick lo muestrea hasta el final
    // de la ventana de ADR-002 §2: 160 min desde kickoff − 10.
    const attempts = cada30(at(0), at(160)).map((startedAt) => ({
      startedAt,
      sourceId: "api-football",
      ok: true as boolean | null,
      error: null,
      requests: 1,
    }));
    const { informe } = informeJornada(
      vacio({
        matches: [
          partido({ kickoff: at(10), status: "postponed", decidedAt: at(9) }),
        ],
        observations: [obs({ id: "o1", observedAt: at(0) })],
        attempts,
      }),
    );
    expect(informe.cobertura.ticksEsperados).toBe(160 * 2);
    expect(informe.cobertura.porcentaje).toBe(1);
  });
});

// V-2. El hueco que va de la última observación de un partido al cierre de su
// ventana efectiva es un hueco como los demás: sin él, un tick que muere a
// mitad de jornada imprime una cadencia perfecta y no aparece en la lista de
// partidos sin señal.
describe("CA-2 (a)/CA-4 (b) el silencio final cuenta", () => {
  // El caso del verificador: observaciones a 0/30/60/90 s y después mudo hasta
  // el final de la ventana, porque el partido nunca llegó a cerrarse.
  const muerto = () =>
    informeJornada(
      vacio({
        matches: [
          partido({ kickoff: at(10), status: "live", decidedAt: at(1) }),
        ],
        observations: [
          obs({ id: "o1", observedAt: seg(0) }),
          obs({ id: "o2", observedAt: seg(30) }),
          obs({ id: "o3", observedAt: seg(60) }),
          obs({ id: "o4", observedAt: seg(90) }),
        ],
      }),
    );

  it("mide el hueco entre la última observación y el cierre de la ventana", () => {
    const { informe } = muerto();
    // Tres huecos de 30 s y el silencio final: de seg(90) a kickoff + 150 min.
    expect(informe.cadencia).toMatchObject({
      n: 4,
      maximo: (160 * 60 - 90) * SEC,
      minimo: 30 * SEC,
    });
  });

  it("el silencio final sale en los huecos largos de CA-2 (a), dicho como lo que es", () => {
    const { texto, informe } = muerto();
    expect(informe.cadencia.huecosLargos).toEqual([
      {
        matchId: MATCH,
        competicion: "Segunda División",
        desde: seg(90),
        ms: (160 * 60 - 90) * SEC,
        final: true,
      },
    ]);
    expect(texto).toContain("huecos > 90 s: 1");
    expect(texto).toContain("hasta el cierre de su ventana");
  });

  it("el partido aparece en la lista de partidos sin señal de CA-4 (b)", () => {
    const { texto, informe } = muerto();
    expect(informe.sinSenal.conHuecoLargo).toEqual([
      {
        matchId: MATCH,
        competicion: "Segunda División",
        ms: (160 * 60 - 90) * SEC,
      },
    ]);
    expect(texto).toContain("con al menos un hueco > 15 min: 1");
  });

  it("un partido muestreado hasta su cierre no inventa ningún hueco", () => {
    const observations: ObsLike[] = [];
    for (let s = 0; s < 115 * 60; s += 30)
      observations.push(obs({ id: `o${s}`, observedAt: seg(s) }));
    const { informe } = informeJornada(
      vacio({
        matches: [
          partido({ kickoff: at(10), status: "finished", decidedAt: at(115) }),
        ],
        observations,
      }),
    );
    expect(informe.cadencia.maximo).toBe(30 * SEC);
    expect(informe.cadencia.huecosLargos).toEqual([]);
    expect(informe.sinSenal.conHuecoLargo).toEqual([]);
  });
});

// V-3. CA-7 contempla «o el estado que el proveedor confirme, con su alerta
// explicada»: un estado no-`finished` en el que board y el proveedor dicen lo
// mismo no es una discrepancia. Discrepancia es que los dos digan cosas
// distintas, y es lo único que puede disparar la rama (c2) «motor equivocado».
describe("CA-5/CA-7 un estado no-finished acordado no es discrepancia", () => {
  // Cobertura sana (120 de 120) con dos partidos: uno finished coincidente y
  // uno postponed que board y proveedor dicen igual.
  const conAcordado = (proveedor: {
    status: MatchStatus;
    score: { home: number; away: number } | null;
  }) =>
    informeJornada(
      vacio({
        hasta: at(60),
        matches: [
          partido({ kickoff: at(10), decidedAt: at(50) }),
          partido({
            id: "aplazado",
            kickoff: at(10),
            status: "postponed",
            score: null,
            decidedAt: at(20),
          }),
        ],
        observations: [
          obs({ id: "o1", observedAt: seg(0) }),
          obs({
            id: "o2",
            matchId: "aplazado",
            observedAt: seg(30),
            rawRef: "raw/a.gz",
          }),
        ],
        attempts: Array.from({ length: 120 }, (_, i) => ({
          startedAt: seg(i * 30),
          sourceId: "api-football",
          ok: true,
          error: null,
          requests: 1,
        })),
        contraste: [
          {
            matchId: MATCH,
            proveedor: { status: "finished", score: { home: 1, away: 0 } },
          },
          { matchId: "aplazado", proveedor },
        ],
      }),
    );

  it("lo cuenta aparte, con su raw_ref y su explicación, y no como discrepancia", () => {
    const { texto, informe } = conAcordado({
      status: "postponed",
      score: null,
    });
    expect(informe.cobertura.porcentaje).toBe(1);
    expect(informe.contraste?.discrepancias).toEqual([]);
    expect(informe.contraste?.acordadosNoFinished).toEqual([
      {
        matchId: "aplazado",
        status: "postponed",
        marcador: "sin marcador",
        rawRef: "raw/a.gz",
      },
    ]);
    expect(texto).toContain("estados no-finished que el proveedor confirma: 1");
    expect(texto).toContain(
      "aplazado  postponed sin marcador  ·  raw_ref: raw/a.gz",
    );
    expect(texto).toContain("discrepancias: 0");
  });

  it("no dispara la rama (c2): baja a válida con reservas y dice por qué", () => {
    const { texto, informe } = conAcordado({
      status: "postponed",
      score: null,
    });
    expect(informe.veredicto).toMatchObject({
      valor: "válida con reservas",
      rama: null,
    });
    expect(informe.veredicto.razones.join(" ")).toContain("no-finished");
    expect(texto).not.toContain("no válida");
  });

  it("la cuenta de CA-5 se sigue imprimiendo tal cual", () => {
    const { texto } = conAcordado({ status: "postponed", score: null });
    expect(texto).toContain(
      "1 de 2 partidos con `finished` y marcador coincidente.",
    );
  });

  it("si los dos dicen cosas distintas sigue siendo discrepancia y rama (c2)", () => {
    const { informe } = conAcordado({
      status: "finished",
      score: { home: 2, away: 2 },
    });
    expect(informe.contraste?.acordadosNoFinished).toEqual([]);
    expect(informe.contraste?.discrepancias).toHaveLength(1);
    expect(informe.veredicto).toMatchObject({ valor: "no válida", rama: "c2" });
  });
});

// V-4. CA-10 pide que el informe quepa en dos páginas, y eso es un número: sin
// medirlo, el bloque 7 imprimía dos líneas por alerta sin tope y un
// forced_finish por partido (39, un escenario plausible) lo llevaba a 204
// líneas. La jornada realista es la del 2026-09-25/28: 39 partidos en cuatro
// competiciones, muestreo completo a 30 s, 12 referencias y su contraste.
describe("CA-10 el informe cabe en dos páginas, medido en líneas", () => {
  const COMPS: readonly [string, string, number][] = [
    ["segunda-division", "Segunda División", 11],
    ["primera-rfef-g1", "Primeira Federación · Grupo 1", 10],
    ["segunda-rfef-g1", "Segunda Federación · Grupo 1", 9],
    ["tercera-rfef-g1", "Terceira Federación · Grupo 1", 9],
  ];

  const realista = (alertas: number) => {
    const matches: InformeMatchLike[] = [];
    let i = 0;
    for (const [competitionId, competitionName, n] of COMPS)
      for (let k = 0; k < n; k += 1) {
        matches.push(
          partido({
            id: `m${i}`,
            competitionId,
            competitionName,
            round: 4,
            kickoff: at(10 + i * 70),
            decidedAt: at(10 + i * 70 + 105),
          }),
        );
        i += 1;
      }
    const observations: ObsLike[] = [];
    const attempts: InformeAttemptLike[] = [];
    for (const [j, m] of matches.entries())
      for (
        let ms = Date.parse(m.kickoff) - 10 * MINUTE_MS;
        ms < Date.parse(m.decidedAt ?? m.kickoff);
        ms += 30 * SEC
      ) {
        const instante = new Date(ms).toISOString() as Instant;
        observations.push(
          obs({ id: `o${j}-${ms}`, matchId: m.id, observedAt: instante }),
        );
        attempts.push({
          startedAt: instante,
          sourceId: "api-football",
          ok: true,
          error: null,
          requests: 1,
        });
      }
    return informeJornada(
      vacio({
        matches,
        observations,
        attempts,
        decisions: matches.map((m, j) =>
          dec({
            id: `d${j}`,
            matchId: m.id,
            status: "finished",
            score: { home: 1, away: 0 },
            decidedAt: m.decidedAt ?? m.kickoff,
            observationIds: [],
          }),
        ),
        referencias: Array.from({ length: 12 }, (_, k) => ({
          matchId: `m${k}`,
          marcador: "1-0",
          instante: at(10 + k * 70 + 50),
          fuente: "radio",
        })),
        alerts: Array.from({ length: alertas }, (_, k) => ({
          kind: k % 2 === 0 ? "forced_finish" : "silence",
          matchId: `m${k % 39}`,
          openedAt: at(10 + (k % 39) * 70 + 100),
          resolvedAt: null,
          details: {
            score: { home: 1, away: 0 },
            minute: 90,
            kickoff: at(10 + (k % 39) * 70),
            lastObservedAt: at(10 + (k % 39) * 70 + 90),
            lastStatus: "live",
          },
        })),
        contraste: matches.map((m) => ({
          matchId: m.id,
          proveedor: {
            status: "finished" as const,
            score: { home: 1, away: 0 },
          },
        })),
        contrastePeticiones: 2,
      }),
    );
  };

  const lineas = (texto: string) => texto.split("\n").length;

  it("la jornada realista con ocho alertas no pasa del tope", () => {
    const { texto, informe } = realista(8);
    expect(informe.cobertura.porcentaje).toBe(1);
    expect(lineas(texto)).toBeLessThanOrEqual(INFORME_MAX_LINEAS);
  });

  it("un forced_finish por partido tampoco: el bloque 7 se recorta como las demás listas", () => {
    const { texto, informe } = realista(39);
    expect(informe.alertas.filas).toHaveLength(39);
    expect(texto).toContain("abiertas en la ventana: 39");
    // Cada lista gasta como mucho diez líneas, y una alerta cuesta dos.
    expect(texto).toContain("… y 34 más, explicadas por kind");
    expect(lineas(texto)).toBeLessThanOrEqual(INFORME_MAX_LINEAS);
  });

  it("sin ninguna fila también cabe, y el tope son dos páginas de verdad", () => {
    expect(lineas(informeJornada(vacio()).texto)).toBeLessThanOrEqual(
      INFORME_MAX_LINEAS,
    );
    // Dos páginas de texto monoespaciado, no «casi dos páginas».
    expect(INFORME_MAX_LINEAS).toBeLessThanOrEqual(150);
  });
});
