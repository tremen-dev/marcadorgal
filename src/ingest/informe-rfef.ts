import { z } from "zod";
import {
  OBSERVATION_WINDOW_MINUTES,
  SILENCE_MINUTES,
} from "../decide/thresholds.ts";
import {
  type AliasFile,
  Instant,
  instantDiff,
  type MatchStatus,
  MINUTE_MS,
  type Score,
  SourceId,
  shiftInstant,
} from "../model/index.ts";
import {
  createRfefExplorer,
  type DeclaredFixture,
  ExplorerExport,
  madridDateOf,
} from "../sources/rfef/explorer.ts";
import { WINDOW_AFTER_MINUTES, WINDOW_BEFORE_MINUTES } from "./constants.ts";
import { percentil } from "./informe.ts";

// SPEC-039 CA-1/CA-2/CA-4. The report of the observation matchday of the rfef
// via explorer (ADR-023): how far it runs behind API-Football, how much live it
// gives where API-Football is silent, how often it is a party to an alert, how
// it fails, how explorer resolved its digits and whether any digit disagrees
// with the closed acta. Pure: no clock, no network, no fs. The shell is
// tools/informe-rfef.mjs and the queries are informe-rfef-db.ts.

export const RFEF = "rfef";
export const API_FOOTBALL = "api-football";

// CA-4: the thresholds of the promotion to 50, per competition (H-1: strict).
export const SUBIDA_MIN_PARTIDOS = 6;
export const SUBIDA_MIN_GOLES = 5;
export const SUBIDA_MEDIANA_MAX_MS = 0;
export const SUBIDA_P95_MAX_MS = 45_000;
export const SUBIDA_COOLDOWN_MAX = 0.1;
export const SUBIDA_ESTATICAS_MIN = 0.95;
// CA-5: one page before the appendix.
export const INFORME_RFEF_MAX_LINEAS = 80;
export const APENDICE = "## Apéndice";

export type RfefMatch = {
  id: string;
  competitionId: string;
  competitionName: string;
  round: number;
  kickoff: Instant;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  // The current Decision (board): status and score.
  status: MatchStatus;
  score: Score | null;
};

export type RfefObservation = {
  id: string;
  matchId: string;
  sourceId: string;
  status: MatchStatus;
  score: Score | null;
  observedAt: Instant;
  // The tick's now (the core writes it): the timeline of both sources.
  receivedAt: Instant;
  // The second clock of ADR-016 for this observation: the instant the base
  // sealed its raw capture. null when it cannot be known (purged, historic).
  recordedAt: Instant | null;
};

export type RfefAlert = {
  kind: string;
  matchId: string | null;
  openedAt: Instant;
  resolvedAt: Instant | null;
  details: unknown;
};

export type RfefAttempt = {
  sourceId: string;
  startedAt: Instant;
  // null: the attempt never closed.
  ok: boolean | null;
  error: string | null;
  fueraDeVentana: number;
};

// CA-1 (c) publicado: a version of the Decision and the source that won it
// (the source of its first observation; a held score keeps the previous one).
export type RfefDecision = {
  matchId: string;
  version: number;
  status: MatchStatus;
  decidedAt: Instant;
  winnerSourceId: string | null;
};

// An export of explorer as stored in _qa/SPEC-039/: the file name and its body.
export type ExportFichero = { fichero: string; contenido: string };

// CA-3/CA-4 (iii)/(v): what does not live in this repo. explorer's own figures
// at the close of the matchday and the operator's log of interventions. A
// competition of null applies to all of them.
const PorCompeticion = z.string().nullable();
export const Evidencia = z.strictObject({
  explorer: z.strictObject({
    capturadoEn: Instant,
    health: z.unknown(),
    sesiones: z.int().min(0),
    softBlocks: z.int().min(0),
    sondeosSaltados: z.int().min(0),
    cooldowns: z.array(z.strictObject({ inicio: Instant, fin: Instant })),
    anomalias: z.array(
      z.strictObject({ competicion: PorCompeticion, detalle: z.string() }),
    ),
  }),
  intervenciones: z.array(
    z.strictObject({
      instante: Instant,
      competicion: PorCompeticion,
      motivo: z.string(),
    }),
  ),
});
export type Evidencia = z.infer<typeof Evidencia>;

export function parseEvidencia(texto: string): Evidencia {
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch (e) {
    throw new Error(
      `evidencia: no es JSON (${e instanceof Error ? e.message : String(e)})`,
    );
  }
  const parsed = Evidencia.safeParse(json);
  if (!parsed.success)
    throw new Error(
      `evidencia: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  return parsed.data;
}

export type InformeRfefInput = {
  desde: Instant;
  hasta: Instant;
  // The competitions of D-3, in the order of the tables: one row each even
  // without a match (CA-4).
  competiciones: readonly string[];
  matches: readonly RfefMatch[];
  observations: readonly RfefObservation[];
  alerts: readonly RfefAlert[];
  attempts: readonly RfefAttempt[];
  decisions: readonly RfefDecision[];
  // The exports of each day, taken at its close (CA-1 f), and the exports of
  // the same dates taken the day after: FINISHED is the closed acta (CA-2).
  exportsDelDia: readonly ExportFichero[];
  exportsActa: readonly ExportFichero[];
  aliases: AliasFile;
  evidencia: Evidencia | null;
};

export type Desfase = { matchId: string; marcador: string; deltaMs: number };

export type AlertaRfef = {
  matchId: string;
  kind: "conflict" | "RN-03";
  openedAt: Instant;
  duracionMs: number | null;
};

export type ActaPartido = {
  matchId: string;
  competitionId: string;
  partido: string;
  acta: Score | null;
  apiFootball: Score | null;
  decision: Score | null;
  decisionFinished: boolean;
  rfef: Score | null;
  // Some rfef observation of the match, of any status (CA-4 i).
  conRfef: boolean;
  // The last rfef live and the minutes it stood unchanged until then.
  rfefLive: Score | null;
  minutosSinCambio: number | null;
  // CA-2: with acta, the last rfef live differs from it.
  difActaDirecto: boolean;
  digitosFalsos: number;
};

// sinDatos: the condition cannot be judged (CA-4 ii without API-Football).
export type Condicion = { ok: boolean; detalle: string; sinDatos?: boolean };

export type Cifra = { partidos: string[]; minutos: number };

export type Criterio = {
  acta: Condicion;
  desfase: Condicion;
  bloqueo: Condicion;
  estrategias: Condicion;
  intervenciones: Condicion;
  recomendacion: "5" | "50";
  texto: string;
};

export type ResumenCompeticion = {
  competitionId: string;
  nombre: string;
  partidos: number;
  obsRfef: number;
  obsApiFootball: number;
  desfase: {
    n: number;
    medianaMs: number | null;
    p95Ms: number | null;
    deltas: Desfase[];
    sinReloj: number;
    // No API-Football observation in the competition: «sin datos», not n=0.
    sinDatos: boolean;
  };
  cobertura: {
    observado: Cifra;
    publicado: Cifra;
    observoSinDecidir: boolean;
    // Matches that would count but have no acta or differ from it live.
    aparte: { matchId: string; motivo: "sin acta" | "≠ acta en directo" }[];
  };
  alertas: AlertaRfef[];
  futuras: number;
  estrategias: {
    filas: number;
    conMarcador: number;
    estaticas: number;
    porEstrategia: [string, number][];
    descartadas: number;
    noEstaticas: string[];
  };
  acta: {
    partidos: ActaPartido[];
    triples: number;
    difApiFootball: number;
    difDecision: number;
    difRfef: number;
    sinActa: number;
    sinApiFootball: number;
    // No API-Football finished in the competition: Triples and ≠ api-football
    // say «sin datos».
    apiFootballSinDatos: boolean;
    difActaDirecto: number;
    digitosFalsos: number;
  };
  bloqueo: {
    ventanaMs: number;
    cooldownMs: number;
    anomalias: number | null;
    intervenciones: number | null;
  };
  criterio: Criterio;
};

export type InformeRfef = {
  competiciones: ResumenCompeticion[];
  intentos: {
    total: number;
    fallidos: number;
    porMotivo: [string, number][];
    fueraDeVentana: number;
  };
  avisos: string[];
  texto: string;
};

// ------------------------------------------------------------------ helpers

const sameScore = (a: Score | null, b: Score | null): boolean =>
  a !== null && b !== null && a.home === b.home && a.away === b.away;
const marcador = (s: Score | null): string =>
  s === null ? "—" : `${s.home}-${s.away}`;
const seg = (ms: number | null): string =>
  ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`;
const pct = (ratio: number): string => `${(ratio * 100).toFixed(1)} %`;
const byReceived = (a: RfefObservation, b: RfefObservation) =>
  instantDiff(b.receivedAt, a.receivedAt) || (a.id < b.id ? -1 : 1);
const firstBy = <T>(
  items: readonly T[],
  key: (t: T) => string,
): Map<string, T> => {
  const out = new Map<string, T>();
  for (const item of items) if (!out.has(key(item))) out.set(key(item), item);
  return out;
};

type Span = { inicio: number; fin: number };

function union(spans: readonly Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.inicio - b.inicio);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out.at(-1);
    if (last !== undefined && s.inicio <= last.fin)
      last.fin = Math.max(last.fin, s.fin);
    else out.push({ ...s });
  }
  return out;
}

const largo = (spans: readonly Span[]) =>
  spans.reduce((acc, s) => acc + (s.fin - s.inicio), 0);

function interseccion(a: readonly Span[], b: readonly Span[]): number {
  let total = 0;
  for (const x of a)
    for (const y of b) {
      const inicio = Math.max(x.inicio, y.inicio);
      const fin = Math.min(x.fin, y.fin);
      if (fin > inicio) total += fin - inicio;
    }
  return total;
}

// The newest export per date: the one explorer served last.
function ultimosPorFecha(
  ficheros: readonly ExportFichero[],
): { fichero: string; export: ExplorerExport }[] {
  const porFecha = new Map<
    string,
    { fichero: string; export: ExplorerExport }
  >();
  for (const f of ficheros) {
    let json: unknown;
    try {
      json = JSON.parse(f.contenido);
    } catch {
      throw new Error(`${f.fichero}: no es JSON`);
    }
    const parsed = ExplorerExport.safeParse(json);
    if (!parsed.success)
      throw new Error(`${f.fichero}: no es un export de explorer (ADR-023 §4)`);
    const prev = porFecha.get(parsed.data.date);
    if (prev === undefined || prev.export.exportedAt < parsed.data.exportedAt)
      porFecha.set(parsed.data.date, {
        fichero: f.fichero,
        export: parsed.data,
      });
  }
  return [...porFecha.values()].sort((a, b) =>
    a.export.date.localeCompare(b.export.date),
  );
}

// ------------------------------------------------------------- (b) desfase

// For every score both sources saw live (0-0 is the start, not a change), Δ =
// recordedAt of the first rfef observation with it − recordedAt of the first
// API-Football one, both on the base's clock (ADR-016).
function desfaseDe(
  matchIds: readonly string[],
  obsOf: Map<string, RfefObservation[]>,
): ResumenCompeticion["desfase"] {
  const deltas: Desfase[] = [];
  let sinReloj = 0;
  for (const matchId of matchIds) {
    const live = (obsOf.get(matchId) ?? []).filter(
      (o) => o.status === "live" && o.score !== null,
    );
    const clave = (o: RfefObservation) => marcador(o.score);
    const primeraDe = (source: string) =>
      firstBy(
        live.filter((o) => o.sourceId === source),
        clave,
      );
    const rfef = primeraDe(RFEF);
    const af = primeraDe(API_FOOTBALL);
    for (const [score, r] of rfef) {
      const a = af.get(score);
      if (a === undefined || score === "0-0") continue;
      if (r.recordedAt === null || a.recordedAt === null) {
        sinReloj += 1;
        continue;
      }
      deltas.push({
        matchId,
        marcador: score,
        deltaMs: instantDiff(a.recordedAt, r.recordedAt),
      });
    }
  }
  const values = deltas.map((d) => d.deltaMs);
  return {
    n: values.length,
    medianaMs: percentil(values, 0.5),
    p95Ms: percentil(values, 0.95),
    deltas,
    sinReloj,
    sinDatos: !matchIds.some((m) =>
      (obsOf.get(m) ?? []).some((o) => o.sourceId === API_FOOTBALL),
    ),
  };
}

// ----------------------------------------------------------- (c) cobertura

// API-Football gives no live at t when, without the rfef, the match would be
// sen_sinal there: its last observation is older than SILENCE_MINUTES or there
// is none, or it still says scheduled with the kickoff gone. A rfef live
// observation at such a t covers until its next one, capped at the freshness
// of RN-01 (OBSERVATION_WINDOW_MINUTES). Two figures: observado, every such
// interval; publicado, the ones where the current Decision was live with the
// rfef as winner. Only matches with acta and without ≠ acta en directo add
// (CA-2): a frozen score is not live gained (F-SPEC-039-7).
function coberturaDe(
  matches: readonly RfefMatch[],
  obsOf: Map<string, RfefObservation[]>,
  decisionsOf: Map<string, RfefDecision[]>,
  actaOf: Map<string, ActaPartido>,
): ResumenCompeticion["cobertura"] {
  const observado: Cifra = { partidos: [], minutos: 0 };
  const publicado: Cifra = { partidos: [], minutos: 0 };
  const aparte: ResumenCompeticion["cobertura"]["aparte"] = [];
  let msObservado = 0;
  let msPublicado = 0;
  for (const m of matches) {
    const obs = obsOf.get(m.id) ?? [];
    const af = obs.filter((o) => o.sourceId === API_FOOTBALL);
    const rfef = obs.filter((o) => o.sourceId === RFEF && o.status === "live");
    const decisions = decisionsOf.get(m.id) ?? [];
    let ms = 0;
    let msPub = 0;
    let cubierto = false;
    let publicadoAqui = false;
    rfef.forEach((r, i) => {
      const t = r.receivedAt;
      const last = af.filter((o) => o.receivedAt <= t).at(-1);
      const sinDirecto =
        last === undefined ||
        instantDiff(last.observedAt, t) >= SILENCE_MINUTES * MINUTE_MS ||
        (last.status === "scheduled" && t > m.kickoff);
      if (!sinDirecto) return;
      cubierto = true;
      const vigente = decisions.filter((d) => d.decidedAt <= t).at(-1);
      const deRfef =
        vigente?.status === "live" && vigente.winnerSourceId === RFEF;
      if (deRfef) publicadoAqui = true;
      const next = rfef[i + 1];
      if (next === undefined) return;
      const tramo = Math.min(
        instantDiff(t, next.receivedAt),
        OBSERVATION_WINDOW_MINUTES * MINUTE_MS,
      );
      ms += tramo;
      if (deRfef) msPub += tramo;
    });
    if (!cubierto) continue;
    const acta = actaOf.get(m.id);
    if (acta === undefined || acta.acta === null) {
      aparte.push({ matchId: m.id, motivo: "sin acta" });
      continue;
    }
    if (acta.difActaDirecto) {
      aparte.push({ matchId: m.id, motivo: "≠ acta en directo" });
      continue;
    }
    observado.partidos.push(m.id);
    msObservado += ms;
    if (publicadoAqui) publicado.partidos.push(m.id);
    msPublicado += msPub;
  }
  observado.minutos = Math.round(msObservado / MINUTE_MS);
  publicado.minutos = Math.round(msPublicado / MINUTE_MS);
  return {
    observado,
    publicado,
    observoSinDecidir:
      observado.partidos.length > 0 && publicado.partidos.length === 0,
    aparte,
  };
}

// --------------------------------------------------------- (d) alertas rfef

const sourceOf = (value: unknown): string | null =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { sourceId?: unknown }).sourceId === "string"
    ? (value as { sourceId: string }).sourceId
    : null;

// conflict (RN-04, and the recovery's conflict over a closed match) and
// regression (RN-03) where the rfef is one of the parties.
function esDeRfef(a: RfefAlert): AlertaRfef["kind"] | null {
  if (a.matchId === null) return null;
  const d = a.details as Record<string, unknown> | null;
  if (a.kind === "conflict") {
    const partes = [sourceOf(d?.winner), sourceOf(d?.rival), sourceOf(d)];
    return partes.includes(RFEF) ? "conflict" : null;
  }
  if (a.kind === "regression") return sourceOf(d) === RFEF ? "RN-03" : null;
  return null;
}

// ------------------------------------------------------------- CA-2 acta

function actaDe(input: InformeRfefInput, avisos: string[]): Map<string, Score> {
  const calendar: DeclaredFixture[] = input.matches.map((m) => ({
    id: m.id as DeclaredFixture["id"],
    competitionId: m.competitionId as DeclaredFixture["competitionId"],
    round: m.round,
    homeTeamId: m.homeTeamId as DeclaredFixture["homeTeamId"],
    awayTeamId: m.awayTeamId as DeclaredFixture["awayTeamId"],
    kickoff: m.kickoff,
  }));
  // The adapter's own identity (ADR-017 §2): the acta is resolved the way the
  // tick resolves every row, never by a second rule of this report.
  const adapter = createRfefExplorer({
    aliases: input.aliases,
    calendar,
    baseUrl: "",
    token: "",
  });
  const acta = new Map<string, Score>();
  for (const { fichero, export: e } of ultimosPorFecha(input.exportsActa)) {
    if (madridDateOf(e.exportedAt) <= e.date) {
      avisos.push(
        `${fichero}: exportado el ${e.exportedAt}, no el día siguiente a ${e.date}; no cuenta como acta`,
      );
      continue;
    }
    const parsed = adapter.parse({
      sourceId: SourceId.parse(RFEF),
      capturedAt: e.exportedAt,
      requests: [
        {
          url: `https://explorer.invalid/api/export/matches?date=${e.date}`,
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(e),
        },
      ],
    });
    for (const o of parsed.observations)
      if (o.status === "finished") acta.set(o.matchId, o.score);
  }
  return acta;
}

// ----------------------------------------------------------------- CA-4

function criterioDe(r: Omit<ResumenCompeticion, "criterio">): Criterio {
  // (i) over the matches with acta and some rfef observation, finished or not.
  const base = r.acta.partidos.filter((p) => p.acta !== null && p.conRfef);
  const finished = base.filter((p) => p.rfef !== null);
  const iguales = finished.filter((p) => sameScore(p.rfef, p.acta)).length;
  const difDirecto = base.filter((p) => p.difActaDirecto).length;
  const acta: Condicion = {
    ok:
      base.length >= SUBIDA_MIN_PARTIDOS &&
      iguales === finished.length &&
      r.acta.digitosFalsos === 0 &&
      difDirecto === 0,
    detalle: `${iguales}/${finished.length} = acta, ${r.acta.digitosFalsos} falsos, ${difDirecto} ≠ directo, n=${base.length}`,
  };
  const d = r.desfase;
  const desfase: Condicion = d.sinDatos
    ? { ok: false, detalle: "sin api-football", sinDatos: true }
    : {
        ok:
          d.n >= SUBIDA_MIN_GOLES &&
          d.medianaMs !== null &&
          d.p95Ms !== null &&
          d.medianaMs <= SUBIDA_MEDIANA_MAX_MS &&
          d.p95Ms <= SUBIDA_P95_MAX_MS,
        detalle: `med ${seg(d.medianaMs)}, p95 ${seg(d.p95Ms)}, n=${d.n}`,
      };
  const b = r.bloqueo;
  const fraccion = b.ventanaMs === 0 ? null : b.cooldownMs / b.ventanaMs;
  const bloqueo: Condicion =
    b.anomalias === null
      ? { ok: false, detalle: "sin evidencia de explorer" }
      : {
          ok:
            fraccion !== null &&
            fraccion < SUBIDA_COOLDOWN_MAX &&
            b.anomalias === 0,
          detalle: `cooldown ${fraccion === null ? "sin ventana" : pct(fraccion)}, ${b.anomalias} anomalías`,
        };
  const e = r.estrategias;
  const estrategias: Condicion = {
    ok:
      e.conMarcador > 0 && e.estaticas / e.conMarcador >= SUBIDA_ESTATICAS_MIN,
    detalle:
      e.conMarcador === 0
        ? "sin filas"
        : `${pct(e.estaticas / e.conMarcador)} static (${e.estaticas}/${e.conMarcador})`,
  };
  const intervenciones: Condicion =
    b.intervenciones === null
      ? { ok: false, detalle: "sin registro" }
      : { ok: b.intervenciones === 0, detalle: `${b.intervenciones}` };
  const todas = [acta, desfase, bloqueo, estrategias, intervenciones];
  const subir = todas.every((c) => c.ok);
  const soloDesfase =
    !desfase.ok &&
    [acta, bloqueo, estrategias, intervenciones].every((c) => c.ok);
  const { observado: o, publicado: p } = r.cobertura;
  const ganado = `directo ganado: obs. ${o.partidos.length} p, ${o.minutos} min; pub. ${p.partidos.length} p, ${p.minutos} min`;
  const texto = subir
    ? "50"
    : !soloDesfase
      ? "5"
      : desfase.sinDatos
        ? `5 — sin referencia de desfase (${ganado})`
        : `5 — reserva útil, sin subir (${ganado})`;
  return {
    acta,
    desfase,
    bloqueo,
    estrategias,
    intervenciones,
    recomendacion: subir ? "50" : "5",
    texto,
  };
}

// ----------------------------------------------------------------- main

export function informeRfef(input: InformeRfefInput): InformeRfef {
  const avisos: string[] = [];
  const obsOf = new Map<string, RfefObservation[]>();
  for (const o of [...input.observations].sort(byReceived)) {
    const list = obsOf.get(o.matchId) ?? [];
    list.push(o);
    obsOf.set(o.matchId, list);
  }
  const decisionsOf = new Map<string, RfefDecision[]>();
  for (const d of [...input.decisions].sort((a, b) => a.version - b.version)) {
    const list = decisionsOf.get(d.matchId) ?? [];
    list.push(d);
    decisionsOf.set(d.matchId, list);
  }
  const competitionOfGroup = new Map(
    Object.entries(input.aliases.competitions ?? {}),
  );
  const exportsDia = ultimosPorFecha(input.exportsDelDia);
  const acta = actaDe(input, avisos);
  const cooldowns = union(
    (input.evidencia?.explorer.cooldowns ?? []).map((c) => ({
      inicio: Date.parse(c.inicio),
      fin: Date.parse(c.fin),
    })),
  );
  const paraCompeticion = <T extends { competicion: string | null }>(
    items: readonly T[] | undefined,
    id: string,
  ) =>
    items === undefined
      ? null
      : items.filter((x) => x.competicion === null || x.competicion === id)
          .length;

  const competiciones = input.competiciones.map((id): ResumenCompeticion => {
    const matches = input.matches.filter((m) => m.competitionId === id);
    const ids = matches.map((m) => m.id);
    const obs = ids.flatMap((m) => obsOf.get(m) ?? []);
    const rfefObs = obs.filter((o) => o.sourceId === RFEF);
    const nombre = matches[0]?.competitionName ?? id;

    const alertas = input.alerts.flatMap((a): AlertaRfef[] => {
      const kind = esDeRfef(a);
      if (kind === null || a.matchId === null || !ids.includes(a.matchId))
        return [];
      return [
        {
          matchId: a.matchId,
          kind,
          openedAt: a.openedAt,
          duracionMs:
            a.resolvedAt === null
              ? null
              : instantDiff(a.openedAt, a.resolvedAt),
        },
      ];
    });

    const filas = exportsDia.flatMap((e) =>
      e.export.matches.filter(
        (row) => competitionOfGroup.get(row.codGrupo) === id,
      ),
    );
    const conMarcador = filas.filter(
      (row) => row.golesLocal !== null && row.golesVisitante !== null,
    );
    const porEstrategia = new Map<string, number>();
    for (const row of filas)
      porEstrategia.set(
        row.strategy,
        (porEstrategia.get(row.strategy) ?? 0) + 1,
      );
    const estaticas = conMarcador.filter((row) =>
      row.strategy.startsWith("static:"),
    );

    const enActa = matches.filter(
      (m) => m.status === "finished" || acta.has(m.id),
    );
    const partidosActa = enActa.map((m): ActaPartido => {
      const own = obsOf.get(m.id) ?? [];
      const lastFinished = (source: string) =>
        own
          .filter((o) => o.sourceId === source && o.status === "finished")
          .at(-1)?.score ?? null;
      const a = acta.get(m.id) ?? null;
      const live = own.filter(
        (o) => o.sourceId === RFEF && o.status === "live" && o.score !== null,
      );
      const ultima = live.at(-1);
      let desde = ultima;
      for (let i = live.length - 1; i >= 0; i -= 1) {
        if (!sameScore(live[i].score, ultima?.score ?? null)) break;
        desde = live[i];
      }
      const digitosFalsos =
        a === null
          ? 0
          : own.filter(
              (o) =>
                o.sourceId === RFEF &&
                (o.status === "live" || o.status === "finished") &&
                o.score !== null &&
                (o.score.home > a.home || o.score.away > a.away),
            ).length;
      return {
        matchId: m.id,
        competitionId: id,
        partido: `${m.homeName} – ${m.awayName}`,
        acta: a,
        apiFootball: lastFinished(API_FOOTBALL),
        decision: m.score,
        decisionFinished: m.status === "finished",
        rfef: lastFinished(RFEF),
        conRfef: own.some((o) => o.sourceId === RFEF),
        rfefLive: ultima?.score ?? null,
        minutosSinCambio:
          ultima === undefined || desde === undefined
            ? null
            : Math.round(
                instantDiff(desde.receivedAt, ultima.receivedAt) / MINUTE_MS,
              ),
        difActaDirecto:
          a !== null && ultima !== undefined && !sameScore(ultima.score, a),
        digitosFalsos,
      };
    });
    const conActa = partidosActa.filter((p) => p.acta !== null);
    const apiFootballSinDatos = partidosActa.every(
      (p) => p.apiFootball === null,
    );

    const ventana = union(
      matches.map((m) => ({
        inicio: Date.parse(
          shiftInstant(m.kickoff, -WINDOW_BEFORE_MINUTES * MINUTE_MS),
        ),
        fin: Date.parse(
          shiftInstant(m.kickoff, WINDOW_AFTER_MINUTES * MINUTE_MS),
        ),
      })),
    );

    const resumen: Omit<ResumenCompeticion, "criterio"> = {
      competitionId: id,
      nombre,
      partidos: matches.length,
      obsRfef: rfefObs.length,
      obsApiFootball: obs.filter((o) => o.sourceId === API_FOOTBALL).length,
      desfase: desfaseDe(ids, obsOf),
      cobertura: coberturaDe(
        matches,
        obsOf,
        decisionsOf,
        new Map(partidosActa.map((p) => [p.matchId, p])),
      ),
      alertas,
      futuras: rfefObs.filter((o) => o.observedAt > o.receivedAt).length,
      estrategias: {
        filas: filas.length,
        conMarcador: conMarcador.length,
        estaticas: estaticas.length,
        porEstrategia: [...porEstrategia].sort((a, b) => b[1] - a[1]),
        descartadas: filas.reduce((acc, row) => acc + row.discardedReadings, 0),
        noEstaticas: conMarcador
          .filter((row) => !row.strategy.startsWith("static:"))
          .map(
            (row) =>
              `${row.equipoLocal} – ${row.equipoVisitante} ${row.golesLocal}-${row.golesVisitante} (${row.strategy})`,
          ),
      },
      acta: {
        partidos: partidosActa,
        triples: conActa.filter(
          (p) =>
            p.decisionFinished &&
            sameScore(p.acta, p.apiFootball) &&
            sameScore(p.acta, p.decision),
        ).length,
        difApiFootball: conActa.filter(
          (p) => p.apiFootball !== null && !sameScore(p.acta, p.apiFootball),
        ).length,
        difDecision: conActa.filter(
          (p) => !p.decisionFinished || !sameScore(p.acta, p.decision),
        ).length,
        difRfef: conActa.filter(
          (p) => p.rfef !== null && !sameScore(p.acta, p.rfef),
        ).length,
        sinActa: partidosActa.length - conActa.length,
        sinApiFootball: conActa.filter((p) => p.apiFootball === null).length,
        apiFootballSinDatos,
        difActaDirecto: conActa.filter((p) => p.difActaDirecto).length,
        digitosFalsos: partidosActa.reduce(
          (acc, p) => acc + p.digitosFalsos,
          0,
        ),
      },
      bloqueo: {
        ventanaMs: largo(ventana),
        cooldownMs: interseccion(ventana, cooldowns),
        anomalias: paraCompeticion(input.evidencia?.explorer.anomalias, id),
        intervenciones: paraCompeticion(input.evidencia?.intervenciones, id),
      },
    };
    return { ...resumen, criterio: criterioDe(resumen) };
  });

  const rfefAttempts = input.attempts.filter((a) => a.sourceId === RFEF);
  const fallidos = rfefAttempts.filter((a) => a.ok !== true);
  const motivos = new Map<string, number>();
  for (const a of fallidos) {
    const motivo =
      a.ok === null ? "sin cerrar" : (a.error ?? "sin error").slice(0, 100);
    motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1);
  }
  const intentos = {
    total: rfefAttempts.length,
    fallidos: fallidos.length,
    porMotivo: [...motivos].sort((a, b) => b[1] - a[1]),
    fueraDeVentana: rfefAttempts.reduce((acc, a) => acc + a.fueraDeVentana, 0),
  };

  const texto = render(input, competiciones, intentos, avisos, exportsDia);
  return { competiciones, intentos, avisos, texto };
}

// ----------------------------------------------------------------- render

const si = (c: Condicion) =>
  c.sinDatos ? "sin datos" : `${c.ok ? "sí" : "no"} (${c.detalle})`;
const cobertura = (c: ResumenCompeticion["cobertura"]) =>
  `obs. ${c.observado.partidos.length} p, ${c.observado.minutos} min · pub. ${c.publicado.partidos.length} p, ${c.publicado.minutos} min${c.observoSinDecidir ? " — la rfef observó sin decidir" : ""}${c.aparte.length > 0 ? ` (${c.aparte.length} aparte)` : ""}`;

function render(
  input: InformeRfefInput,
  cs: readonly ResumenCompeticion[],
  intentos: InformeRfef["intentos"],
  avisos: readonly string[],
  exportsDia: readonly { fichero: string }[],
): string {
  const ev = input.evidencia;
  const nombre = (c: ResumenCompeticion) => c.nombre;
  const out: string[] = [
    `# Informe rfef vía explorer — ${input.desde} → ${input.hasta}`,
    "",
    `SPEC-039. ${input.matches.length} partidos de ${cs.filter((c) => c.partidos > 0).length} competiciones. Δ = rfef − api-football sobre el segundo reloj (ADR-016: crudo sellado por la base), solo marcadores vistos en directo por las dos. Cobertura: rfef \`live\` mientras api-football no daba directo (sin observación en ${SILENCE_MINUTES} min o \`scheduled\` con el kickoff pasado).`,
    "",
    "## Por competición (CA-1 a-d)",
    "",
    "| Competición | Partidos | Obs. rfef | Obs. api-football | Δ n | Δ mediana | Δ p95 | Cobertura (obs. / pub.) | conflict | RN-03 |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...cs.map(
      (c) =>
        `| ${nombre(c)} | ${c.partidos} | ${c.obsRfef} | ${c.obsApiFootball} | ${c.desfase.sinDatos ? "sin datos | — | —" : `${c.desfase.n} | ${seg(c.desfase.medianaMs)} | ${seg(c.desfase.p95Ms)}`} | ${cobertura(c.cobertura)} | ${c.alertas.filter((a) => a.kind === "conflict").length} | ${c.alertas.filter((a) => a.kind === "RN-03").length} |`,
    ),
    "",
    "## Fallos y descartes (CA-1 e)",
    "",
    `- Intentos rfef: ${intentos.total}, con \`ok = false\`: ${intentos.fallidos}.${
      intentos.porMotivo.length === 0
        ? ""
        : ` Motivos: ${intentos.porMotivo
            .slice(0, 3)
            .map(([m, n]) => `«${m}» ×${n}`)
            .join(
              "; ",
            )}${intentos.porMotivo.length > 3 ? " (resto en el apéndice)" : ""}.`
    }`,
    `- Observaciones descartadas por \`fueraDeVentana\`: ${intentos.fueraDeVentana}. Con \`observedAt\` futuro (las ignora el motor): ${cs.reduce((a, c) => a + c.futuras, 0)}.`,
    `- Alertas abiertas al cierre con la rfef como parte: ${cs.reduce((a, c) => a + c.alertas.filter((x) => x.duracionMs === null).length, 0)}.`,
    "",
    `## Estrategias del último export del día (CA-1 f): ${exportsDia.map((e) => e.fichero).join(", ") || "ninguno"}`,
    "",
    "| Competición | Filas | Con marcador | static | Otras | discardedReadings |",
    "|---|---|---|---|---|---|",
    ...cs.map(
      (c) =>
        `| ${nombre(c)} | ${c.estrategias.filas} | ${c.estrategias.conMarcador} | ${c.estrategias.estaticas} | ${c.estrategias.conMarcador - c.estrategias.estaticas} | ${c.estrategias.descartadas} |`,
    ),
    "",
    "## Contraste con acta cerrada (CA-2)",
    "",
    "| Competición | finished | Triples | ≠ api-football | ≠ Decision | ≠ rfef | ≠ acta en directo | Sin acta | Sin api-football | Dígitos falsos rfef |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...cs.map(
      (c) =>
        `| ${nombre(c)} | ${c.acta.partidos.length} | ${c.acta.apiFootballSinDatos ? "sin datos | sin datos" : `${c.acta.triples} | ${c.acta.difApiFootball}`} | ${c.acta.difDecision} | ${c.acta.difRfef} | ${c.acta.difActaDirecto} | ${c.acta.sinActa} | ${c.acta.sinApiFootball} | ${c.acta.digitosFalsos} |`,
    ),
    ...(avisos.length === 0 ? [] : ["", ...avisos.map((a) => `- Aviso: ${a}`)]),
    "",
    "## Explorer al cierre (CA-3, evidencia externa)",
    "",
    ...(ev === null
      ? [
          "- Sin evidencia de explorer (`--evidencia`): (iii) y (v) no se cumplen.",
        ]
      : [
          `- Capturado ${ev.explorer.capturadoEn}: ${ev.explorer.sesiones} sesiones, ${ev.explorer.softBlocks} soft-blocks, ${ev.explorer.sondeosSaltados} sondeos saltados, ${ev.explorer.anomalias.length} anomalías, ${ev.intervenciones.length} intervenciones manuales.`,
          `- Cooldown dentro de la ventana: ${cs.map((c) => `${nombre(c)} ${Math.round(c.bloqueo.cooldownMs / 1000)} s`).join(", ")}.`,
        ]),
    "",
    "## Criterio de subida por competición (CA-4)",
    "",
    "| Competición | (i) acta | (ii) desfase | (iii) bloqueo | (iv) estrategias | (v) intervenciones | Recomendación |",
    "|---|---|---|---|---|---|---|",
    ...cs.map(
      (c) =>
        `| ${nombre(c)} | ${si(c.criterio.acta)} | ${si(c.criterio.desfase)} | ${si(c.criterio.bloqueo)} | ${si(c.criterio.estrategias)} | ${si(c.criterio.intervenciones)} | ${c.criterio.texto} |`,
    ),
    "",
    `Umbrales: (i) ≥ ${SUBIDA_MIN_PARTIDOS} partidos con acta y observación rfef, 100 % de los finished de rfef = acta, 0 dígitos falsos y 0 ≠ acta en directo; (ii) mediana Δ ≤ ${SUBIDA_MEDIANA_MAX_MS / 1000} s y p95 Δ ≤ ${SUBIDA_P95_MAX_MS / 1000} s, n ≥ ${SUBIDA_MIN_GOLES} (sin api-football: sin datos); (iii) cooldown < ${SUBIDA_COOLDOWN_MAX * 100} % de la ventana y 0 anomalías; (iv) ≥ ${SUBIDA_ESTATICAS_MIN * 100} % static; (v) 0 intervenciones. La decisión es del titular, en un ADR que supersede ADR-023 §1.`,
    "",
    APENDICE,
    "",
    ...apendice(cs, intentos, ev),
  ];
  return out.join("\n");
}

function apendice(
  cs: readonly ResumenCompeticion[],
  intentos: InformeRfef["intentos"],
  ev: Evidencia | null,
): string[] {
  const out: string[] = [];
  for (const c of cs) {
    out.push(`### ${c.nombre}`, "");
    out.push(
      `- Desfase por gol: ${c.desfase.deltas.map((d) => `${d.matchId} ${d.marcador} ${seg(d.deltaMs)}`).join("; ") || "ninguno"}${c.desfase.sinReloj > 0 ? ` (${c.desfase.sinReloj} sin segundo reloj)` : ""}.`,
    );
    out.push(
      `- Cobertura: observado ${c.cobertura.observado.partidos.join(", ") || "ninguno"}; publicado ${c.cobertura.publicado.partidos.join(", ") || "ninguno"}.${c.cobertura.aparte.length > 0 ? ` Aparte: ${c.cobertura.aparte.map((a) => `${a.matchId} (${a.motivo})`).join("; ")}.` : ""}`,
    );
    out.push(
      `- Alertas: ${c.alertas.map((a) => `${a.kind} ${a.matchId} ${a.openedAt} (${a.duracionMs === null ? "abierta" : `${Math.round(a.duracionMs / 1000)} s`})`).join("; ") || "ninguna"}.`,
    );
    out.push(
      `- Estrategias: ${c.estrategias.porEstrategia.map(([s, n]) => `${s} ×${n}`).join(", ") || "ninguna"}.${c.estrategias.noEstaticas.length > 0 ? ` No static: ${c.estrategias.noEstaticas.join("; ")}.` : ""}`,
    );
    out.push(`- Observaciones rfef con \`observedAt\` futuro: ${c.futuras}.`);
    if (c.acta.partidos.length > 0) {
      out.push(
        "",
        "| Partido | Acta | api-football | Decision | rfef | Última rfef live | Dígitos falsos |",
        "|---|---|---|---|---|---|---|",
        ...c.acta.partidos.map(
          (p) =>
            `| ${p.matchId} (${p.partido}) | ${p.acta === null ? "sin acta" : marcador(p.acta)} | ${p.apiFootball === null && p.acta !== null ? "sin api-football" : marcador(p.apiFootball)} | ${p.decisionFinished ? marcador(p.decision) : "no finished"} | ${marcador(p.rfef)} | ${marcador(p.rfefLive)}${p.difActaDirecto ? ` (${p.minutosSinCambio} min sin cambio)` : ""} | ${p.digitosFalsos} |`,
        ),
      );
    }
    out.push("");
  }
  out.push(
    `### Motivos de fallo rfef`,
    "",
    ...(intentos.porMotivo.length === 0
      ? ["- ninguno"]
      : intentos.porMotivo.map(([m, n]) => `- «${m}» ×${n}`)),
  );
  if (ev !== null) {
    out.push(
      "",
      "### Explorer",
      "",
      `- \`/api/health\`: \`${JSON.stringify(ev.explorer.health)}\``,
      ...ev.explorer.cooldowns.map((c) => `- cooldown ${c.inicio} → ${c.fin}`),
      ...ev.explorer.anomalias.map(
        (a) => `- anomalía (${a.competicion ?? "todas"}): ${a.detalle}`,
      ),
      ...ev.intervenciones.map(
        (i) =>
          `- intervención ${i.instante} (${i.competicion ?? "todas"}): ${i.motivo}`,
      ),
    );
  }
  return out;
}
