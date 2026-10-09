import { describe, expect, it } from "vitest";
import {
  construirInforme,
  type InformeLatencia,
  informeMarkdown,
  parseCalibracion,
} from "./informe-latencia.ts";
import type { GolMedido, Latencia } from "./latencia.ts";
import { parseSonda } from "./sonda.ts";

// SPEC-025 CA-5: the one-page report and its projected scenarios, with the
// formulas fixed by the spec before measuring.
const T0 = Date.parse("2026-10-17T16:00:00.000Z");
const t = (s: number) => new Date(T0 + s * 1000).toISOString();

function gol(
  i: number,
  over: Partial<GolMedido["tramos"]> & {
    competitionId?: string;
    estado?: GolMedido["estado"];
    motivos?: string[];
    manual?: string | null;
    referencia?: GolMedido["referencia"];
  } = {},
): GolMedido {
  const { competitionId, estado, motivos, manual, referencia, ...tramos } =
    over;
  return {
    matchId: `m${i}`,
    competitionId: competitionId ?? "segunda-division",
    k: 1,
    estado: estado ?? "valido",
    version: 2,
    recordedAt: t(60),
    referencia:
      referencia === undefined ? { from: t(10), to: t(70) } : referencia,
    manual: manual ?? null,
    pintura: { paintedAt: t(80), version: 2, ruta: "/", origen: "a" },
    respuesta: { age: 5, xVercelCache: "HIT", estado: 200 },
    tramos: {
      muestreo: 30_000,
      peticionCrudo: 800,
      parseMotor: 300,
      entrega: 18_500,
      cdn: 5_000,
      espera: 13_500,
      total: 40_000,
      totalManual: null,
      residuo: 9_600,
      ...tramos,
    },
    motivos: motivos ?? [],
  };
}

const latencia = (goles: GolMedido[]): Latencia => ({
  goles,
  juntas: {
    tickBase: { mediana: 350, n: 120 },
    baseSonda: { mediana: 900, n: 400, resolucionMs: 1000 },
    residuo: { mediana: 9_600, n: goles.length },
  },
});

const sonda = parseSonda(
  [
    { tipo: "inicio", instante: t(0) },
    { tipo: "visibilidad", ruta: "/", estado: "visible", instante: t(60) },
  ]
    .map((l) => JSON.stringify(l))
    .join("\n"),
  "sonda-a.jsonl",
);

function seeded(): InformeLatencia {
  return construirInforme({
    desde: "2026-10-16T18:20:00.000Z",
    hasta: "2026-10-19T21:00:00.000Z",
    latencia: latencia([
      gol(1, {
        total: 40_000,
        entrega: 18_500,
        manual: t(36),
        totalManual: 44_000,
      }),
      gol(2, {
        total: 50_000,
        entrega: 20_000,
        competitionId: "tercera-rfef-g1",
        manual: t(42),
        totalManual: 38_000,
      }),
      gol(3, { total: 100_000, entrega: 30_000 }),
      gol(4, {
        total: null,
        residuo: null,
        referencia: null,
        motivos: ["sin referencia"],
      }),
      gol(5, {
        estado: "anulado",
        total: null,
        residuo: null,
        referencia: null,
        motivos: ["anulado: bajada en v3"],
      }),
    ]),
    sonda,
    ficherosSonda: ["sonda-a.jsonl"],
    calibracionNoCasada: [],
    peticionesPorDia: [
      { dia: "2026-10-17", total: 1_400 },
      { dia: "2026-10-18", total: 2_100 },
    ],
  });
}

describe("SPEC-025 CA-5 construirInforme", () => {
  const informe = seeded();

  it("counts n by competition, by reference and by state, nothing hidden", () => {
    expect(informe.n.goles).toBe(5);
    expect(informe.n.porCompeticion).toEqual([
      { competitionId: "segunda-division", n: 4 },
      { competitionId: "tercera-rfef-g1", n: 1 },
    ]);
    expect(informe.n.porReferencia).toEqual({
      proveedor: 3,
      manual: 2,
      sinReferencia: 1,
    });
    expect(informe.n.porMotivo).toEqual([
      { motivo: "anulado: bajada en v3", n: 1 },
      { motivo: "sin referencia", n: 1 },
    ]);
  });

  it("per stretch: median, p95 or worst case (n < 20) and maximum", () => {
    expect(informe.tramos.total).toEqual({
      n: 3,
      mediana: 50_000,
      p95: 100_000,
      maximo: 100_000,
    });
    expect(informe.tramos.entrega.n).toBe(5);
  });

  it("the calibration against the provider's interval: bias and spread", () => {
    // manual − middle of [10, 70): 36 − 40 = −4 s and 42 − 40 = +2 s.
    expect(informe.calibracion).toEqual({
      n: 2,
      sesgo: -4_000,
      dispersion: 4_000,
      dentroDelIntervalo: 2,
      noCasadas: [],
    });
  });

  it("projects the scenarios with the formulas of the spec", () => {
    const [polling, realtime, tick15] = informe.escenarios;
    expect(polling.nombre).toMatch(/polling/);
    expect(polling.stats.mediana).toBe(50_000);
    // Realtime = total − (d) + 5 s: 40−18.5+5, 50−20+5, 100−30+5.
    expect(realtime.stats).toMatchObject({
      n: 3,
      mediana: 35_000,
      maximo: 75_000,
    });
    // − 7.5 s more.
    expect(tick15.stats).toMatchObject({ mediana: 27_500, maximo: 67_500 });
    expect(informe.peticiones).toEqual({
      maxPorDia: 2_100,
      doble: 4_200,
      presupuesto: 3_000,
      planPro: 7_500,
    });
  });

  it("a verdict per objective: median < 45 s and p95 < 90 s", () => {
    expect(informe.veredicto).toEqual({
      mediana: "no cumple",
      p95: "no se contrasta",
    });
  });
});

describe("SPEC-025 CA-5 informeMarkdown", () => {
  const md = informeMarkdown(seeded());

  it("is one page with every section", () => {
    for (const heading of [
      "# Latencia gol → pantalla",
      "## n",
      "## Tramos",
      "## Total contra el objetivo",
      "## Calibración manual",
      "## Juntas",
      "## Escenarios proyectados",
      "## Sonda",
    ])
      expect(md).toContain(heading);
    expect(md.split("\n").length).toBeLessThan(90);
  });

  it("prints the worst case with its n below twenty samples (SPEC-009 CA-3)", () => {
    expect(md).toContain("peor caso (n=3)");
    expect(md).toMatch(
      /\| \(e\) total \| 3 \| 50\.0 s \| 100\.0 s \| 100\.0 s \|/,
    );
  });

  it("prints the joints and the scenarios with their formulas", () => {
    expect(md).toContain("tick ↔ base");
    expect(md).toContain("0.35 s");
    expect(md).toContain("±1 s");
    expect(md).toContain("total − (d) + 5 s");
    expect(md).toContain("4200");
  });

  it("says the verdict per objective", () => {
    expect(md).toContain("mediana < 45 s: **no cumple**");
    expect(md).toContain("p95 < 90 s: **no se contrasta**");
  });
});

describe("SPEC-025 CA-5 the verdict", () => {
  it("below twenty samples, a worst case under 90 s is enough for the p95", () => {
    const informe = construirInforme({
      desde: t(0),
      hasta: t(3600),
      latencia: latencia([
        gol(1, { total: 30_000 }),
        gol(2, { total: 40_000 }),
      ]),
      sonda,
      ficherosSonda: [],
      calibracionNoCasada: [],
      peticionesPorDia: [],
    });
    expect(informe.veredicto).toEqual({ mediana: "cumple", p95: "cumple" });
  });

  it("with no total at all there is no verdict, and it says so", () => {
    const informe = construirInforme({
      desde: t(0),
      hasta: t(3600),
      latencia: latencia([]),
      sonda,
      ficherosSonda: [],
      calibracionNoCasada: [],
      peticionesPorDia: [],
    });
    expect(informe.veredicto).toEqual({
      mediana: "sin datos",
      p95: "sin datos",
    });
    expect(informeMarkdown(informe)).toContain("sin datos");
  });
});

describe("SPEC-025 CA-5 parseCalibracion", () => {
  it("reads matchId,gol,instante and rejects what it cannot read, saying why", () => {
    const { filas, noCasadas } = parseCalibracion(
      [
        "matchId,gol,instante,nota",
        "segunda-division-2026-27-j10-a-b,1,2026-10-17T16:31:12Z,Radio Galega",
        "x,0,2026-10-17T16:31:12Z",
        "y,2,17/10 16:31",
        "",
      ].join("\n"),
    );
    expect(filas).toEqual([
      {
        matchId: "segunda-division-2026-27-j10-a-b",
        gol: 1,
        instante: "2026-10-17T16:31:12.000Z",
      },
    ]);
    expect(noCasadas.map((n) => n.motivo)).toEqual([
      "gol no es un entero ≥ 1",
      "instante no es ISO-8601 con Z",
    ]);
  });
});

describe("SPEC-025 CA-2 referenciasDe", () => {
  it("maps each fixture's goals to its match through the alias; a fixture with no alias is not ours", async () => {
    const { referenciasDe } = await import("./informe-latencia.ts");
    const refs = referenciasDe(
      [
        {
          fixtureId: "1",
          leagueId: "141",
          periods: { first: null, second: null },
          goals: [
            {
              order: 1,
              elapsed: 7,
              extra: null,
              detail: "Normal Goal",
              teamId: "9",
              interval: null,
              reason: "no_periods",
            },
          ],
        },
        {
          fixtureId: "2",
          leagueId: "39",
          periods: { first: null, second: null },
          goals: [],
        },
      ],
      (id) => (id === "1" ? "segunda-division-x" : undefined),
    );
    expect(refs).toEqual([
      {
        matchId: "segunda-division-x",
        order: 1,
        interval: null,
        reason: "no_periods",
      },
    ]);
  });
});
