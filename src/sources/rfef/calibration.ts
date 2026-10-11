import type { AliasFile } from "../../model/index.ts";
import type { DeclaredMatch } from "./adapter.ts";

// SPEC-032: calibration of the cadence the RFEF sustains with the production
// pattern of ADR-019 §1-§2. Pure: the clock, the network and the files are
// injected by the shell (tools/calibrar-rfef.mjs); nothing here reads them.

// H-4 of SPEC-032 (resolved by the owner): the steps, max(30 min, 10 rounds)
// per step, one step of margin and 24 h of rest.
export const STEPS_SECONDS = [180, 120, 90, 60, 45, 30] as const;
export const STEP_MIN_SECONDS = 30 * 60;
export const STEP_MIN_ROUNDS = 10;
export const MAX_SERIES_SECONDS = 4 * 3600;

export type Step = { intervalSeconds: number; rounds: number; seconds: number };
export type Plan = {
  steps: Step[];
  rounds: number;
  maxRequests: number;
  seconds: number;
};
export type Variant = "todos" | "enjuego";
export type Round = {
  index: number;
  step: number;
  intervalSeconds: number;
  nInStep: number;
  variant: Variant;
};

export function buildPlan(steps: readonly number[] = STEPS_SECONDS): Plan {
  const out = steps.map((intervalSeconds) => {
    const rounds = Math.max(
      STEP_MIN_ROUNDS,
      Math.ceil(STEP_MIN_SECONDS / intervalSeconds),
    );
    return { intervalSeconds, rounds, seconds: rounds * intervalSeconds };
  });
  const rounds = out.reduce((n, s) => n + s.rounds, 0);
  const seconds = out.reduce((n, s) => n + s.seconds, 0);
  if (seconds > MAX_SERIES_SECONDS)
    throw new Error(`the plan lasts ${seconds} s, over ${MAX_SERIES_SECONDS}`);
  // One portada opens the session; then one POST per round (ADR-019 §1).
  return { steps: out, rounds, maxRequests: rounds + 1, seconds };
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
  return [
    "Plan de calibración RFEF (SPEC-032, ADR-019 §1-§2):",
    ...plan.steps.map(
      (s, i) =>
        `  escalón ${i + 1}: cada ${s.intervalSeconds} s, ${s.rounds} vueltas, ${Math.round(s.seconds / 60)} min`,
    ),
    `Peticiones máximas: ${plan.maxRequests} (${plan.rounds} vueltas + 1 portada; una renovación de sesión añade 2, nunca más de 3 por vuelta)`,
    `Duración máxima: ${hm(plan.seconds)}`,
  ];
}

export type CalibrateOptions = {
  dryRun: boolean;
  // --ultima-peticion: the last known request to marcadores.rfef.es from
  // this IP, manual browsing included (CA-5 i).
  lastRequest: string | null;
  // The newest `inicio` of _qa/calibracion/*.jsonl, read by the shell (CA-5 ii).
  lastLogged: string | null;
};

export type CalendarMatch = DeclaredMatch & { kickoff: string };

export type CalibrateDeps = {
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
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
  variante: "portada" | Variant;
  metodo: "GET" | "POST";
  status: number | null;
  contentLength: number | null;
  bytes: number;
  sha256: string | null;
  date: string | null;
  filas: number | null;
  observaciones: number | null;
  requestErrors: string[] | null;
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

export async function calibrate(
  options: CalibrateOptions,
  deps: CalibrateDeps,
): Promise<Outcome> {
  if (options.dryRun) {
    for (const line of formatPlan(buildPlan())) deps.log(line);
    return { kind: "dry-run" };
  }
  throw new Error("not yet");
}

// CA-7: the report, from the JSONL of one series.
export function buildReport(_lines: readonly CalibrationLine[]): string {
  throw new Error("CA-7");
}
