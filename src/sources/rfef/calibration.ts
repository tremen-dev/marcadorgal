import {
  type AliasFile,
  type RawCapture,
  shiftInstant,
} from "../../model/index.ts";
import {
  charsetOf,
  createRfef,
  type DeclaredMatch,
  nloginInit,
  PANEL_ENJUEGO_QUERY,
  PANEL_QUERY,
  PANEL_URL,
  PORTADA_URL,
  panelInit,
  portadaInit,
  readNlogin,
  readPortada,
  USER_AGENT,
} from "./adapter.ts";
import { readPanel } from "./panel.ts";

// SPEC-032: calibration of the cadence the RFEF sustains with the production
// pattern of ADR-019 §1-§2 and the session of ADR-020. Pure: the clock, the network and the files are
// injected by the shell (tools/calibrar-rfef.mjs); nothing here reads them.

// H-4 of SPEC-032 (resolved by the owner): the steps, max(30 min, 10 rounds)
// per step, one step of margin and 24 h of rest.
export const STEPS_SECONDS = [180, 120, 90, 60, 45, 30] as const;
export const STEP_MIN_SECONDS = 30 * 60;
export const STEP_MIN_ROUNDS = 10;
export const MAX_SERIES_SECONDS = 4 * 3600;

// E-2 (approved 2026-10-17): the plan `lento`, 300 → 240 → 180 s, 60 min
// each, never under 180 s, and an additive jitter of 0-J s per interval
// (J = 5 in `lento`, 0 in `original`). The original plan is the default.
export type PlanName = "original" | "lento";
export const PLANS: Record<
  PlanName,
  { steps: readonly number[]; stepMinSeconds: number; jitterSeconds: number }
> = {
  original: {
    steps: STEPS_SECONDS,
    stepMinSeconds: STEP_MIN_SECONDS,
    jitterSeconds: 0,
  },
  lento: { steps: [300, 240, 180], stepMinSeconds: 60 * 60, jitterSeconds: 5 },
};
export const MAX_JITTER_SECONDS = 5;

export type Step = { intervalSeconds: number; rounds: number; seconds: number };
export type Plan = {
  name: PlanName;
  steps: Step[];
  rounds: number;
  maxRequests: number;
  // Without jitter, and with the most jitter of every interval (CA-3).
  seconds: number;
  jitterSeconds: number;
  maxSeconds: number;
};
export type Variant = "todos" | "enjuego";
export type Round = {
  index: number;
  step: number;
  intervalSeconds: number;
  nInStep: number;
  variant: Variant;
};

export function buildPlan(
  name: PlanName = "original",
  jitterSeconds: number = PLANS[name].jitterSeconds,
): Plan {
  const { steps, stepMinSeconds } = PLANS[name];
  const out = steps.map((intervalSeconds) => {
    const rounds = Math.max(
      STEP_MIN_ROUNDS,
      Math.ceil(stepMinSeconds / intervalSeconds),
    );
    return { intervalSeconds, rounds, seconds: rounds * intervalSeconds };
  });
  const rounds = out.reduce((n, s) => n + s.rounds, 0);
  const seconds = out.reduce((n, s) => n + s.seconds, 0);
  const maxSeconds = seconds + rounds * jitterSeconds;
  if (maxSeconds > MAX_SERIES_SECONDS)
    throw new Error(
      `the plan lasts ${maxSeconds} s, over ${MAX_SERIES_SECONDS}`,
    );
  // Portada and NLogin open the session (ADR-020 §1); then one POST per round.
  return {
    name,
    steps: out,
    rounds,
    maxRequests: rounds + 2,
    seconds,
    jitterSeconds,
    maxSeconds,
  };
}

// CA-1 (E-2): --plan and --jitter, checked before anything else. An unknown
// plan or a jitter outside [0, 5] s is refused.
export function resolvePlan(
  name: string | undefined,
  jitterSeconds: number | undefined,
): { plan: Plan } | { reasons: string[] } {
  const reasons: string[] = [];
  const known = name === undefined || Object.hasOwn(PLANS, name);
  if (!known)
    reasons.push(
      `plan desconocido '${name}' (planes: ${Object.keys(PLANS).join(", ")})`,
    );
  if (
    jitterSeconds !== undefined &&
    !(jitterSeconds >= 0 && jitterSeconds <= MAX_JITTER_SECONDS)
  )
    reasons.push(
      `--jitter ${jitterSeconds} fuera de [0, ${MAX_JITTER_SECONDS}] s`,
    );
  if (reasons.length > 0) return { reasons };
  return { plan: buildPlan((name ?? "original") as PlanName, jitterSeconds) };
}

// The plan of a JSONL with no plan given (--informe): `original` when every
// step of it is one of the original plan, `lento` otherwise.
export function planOfLines(lines: readonly CalibrationLine[]): Plan {
  const original = PLANS.original.steps;
  return lines.every((l) => original.includes(l.escalon))
    ? buildPlan("original")
    : buildPlan("lento");
}

// Round 1 and the last one ask for todos; the rest, Sch_en_juego=1 (CA-2).
export function planRounds(plan: Plan): Round[] {
  const out: Round[] = [];
  plan.steps.forEach((step, s) => {
    for (let n = 1; n <= step.rounds; n += 1)
      out.push({
        index: out.length + 1,
        step: s,
        intervalSeconds: step.intervalSeconds,
        nInStep: n,
        variant: "enjuego",
      });
  });
  if (out.length > 0) {
    out[0].variant = "todos";
    out[out.length - 1].variant = "todos";
  }
  return out;
}

const hm = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

export function formatPlan(plan: Plan): string[] {
  const j = plan.jitterSeconds;
  return [
    "Plan de calibración RFEF (SPEC-032, ADR-019 §1-§2, ADR-020):",
    `Plan: ${plan.name}${plan.name === "original" ? " (por defecto)" : ""}`,
    ...plan.steps.map(
      (s, i) =>
        `  escalón ${i + 1}: cada ${s.intervalSeconds} s, ${s.rounds} vueltas, ${Math.round(s.seconds / 60)} min`,
    ),
    `Peticiones máximas: ${plan.maxRequests} (${plan.rounds} vueltas + portada y NLogin para abrir sesión; una renovación añade 3: 3 al abrir, nunca más de 4 por vuelta)`,
    j === 0
      ? "Jitter: 0 s"
      : `Jitter: 0-${j} s por intervalo (solo suma; nunca antes del intervalo)`,
    `Duración máxima: ${hm(plan.maxSeconds)}${j === 0 ? "" : ` (${hm(plan.seconds)} + ${plan.rounds} × ${j} s de jitter)`}`,
  ];
}

export type CalibrateOptions = {
  dryRun: boolean;
  // --ultima-peticion: the last known request to marcadores.rfef.es from
  // this IP, manual browsing included (CA-5 i).
  lastRequest: string | null;
  // The newest `inicio` of _qa/calibracion/*.jsonl, read by the shell (CA-5 ii).
  lastLogged: string | null;
  // --plan and --jitter (E-2); without them, the original plan and its jitter.
  plan?: string;
  jitterSeconds?: number;
};

export type CalendarMatch = DeclaredMatch & { kickoff: string };

export type CalibrateDeps = {
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  // The rng of the jitter, in [0, 1) (E-2). Only needed when the jitter > 0.
  random?: () => number;
  // One JSONL line and the body as received; the shell writes both (CA-6).
  record: (line: CalibrationLine, body: Uint8Array) => Promise<void> | void;
  log: (message: string) => void;
  calendar: readonly CalendarMatch[];
  aliases: AliasFile;
};

// What a request ended in. Only "ok" lets the series go on (CA-4).
export type Result =
  | "ok"
  | "vacio"
  | "bloqueada-al-inicio"
  | "nlogin"
  | "no-2xx"
  | "error-red"
  | "sin-sesion";

// One line per request (CA-6). Never a header of the request: no cookie.
export type CalibrationLine = {
  inicio: string;
  escalon: number;
  nEscalon: number;
  vuelta: number;
  total: number;
  variante: "portada" | "nlogin" | Variant;
  metodo: "GET" | "POST";
  status: number | null;
  contentLength: number | null;
  bytes: number;
  sha256: string | null;
  date: string | null;
  filas: number | null;
  observaciones: number | null;
  requestErrors: string[] | null;
  // The jitter added to the wait just before this request; 0 when there was
  // no wait before it (round 1, an opening or a retry). E-2.
  jitterMs: number;
  rancia: boolean;
  resultado: Result;
  error?: string;
};

export type Outcome =
  | { kind: "dry-run" }
  | { kind: "rechazada"; reasons: string[] }
  | { kind: "completa"; requests: number }
  | {
      kind: "parada";
      result: Exclude<Result, "ok">;
      line: CalibrationLine;
      requests: number;
    };

export const exitCode = (outcome: Outcome): number =>
  outcome.kind === "dry-run" || outcome.kind === "completa"
    ? 0
    : outcome.kind === "rechazada"
      ? 2
      : 1;

// CA-5: the window of ADR-002 §2, kickoff − 10 min to kickoff + 150 min.
export const WINDOW_BEFORE_MS = 10 * 60_000;
export const WINDOW_AFTER_MS = 150 * 60_000;
export const REST_MS = 24 * 3600_000;

export function inWindow(
  calendar: readonly { kickoff: string }[],
  nowMs: number,
): number {
  return calendar.filter((m) => {
    const k = Date.parse(m.kickoff);
    return nowMs >= k - WINDOW_BEFORE_MS && nowMs <= k + WINDOW_AFTER_MS;
  }).length;
}

// CA-5: no request at all unless the IP has rested 24 h and there is a match
// in window. There is no separate probe: the first request is the probe.
export function preconditions(
  options: Pick<CalibrateOptions, "lastRequest" | "lastLogged">,
  calendar: readonly { kickoff: string }[],
  nowMs: number,
): string[] {
  const reasons: string[] = [];
  const rested = (iso: string, what: string) => {
    const at = Date.parse(iso);
    if (Number.isNaN(at)) reasons.push(`${what} '${iso}' no es un instante`);
    else if (nowMs - at < REST_MS)
      reasons.push(`${what} ${iso}: menos de 24 h de reposo`);
  };
  if (options.lastRequest === null)
    reasons.push(
      "falta --ultima-peticion <ISO> (última petición a marcadores.rfef.es desde esta IP)",
    );
  else rested(options.lastRequest, "--ultima-peticion");
  if (options.lastLogged !== null)
    rested(options.lastLogged, "última línea de _qa/calibracion");
  if (inWindow(calendar, nowMs) === 0)
    reasons.push("ningún partido de las cinco competiciones en ventana");
  return reasons;
}

const NLOGIN = /No se ha aceptado el cookie/;

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// The model's formatter: an epoch millisecond as an Instant (ISO, Z).
const iso = (ms: number): string =>
  shiftInstant("1970-01-01T00:00:00.000Z", ms);

export async function calibrate(
  options: CalibrateOptions,
  deps: CalibrateDeps,
): Promise<Outcome> {
  const resolved = resolvePlan(options.plan, options.jitterSeconds);
  if ("reasons" in resolved)
    return { kind: "rechazada", reasons: resolved.reasons };
  const { plan } = resolved;
  if (options.dryRun) {
    for (const line of formatPlan(plan)) deps.log(line);
    return { kind: "dry-run" };
  }
  const reasons = preconditions(options, deps.calendar, deps.now());
  if (plan.jitterSeconds > 0 && deps.random === undefined)
    reasons.push("jitter > 0 sin generador aleatorio");
  if (reasons.length > 0) return { kind: "rechazada", reasons };
  return runSeries(deps, plan);
}

type Sent = {
  line: CalibrationLine;
  bytes: Uint8Array;
  response: Response | null;
  text: string;
};

// The series (CA-2, CA-3, CA-4): the production pattern of ADR-019 §1-§2 and
// ADR-020 on the plan of CA-1, stopping at the first empty body.
export async function runSeries(
  deps: CalibrateDeps,
  plan: Plan = buildPlan(),
): Promise<Outcome> {
  const adapter = createRfef({
    aliases: deps.aliases,
    calendar: deps.calendar,
  });
  const rounds = planRounds(plan);
  // The jitter of the wait before the next request; consumed by it.
  let jitterMs = 0;
  const drawJitter = (): number => {
    const max = plan.jitterSeconds * 1000;
    if (max === 0 || deps.random === undefined) return 0;
    const r = Math.min(1, Math.max(0, deps.random()));
    return Math.round(r * max);
  };
  let session: string | null = null;
  // The portada gave its cookie and its NLogin; NLogin has not answered yet.
  let opening: { session: string; nlogin: string } | null = null;
  let previousSha: string | null = null;
  let total = 0;
  let previous: { start: number; end: number; interval: number } | null = null;

  const requestOf = (
    variante: CalibrationLine["variante"],
  ): [string, RequestInit] => {
    if (variante === "portada") return [PORTADA_URL, portadaInit(USER_AGENT)];
    if (variante === "nlogin") {
      if (opening === null) throw new Error("NLogin without a portada");
      return [opening.nlogin, nloginInit(opening.session, USER_AGENT)];
    }
    return [
      PANEL_URL,
      panelInit(
        session ?? "",
        USER_AGENT,
        variante === "todos" ? PANEL_QUERY : PANEL_ENJUEGO_QUERY,
      ),
    ];
  };

  const send = async (
    round: Round,
    variante: CalibrationLine["variante"],
  ): Promise<Sent> => {
    const post = variante === "todos" || variante === "enjuego";
    const startMs = deps.now();
    total += 1;
    const line: CalibrationLine = {
      inicio: iso(startMs),
      escalon: round.intervalSeconds,
      nEscalon: round.nInStep,
      vuelta: round.index,
      total,
      variante,
      metodo: post ? "POST" : "GET",
      status: null,
      contentLength: null,
      bytes: 0,
      sha256: null,
      date: null,
      filas: null,
      observaciones: null,
      requestErrors: null,
      jitterMs,
      rancia: false,
      resultado: "ok",
    };
    jitterMs = 0;
    let response: Response;
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      response = await deps.fetch(...requestOf(variante));
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch (e) {
      line.resultado = "error-red";
      line.error = e instanceof Error ? e.message : String(e);
      return { line, bytes: new Uint8Array(), response: null, text: "" };
    }
    const length = response.headers.get("content-length");
    line.status = response.status;
    line.contentLength = length === null ? null : Number(length);
    line.bytes = bytes.length;
    line.sha256 = await sha256(bytes);
    line.date = response.headers.get("date");
    const text = new TextDecoder(
      charsetOf(response.headers.get("content-type")),
    ).decode(bytes);
    const ok = response.status >= 200 && response.status <= 299;
    const redirect = response.status >= 300 && response.status <= 399;
    const parse = () => {
      const parsed = adapter.parse({
        sourceId: adapter.id,
        capturedAt: line.inicio,
        requests: [
          {
            url: PANEL_URL,
            method: "POST",
            requestBody:
              variante === "todos" ? PANEL_QUERY : PANEL_ENJUEGO_QUERY,
            status: response.status,
            contentType: response.headers.get("content-type"),
            body: text,
          },
        ],
      } as RawCapture);
      line.observaciones = parsed.observations.length;
      line.requestErrors = parsed.requestErrors.map((r) => r.error);
    };
    // The opening (ADR-020 §1), with the functions of the adapter. An answer
    // that breaks it is a session failure, which stops the series.
    const opens = (step: () => void) => {
      if (!ok && !redirect) {
        line.resultado = "no-2xx";
        return;
      }
      try {
        step();
      } catch (e) {
        line.resultado = "sin-sesion";
        line.error = e instanceof Error ? e.message : String(e);
      }
    };
    if (ok && bytes.length === 0) {
      // The block (ADR-018 §3), whatever the request; the first round is the
      // probe (CA-5).
      line.resultado = round.index === 1 ? "bloqueada-al-inicio" : "vacio";
      if (post) parse(); // "empty body"
    } else if (variante === "portada")
      opens(() => {
        opening = readPortada(response);
      });
    else if (variante === "nlogin")
      opens(() => {
        if (opening === null) throw new Error("NLogin without a portada");
        session = readNlogin(response, opening.session);
        opening = null;
      });
    else if (redirect || (ok && NLOGIN.test(text))) line.resultado = "nlogin";
    else if (!ok) line.resultado = "no-2xx";
    else {
      parse();
      try {
        line.filas = readPanel(text).rows.length;
      } catch {
        line.filas = null;
      }
      // ADR-018 §4: byte-for-byte equal to the previous one. Logged, not a stop.
      line.rancia = previousSha !== null && line.sha256 === previousSha;
      previousSha = line.sha256;
    }
    return { line, bytes, response, text };
  };

  const report = async (sent: Sent): Promise<Outcome | null> => {
    await deps.record(sent.line, sent.bytes);
    const l = sent.line;
    deps.log(
      `${l.inicio} vuelta ${l.vuelta} (${l.escalon} s, ${l.nEscalon}) ${l.metodo} ${l.variante}: ${l.status ?? "-"} ${l.bytes} B ${l.resultado}${l.rancia ? " rancia" : ""}`,
    );
    if (l.resultado === "ok" || l.resultado === "nlogin") return null;
    if (l.resultado === "vacio")
      deps.log(
        `Umbral: primer vacío en el escalón de ${l.escalon} s, vuelta ${l.nEscalon} del escalón (${l.total} peticiones en la serie).`,
      );
    if (l.resultado === "sin-sesion")
      deps.log(
        `Parada: la sesión no se abre como dice ADR-020 §1 (${l.error}).`,
      );
    return { kind: "parada", result: l.resultado, line: l, requests: total };
  };

  // ADR-020 §1: portada, then its NLogin. Two requests.
  const openSession = async (round: Round): Promise<Outcome | null> => {
    session = null;
    const stop = await report(await send(round, "portada"));
    if (stop !== null) return stop;
    return report(await send(round, "nlogin"));
  };

  for (const round of rounds) {
    if (previous !== null) {
      // Starts are never closer than the interval (plus the jitter, which
      // only adds), and a slow request does not bring the next one forward
      // (CA-3, E-2).
      jitterMs = drawJitter();
      const target = Math.max(
        previous.start + previous.interval * 1000 + jitterMs,
        previous.end,
      );
      for (let now = deps.now(); now < target; now = deps.now())
        await deps.sleep(target - now);
    }
    const start = deps.now();
    let fresh = false;
    let stop: Outcome | null;
    if (session === null) {
      stop = await openSession(round);
      if (stop !== null) return stop;
      fresh = true;
    }
    let sent = await send(round, round.variant);
    stop = await report(sent);
    if (stop !== null) return stop;
    if (sent.line.resultado === "nlogin") {
      // ADR-020 §2: a full opening and one retry (4 requests in the round);
      // the POST just after an opening that is refused stops the series.
      if (fresh) return nloginStop(sent.line);
      stop = await openSession(round);
      if (stop !== null) return stop;
      sent = await send(round, round.variant);
      stop = await report(sent);
      if (stop !== null) return stop;
      if (sent.line.resultado === "nlogin") return nloginStop(sent.line);
    }
    previous = { start, end: deps.now(), interval: round.intervalSeconds };
  }
  deps.log(
    `Serie completa: ${total} peticiones, sin vacío hasta ${lastStep(plan)} s.`,
  );
  return { kind: "completa", requests: total };

  function nloginStop(line: CalibrationLine): Outcome {
    deps.log("Parada: la sesión recién abierta no se acepta (NLogin).");
    return { kind: "parada", result: "nlogin", line, requests: total };
  }
}

const lastStep = (plan: Plan): number =>
  plan.steps[plan.steps.length - 1].intervalSeconds;

// CA-7: the analysis of one series, from its JSONL alone.
export type Row = "directo" | "sen-sinal" | "sin-cadencia";
export type Threshold = {
  step: number;
  nInStep: number;
  at: string;
  // Requests (every line, portadas included) before the empty.
  inStep: number;
  last10: number;
  last30: number;
  last60: number;
  // E-2: every request before the empty since the first of the series, and
  // the minutes from that first one, on the real starts (jitter included).
  cumulative: number;
  minutes: number;
};
export type Analysis = {
  kind: "medida" | "bloqueada-al-inicio";
  plan: PlanName;
  first: string;
  last: string;
  requests: number;
  rounds: number;
  stale: number;
  stop: Exclude<Result, "ok"> | null;
  completed: number[];
  threshold: Threshold | null;
  sustainable: number | null;
  recommended: number | null;
  row: Row | null;
};

// The decision table of SPEC-032 (notes for the human gate), on C*.
export const rowOf = (recommended: number | null): Row =>
  recommended === null
    ? "sin-cadencia"
    : recommended <= 45
      ? "directo"
      : "sen-sinal";

export function analyze(
  lines: readonly CalibrationLine[],
  plan: Plan = buildPlan(),
): Analysis {
  if (lines.length === 0) throw new Error("a series with no lines");
  const lastLine = lines[lines.length - 1];
  const stopLine = lines.find(
    (l) => l.resultado !== "ok" && l.resultado !== "nlogin",
  );
  const nloginStop =
    stopLine === undefined && lastLine.resultado === "nlogin"
      ? lastLine
      : undefined;
  const stop = stopLine?.resultado ?? nloginStop?.resultado ?? null;
  const base = {
    plan: plan.name,
    first: lines[0].inicio,
    last: lastLine.inicio,
    requests: lines.length,
    rounds: new Set(lines.map((l) => l.vuelta)).size,
    stale: lines.filter((l) => l.rancia).length,
    stop: stop === "ok" ? null : stop,
  };
  if (stop === "bloqueada-al-inicio")
    return {
      kind: "bloqueada-al-inicio",
      ...base,
      completed: [],
      threshold: null,
      sustainable: null,
      recommended: null,
      row: null,
    };

  // A step is completed when its last round got a good panel.
  const steps = plan.steps;
  const completed = steps
    .filter((s) =>
      lines.some(
        (l) =>
          l.escalon === s.intervalSeconds &&
          l.nEscalon === s.rounds &&
          l.metodo === "POST" &&
          l.resultado === "ok",
      ),
    )
    .map((s) => s.intervalSeconds);

  let threshold: Threshold | null = null;
  const empty = lines.find((l) => l.resultado === "vacio");
  if (empty !== undefined) {
    const at = Date.parse(empty.inicio);
    const before = lines.filter((l) => Date.parse(l.inicio) < at);
    const within = (minutes: number) =>
      before.filter((l) => at - Date.parse(l.inicio) <= minutes * 60_000)
        .length;
    threshold = {
      step: empty.escalon,
      nInStep: empty.nEscalon,
      at: empty.inicio,
      inStep: before.filter((l) => l.escalon === empty.escalon).length,
      last10: within(10),
      last30: within(30),
      last60: within(60),
      cumulative: before.length,
      minutes: (at - Date.parse(lines[0].inicio)) / 60_000,
    };
  }

  // Steps run from slow to fast: the sustainable one is the fastest held,
  // and the recommended one is the step before it (one step of margin). If
  // the sustainable one is the slowest of the plan there is no margin, and
  // C* = sin cadencia (E-2, closes F-SPEC-032-1): in `lento`, 180 → 240,
  // 240 → 300, 300 or none → sin cadencia.
  const held = steps.filter((s) => completed.includes(s.intervalSeconds));
  const fastest = held.length > 0 ? held[held.length - 1] : null;
  const i = fastest === null ? -1 : steps.indexOf(fastest);
  const recommended = i > 0 ? steps[i - 1].intervalSeconds : null;
  return {
    kind: "medida",
    ...base,
    completed,
    threshold,
    sustainable: fastest?.intervalSeconds ?? null,
    recommended,
    row: rowOf(recommended),
  };
}

const TABLE: { row: Row; cadence: string; option: string }[] = [
  {
    row: "directo",
    cadence: "≤ 45 s",
    option:
      "Directo en las franjas de H-2; la latencia se comprueba en la jornada medida",
  },
  {
    row: "sen-sinal",
    cadence: "60 s – 5 min",
    option:
      "Solo `sen sinal` y corrección de finales (H-2 b); criterio 3 no se cumple para la RFEF",
  },
  {
    row: "sin-cadencia",
    cadence: "sin cadencia",
    option: "No hay alta por esta vía; solo acceso autorizado",
  },
];

export function buildReport(
  lines: readonly CalibrationLine[],
  plan: Plan = buildPlan(),
): string {
  const a = analyze(lines, plan);
  const out = [
    `# Calibración RFEF — ${a.first.slice(0, 10)}`,
    "",
    "SPEC-032, ADR-019 §1-§2. Generado por `npm run rfef:calibrar` desde el JSONL de la serie.",
    "",
    `- Plan: \`${plan.name}\` (escalones ${plan.steps.map((s) => s.intervalSeconds).join(", ")} s; ${plan.jitterSeconds === 0 ? "sin jitter" : `jitter 0-${plan.jitterSeconds} s por intervalo`}).`,
    `- Serie: ${a.first} → ${a.last}; ${a.requests} peticiones en ${a.rounds} vueltas; ${a.stale} rancias (ADR-018 §4).`,
    `- Final: ${a.stop === null ? "plan completo" : `parada por \`${a.stop}\``}.`,
  ];
  if (a.kind === "bloqueada-al-inicio") {
    out.push(
      "- **bloqueada-al-inicio**: la primera vuelta volvió vacía; la IP no estaba libre. Sin medida: CA-8 sigue abierto y la serie se repite otro día de partido, tras 24 h de reposo.",
    );
  } else {
    const t = a.threshold;
    out.push(
      t === null
        ? a.stop === null
          ? `- Umbral: sin umbral hasta ${lastStep(plan)} s.`
          : `- Umbral: sin vacío; la serie paró por \`${a.stop}\` antes de acabar el plan.`
        : `- Umbral: escalón de ${t.step} s, vuelta ${t.nInStep} del escalón (${t.at}); peticiones antes del vacío: ${t.inStep} en ese escalón, ${t.last10} en los 10 min previos, ${t.last30} en los 30 min, ${t.last60} en los 60 min; ${t.cumulative} acumuladas desde la primera de la serie, a ${t.minutes.toFixed(1).replace(".", ",")} min desde la primera.`,
      `- Escalones completados sin vacío: ${a.completed.length > 0 ? a.completed.map((c) => `${c} s`).join(", ") : "ninguno"}.`,
      a.sustainable === null
        ? "- Sostenible: sin cadencia sostenible."
        : `- Sostenible: ${a.sustainable} s.`,
      a.recommended === null
        ? a.sustainable === null
          ? "- **Recomendada (C\\*): sin cadencia sostenible.**"
          : `- **Recomendada (C\\*): sin cadencia** — no hay un escalón más lento que ${a.sustainable} s para dejar margen.`
        : `- **Recomendada (C\\*): ${a.recommended} s**`,
    );
  }
  out.push(
    "",
    "## Tabla de decisión",
    "",
    "Sobre la cadencia recomendada C\\*; la decide el titular. Retraso medio de detección ~C\\*/2, más la publicación de la RFEF (sin medir).",
    "",
    "| | C\\* | Opción |",
    "|---|---|---|",
    ...TABLE.map(
      (r) =>
        `| ${r.row === a.row ? "**→**" : ""} | ${r.cadence} | ${r.option} |`,
    ),
    "",
  );
  return out.join("\n");
}
