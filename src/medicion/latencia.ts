import { percentil } from "../ingest/informe.ts";
import { type Instant, instantDiff } from "../model/index.ts";
import type { Pintura, Respuesta, Sonda } from "./sonda.ts";

// SPEC-025 CA-4. Goal → screen, stretch by stretch, each inside one clock
// (D-9, ADR-016 §5). Pure: no clock, no network, no database. Rows in,
// measured goals out; src/medicion/latencia-db.ts reads the rows and
// tools/informe-latencia.mjs is the shell.
//
//   (a) muestreo       first observation with the goal − last without it
//                      (observed_at: the tick's clock)
//   (b) peticionCrudo  storage.objects.created_at − opened_at (the base's)
//   (c) parseMotor     recorded_at − created_at (the base's)
//   (d) entrega        paintedAt − recorded_at: the base ↔ probe joint, split
//                      into cdn (Age) and espera (the rest: the polling wait)
//   (e) total          paintedAt − the reference (provider ↔ probe)
//
// Every value is in milliseconds; null when a piece is missing, and then the
// goal says why in `motivos`. No goal is dropped in silence.

export type LatMatch = { id: string; competitionId: string };

export type LatObservation = {
  id: string;
  matchId: string;
  observedAt: Instant;
  // home + away, or null without a score.
  total: number | null;
  rawRef: string;
};

export type LatDecision = {
  id: string;
  matchId: string;
  version: number;
  total: number | null;
  decidedAt: Instant;
  // ADR-016: null for the rows written before the migration.
  recordedAt: Instant | null;
  observationIds: string[];
};

export type LatAttempt = {
  rawRef: string | null;
  startedAt: Instant;
  openedAt: Instant | null;
};

export type LatRawObject = { rawRef: string; createdAt: Instant };

// The provider's k-th goal of a match (src/sources/api-football/events.ts,
// already mapped from fixture to match).
export type LatReferencia = {
  matchId: string;
  order: number;
  interval: { from: Instant; to: Instant } | null;
  reason: string | null;
};

// H-1: the owner's own instant of a goal, to the second.
export type LatCalibracion = {
  matchId: string;
  gol: number;
  instante: Instant;
};

export type LatenciaInput = {
  matches: readonly LatMatch[];
  observations: readonly LatObservation[];
  decisions: readonly LatDecision[];
  attempts: readonly LatAttempt[];
  rawObjects: readonly LatRawObject[];
  referencias: readonly LatReferencia[];
  calibracion: readonly LatCalibracion[];
  sonda: Sonda;
};

export type Tramos = {
  muestreo: number | null;
  peticionCrudo: number | null;
  parseMotor: number | null;
  entrega: number | null;
  cdn: number | null;
  espera: number | null;
  total: number | null;
  totalManual: number | null;
  residuo: number | null;
};

export type GolMedido = {
  matchId: string;
  competitionId: string;
  // The k of the k-th goal of the match (the level the score reached).
  k: number;
  // valido: published and not lowered; anulado: lowered later (RN-03);
  // sin_decision: the provider has it and no Decision ever published it.
  estado: "valido" | "anulado" | "sin_decision";
  version: number | null;
  recordedAt: Instant | null;
  referencia: { from: Instant; to: Instant } | null;
  manual: Instant | null;
  pintura: Pick<Pintura, "paintedAt" | "version" | "ruta" | "origen"> | null;
  respuesta: Pick<Respuesta, "age" | "xVercelCache" | "estado"> | null;
  tramos: Tramos;
  motivos: string[];
};

export type Juntas = {
  // opened_at − started_at: the base's clock against the tick's.
  tickBase: { mediana: number | null; n: number };
  // probe's instant − Date header: the server's clock against the probe's.
  baseSonda: { mediana: number | null; n: number; resolucionMs: number };
  residuo: { mediana: number | null; n: number };
};

export type Latencia = { goles: GolMedido[]; juntas: Juntas };

const REFERENCE_HALF_WIDTH_MS = 30_000;
const DATE_RESOLUTION_MS = 1000;

const diff = (a: Instant | null | undefined, b: Instant | null | undefined) =>
  a == null || b == null ? null : instantDiff(a, b);

const groupBy = <T>(rows: readonly T[], key: (r: T) => string) => {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(key(r));
    if (list === undefined) map.set(key(r), [r]);
    else list.push(r);
  }
  return map;
};

type Subida = {
  k: number;
  decision: LatDecision;
  bajadaEn: number | null;
};

// Every rise of the score is one goal per level crossed; a later fall marks
// the newest rises of the levels it leaves as disallowed (RN-03).
function subidas(decisions: readonly LatDecision[]): Subida[] {
  const out: Subida[] = [];
  let prev = 0;
  for (const d of decisions.toSorted((a, b) => a.version - b.version)) {
    if (d.total === null) continue;
    for (let k = prev + 1; k <= d.total; k += 1)
      out.push({ k, decision: d, bajadaEn: null });
    for (let k = d.total + 1; k <= prev; k += 1) {
      const last = out.findLast((s) => s.k === k && s.bajadaEn === null);
      if (last !== undefined) last.bajadaEn = d.version;
    }
    prev = d.total;
  }
  return out;
}

const vacios = (): Tramos => ({
  muestreo: null,
  peticionCrudo: null,
  parseMotor: null,
  entrega: null,
  cdn: null,
  espera: null,
  total: null,
  totalManual: null,
  residuo: null,
});

const middle = (r: { from: Instant; to: Instant }) =>
  new Date(Date.parse(r.from) + REFERENCE_HALF_WIDTH_MS).toISOString();

export function medirLatencia(input: LatenciaInput): Latencia {
  const competition = new Map(
    input.matches.map((m) => [m.id, m.competitionId]),
  );
  const obsById = new Map(input.observations.map((o) => [o.id, o]));
  const obsByMatch = groupBy(input.observations, (o) => o.matchId);
  for (const list of obsByMatch.values())
    list.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const decByMatch = groupBy(input.decisions, (d) => d.matchId);
  const refByMatch = groupBy(input.referencias, (r) => r.matchId);
  const attemptByRaw = new Map(
    input.attempts
      .filter((a): a is LatAttempt & { rawRef: string } => a.rawRef !== null)
      .map((a) => [a.rawRef, a]),
  );
  const createdByRaw = new Map(
    input.rawObjects.map((r) => [r.rawRef, r.createdAt]),
  );
  const manualOf = new Map(
    input.calibracion.map((c) => [`${c.matchId}#${c.gol}`, c.instante]),
  );
  const paintsByMatch = groupBy(input.sonda.pinturas, (p) => p.matchId);

  // The first paint of version ≥ v in a page that was already open when the
  // Decision arrived: a page that loaded with it shows what was there.
  function pinturaDe(matchId: string, version: number) {
    const byOrigin = groupBy(paintsByMatch.get(matchId) ?? [], (p) => p.origen);
    let best: Pintura | null = null;
    let anterior = false;
    for (const paints of byOrigin.values()) {
      if (paints.some((p) => p.inicial && p.version >= version)) {
        anterior = true;
        continue;
      }
      const first = paints
        .filter((p) => !p.inicial && p.version >= version)
        .reduce<Pintura | null>(
          (a, p) => (a === null || p.paintedAt < a.paintedAt ? p : a),
          null,
        );
      if (first !== null && (best === null || first.paintedAt < best.paintedAt))
        best = first;
    }
    return { pintura: best, anterior };
  }

  // The 200 that brought the paint: the newest of its page before it.
  function respuestaDe(p: Pintura): Respuesta | null {
    let found: Respuesta | null = null;
    for (const r of input.sonda.respuestas)
      if (
        r.origen === p.origen &&
        r.ruta === p.ruta &&
        r.estado === 200 &&
        r.instante <= p.paintedAt &&
        (found === null || r.instante > found.instante)
      )
        found = r;
    return found;
  }

  function medir(
    matchId: string,
    k: number,
    estado: GolMedido["estado"],
    decision: LatDecision | null,
    ref: LatReferencia | null,
    extraMotivos: string[],
  ): GolMedido {
    const motivos = [...extraMotivos];
    const tramos = vacios();
    let pintura: GolMedido["pintura"] = null;
    let respuesta: GolMedido["respuesta"] = null;

    if (estado !== "anulado") {
      if (ref === null) motivos.push("sin referencia");
      else if (ref.interval === null)
        motivos.push(`referencia sin intervalo: ${ref.reason ?? "?"}`);
    }
    if (decision === null) motivos.push("sin Decision");
    else {
      // (a) the observation that brought the goal: the newest the Decision cites.
      const cited = decision.observationIds
        .map((id) => obsById.get(id))
        .filter((o): o is LatObservation => o !== undefined)
        .reduce<LatObservation | null>(
          (a, o) => (a === null || o.observedAt > a.observedAt ? o : a),
          null,
        );
      if (cited === null) motivos.push("sin observación citada");
      else {
        const list = obsByMatch.get(matchId) ?? [];
        let first = list.indexOf(cited);
        while (first > 0 && (list[first - 1].total ?? 0) >= k) first -= 1;
        if (first <= 0) motivos.push("sin observación previa sin el gol");
        else
          tramos.muestreo = diff(
            list[first - 1].observedAt,
            list[first].observedAt,
          );

        // (b) and (c), in the base's clock.
        const attempt = attemptByRaw.get(cited.rawRef);
        const created = createdByRaw.get(cited.rawRef) ?? null;
        if (attempt === undefined) motivos.push("sin intento");
        else if (attempt.openedAt === null) motivos.push("sin opened_at");
        if (created === null) motivos.push("sin crudo en storage");
        tramos.peticionCrudo = diff(attempt?.openedAt, created);
      }
      const created =
        cited === null ? null : (createdByRaw.get(cited.rawRef) ?? null);
      if (decision.recordedAt === null) motivos.push("sin recorded_at");
      tramos.parseMotor = diff(created, decision.recordedAt);

      // (d) the probe.
      const found = pinturaDe(matchId, decision.version);
      if (found.pintura === null)
        motivos.push(found.anterior ? "anterior a la sonda" : "sin pintura");
      else {
        const p = found.pintura;
        pintura = {
          paintedAt: p.paintedAt,
          version: p.version,
          ruta: p.ruta,
          origen: p.origen,
        };
        tramos.entrega = diff(decision.recordedAt, p.paintedAt);
        const r = respuestaDe(p);
        if (r === null) motivos.push("sin respuesta de /api/board");
        else {
          respuesta = {
            age: r.age,
            xVercelCache: r.xVercelCache,
            estado: r.estado,
          };
          if (r.age === null) motivos.push("respuesta sin Age");
          else {
            tramos.cdn = r.age * 1000;
            tramos.espera =
              tramos.entrega === null ? null : tramos.entrega - tramos.cdn;
          }
        }
      }
    }

    // (e) the whole way, against the provider and against the owner.
    const manual = manualOf.get(`${matchId}#${k}`) ?? null;
    if (pintura !== null && estado !== "anulado") {
      if (ref?.interval)
        tramos.total = diff(middle(ref.interval), pintura.paintedAt);
      tramos.totalManual = diff(manual, pintura.paintedAt);
    }
    const parts = [
      tramos.muestreo,
      tramos.peticionCrudo,
      tramos.parseMotor,
      tramos.entrega,
    ];
    if (tramos.total !== null && parts.every((x) => x !== null))
      tramos.residuo =
        (parts as number[]).reduce((a, b) => a + b, 0) - tramos.total;

    return {
      matchId,
      competitionId: competition.get(matchId) ?? "?",
      k,
      estado,
      version: decision?.version ?? null,
      recordedAt: decision?.recordedAt ?? null,
      referencia: estado === "anulado" ? null : (ref?.interval ?? null),
      manual: estado === "anulado" ? null : manual,
      pintura,
      respuesta,
      tramos,
      motivos,
    };
  }

  const goles: GolMedido[] = [];
  const matchIds = [
    ...new Set([...decByMatch.keys(), ...refByMatch.keys()]),
  ].sort();
  for (const matchId of matchIds) {
    const refs = new Map(
      (refByMatch.get(matchId) ?? []).map((r) => [r.order, r]),
    );
    const rises = subidas(decByMatch.get(matchId) ?? []);
    const valid = new Set<number>();
    for (const s of rises) {
      if (s.bajadaEn !== null) {
        goles.push(
          medir(matchId, s.k, "anulado", s.decision, null, [
            `anulado: bajada en v${s.bajadaEn}`,
          ]),
        );
        continue;
      }
      valid.add(s.k);
      goles.push(
        medir(matchId, s.k, "valido", s.decision, refs.get(s.k) ?? null, []),
      );
    }
    for (const [order, ref] of [...refs].sort((a, b) => a[0] - b[0]))
      if (!valid.has(order))
        goles.push(medir(matchId, order, "sin_decision", null, ref, []));
  }

  const mediana = (values: number[]) => ({
    mediana: percentil(values, 0.5),
    n: values.length,
  });
  const tickBase = input.attempts
    .map((a) => diff(a.startedAt, a.openedAt))
    .filter((x): x is number => x !== null);
  const baseSonda = input.sonda.respuestas
    .map((r) => diff(r.date, r.instante))
    .filter((x): x is number => x !== null);
  const residuo = goles
    .map((g) => g.tramos.residuo)
    .filter((x): x is number => x !== null);

  return {
    goles,
    juntas: {
      tickBase: mediana(tickBase),
      baseSonda: { ...mediana(baseSonda), resolucionMs: DATE_RESOLUTION_MS },
      residuo: mediana(residuo),
    },
  };
}
