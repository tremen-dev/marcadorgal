import {
  type AlertKind,
  type Decision,
  type DecisionRule,
  FEDERATION_PRIORITY,
  type Instant,
  instantDiff,
  type MatchState,
  type MatchStatus,
  MINUTE_MS,
  type Observation,
  type ObservationId,
  OPERATOR_PRIORITY,
  type Qualifier,
} from "../model/index.ts";
import {
  KICKOFF_GRACE_MINUTES,
  OBSERVATION_WINDOW_MINUTES,
} from "./thresholds.ts";
import type {
  AlertDraft,
  DecisionDraft,
  EngineInput,
  EngineOutput,
} from "./types.ts";

// One candidate: the freshest observation of a source, with its priority.
type Candidate = { observation: Observation; priority: number };

const minutes = (n: number) => n * MINUTE_MS;

// Age of an observation at now, in milliseconds; negative in the future.
const age = (observedAt: Instant, now: Instant) => instantDiff(observedAt, now);

const byId = (a: Observation, b: Observation) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

// Oldest first, ties broken by id: the same set always folds the same way.
const oldestFirst = (a: Observation, b: Observation) =>
  instantDiff(b.observedAt, a.observedAt) || byId(a, b);

// The MatchState of an observation, without the keys the core owns.
function stateOf(o: Observation): MatchState {
  if (o.status === "live")
    return {
      status: "live",
      score: o.score,
      minute: o.minute,
      addedMinute: o.addedMinute,
    };
  if (o.status === "finished" || o.status === "suspended")
    return { status: o.status, score: o.score, minute: null };
  return { status: o.status, score: null, minute: null };
}

// The published tuple of H-1: a Decision is born when any of these moves, the
// minute included. The rule is deliberately out of it.
const tuple = (s: MatchState & { qualifier: Qualifier }) =>
  [
    s.status,
    s.score === null ? "-" : `${s.score.home}-${s.score.away}`,
    s.minute ?? "-",
    (s.status === "live" ? s.addedMinute : null) ?? "-",
    s.qualifier,
  ].join("|");

// RN-02 as a guard: an illegal transition never publishes, whichever rule
// would have decided it. The forced finish of RN-02 is evaluated apart (H-3).
function transitionAllowed(
  from: MatchStatus | null,
  to: MatchStatus,
  priority: number,
  kickoff: Instant,
  now: Instant,
): boolean {
  // Nothing goes back from finished but the operator, handled before this.
  if (from === "finished" && to !== "finished") return false;
  if (to === "postponed" || to === "suspended")
    return priority >= FEDERATION_PRIORITY;
  const fresh = from === null || from === "scheduled";
  // A live claimed too far from kickoff is dropped in silence (N-5).
  if (fresh && to === "live")
    return instantDiff(kickoff, now) >= -minutes(KICKOFF_GRACE_MINUTES);
  // A match that was already over when the first observation arrived (N-4).
  if (fresh && to === "finished") return instantDiff(kickoff, now) >= 0;
  return true;
}

const sameScore = (a: MatchState, b: MatchState) =>
  a.score !== null &&
  b.score !== null &&
  a.score.home === b.score.home &&
  a.score.away === b.score.away;

export function decide(input: EngineInput): EngineOutput {
  const { match, current, observations, priority, now } = input;
  const matchId = match.id;
  const open: AlertDraft[] = [];
  const resolve: AlertKind[] = [];

  // Only what already happened, oldest first (a).
  const timeline = observations
    .filter((o) => age(o.observedAt, now) >= 0)
    .sort(oldestFirst);

  // One per source, the freshest, priority known (RN-01).
  const freshest = new Map<string, Observation>();
  for (const o of timeline) {
    if (age(o.observedAt, now) >= minutes(OBSERVATION_WINDOW_MINUTES)) continue;
    if (priority(o.sourceId) === undefined) continue;
    freshest.set(o.sourceId, o);
  }
  // Highest priority first, then the most recent, then the id (c).
  const ranked: Candidate[] = [...freshest.values()]
    .map((observation) => ({
      observation,
      priority: priority(observation.sourceId) as number,
    }))
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        instantDiff(a.observation.observedAt, b.observation.observedAt) ||
        byId(b.observation, a.observation),
    );
  const winner = ranked[0];

  const draft = (
    state: MatchState,
    rule: DecisionRule,
    qualifier: Qualifier,
    observationIds: ObservationId[],
  ): DecisionDraft => ({
    ...state,
    matchId,
    qualifier,
    rule,
    observationIds,
    decidedAt: now,
  });

  // Idempotence (g): the same tuple twice writes one row, not two.
  const publish = (decision: DecisionDraft | null): EngineOutput => ({
    decision:
      decision !== null &&
      current !== null &&
      tuple(decision) === tuple(current)
        ? null
        : decision,
    open,
    resolve,
  });

  // CA-7: confirmado by priority or by a second source that agrees with what
  // is being published; the confirming observation is cited too (RN-06).
  const settle = (
    state: MatchState,
    rule: DecisionRule,
    candidate: Candidate,
  ): DecisionDraft => {
    if (candidate.priority >= FEDERATION_PRIORITY)
      return draft(state, rule, "confirmado", [candidate.observation.id]);
    const confirmer = ranked.find(
      (r) =>
        r.observation.sourceId !== candidate.observation.sourceId &&
        stateOf(r.observation).status === state.status &&
        sameScore(stateOf(r.observation), state),
    );
    return confirmer === undefined
      ? draft(state, rule, "provisional", [candidate.observation.id])
      : draft(state, rule, "confirmado", [
          candidate.observation.id,
          confirmer.observation.id,
        ]);
  };

  // 1. The operator publishes as is: no monotonía, no conflicto, no cierre
  //    forzoso (e).
  if (winner !== undefined && winner.priority >= OPERATOR_PRIORITY)
    return publish(
      draft(stateOf(winner.observation), "operator", "confirmado", [
        winner.observation.id,
      ]),
    );

  if (winner === undefined) return publish(null);

  const proposed = stateOf(winner.observation);

  // RN-02 as a guard (d): an illegal transition drops the observation, which
  // stays in the log and may publish itself on a later tick.
  if (
    !transitionAllowed(
      current?.status ?? null,
      proposed.status,
      winner.priority,
      match.kickoff,
      now,
    )
  )
    return publish(null);

  // 2. RN-01: the winner, as it comes.
  return publish(settle(proposed, "RN-01", winner));
}
