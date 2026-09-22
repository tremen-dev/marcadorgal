import { SILENCE_MINUTES } from "../decide/thresholds.ts";
import {
  HOUR_MS,
  type Instant,
  instantDiff,
  type MatchStatus,
  MINUTE_MS,
  type Score,
} from "../model/index.ts";
import {
  INFORME_COVERAGE_RESERVED,
  INFORME_COVERAGE_VALID,
  INFORME_FILAS_MOSTRADAS,
  INFORME_GAP_SECONDS,
  INFORME_GOALS_PER_MATCH,
  INFORME_MEDIAN_TARGET_SECONDS,
  INFORME_P95_MIN_SAMPLES,
  INFORME_P95_TARGET_SECONDS,
  INFORME_REQUESTS_PER_DAY,
  INFORME_REQUESTS_PER_MINUTE,
  INFORME_TICK_SECONDS,
  WINDOW_AFTER_MINUTES,
  WINDOW_BEFORE_MINUTES,
} from "./constants.ts";

// SPEC-009 CA-1. The whole arithmetic of the matchday report as pure
// functions over rows: no database, no clock, no network, no fetch.
// tools/informe-jornada.mjs is the shell that queries DATABASE_URL and writes
// the file, the same split as src/ingest/salud.ts + tools/tick-salud.mjs.

// ---------------------------------------------------------------- input rows

export type InformeMatch = {
  id: string;
  competitionId: string;
  competitionName: string;
  round: number;
  kickoff: Instant;
  // The current Decision, as board projects it ('scheduled' when there is none).
  status: MatchStatus;
  score: Score | null;
  decidedAt: Instant | null;
};

export type InformeObservation = {
  id: string;
  matchId: string;
  observedAt: Instant;
  status: MatchStatus;
  score: Score | null;
  rawRef: string;
};

export type InformeDecision = {
  id: string;
  matchId: string;
  version: number;
  status: MatchStatus;
  score: Score | null;
  rule: string;
  decidedAt: Instant;
  observationIds: readonly string[];
};

// requests comes from ingest_attempts.details->>'requests' and never from
// net._http_response, which pg_net prunes within hours (N-2).
export type InformeAttempt = {
  startedAt: Instant;
  sourceId: string;
  ok: boolean | null;
  error: string | null;
  requests: number;
};

export type InformeAlert = {
  kind: string;
  matchId: string | null;
  openedAt: Instant;
  resolvedAt: Instant | null;
  details: unknown;
};

// One hand-written line of referencias.csv (CA-3).
export type Referencia = {
  matchId: string;
  marcador: string;
  instante: Instant;
  fuente: string;
};

export type NoCasada = { fila: string; motivo: string };

// What the provider answered for one match of the window (CA-5); proveedor
// null when it did not answer for it at all.
export type ContrasteFila = {
  matchId: string;
  proveedor: { status: MatchStatus; score: Score | null } | null;
};

// The three facts of CA-9 that no query can answer: a person declares them.
export type Declaraciones = {
  intervencionSobreElDato?: readonly string[];
  intervencionSobreLaPlataforma?: readonly string[];
  alertasExplicadas?: boolean;
};

export type InformeInput = {
  desde: Instant;
  hasta: Instant;
  // Values that must never reach the output, whatever row carried them.
  secrets: readonly string[];
  // The five competitions of D-3, to count how many of them were measured.
  competicionesDeclaradas: readonly string[];
  matches: readonly InformeMatch[];
  observations: readonly InformeObservation[];
  decisions: readonly InformeDecision[];
  attempts: readonly InformeAttempt[];
  alerts: readonly InformeAlert[];
  referencias: readonly Referencia[];
  referenciasNoCasadas: readonly NoCasada[];
  contraste: readonly ContrasteFila[] | null;
  // Requests the contrast made, noted apart from the tick's (CA-5, RN-08).
  contrastePeticiones?: number;
  declaraciones?: Declaraciones;
};

// --------------------------------------------------------------- output shape

export type Estadisticos = {
  n: number;
  mediana: number | null;
  p95: number | null;
  maximo: number | null;
  minimo: number | null;
};

export type HuecoLargo = {
  matchId: string;
  competicion: string;
  desde: Instant;
  ms: number;
};

export type Veredicto = {
  valor: "válida" | "válida con reservas" | "no válida";
  rama: "c1" | "c2" | null;
  razones: readonly string[];
  pendientes: readonly string[];
};

export type Informe = {
  desde: Instant;
  hasta: Instant;
  cobertura: {
    competiciones: readonly { id: string; nombre: string; partidos: number }[];
    sinPartidos: readonly string[];
    partidos: number;
    ticksEsperados: number;
    ticksReales: number;
    porcentaje: number | null;
    horasSinEjecuciones: readonly Instant[];
    intentosFueraDeVentana: number;
    intentosFallidos: number;
  };
  cadencia: Estadisticos & { huecosLargos: readonly HuecoLargo[] };
  latenciaInterna: Estadisticos;
  techoPropio: number | null;
  latenciaExterna: Estadisticos & { noCasadas: readonly NoCasada[] };
  peticiones: {
    total: number;
    intentos: number;
    porDia: readonly { dia: string; total: number }[];
    picoPorMinuto: { minuto: string; total: number } | null;
  };
  sinSenal: {
    sinObservaciones: readonly { matchId: string; competicion: string }[];
    conHuecoLargo: readonly {
      matchId: string;
      competicion: string;
      ms: number;
    }[];
  };
  alertas: {
    porKind: readonly { kind: string; count: number }[];
    filas: readonly InformeAlert[];
    inesperadas: number;
  };
  contraste: {
    total: number;
    coinciden: number;
    discrepancias: readonly {
      matchId: string;
      board: { status: string; marcador: string };
      proveedor: { status: string; marcador: string };
      rawRef: string | null;
    }[];
  } | null;
  veredicto: Veredicto;
};

// ------------------------------------------------------------------ primitives

// Nearest rank, never interpolated: every number the report prints is a
// number that really happened, which is what a measurement report owes its
// reader. p over (0, 1]; null with no samples.
export function percentil(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].toSorted((a, b) => a - b);
  const rank = Math.min(
    sorted.length,
    Math.max(1, Math.ceil(p * sorted.length)),
  );
  return sorted[rank - 1];
}

export function estadisticos(values: readonly number[]): Estadisticos {
  return {
    n: values.length,
    mediana: percentil(values, 0.5),
    p95: percentil(values, 0.95),
    maximo: percentil(values, 1),
    minimo: values.length === 0 ? null : Math.min(...values),
  };
}

// CA-3: below twenty samples a "p95" is the maximum disguised as a statistic,
// and whoever reads the report has to know it.
export function etiquetaP95(n: number): string {
  return n >= INFORME_P95_MIN_SAMPLES ? "p95" : `peor caso (n=${n})`;
}

export const REDACTED = "[secreto]";

function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    out = out.split(secret).join(REDACTED);
  }
  return out;
}

// -------------------------------------------------------------------- CSV

const CABECERA = "matchId,marcador,instante,fuente";
const MARCADOR = /^\d{1,2}-\d{1,2}$/;

// Reads referencias.csv (CA-3). A malformed row is never dropped in silence:
// it comes back in noCasadas with its reason, and the report prints it.
export function parseReferencias(csv: string): {
  filas: Referencia[];
  noCasadas: NoCasada[];
} {
  const filas: Referencia[] = [];
  const noCasadas: NoCasada[] = [];
  for (const raw of csv.split(/\r?\n/)) {
    const fila = raw.trim();
    if (fila === "" || fila === CABECERA) continue;
    const parts = fila.split(",").map((p) => p.trim());
    if (parts.length !== 4) {
      noCasadas.push({
        fila,
        motivo: `la fila tiene ${parts.length} campos y no 4 (${CABECERA})`,
      });
      continue;
    }
    const [matchId, marcador, instante, fuente] = parts;
    if (matchId === "") {
      noCasadas.push({ fila, motivo: "matchId vacío" });
      continue;
    }
    if (!MARCADOR.test(marcador)) {
      noCasadas.push({
        fila,
        motivo: `marcador '${marcador}' no es <local>-<visitante>`,
      });
      continue;
    }
    const ms = Date.parse(instante);
    if (Number.isNaN(ms)) {
      noCasadas.push({ fila, motivo: `instante '${instante}' no es ISO-8601` });
      continue;
    }
    if (fuente === "") {
      noCasadas.push({ fila, motivo: "fuente vacía" });
      continue;
    }
    // Normalised to UTC with Z, whatever the person wrote.
    filas.push({
      matchId,
      marcador,
      instante: new Date(ms).toISOString(),
      fuente,
    });
  }
  return { filas, noCasadas };
}

// ------------------------------------------------------------------ helpers

const marcadorDe = (score: Score | null): string =>
  score === null ? "sin marcador" : `${score.home}-${score.away}`;

const segundos = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;

const conN = (label: string, ms: number | null, n: number): string =>
  `${label}: ${ms === null ? "n/a" : segundos(ms)} (n=${n})`;

const dia = (instant: Instant): string => instant.slice(0, 10);
const minuto = (instant: Instant): string => `${instant.slice(0, 16)}Z`;
const hora = (instant: Instant): Instant =>
  `${instant.slice(0, 13)}:00:00.000Z` as Instant;

const PALABRAS = ["cero", "una", "dos", "tres", "cuatro", "cinco"];
const palabra = (n: number): string => PALABRAS[n] ?? String(n);

const lista = (lines: readonly string[], vacio: string): string[] =>
  lines.length === 0 ? [`  ${vacio}`] : [...lines];

// The same, capped: the headline count already carries the fact, so the rest
// collapses into one line instead of eating the two pages of CA-10.
function primeras(lines: readonly string[], vacio: string): string[] {
  if (lines.length <= INFORME_FILAS_MOSTRADAS) return lista(lines, vacio);
  return [
    ...lines.slice(0, INFORME_FILAS_MOSTRADAS),
    `  … y ${lines.length - INFORME_FILAS_MOSTRADAS} más`,
  ];
}

// Comparison against a target in seconds, over a measurement in milliseconds:
// the units are not the same and mixing them prints the wrong verdict.
const cumple = (ms: number | null, targetSeconds: number): string =>
  ms === null ? "n/a" : ms / 1000 < targetSeconds ? "cumple" : "NO cumple";

const sinDatos = (por: string): string => `(sin datos: ${por})`;

function contar<T>(items: readonly T[], key: (t: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([k, count]) => ({ k, count }));
}

// ---------------------------------------------------------- the measurements

// CA-2 (a): gaps between consecutive observed_at of the same match. Never
// across matches: two matches are two independent samplings.
function cadenciaDe(input: InformeInput) {
  const nombre = new Map(input.matches.map((m) => [m.id, m.competitionName]));
  const porPartido = new Map<string, Instant[]>();
  for (const o of input.observations) {
    const list = porPartido.get(o.matchId);
    if (list === undefined) porPartido.set(o.matchId, [o.observedAt]);
    else list.push(o.observedAt);
  }
  const huecos: number[] = [];
  const largos: HuecoLargo[] = [];
  const mayorPorPartido = new Map<string, number>();
  for (const [matchId, instants] of porPartido) {
    const sorted = instants.toSorted((a, b) => Date.parse(a) - Date.parse(b));
    for (let i = 1; i < sorted.length; i += 1) {
      const ms = instantDiff(sorted[i - 1], sorted[i]);
      huecos.push(ms);
      mayorPorPartido.set(
        matchId,
        Math.max(mayorPorPartido.get(matchId) ?? 0, ms),
      );
      if (ms > INFORME_GAP_SECONDS * 1000)
        largos.push({
          matchId,
          competicion: nombre.get(matchId) ?? matchId,
          desde: sorted[i - 1],
          ms,
        });
    }
  }
  largos.sort((a, b) => Date.parse(a.desde) - Date.parse(b.desde));
  return { stats: estadisticos(huecos), largos, mayorPorPartido };
}

// CA-2 (b): for every Decision that changes the published score, the age of
// the cited observation that brings the new score. When several cited
// observations carry it, the earliest counts: that is when the provider first
// had it. Since observed_at = capturedAt (SPEC-006 CA-7), this is capture ->
// publication, never end to end.
function latenciaInternaDe(input: InformeInput): number[] {
  const observed = new Map(input.observations.map((o) => [o.id, o]));
  const porPartido = new Map<string, InformeDecision[]>();
  for (const d of input.decisions) {
    const list = porPartido.get(d.matchId);
    if (list === undefined) porPartido.set(d.matchId, [d]);
    else list.push(d);
  }
  const latencies: number[] = [];
  for (const decisions of porPartido.values()) {
    let previo: string | null = null;
    for (const d of decisions.toSorted((a, b) => a.version - b.version)) {
      const actual = marcadorDe(d.score);
      const cambia = d.score !== null && actual !== previo;
      previo = actual;
      if (!cambia) continue;
      const citadas = d.observationIds
        .map((id) => observed.get(id))
        .filter((o): o is InformeObservation => o !== undefined);
      const traen = citadas.filter((o) => marcadorDe(o.score) === actual);
      const fuente = (traen.length > 0 ? traen : citadas).toSorted(
        (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt),
      )[0];
      if (fuente === undefined) continue;
      latencies.push(instantDiff(fuente.observedAt, d.decidedAt));
    }
  }
  return latencies;
}

// CA-3: the reference is crossed with the Decision that published that score
// — the first version that carries it. Nothing is discarded in silence.
function latenciaExternaDe(input: InformeInput) {
  const conocido = new Set(input.matches.map((m) => m.id));
  const porPartido = new Map<string, InformeDecision[]>();
  for (const d of input.decisions) {
    const list = porPartido.get(d.matchId);
    if (list === undefined) porPartido.set(d.matchId, [d]);
    else list.push(d);
  }
  const latencies: number[] = [];
  const noCasadas: NoCasada[] = [...input.referenciasNoCasadas];
  for (const r of input.referencias) {
    const fila = `${r.matchId},${r.marcador},${r.instante},${r.fuente}`;
    if (!conocido.has(r.matchId)) {
      noCasadas.push({
        fila,
        motivo: `${r.matchId} no es un partido de la ventana`,
      });
      continue;
    }
    const publicada = (porPartido.get(r.matchId) ?? [])
      .toSorted((a, b) => a.version - b.version)
      .find((d) => marcadorDe(d.score) === r.marcador);
    if (publicada === undefined) {
      noCasadas.push({
        fila,
        motivo: `el marcador ${r.marcador} nunca se publicó`,
      });
      continue;
    }
    latencies.push(instantDiff(r.instante, publicada.decidedAt));
  }
  return { stats: estadisticos(latencies), noCasadas };
}

// The expected ticks of CA-9: the union of the per-match windows (ADR-002 §2)
// clipped to [desde, hasta], divided by the cadence the triggers aim at. A
// derived number: nothing is expected of the tick when nothing is playing.
function ticksEsperados(input: InformeInput): number {
  const desde = Date.parse(input.desde);
  const hasta = Date.parse(input.hasta);
  const spans = input.matches
    .map((m) => {
      const k = Date.parse(m.kickoff);
      return {
        from: Math.max(desde, k - WINDOW_BEFORE_MINUTES * MINUTE_MS),
        to: Math.min(hasta, k + WINDOW_AFTER_MINUTES * MINUTE_MS),
      };
    })
    .filter((s) => s.to > s.from)
    .toSorted((a, b) => a.from - b.from);
  let total = 0;
  let cursor = -Infinity;
  for (const span of spans) {
    const from = Math.max(span.from, cursor);
    if (span.to > from) total += span.to - from;
    cursor = Math.max(cursor, span.to);
  }
  return Math.round(total / (INFORME_TICK_SECONDS * 1000));
}

// ------------------------------------------------------------------ verdict

type VeredictoInput = {
  cobertura: number | null;
  competicionesMudas: readonly string[];
  discrepancias: number;
  observaciones: number;
  alertasInesperadas: number;
  declaraciones: Declaraciones;
};

// CA-9. The thresholds are in constants.ts, fixed before measuring. The three
// facts a query cannot answer (H-2 and the hand-written explanations) arrive
// as declarations: while nobody declares them they are listed as pending, and
// the definitive verdict is the one the ledger carries.
export function veredictoDe(v: VeredictoInput): Veredicto {
  const razones: string[] = [];
  const pendientes: string[] = [];
  const d = v.declaraciones;

  if (d.intervencionSobreElDato === undefined)
    pendientes.push(
      "intervención sobre el dato (H-2 (i)): invalida el criterio 5",
    );
  if (d.intervencionSobreLaPlataforma === undefined)
    pendientes.push(
      "intervención sobre la plataforma (H-2 (ii)): baja a válida con reservas",
    );
  if (d.alertasExplicadas === undefined)
    pendientes.push(
      "explicación a mano de cada alerta abierta (CA-4 (c)): sin ella no hay válida",
    );

  // (c1) ingesta rota: lo irrepetible. Se repite la medición (N-4).
  if (v.cobertura !== null && v.cobertura < INFORME_COVERAGE_RESERVED)
    razones.push(
      `cobertura de ticks ${porcentaje(v.cobertura)} por debajo del ${porcentaje(INFORME_COVERAGE_RESERVED)}`,
    );
  for (const c of v.competicionesMudas)
    razones.push(`${c} no tiene una sola observación`);
  if (razones.length > 0)
    return { valor: "no válida", rama: "c1", razones, pendientes };

  // (c2) ingesta sana y motor equivocado: no se repite, se recalcula (N-3).
  if (v.discrepancias > 0 && v.observaciones > 0) {
    razones.push(
      `${v.discrepancias} partido(s) con marcador que no cuadra con el proveedor, sobre una ingesta con ${v.observaciones} observaciones`,
    );
    return { valor: "no válida", rama: "c2", razones, pendientes };
  }

  const dato = d.intervencionSobreElDato ?? [];
  if (dato.length > 0) {
    razones.push(...dato.map((x) => `intervención sobre el dato: ${x}`));
    return { valor: "no válida", rama: null, razones, pendientes };
  }

  const reservas: string[] = [];
  if (
    v.cobertura !== null &&
    v.cobertura < INFORME_COVERAGE_VALID &&
    v.cobertura >= INFORME_COVERAGE_RESERVED
  )
    reservas.push(
      `cobertura de ticks ${porcentaje(v.cobertura)}, entre el ${porcentaje(INFORME_COVERAGE_RESERVED)} y el ${porcentaje(INFORME_COVERAGE_VALID)}`,
    );
  reservas.push(
    ...(d.intervencionSobreLaPlataforma ?? []).map(
      (x) => `intervención sobre la plataforma: ${x}`,
    ),
  );
  if (v.alertasInesperadas > 0)
    reservas.push(
      `${v.alertasInesperadas} alerta(s) unresolved_team o conflict, que se esperaban en cero`,
    );
  if (d.alertasExplicadas === false)
    reservas.push("alguna alerta abierta quedó sin explicación");
  if (reservas.length > 0)
    return {
      valor: "válida con reservas",
      rama: null,
      razones: reservas,
      pendientes,
    };
  return { valor: "válida", rama: null, razones: [], pendientes };
}

const porcentaje = (ratio: number): string => `${Math.round(ratio * 100)} %`;

// ------------------------------------------------------------------- blocks

export const BLOQUES = [
  "## 1. Ventana y cobertura",
  "## 2. Cadencia efectiva",
  "## 3. Latencia interna",
  "## 4. Latencia extremo a extremo",
  "## 5. Peticiones al proveedor",
  "## 6. Partidos sin señal",
  "## 7. Alertas",
  "## 8. Contraste de marcadores",
  "## 9. Veredicto",
] as const;

export function informeJornada(input: InformeInput): {
  texto: string;
  informe: Informe;
} {
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  // ---- 1. Ventana y cobertura ------------------------------------------
  const porCompeticion = new Map<
    string,
    { nombre: string; partidos: number }
  >();
  for (const m of input.matches) {
    const entry = porCompeticion.get(m.competitionId);
    if (entry === undefined)
      porCompeticion.set(m.competitionId, {
        nombre: m.competitionName,
        partidos: 1,
      });
    else entry.partidos += 1;
  }
  const competiciones = [...porCompeticion]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([id, v]) => ({ id, nombre: v.nombre, partidos: v.partidos }));
  const sinPartidos = input.competicionesDeclaradas.filter(
    (c) => !porCompeticion.has(c),
  );

  const esperados = ticksEsperados(input);
  const ticksReales = new Set(input.attempts.map((a) => a.startedAt)).size;
  const cobertura = esperados === 0 ? null : ticksReales / esperados;

  // An attempt is inside the window of a match when some match was in its own
  // window at that instant: outside it there must not be a single row (CA-7).
  const enVentanaDePartido = (instant: Instant): boolean => {
    const ms = Date.parse(instant);
    return input.matches.some((m) => {
      const k = Date.parse(m.kickoff);
      return (
        ms >= k - WINDOW_BEFORE_MINUTES * MINUTE_MS &&
        ms < k + WINDOW_AFTER_MINUTES * MINUTE_MS
      );
    });
  };
  const fueraDeVentana = input.attempts.filter(
    (a) => !enVentanaDePartido(a.startedAt),
  );
  const fallidos = input.attempts.filter((a) => a.ok === false);

  const horasConIntento = new Set(input.attempts.map((a) => hora(a.startedAt)));
  const horasSinEjecuciones: Instant[] = [];
  for (
    let ms = Date.parse(hora(input.desde));
    ms < Date.parse(input.hasta);
    ms += HOUR_MS
  ) {
    const h = new Date(ms).toISOString() as Instant;
    if (
      enVentanaDePartido(h) &&
      Date.parse(h) >= Date.parse(input.desde) &&
      !horasConIntento.has(h)
    )
      horasSinEjecuciones.push(h);
  }

  push(
    `# Informe de la jornada · ${dia(input.desde)} → ${dia(input.hasta)}`,
    "",
    competiciones.length === 0
      ? `Se midieron ${palabra(0)} de las ${palabra(input.competicionesDeclaradas.length)} competiciones de D-3.`
      : `Se midieron ${palabra(competiciones.length)} de las ${palabra(input.competicionesDeclaradas.length)} competiciones de D-3: ${competiciones
          .map((c) => `${c.nombre} (${c.partidos} partidos)`)
          .join(", ")}.`,
    `Sin partidos en la ventana: ${sinPartidos.length === 0 ? "ninguna" : sinPartidos.join(", ")}.`,
    "",
    BLOQUES[0],
    "",
    `ventana: ${input.desde} → ${input.hasta} (${(instantDiff(input.desde, input.hasta) / HOUR_MS || 0).toFixed(1)} h)`,
    `partidos en la ventana: ${input.matches.length}`,
  );
  if (input.matches.length === 0)
    push(`  ${sinDatos("ningún partido en la ventana")}`);
  else
    push(
      ...competiciones.map((c) => `  ${c.nombre} · ${c.partidos} partido(s)`),
    );
  push(
    `ticks: ${ticksReales} de ${esperados} esperados (${cobertura === null ? "n/a" : porcentaje(cobertura)})   ← cobertura de CA-9`,
    `horas de ventana sin ejecuciones: ${horasSinEjecuciones.length}`,
    ...primeras(
      horasSinEjecuciones.map((h) => `  ${h}`),
      "(ninguna)",
    ).filter(() => horasSinEjecuciones.length > 0),
    `intentos fuera de la ventana de todo partido: ${fueraDeVentana.length}   ← criterio 2`,
    `intentos fallidos: ${fallidos.length}`,
    ...primeras(
      fallidos.map(
        (a) => `  ${a.startedAt}  ${a.sourceId}  ${a.error ?? "sin error"}`,
      ),
      "(ninguno)",
    ).filter(() => fallidos.length > 0),
  );

  // ---- 2. Cadencia efectiva --------------------------------------------
  const cad = cadenciaDe(input);
  push(
    "",
    BLOQUES[1],
    "",
    "Huecos entre observed_at consecutivos de cada partido: el coste de muestrear",
    "a 30 s y lo que delata un job caído.",
  );
  if (cad.stats.n === 0)
    push(sinDatos("ningún partido tiene dos observaciones consecutivas"));
  else {
    push(
      `${conN("mediana", cad.stats.mediana, cad.stats.n)} · ${conN(etiquetaP95(cad.stats.n), cad.stats.p95, cad.stats.n)} · ${conN("máximo", cad.stats.maximo, cad.stats.n)}`,
      `huecos > ${INFORME_GAP_SECONDS} s: ${cad.largos.length}`,
      ...primeras(
        cad.largos.map(
          (h) =>
            `  ${h.desde}  ${segundos(h.ms)}  ${h.matchId}  ${h.competicion}`,
        ),
        "(ninguno)",
      ),
    );
  }

  // ---- 3. Latencia interna ---------------------------------------------
  const interna = estadisticos(latenciaInternaDe(input));
  const techoPropio =
    cad.stats.p95 === null || interna.p95 === null
      ? null
      : cad.stats.p95 + interna.p95;
  push(
    "",
    BLOQUES[2],
    "",
    "decided_at − observed_at de la observación citada que trae el marcador nuevo,",
    "para cada Decision que cambia el marcador publicado.",
    "Como observed_at = capturedAt (el proveedor no data sus respuestas, SPEC-006",
    "CA-7), esto mide captura → publicación: raw store, parse, inserción y motor.",
    "No es latencia extremo a extremo, y nadie debe leerlo como tal.",
  );
  if (interna.n === 0)
    push(
      sinDatos("ninguna Decision de la ventana cambia el marcador publicado"),
    );
  else
    push(
      `${conN("mediana", interna.mediana, interna.n)} · ${conN(etiquetaP95(interna.n), interna.p95, interna.n)} · ${conN("máximo", interna.maximo, interna.n)}`,
    );
  push(
    techoPropio === null
      ? "techo propio: n/a (hace falta cadencia y latencia interna para sumarlo)"
      : `techo propio (${etiquetaP95(cad.stats.n)} cadencia + ${etiquetaP95(interna.n)} latencia interna): ${segundos(techoPropio)}`,
    "  el peor caso de «el proveedor ya lo tenía → nosotros lo publicamos».",
  );

  // ---- 4. Latencia extremo a extremo -----------------------------------
  const externa = latenciaExternaDe(input);
  const goles = Math.round(input.matches.length * INFORME_GOALS_PER_MATCH);
  push(
    "",
    BLOQUES[3],
    "",
    "decided_at − instante de la referencia externa, una fila por gol referenciado",
    "a mano en referencias.csv (H-6 (ii)).",
  );
  if (externa.stats.n === 0)
    push(sinDatos("ninguna fila de referencias.csv casó con una Decision"));
  else {
    const e = externa.stats;
    push(
      `${conN("mediana", e.mediana, e.n)} · ${conN(etiquetaP95(e.n), e.p95, e.n)} · ${conN("máximo", e.maximo, e.n)}`,
      `rango: [${segundos(e.minimo ?? 0)}, ${segundos(e.maximo ?? 0)}]`,
      `objetivo de vision.md: mediana < ${INFORME_MEDIAN_TARGET_SECONDS} s → ${cumple(e.mediana, INFORME_MEDIAN_TARGET_SECONDS)}` +
        (e.n >= INFORME_P95_MIN_SAMPLES
          ? ` · p95 < ${INFORME_P95_TARGET_SECONDS} s → ${cumple(e.p95, INFORME_P95_TARGET_SECONDS)}`
          : ` · el p95 de vision.md no se contrasta con n=${e.n}`),
    );
  }
  push(
    `tamaño esperable: los ${input.matches.length} partidos de la ventana dan del orden de ${goles} goles,`,
    "pero la muestra referenciada la limita lo que una persona puede seguir a la vez",
    "(H-3: domingo 27, 14:00Z-17:00Z), así que esto siempre pesará menos que la",
    "cadencia y la latencia interna, que se calculan sobre miles de capturas.",
    `referencias no casadas: ${externa.noCasadas.length}`,
    ...lista(
      externa.noCasadas.map((r) => `  ${r.fila}  →  ${r.motivo}`),
      "(ninguna)",
    ),
  );

  // ---- 5. Peticiones al proveedor --------------------------------------
  const totalPeticiones = input.attempts.reduce((a, b) => a + b.requests, 0);
  const porDia = sumar(input.attempts, (a) => dia(a.startedAt));
  const porMinuto = sumar(input.attempts, (a) => minuto(a.startedAt));
  const pico = porMinuto.toSorted((a, b) => b.total - a.total)[0] ?? null;
  push(
    "",
    BLOQUES[4],
    "",
    "De ingest_attempts.details->>'requests' y no de net._http_response, que pg_net",
    "poda a las pocas horas y no sobrevive a una medición de cuatro días (N-2).",
  );
  if (input.attempts.length === 0)
    push(sinDatos("ningún intento de ingesta en la ventana"));
  else {
    push(
      `total: ${totalPeticiones} peticiones en ${input.attempts.length} intento(s)`,
      "por día:",
      ...porDia.map((d) => `  ${d.dia}: ${d.total}`),
      `pico por minuto: ${pico === null ? "n/a" : `${pico.total} (${pico.dia})`}`,
      `presupuesto SPEC-005 N-4 (≤ ${INFORME_REQUESTS_PER_MINUTE}/min, ~${INFORME_REQUESTS_PER_DAY}/día): ${
        (pico?.total ?? 0) > INFORME_REQUESTS_PER_MINUTE ||
        porDia.some((d) => d.total > INFORME_REQUESTS_PER_DAY)
          ? "EXCEDE"
          : "cumple"
      }`,
    );
  }

  // ---- 6. Partidos sin señal -------------------------------------------
  const conObservaciones = new Set(input.observations.map((o) => o.matchId));
  const sinObservaciones = input.matches
    .filter((m) => !conObservaciones.has(m.id))
    .map((m) => ({ matchId: m.id, competicion: m.competitionName }));
  const conHuecoLargo = input.matches
    .map((m) => ({
      matchId: m.id,
      competicion: m.competitionName,
      ms: cad.mayorPorPartido.get(m.id) ?? 0,
    }))
    .filter((m) => m.ms > SILENCE_MINUTES * MINUTE_MS);
  push(
    "",
    BLOQUES[5],
    "",
    "RN-05 y RN-02: un partido sin señal es el motor haciendo su trabajo, no un",
    "defecto. Se listan para poder explicarlos uno a uno.",
  );
  if (input.matches.length === 0)
    push(sinDatos("ningún partido en la ventana"));
  else
    push(
      `sin ninguna observación: ${sinObservaciones.length}`,
      ...porCompeticion_(sinObservaciones),
      ...primeras(
        sinObservaciones.map((m) => `  ${m.matchId} · ${m.competicion}`),
        "(ninguno)",
      ),
      `con al menos un hueco > ${SILENCE_MINUTES} min: ${conHuecoLargo.length}`,
      ...porCompeticion_(conHuecoLargo),
      ...primeras(
        conHuecoLargo.map(
          (m) =>
            `  ${m.matchId} · ${m.competicion} · hueco mayor: ${segundos(m.ms)}`,
        ),
        "(ninguno)",
      ),
    );

  // ---- 7. Alertas -------------------------------------------------------
  const abiertas = input.alerts.filter(
    (a) =>
      Date.parse(a.openedAt) >= Date.parse(input.desde) &&
      Date.parse(a.openedAt) <= Date.parse(input.hasta),
  );
  const porKind = contar(abiertas, (a) => a.kind).map(({ k, count }) => ({
    kind: k,
    count,
  }));
  const inesperadas = abiertas.filter(
    (a) => a.kind === "unresolved_team" || a.kind === "conflict",
  ).length;
  push(
    "",
    BLOQUES[6],
    "",
    "Ninguna se resuelve aquí: eso es EPIC-004. Cada una lleva su explicación",
    "escrita a mano debajo.",
    `abiertas en la ventana: ${abiertas.length}`,
    ...lista(
      porKind.map((k) => `  ${k.kind}: ${k.count}`),
      "(ninguna)",
    ),
  );
  for (const a of abiertas.toSorted(
    (x, y) => Date.parse(x.openedAt) - Date.parse(y.openedAt),
  ))
    push(
      `  ${a.openedAt}  ${a.kind}  ${a.matchId ?? "sin partido"}  ${JSON.stringify(a.details)}`,
      "    explicación:",
    );
  push(
    inesperadas === 0
      ? `unresolved_team y conflict se esperaban en cero: unresolved_team 0, conflict 0.`
      : `unresolved_team y conflict se esperaban en cero y aparecen ${inesperadas}: la explicación es obligatoria y el veredicto baja (CA-9).`,
  );

  // ---- 8. Contraste de marcadores --------------------------------------
  const ultimoRawRef = new Map<string, { at: Instant; rawRef: string }>();
  for (const o of input.observations) {
    const prev = ultimoRawRef.get(o.matchId);
    if (prev === undefined || Date.parse(o.observedAt) >= Date.parse(prev.at))
      ultimoRawRef.set(o.matchId, { at: o.observedAt, rawRef: o.rawRef });
  }
  const board = new Map(input.matches.map((m) => [m.id, m]));
  let contraste: Informe["contraste"] = null;
  push(
    "",
    BLOQUES[7],
    "",
    "Una sola tanda de peticiones por ids=, al terminar la jornada y fuera de",
    "ventana (RN-08), anotadas aparte de las del tick.",
  );
  if (input.contraste === null)
    push(sinDatos("se generó el informe sin --contrastar"));
  else {
    const coinciden: string[] = [];
    const discrepancias: NonNullable<
      Informe["contraste"]
    >["discrepancias"][number][] = [];
    for (const fila of input.contraste) {
      const m = board.get(fila.matchId);
      const nuestro = {
        status: m?.status ?? "sin partido",
        marcador: marcadorDe(m?.score ?? null),
      };
      const suyo = {
        status: fila.proveedor?.status ?? "sin respuesta",
        marcador: marcadorDe(fila.proveedor?.score ?? null),
      };
      if (
        nuestro.status === suyo.status &&
        nuestro.marcador === suyo.marcador &&
        nuestro.status === "finished"
      )
        coinciden.push(
          `  ${fila.matchId}  ${nuestro.status} ${nuestro.marcador}`,
        );
      else
        discrepancias.push({
          matchId: fila.matchId,
          board: nuestro,
          proveedor: suyo,
          rawRef: ultimoRawRef.get(fila.matchId)?.rawRef ?? null,
        });
    }
    contraste = {
      total: input.contraste.length,
      coinciden: coinciden.length,
      discrepancias,
    };
    push(
      `${coinciden.length} de ${input.contraste.length} partidos con \`finished\` y marcador coincidente.`,
      `peticiones del contraste: ${input.contrastePeticiones ?? 0} (aparte de las del tick)`,
      "coinciden:",
      ...primeras(coinciden, "(ninguno)"),
      `discrepancias: ${discrepancias.length}`,
      ...lista(
        discrepancias.map(
          (d) =>
            `  ${d.matchId}  board: ${d.board.status} ${d.board.marcador}  ·  proveedor: ${d.proveedor.status} ${d.proveedor.marcador}  ·  raw_ref: ${d.rawRef ?? "ninguno"}`,
        ),
        "(ninguna)",
      ),
    );
  }

  // ---- 9. Veredicto -----------------------------------------------------
  const competicionesMudas = competiciones
    .filter((c) =>
      input.matches
        .filter((m) => m.competitionId === c.id)
        .every((m) => !conObservaciones.has(m.id)),
    )
    .map((c) => c.nombre);
  const veredicto = veredictoDe({
    cobertura,
    competicionesMudas,
    discrepancias: contraste?.discrepancias.length ?? 0,
    observaciones: input.observations.length,
    alertasInesperadas: inesperadas,
    declaraciones: input.declaraciones ?? {},
  });
  push(
    "",
    BLOQUES[8],
    "",
    `veredicto: ${veredicto.valor}${veredicto.rama === null ? "" : ` (${veredicto.rama})`}`,
    ...lista(
      veredicto.razones.map((r) => `  - ${r}`),
      "(sin reservas)",
    ),
  );
  if (veredicto.rama === "c1")
    push(
      "  rama (c1) ingesta rota: es lo irrepetible. Se repite la medición en la",
      "  jornada del 2026-10-02/04 y esta spec queda en en-revision hasta entonces.",
    );
  if (veredicto.rama === "c2")
    push(
      "  rama (c2) ingesta sana y motor equivocado: no se repite. El crudo vive 30",
      "  días (ADR-007 §5) y src/decide/replay.ts es determinista, así que se",
      "  corrige el motor, se recalcula el log de Decisions sobre las observaciones",
      "  guardadas y el informe se rehace con los números del replay, anotando que",
      "  la latencia interna se midió sobre la ejecución original.",
    );
  push(
    `salvedad de H-1: criterio 5 cerrado sobre ${palabra(competiciones.length)} competiciones de ${palabra(input.competicionesDeclaradas.length)};` +
      ` ${sinPartidos.length === 0 ? "todas jugaron en la ventana" : `${sinPartidos.join(", ")} no jugó en la ventana`};` +
      " su comprobación queda como R-SPEC-009-1.",
    `declaraciones pendientes (no se derivan de la base de datos): ${veredicto.pendientes.length}`,
    ...lista(
      veredicto.pendientes.map((p) => `  - ${p}`),
      "(ninguna)",
    ),
  );

  const informe: Informe = {
    desde: input.desde,
    hasta: input.hasta,
    cobertura: {
      competiciones,
      sinPartidos,
      partidos: input.matches.length,
      ticksEsperados: esperados,
      ticksReales,
      porcentaje: cobertura,
      horasSinEjecuciones,
      intentosFueraDeVentana: fueraDeVentana.length,
      intentosFallidos: fallidos.length,
    },
    cadencia: { ...cad.stats, huecosLargos: cad.largos },
    latenciaInterna: interna,
    techoPropio,
    latenciaExterna: { ...externa.stats, noCasadas: externa.noCasadas },
    peticiones: {
      total: totalPeticiones,
      intentos: input.attempts.length,
      porDia: porDia.map((d) => ({ dia: d.dia, total: d.total })),
      picoPorMinuto:
        pico === null ? null : { minuto: pico.dia, total: pico.total },
    },
    sinSenal: { sinObservaciones, conHuecoLargo },
    alertas: { porKind, filas: abiertas, inesperadas },
    contraste,
    veredicto,
  };
  return { texto: redact(out.join("\n"), input.secrets), informe };
}

// One line with the per-competition breakdown, so capping the list below never
// loses the shape of the problem. Nothing when the list fits anyway.
function porCompeticion_(items: readonly { competicion: string }[]): string[] {
  if (items.length <= INFORME_FILAS_MOSTRADAS) return [];
  return [
    `  por competición: ${contar(items, (m) => m.competicion)
      .map(({ k, count }) => `${k} ${count}`)
      .join(", ")}`,
  ];
}

// Sum of requests grouped by a key of the attempt, ordered by key.
function sumar(
  attempts: readonly InformeAttempt[],
  key: (a: InformeAttempt) => string,
): { dia: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const a of attempts) {
    const k = key(a);
    totals.set(k, (totals.get(k) ?? 0) + a.requests);
  }
  return [...totals]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([dia, total]) => ({ dia, total }));
}
