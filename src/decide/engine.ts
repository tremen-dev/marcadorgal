import {
  type AlertKind,
  type DecisionRule,
  FEDERATION_PRIORITY,
  type Instant,
  instantDiff,
  isHalfTime,
  type MatchState,
  type MatchStatus,
  MINUTE_MS,
  type Observation,
  type ObservationId,
  OPERATOR_PRIORITY,
  type Qualifier,
  type Score,
  type ScoredBy,
  type SourceId,
} from "../model/index.ts";
import {
  CONFLICT_GRACE_MINUTES,
  FORCED_FINISH_MINUTES,
  KICKOFF_GRACE_MINUTES,
  OBSERVATION_WINDOW_MINUTES,
  SILENCE_MINUTES,
} from "./thresholds.ts";
import type {
  AlertDraft,
  DecisionDraft,
  EngineInput,
  EngineOutput,
  LastHeard,
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
      halfTime: o.halfTime ?? false,
    };
  if (o.status === "finished" || o.status === "suspended")
    return { status: o.status, score: o.score, minute: null };
  return { status: o.status, score: null, minute: null };
}

// The published tuple of H-1: a Decision is born when any of these moves, the
// minute and half-time included (SPEC-021 CA-3: an absent halfTime is false).
// The rule is deliberately out of it.
const tuple = (s: MatchState & { qualifier: Qualifier }) =>
  [
    s.status,
    s.score === null ? "-" : `${s.score.home}-${s.score.away}`,
    s.minute ?? "-",
    (s.status === "live" ? s.addedMinute : null) ?? "-",
    isHalfTime(s) ? "HT" : "-",
    s.qualifier,
  ].join("|");

// RN-02 as a guard: an illegal transition never publishes, whichever rule
// would have decided it. The forced finish of RN-02 is evaluated apart (H-3).
// postponed and suspended come from the winning source like any other
// transition, and leaving them is one more transition (ADR-012 §1, §3).
function transitionAllowed(
  from: MatchStatus | null,
  to: MatchStatus,
  kickoff: Instant,
  now: Instant,
): boolean {
  // Nothing goes back from finished but the operator, handled before this.
  if (from === "finished" && to !== "finished") return false;
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

// ADR-011 §3: an owner nobody recorded (every row before SPEC-014) is
// api-football, the only source that published until then.
const LEGACY_OWNER = "api-football" as SourceId;

type Side = "home" | "away";
const SIDES: readonly Side[] = ["home", "away"];

// ADR-011 §2: after publishing, a side whose value changes (up or down) is
// owned by the winning source; a side that does not change keeps its owner. A
// state with no score has no owners (SPEC-014 CA-4).
function ownersOf(
  score: Score | null,
  before: Score | null,
  owners: ScoredBy,
  winner: SourceId | null,
): ScoredBy {
  if (score === null) return { home: null, away: null };
  const owner = (side: Side) =>
    before !== null && before[side] === score[side]
      ? owners[side]
      : (winner ?? owners[side]);
  return { home: owner("home"), away: owner("away") };
}

const sameScore = (a: MatchState, b: MatchState) =>
  a.score !== null &&
  b.score !== null &&
  a.score.home === b.score.home &&
  a.score.away === b.score.away;

// CA-7: a second source agrees when it says the same status and, if that
// status carries a score, the same score (a postponed has none: ADR-012 §2).
const agrees = (a: MatchState, b: MatchState) =>
  a.status === b.status &&
  ((a.score === null && b.score === null) || sameScore(a, b));

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
  const { match, current, observations, priority, lastHeard, now } = input;
  const matchId = match.id;
  const open: AlertDraft[] = [];
  const resolve: AlertKind[] = [];

  // Only what already happened, oldest first (a).
  const timeline = observations
    .filter((o) => age(o.observedAt, now) >= 0)
    .sort(oldestFirst);

  // Anything heard inside the silence window, and the very last thing heard:
  // RN-05 reads the first, the alerts of RN-05 and RN-02 the second.
  const heard = timeline.filter(
    (o) => age(o.observedAt, now) < minutes(SILENCE_MINUTES),
  );
  // The last thing heard of this match, at any age (N-9): the adapter knows
  // it beyond the window, and without it the freshest of what we were handed.
  const newest = timeline.at(-1);
  const last: LastHeard | null =
    lastHeard ??
    (newest === undefined
      ? null
      : { observedAt: newest.observedAt, status: newest.status });

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

  // The owners of the current Decision, legacy rows included (null stays null
  // here: it is read as api-football only when a retreat is judged).
  const currentOwners: ScoredBy = current?.scoredBy ?? {
    home: null,
    away: null,
  };
  const currentScore = current?.score ?? null;

  // Every Decision of the engine says who owns each side and is no forced
  // finish (CA-8); the forced finish of RN-02 overrides the mark.
  const draft = (
    state: MatchState,
    rule: DecisionRule,
    qualifier: Qualifier,
    observationIds: ObservationId[],
    by: SourceId | null,
  ): DecisionDraft => ({
    ...state,
    matchId,
    qualifier,
    rule,
    observationIds,
    decidedAt: now,
    scoredBy: ownersOf(state.score, currentScore, currentOwners, by),
    forcedFinish: false,
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
    const by = candidate.observation.sourceId;
    if (candidate.priority >= FEDERATION_PRIORITY)
      return draft(state, rule, "confirmado", [candidate.observation.id], by);
    const confirmer = ranked.find(
      (r) =>
        r.observation.sourceId !== candidate.observation.sourceId &&
        agrees(stateOf(r.observation), state),
    );
    return confirmer === undefined
      ? draft(state, rule, "provisional", [candidate.observation.id], by)
      : draft(
          state,
          rule,
          "confirmado",
          [candidate.observation.id, confirmer.observation.id],
          by,
        );
  };

  // The signal is back: RN-05 closes its own alert, and only its own (N-3).
  // A scheduled · sen_sinal never opened one (ADR-013 H-4).
  if (
    ranked.length > 0 &&
    current?.qualifier === "sen_sinal" &&
    current.status === "live"
  )
    resolve.push("silence");

  // 1. The operator publishes as is: no monotonía, no conflicto, no cierre
  //    forzoso (e).
  if (winner !== undefined && winner.priority >= OPERATOR_PRIORITY)
    return publish(
      draft(
        stateOf(winner.observation),
        "operator",
        "confirmado",
        [winner.observation.id],
        winner.observation.sourceId,
      ),
    );

  // 2. RN-02 forced finish (H-3): above RN-05 and above whatever the sources
  //    are still saying. It publishes a finished nobody confirmed, so it
  //    always leaves a forced_finish Alert behind (H-5 (iii)). RN-03 does
  //    not survive the close (ADR-010 §1): the score is the winning fresh
  //    observation's, and the current one only when nobody fresh has one.
  if (
    current !== null &&
    current.status === "live" &&
    instantDiff(match.kickoff, now) >= minutes(FORCED_FINISH_MINUTES)
  ) {
    const freshScore =
      winner === undefined ? null : stateOf(winner.observation).score;
    const closed =
      freshScore === null || winner === undefined
        ? draft(
            { status: "finished", score: current.score, minute: null },
            "RN-02",
            "provisional",
            [...current.observationIds],
            null,
          )
        : draft(
            { status: "finished", score: freshScore, minute: null },
            "RN-02",
            "provisional",
            [winner.observation.id],
            winner.observation.sourceId,
          );
    // CA-10: score is what the close publishes, heldScore what was published
    // right before it (what score used to carry, so it is not lost).
    const published = closed.score ?? current.score;
    open.push({
      kind: "forced_finish",
      matchId,
      details: {
        score: { home: published.home, away: published.away },
        heldScore: { home: current.score.home, away: current.score.away },
        minute: current.minute,
        kickoff: match.kickoff,
        lastObservedAt: last?.observedAt ?? null,
        lastStatus: last?.status ?? null,
      },
    });
    // The one Decision of the engine that is a forced finish (CA-8).
    return publish({ ...closed, forcedFinish: true });
  }

  // RN-12 reconciliation (ADR-010 §2): a match closed provisional by the
  // forced finish of RN-02 accepts the final the winning source confirms
  // later. Score and qualifier change, the status never does, and RN-03 has
  // nothing to say after the close (ADR-010 §1). It does not resolve the
  // forced_finish alert (EPIC-004). A confirmed finished admits nothing.
  // Only the mark tells a forced finish (SPEC-014 CA-8, CA-9): a correction
  // with rule RN-02 and any row without the mark is no forced finish.
  if (current !== null && current.status === "finished") {
    const confirmed = winner === undefined ? null : stateOf(winner.observation);
    if (
      current.forcedFinish === true &&
      winner !== undefined &&
      confirmed !== null &&
      confirmed.status === "finished"
    )
      return publish(
        draft(
          confirmed,
          "RN-12",
          "confirmado",
          [winner.observation.id],
          winner.observation.sourceId,
        ),
      );
    if (current.qualifier === "confirmado") return publish(null);
  }

  // 3. RN-05 in scheduled (ADR-013 §2, SPEC-018 CA-4): the kickoff is
  //    fifteen minutes gone and no fresh observation gives the match live,
  //    finished, postponed or suspended. It stays scheduled, loses its
  //    qualifier and opens no Alert (H-4). A later scheduled observation does
  //    not give it back (no blinking): only a real state does, through RN-01.
  if (
    current !== null &&
    current.status === "scheduled" &&
    instantDiff(match.kickoff, now) >= minutes(SILENCE_MINUTES) &&
    ranked.every((r) => r.observation.status === "scheduled")
  )
    return publish(
      draft(
        { status: "scheduled", score: null, minute: null },
        "RN-05",
        "sen_sinal",
        [...current.observationIds],
        null,
      ),
    );

  // 3. RN-05 silencio: nobody has said anything for fifteen minutes, so the
  //    match keeps its state and loses its qualifier.
  if (winner === undefined) {
    if (current !== null && current.status === "live" && heard.length === 0) {
      open.push({
        kind: "silence",
        matchId,
        details: { lastObservedAt: last?.observedAt ?? null },
      });
      return publish(
        draft(
          {
            status: "live",
            score: current.score,
            minute: current.minute,
            addedMinute: current.addedMinute,
            halfTime: current.halfTime ?? false,
          },
          "RN-05",
          "sen_sinal",
          [...current.observationIds],
          null,
        ),
      );
    }
    return publish(null);
  }

  const proposed = stateOf(winner.observation);

  // RN-02 as a guard (d): an illegal transition drops the observation, which
  // stays in the log and may publish itself on a later tick.
  if (
    !transitionAllowed(
      current?.status ?? null,
      proposed.status,
      match.kickoff,
      now,
    )
  )
    return publish(null);

  // 4. RN-03 monotonía, side by side (ADR-011): while the match is in play a
  //    side goes down only by its owner or by a heavier source. A side that
  //    nobody may lower keeps the current value; the proposed status and
  //    minute are published wearing it, and the retreat leaves an Alert for
  //    the operator (N-3). An accepted retreat falls through to RN-01 with no
  //    alert (ADR-011 §4). It does not survive the close (ADR-010 §1): the
  //    transition to finished falls through to RN-01 and publishes the winner
  //    as it comes.
  const held = currentScore;
  const closing =
    proposed.status === "finished" && current?.status !== "finished";
  if (!closing && held !== null && proposed.score !== null) {
    const proposedScore = proposed.score;
    const mayLower = (side: Side) => {
      const owner = currentOwners[side] ?? LEGACY_OWNER;
      if (owner === winner.observation.sourceId) return true;
      const weight = priority(owner);
      return weight !== undefined && winner.priority > weight;
    };
    const keep = (side: Side) =>
      proposedScore[side] < held[side] && !mayLower(side);
    if (SIDES.some(keep)) {
      open.push({
        kind: "regression",
        matchId,
        details: {
          sourceId: winner.observation.sourceId,
          observationId: winner.observation.id,
          current: { home: held.home, away: held.away },
          proposed: { home: proposedScore.home, away: proposedScore.away },
        },
      });
      const kept: Score = {
        home: keep("home") ? held.home : proposedScore.home,
        away: keep("away") ? held.away : proposedScore.away,
      };
      return publish(settle(holdingScore(proposed, kept), "RN-03", winner));
    }
  }

  // 5. RN-04 conflicto: a guard, never a publication, so RN-04 is not a
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

  // 6. RN-01: the winner, as it comes.
  return publish(settle(proposed, "RN-01", winner));
}
