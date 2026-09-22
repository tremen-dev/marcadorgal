import { describe, expect, it } from "vitest";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { INFORME_P95_MIN_SAMPLES } from "./constants.ts";
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
        matches: [partido()],
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
        matches: [partido()],
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
        matches: [partido(), partido({ id: "otro" })],
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
        matches: [partido()],
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
          partido(),
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
      partido({ id: `m${i}`, kickoff: at(i * 30) }),
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
