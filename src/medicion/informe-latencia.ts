import {
  INFORME_MEDIAN_TARGET_SECONDS,
  INFORME_P95_MIN_SAMPLES,
  INFORME_P95_TARGET_SECONDS,
  INFORME_REQUESTS_PER_DAY,
} from "../ingest/constants.ts";
import { etiquetaP95, percentil } from "../ingest/informe.ts";
import { type Instant, instantDiff } from "../model/index.ts";
import type { FixtureGoals } from "../sources/api-football/events.ts";
import type {
  GolMedido,
  Juntas,
  LatCalibracion,
  Latencia,
  LatReferencia,
  Tramos,
} from "./latencia.ts";
import type { Sonda } from "./sonda.ts";

// SPEC-025 CA-5. The one-page latency report, pure: rows in, Markdown out.
// tools/informe-latencia.mjs is the shell. The scenarios are projections with
// the formulas fixed by the spec before measuring:
//   Realtime          = total − (d) + 5 s (the bound of SPEC-024 CA-10, lab)
//   Realtime + 15 s   = Realtime − 7.5 s, with requests/day × 2

export const REALTIME_BOUND_MS = 5_000;
export const TICK_15_GAIN_MS = 7_500;
// SPEC-005 N-4: the Pro plan allows 7.500 requests a day; the project's own
// budget is INFORME_REQUESTS_PER_DAY (≈ 3.000 a matchday).
export const PLAN_PRO_REQUESTS_PER_DAY = 7_500;

export type EstadTramo = {
  n: number;
  mediana: number | null;
  p95: number | null;
  maximo: number | null;
};

type TramoKey = Exclude<keyof Tramos, "totalManual">;

export type Escenario = { nombre: string; formula: string; stats: EstadTramo };

export type Veredicto =
  | "cumple"
  | "no cumple"
  | "no se contrasta"
  | "sin datos";

export type NoCasada = { fila: string; motivo: string };

export type InformeLatencia = {
  desde: Instant;
  hasta: Instant;
  n: {
    goles: number;
    porEstado: { estado: string; n: number }[];
    porCompeticion: { competitionId: string; n: number }[];
    porReferencia: { proveedor: number; manual: number; sinReferencia: number };
    porMotivo: { motivo: string; n: number }[];
  };
  tramos: Record<TramoKey, EstadTramo>;
  totalManual: EstadTramo;
  calibracion: {
    n: number;
    sesgo: number | null;
    dispersion: number | null;
    dentroDelIntervalo: number;
    noCasadas: NoCasada[];
  };
  juntas: Juntas;
  escenarios: Escenario[];
  peticiones: {
    maxPorDia: number | null;
    doble: number | null;
    presupuesto: number;
    planPro: number;
  };
  sonda: {
    ficheros: string[];
    pinturas: number;
    respuestas: number;
    noVisibles: number;
    erroresSonda: number;
    lineasInvalidas: number;
  };
  veredicto: { mediana: Veredicto; p95: Veredicto };
};

export type InformeLatenciaInput = {
  desde: Instant;
  hasta: Instant;
  latencia: Latencia;
  sonda: Sonda;
  ficherosSonda: string[];
  calibracionNoCasada: NoCasada[];
  peticionesPorDia: { dia: string; total: number }[];
};

const stats = (values: readonly number[]): EstadTramo => ({
  n: values.length,
  mediana: percentil(values, 0.5),
  p95: percentil(values, 0.95),
  maximo: percentil(values, 1),
});

const present = (values: readonly (number | null)[]): number[] =>
  values.filter((x): x is number => x !== null);

const counted = <T extends string>(keys: readonly T[]) => {
  const map = new Map<T, number>();
  for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1);
  return [...map].sort((a, b) => a[0].localeCompare(b[0]));
};

const TRAMOS: readonly TramoKey[] = [
  "muestreo",
  "peticionCrudo",
  "parseMotor",
  "entrega",
  "cdn",
  "espera",
  "total",
  "residuo",
];

function veredictoMediana(s: EstadTramo): Veredicto {
  if (s.mediana === null) return "sin datos";
  return s.mediana < INFORME_MEDIAN_TARGET_SECONDS * 1000
    ? "cumple"
    : "no cumple";
}

// Below twenty samples the p95 is not a statistic (SPEC-009 CA-3); but if
// even the worst case is under the target, so is any p95 of those samples.
function veredictoP95(s: EstadTramo): Veredicto {
  if (s.p95 === null || s.maximo === null) return "sin datos";
  const target = INFORME_P95_TARGET_SECONDS * 1000;
  if (s.n >= INFORME_P95_MIN_SAMPLES)
    return s.p95 < target ? "cumple" : "no cumple";
  return s.maximo < target ? "cumple" : "no se contrasta";
}

export function construirInforme(input: InformeLatenciaInput): InformeLatencia {
  const goles = input.latencia.goles;
  const vivos = goles.filter((g) => g.estado !== "anulado");
  const tramos = Object.fromEntries(
    TRAMOS.map((k) => [k, stats(present(goles.map((g) => g.tramos[k])))]),
  ) as Record<TramoKey, EstadTramo>;

  const calibrados = vivos.filter(
    (
      g,
    ): g is GolMedido & {
      manual: Instant;
      referencia: { from: Instant; to: Instant };
    } => g.manual !== null && g.referencia !== null,
  );
  const sesgos = calibrados.map((g) =>
    instantDiff(
      new Date(Date.parse(g.referencia.from) + 30_000).toISOString(),
      g.manual,
    ),
  );

  const realtime = present(
    goles.map((g) =>
      g.tramos.total === null || g.tramos.entrega === null
        ? null
        : g.tramos.total - g.tramos.entrega + REALTIME_BOUND_MS,
    ),
  );
  const maxPorDia =
    input.peticionesPorDia.length === 0
      ? null
      : Math.max(...input.peticionesPorDia.map((d) => d.total));

  return {
    desde: input.desde,
    hasta: input.hasta,
    n: {
      goles: goles.length,
      porEstado: counted(goles.map((g) => g.estado)).map(([estado, n]) => ({
        estado,
        n,
      })),
      porCompeticion: counted(goles.map((g) => g.competitionId)).map(
        ([competitionId, n]) => ({ competitionId, n }),
      ),
      porReferencia: {
        proveedor: vivos.filter((g) => g.referencia !== null).length,
        manual: vivos.filter((g) => g.manual !== null).length,
        sinReferencia: vivos.filter((g) => g.referencia === null).length,
      },
      porMotivo: counted(goles.flatMap((g) => g.motivos)).map(
        ([motivo, n]) => ({ motivo, n }),
      ),
    },
    tramos,
    totalManual: stats(present(goles.map((g) => g.tramos.totalManual))),
    calibracion: {
      n: calibrados.length,
      sesgo: percentil(sesgos, 0.5),
      dispersion: percentil(
        sesgos.map((x) => Math.abs(x)),
        0.95,
      ),
      dentroDelIntervalo: calibrados.filter(
        (g) => g.manual >= g.referencia.from && g.manual < g.referencia.to,
      ).length,
      noCasadas: input.calibracionNoCasada,
    },
    juntas: input.latencia.juntas,
    escenarios: [
      {
        nombre: "polling actual (medido)",
        formula: "total",
        stats: tramos.total,
      },
      {
        nombre: "Realtime (proyectado)",
        formula: "total − (d) + 5 s",
        stats: stats(realtime),
      },
      {
        nombre: "Realtime + tick a 15 s (proyectado)",
        formula: "total − (d) + 5 s − 7,5 s; peticiones/día × 2",
        stats: stats(realtime.map((x) => x - TICK_15_GAIN_MS)),
      },
    ],
    peticiones: {
      maxPorDia,
      doble: maxPorDia === null ? null : maxPorDia * 2,
      presupuesto: INFORME_REQUESTS_PER_DAY,
      planPro: PLAN_PRO_REQUESTS_PER_DAY,
    },
    sonda: {
      ficheros: input.ficherosSonda,
      pinturas: input.sonda.pinturas.length,
      respuestas: input.sonda.respuestas.length,
      noVisibles: input.sonda.noVisibles,
      erroresSonda: input.sonda.erroresSonda.length,
      lineasInvalidas: input.sonda.lineasInvalidas.length,
    },
    veredicto: {
      mediana: veredictoMediana(tramos.total),
      p95: veredictoP95(tramos.total),
    },
  };
}

// ------------------------------------------------------------------ Markdown

const seg = (ms: number | null, decimals = 1) =>
  ms === null ? "—" : `${(ms / 1000).toFixed(decimals)} s`;

const NOMBRES: Record<TramoKey, string> = {
  muestreo: "(a) muestreo · reloj del tick",
  peticionCrudo: "(b) petición + crudo · reloj de la base",
  parseMotor: "(c) parse + inserción + motor · reloj de la base",
  entrega: "(d) entrega · junta base ↔ sonda",
  cdn: "(d1) CDN (Age)",
  espera: "(d2) espera de polling",
  total: "(e) total",
  residuo: "residuo (suma − total)",
};

const fila = (nombre: string, s: EstadTramo) =>
  `| ${nombre} | ${s.n} | ${seg(s.mediana)} | ${seg(s.p95)} | ${seg(s.maximo)} |`;

export function informeMarkdown(i: InformeLatencia): string {
  const total = i.tramos.total;
  const p95Label = etiquetaP95(total.n);
  const out: string[] = [
    "# Latencia gol → pantalla (SPEC-025)",
    "",
    `Ventana: ${i.desde} → ${i.hasta}. Cada tramo en su reloj (D-9, ADR-016); la columna p95 es el peor caso con n < ${INFORME_P95_MIN_SAMPLES}.`,
    "",
    "## n",
    "",
    `- Goles: ${i.n.goles} (${i.n.porEstado.map((e) => `${e.estado} ${e.n}`).join(", ") || "ninguno"}).`,
    `- Por competición: ${i.n.porCompeticion.map((c) => `${c.competitionId} ${c.n}`).join(", ") || "—"}.`,
    `- Por referencia: proveedor ${i.n.porReferencia.proveedor}, manual ${i.n.porReferencia.manual}, sin referencia ${i.n.porReferencia.sinReferencia}.`,
    `- Motivos (un gol puede tener varios): ${i.n.porMotivo.map((m) => `${m.motivo} ${m.n}`).join("; ") || "ninguno"}.`,
    "",
    "## Tramos",
    "",
    "| Tramo | n | mediana | p95 | máximo |",
    "|---|---|---|---|---|",
    ...TRAMOS.map((k) => fila(NOMBRES[k], i.tramos[k])),
    fila("(e') total contra la anotación manual", i.totalManual),
    "",
    "## Total contra el objetivo",
    "",
    `- mediana < ${INFORME_MEDIAN_TARGET_SECONDS} s: **${i.veredicto.mediana}** — ${seg(total.mediana)} (n=${total.n}).`,
    `- p95 < ${INFORME_P95_TARGET_SECONDS} s: **${i.veredicto.p95}** — ${p95Label} = ${seg(total.p95)}.`,
    "",
    "## Calibración manual",
    "",
    `- n = ${i.calibracion.n}; sesgo (mediana de manual − centro del intervalo) ${seg(i.calibracion.sesgo)}; dispersión (${etiquetaP95(i.calibracion.n)} de |manual − centro|) ${seg(i.calibracion.dispersion)}; dentro del intervalo del proveedor ${i.calibracion.dentroDelIntervalo} de ${i.calibracion.n}.`,
    ...(i.calibracion.noCasadas.length === 0
      ? []
      : [
          `- Filas no casadas: ${i.calibracion.noCasadas.map((n) => `«${n.fila}» (${n.motivo})`).join("; ")}.`,
        ]),
    "",
    "## Juntas",
    "",
    `- tick ↔ base: mediana de opened_at − started_at ${seg(i.juntas.tickBase.mediana, 2)} (n=${i.juntas.tickBase.n}).`,
    `- base ↔ sonda: mediana de instante local − cabecera Date ${seg(i.juntas.baseSonda.mediana, 2)} (n=${i.juntas.baseSonda.n}; ±${i.juntas.baseSonda.resolucionMs / 1000} s).`,
    `- residuo: mediana ${seg(i.juntas.residuo.mediana)} (n=${i.juntas.residuo.n}).`,
    "",
    "## Escenarios proyectados",
    "",
    "| Escenario | fórmula | n | mediana | p95 | máximo |",
    "|---|---|---|---|---|---|",
    ...i.escenarios.map(
      (e) =>
        `| ${e.nombre} | ${e.formula} | ${e.stats.n} | ${seg(e.stats.mediana)} | ${seg(e.stats.p95)} | ${seg(e.stats.maximo)} |`,
    ),
    "",
    `Peticiones/día: máximo medido ${i.peticiones.maxPorDia ?? "—"}; con tick a 15 s ${i.peticiones.doble ?? "—"} frente al presupuesto ${i.peticiones.presupuesto} (SPEC-005 N-4) y al plan Pro ${i.peticiones.planPro}.`,
    "",
    "## Sonda",
    "",
    `- Ficheros: ${i.sonda.ficheros.join(", ") || "ninguno"}.`,
    `- Pinturas ${i.sonda.pinturas}, respuestas de /api/board ${i.sonda.respuestas}, comprobaciones no visibles ${i.sonda.noVisibles}, errores de la sonda ${i.sonda.erroresSonda}, líneas ilegibles ${i.sonda.lineasInvalidas}.`,
  ];
  return out.join("\n");
}

// ---------------------------------------------------------- calibration CSV

// H-1: the owner's notes, `matchId,gol,instante[,nota]`, the instant to the
// second, ISO-8601 with Z. What cannot be read is returned with its reason.
export function parseCalibracion(csv: string): {
  filas: LatCalibracion[];
  noCasadas: NoCasada[];
} {
  const filas: LatCalibracion[] = [];
  const noCasadas: NoCasada[] = [];
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  for (const [n, line] of lines.entries()) {
    const [matchId = "", gol = "", instante = ""] = line
      .split(",")
      .map((c) => c.trim());
    if (n === 0 && matchId === "matchId") continue;
    if (matchId === "") {
      noCasadas.push({ fila: line, motivo: "sin matchId" });
      continue;
    }
    if (!/^[1-9]\d*$/.test(gol)) {
      noCasadas.push({ fila: line, motivo: "gol no es un entero ≥ 1" });
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(instante)) {
      noCasadas.push({ fila: line, motivo: "instante no es ISO-8601 con Z" });
      continue;
    }
    filas.push({
      matchId,
      gol: Number(gol),
      instante: new Date(Date.parse(instante)).toISOString(),
    });
  }
  return { filas, noCasadas };
}

// The provider's goals of each fixture as the references of their match
// (CA-2): the alias file says which match a fixture is. A fixture with no
// alias is not one of ours and is left out.
export function referenciasDe(
  fixtures: readonly FixtureGoals[],
  matchOf: (fixtureId: string) => string | undefined,
): LatReferencia[] {
  return fixtures.flatMap((f) => {
    const matchId = matchOf(f.fixtureId);
    if (matchId === undefined) return [];
    return f.goals.map((g) => ({
      matchId,
      order: g.order,
      interval: g.interval,
      reason: g.reason,
    }));
  });
}
