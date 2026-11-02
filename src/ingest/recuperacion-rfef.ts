import type { AlertDraft } from "../decide/index.ts";
import type {
  DecisionId,
  Instant,
  MatchId,
  MatchStatus,
  Observation,
  ObservationId,
  Score,
  SourceId,
} from "../model/index.ts";

// SPEC-044 CA-3 (ADR-025 §2-§6), the pure half of the recovery: given the
// observations of the matches in recovery, the current Decision of each, the
// last observation this source already left for each and the ids of the
// common window, it says what to insert, at which instants the engine runs
// (ADR-025 §4: one call per distinct observedAt, ascending), what is dropped
// and why, and what to do with a match the source already closed. No clock,
// no network, no database: the tick (CA-5) and rfef:recuperar (CA-6) share
// it and only they touch a transaction.

// The current Decision of a match as the board reads it: without one the
// board says scheduled, so status is never null and decisionId is.
export type RecoveryCurrent = {
  matchId: string;
  decisionId: string | null;
  status: MatchStatus;
  score: Score | null;
  forcedFinish: boolean | null;
};

// The newest observation this source already left for the match, if any:
// the identity of ADR-025 §5 (observedAt, status, score).
export type RecoveryLastOwn = {
  matchId: string;
  observedAt: Instant;
  status: MatchStatus;
  score: Score | null;
};

export type RecoveryPlanInput = {
  observations: readonly Observation[];
  currents: readonly RecoveryCurrent[];
  lastOwn: readonly RecoveryLastOwn[];
  inCommonWindow: ReadonlySet<string>;
};

export type RecoveryGroup = { now: Instant; matchIds: MatchId[] };

export type RecoveryClosed = {
  matchId: MatchId;
  agrees: boolean;
  alert?: AlertDraft;
};

export type RecoveryPlan = {
  insert: Observation[];
  groups: RecoveryGroup[];
  dropped: { live: number; duplicate: number; inWindow: number };
  closed: RecoveryClosed[];
};

// Only final states are heard outside the common window (ADR-025 §3): a
// live of Sunday published on Monday would leave a match in play that no
// sweep would ever close. explorer never emits scheduled (ADR-023 §5); if a
// source ever did, it is not final either.
const FINAL: ReadonlySet<MatchStatus> = new Set([
  "finished",
  "postponed",
  "suspended",
]);

const sameScore = (a: Score | null, b: Score | null): boolean =>
  a === null || b === null ? a === b : a.home === b.home && a.away === b.away;

const plainScore = (score: Score | null) =>
  score === null ? null : { home: score.home, away: score.away };

// A finished without the mark of the forced finish is closed for good
// (RN-04, ADR-011): the same test isInWindow and isInRecovery make.
const isClosed = (current: RecoveryCurrent | undefined): boolean =>
  current !== undefined &&
  current.status === "finished" &&
  current.forcedFinish !== true;

export function planRecovery({
  observations,
  currents,
  lastOwn,
  inCommonWindow,
}: RecoveryPlanInput): RecoveryPlan {
  const currentOf = new Map(currents.map((c) => [c.matchId, c]));
  const lastOf = new Map(lastOwn.map((o) => [o.matchId, o]));
  const plan: RecoveryPlan = {
    insert: [],
    groups: [],
    dropped: { live: 0, duplicate: 0, inWindow: 0 },
    closed: [],
  };
  const byInstant = new Map<Instant, Set<MatchId>>();

  for (const o of observations) {
    if (inCommonWindow.has(o.matchId)) {
      plan.dropped.inWindow += 1;
      continue;
    }
    if (!FINAL.has(o.status)) {
      plan.dropped.live += 1;
      continue;
    }
    const last = lastOf.get(o.matchId);
    if (
      last !== undefined &&
      last.observedAt === o.observedAt &&
      last.status === o.status &&
      sameScore(last.score, o.score)
    ) {
      plan.dropped.duplicate += 1;
      continue;
    }
    plan.insert.push(o);

    const current = currentOf.get(o.matchId);
    if (isClosed(current) && current !== undefined) {
      // The observation is kept and the engine never runs for it (ADR-025
      // §6): a Decision over a closed match is RN-04's business, an alert.
      const agrees =
        o.status === current.status && sameScore(o.score, current.score);
      const closed: RecoveryClosed = { matchId: o.matchId, agrees };
      if (!agrees)
        closed.alert = {
          kind: "conflict",
          matchId: o.matchId,
          details: {
            sourceId: o.sourceId as SourceId,
            observationId: o.id as ObservationId,
            current: plainScore(current.score),
            proposed: plainScore(o.score),
            decisionId: current.decisionId as DecisionId | null,
          },
        };
      plan.closed.push(closed);
      continue;
    }
    const ids = byInstant.get(o.observedAt) ?? new Set<MatchId>();
    ids.add(o.matchId);
    byInstant.set(o.observedAt, ids);
  }

  // Ascending by instant, compared as milliseconds (two spellings of one
  // instant must not become two groups); ids in order inside each group.
  plan.groups = [...byInstant]
    .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
    .map(([now, ids]) => ({ now, matchIds: [...ids].sort() }));
  return plan;
}

// --- SPEC-044 CA-6: the pure side of npm run rfef:recuperar -----------------

export type RecoveryArgs = { desde: string; hasta: string; dryRun: boolean };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// At most a week, inclusive (ADR-025 §6): the tool is a path for a matchday
// a source missed, not a bulk import.
export const RECOVERY_MAX_DAYS = 7;

export const RECOVERY_USAGE =
  "Uso: npm run rfef:recuperar -- --desde <YYYY-MM-DD> --hasta <YYYY-MM-DD> [--dry-run]";

const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`);

export function parseRecoveryArgs(argv: readonly string[]): RecoveryArgs {
  let desde: string | undefined;
  let hasta: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--desde" || arg === "--hasta") {
      const value = argv[i + 1];
      if (
        value === undefined ||
        !DATE.test(value) ||
        Number.isNaN(dayNumber(value))
      )
        throw new Error(`${arg} necesita una fecha YYYY-MM-DD`);
      if (arg === "--desde") desde = value;
      else hasta = value;
      i += 1;
    } else throw new Error(`argumento desconocido: ${arg}`);
  }
  if (desde === undefined) throw new Error("falta --desde");
  if (hasta === undefined) throw new Error("falta --hasta");
  const days = (dayNumber(hasta) - dayNumber(desde)) / DAY_MS + 1;
  if (days < 1)
    throw new Error("--desde tiene que ser anterior o igual a --hasta");
  if (days > RECOVERY_MAX_DAYS)
    throw new Error(`el rango no puede pasar de ${RECOVERY_MAX_DAYS} días`);
  return { desde, hasta, dryRun };
}

// Every Europe/Madrid date of the range, inclusive.
export function recoveryDates(desde: string, hasta: string): string[] {
  const dates: string[] = [];
  for (let day = dayNumber(desde); day <= dayNumber(hasta); day += DAY_MS)
    dates.push(new Date(day).toISOString().slice(0, 10));
  return dates;
}

const scoreText = (score: Score | null) =>
  score === null ? "—" : `${score.home}-${score.away}`;

const stateText = (status: MatchStatus, score: Score | null) =>
  `${status} ${scoreText(score)}`;

// One line per observation the source gave, in the order they came:
// match, current Decision, proposed state and what the plan does with it.
export function planLines(
  plan: RecoveryPlan,
  currents: readonly RecoveryCurrent[],
  observations: readonly Observation[],
): string[] {
  const currentOf = new Map(currents.map((c) => [c.matchId, c]));
  const inserted = new Set(plan.insert.map((o) => o.id));
  const grouped = new Set(plan.groups.flatMap((g) => g.matchIds));
  const closedOf = new Map(plan.closed.map((c) => [c.matchId, c]));
  return observations.map((o) => {
    const current = currentOf.get(o.matchId);
    const vigente =
      current === undefined
        ? "sin vigente"
        : `${stateText(current.status, current.score)}${current.forcedFinish === true ? " (cierre forzoso)" : ""}`;
    const propuesto = stateText(o.status, o.score);
    let accion: string;
    if (!inserted.has(o.id)) {
      if (!FINAL.has(o.status)) accion = "live descartado";
      else if (grouped.has(o.matchId) || closedOf.has(o.matchId))
        accion = "duplicada";
      else accion = "duplicada o en ventana";
    } else if (closedOf.has(o.matchId)) {
      const closed = closedOf.get(o.matchId);
      accion =
        closed?.agrees === true
          ? "insertar; cerrado, coincide"
          : "insertar; cerrado, discrepa: alerta conflict";
    } else accion = `insertar y decidir a ${o.observedAt}`;
    return `${o.matchId}  ${vigente}  →  ${propuesto}  ·  ${accion}`;
  });
}
