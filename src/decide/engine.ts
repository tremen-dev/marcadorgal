import {
  type AlertKind,
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
  type Score,
} from "../model/index.ts";
import {
  CONFLICT_GRACE_MINUTES,
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

// RN-03: the proposed state keeps its status and its minute, but wears the
// score that is already published. Sides are never mixed.
function holdingScore(state: MatchState, score: Score): MatchState {
  if (state.status === "live") return { ...state, score };
  if (state.status === "finished" || state.status === "suspended")
    return { status: state.status, score, minute: null };
  return state;
}

const sameScore = (a: MatchState, b: MatchState) =>
  a.score !== null &&
  b.score !== null &&
  a.score.home === b.score.home &&
  a.score.away === b.score.away;

// H-4: two priorities are adjacent when no other source the engine can see
// carries a priority strictly between them. Equal priority counts.
const adjacent = (a: number, b: number, known: number[]) =>
  !known.some((p) => p > Math.min(a, b) && p < Math.max(a, b));

// RN-04: walking the two timelines and keeping the last score of each, the
// instant of the first observation after the last moment they agreed (or one
// of them had no score yet). null when they still agree.
function disagreementSince(
  timeline: Observation[],
  a: string,
  b: string,
): Instant | null {
  const line = timeline.filter((o) => o.sourceId === a || o.sourceId === b);
  const last = new Map<string, Score | null>();
  let met = -1;
  line.forEach((o, i) => {
    last.set(o.sourceId, stateOf(o).score);
    const one = last.get(a);
    const other = last.get(b);
    const agreed =
      one === undefined ||
      other === undefined ||
      one === null ||
      other === null ||
      (one.home === other.home && one.away === other.away);
    if (agreed) met = i;
  });
  return line[met + 1]?.observedAt ?? null;
}

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

  // 2. RN-03 monotonía: a score never goes down but by the operator. The
  //    proposed status is published wearing the current score, and the
  //    retreat leaves an Alert for the operator (N-3).
  const held = current?.score ?? null;
  if (
    held !== null &&
    proposed.score !== null &&
    (proposed.score.home < held.home || proposed.score.away < held.away)
  ) {
    open.push({
      kind: "regression",
      matchId,
      details: {
        sourceId: winner.observation.sourceId,
        observationId: winner.observation.id,
        current: { home: held.home, away: held.away },
        proposed: { home: proposed.score.home, away: proposed.score.away },
      },
    });
    return publish(settle(holdingScore(proposed, held), "RN-03", winner));
  }

  // 3. RN-04 conflicto: a guard, never a publication, so RN-04 is not a
  //    DecisionRule. The current Decision is held and the operator is told.
  const known = [
    ...new Set(
      timeline
        .map((o) => priority(o.sourceId))
        .filter((p): p is number => p !== undefined),
    ),
  ];
  for (const rival of ranked) {
    if (rival.observation.sourceId === winner.observation.sourceId) continue;
    if (!adjacent(winner.priority, rival.priority, known)) continue;
    const rivalState = stateOf(rival.observation);
    if (proposed.score === null || rivalState.score === null) continue;
    if (sameScore(proposed, rivalState)) continue;
    const since = disagreementSince(
      timeline,
      winner.observation.sourceId,
      rival.observation.sourceId,
    );
    if (since === null) continue;
    if (instantDiff(since, now) <= minutes(CONFLICT_GRACE_MINUTES)) continue;
    open.push({
      kind: "conflict",
      matchId,
      details: {
        winner: {
          sourceId: winner.observation.sourceId,
          score: { home: proposed.score.home, away: proposed.score.away },
        },
        rival: {
          sourceId: rival.observation.sourceId,
          score: { home: rivalState.score.home, away: rivalState.score.away },
        },
        since,
      },
    });
    return publish(null);
  }

  // 4. RN-01: the winner, as it comes.
  return publish(settle(proposed, "RN-01", winner));
}
