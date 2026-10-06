import {
  type DecisionDraft,
  type EngineInput,
  type EngineMatch,
  type EngineOutput,
  replay,
} from "../decide/index.ts";
import {
  type CompetitionId,
  type Instant,
  type MatchId,
  type MatchStatus,
  MINUTE_MS,
  type Observation,
  type Score,
  shiftInstant,
} from "../model/index.ts";
import {
  INFORME_TICK_SECONDS,
  WINDOW_AFTER_MINUTES,
  WINDOW_BEFORE_MINUTES,
} from "./constants.ts";

// SPEC-012 CA-4, the pure half. Replays a measured matchday match by match
// with the engine of today and compares the last Decision of the replay with
// what board publishes. Where they diverge on a finished match it drafts ONE
// corrective Decision: the score of the replay, rule RN-02, the observations
// that sustain it (RN-06) and decided_at today. Correcting is adding (RN-07).

export type BoardState = { status: MatchStatus; score: Score | null };

export type ReplayJornadaInput = {
  matches: { match: EngineMatch; board: BoardState }[];
  observations: Observation[];
  priority: (
    competitionId: CompetitionId,
  ) => (sourceId: string) => number | undefined;
  now: Instant;
  engine?: (input: EngineInput) => EngineOutput;
};

export type ReplayJornadaRow = {
  matchId: MatchId;
  board: BoardState;
  replay: BoardState | null;
  divergent: boolean;
  correction: DecisionDraft | null;
  // SPEC-014 CA-6: the live ticks in which the published score is not the
  // source's. A tick is a live observation of the match (N-3: they come out
  // of observations), counted when what is published right after deciding at
  // its instant is live too and wears another score.
  liveTicks: number;
};

// The sweep of ADR-009: what nobody observes (RN-05, the forced finish of
// RN-02) only happens when the tick looks, and the tick looked every thirty
// seconds over the window of ADR-002 §2, [kickoff − 10, kickoff + 150).
export function sweepInstants(kickoff: Instant): Instant[] {
  const step = INFORME_TICK_SECONDS * 1000;
  const from = -WINDOW_BEFORE_MINUTES * MINUTE_MS;
  const to = WINDOW_AFTER_MINUTES * MINUTE_MS;
  const instants: Instant[] = [];
  for (let offset = from; offset < to; offset += step)
    instants.push(shiftInstant(kickoff, offset));
  return instants;
}

const stateOf = (d: DecisionDraft): BoardState => ({
  status: d.status,
  score: d.score === null ? null : { home: d.score.home, away: d.score.away },
});

const same = (a: BoardState, b: BoardState) =>
  a.status === b.status &&
  (a.score === null || b.score === null
    ? a.score === b.score
    : a.score.home === b.score.home && a.score.away === b.score.away);

const scoreKey = (score: Score) => `${score.home}-${score.away}`;

function countLiveTicks(
  steps: ReturnType<typeof replay>,
  observations: Observation[],
): number {
  const sourceAt = new Map<Instant, Set<string>>();
  for (const o of observations) {
    if (o.status !== "live") continue;
    const at = sourceAt.get(o.observedAt) ?? new Set<string>();
    at.add(scoreKey(o.score));
    sourceAt.set(o.observedAt, at);
  }
  let published: DecisionDraft | null = null;
  let ticks = 0;
  for (const step of steps) {
    if (step.output.decision !== null) published = step.output.decision;
    const source = sourceAt.get(step.now);
    if (source === undefined || published === null) continue;
    if (published.status !== "live") continue;
    if (!source.has(scoreKey(published.score))) ticks += 1;
  }
  return ticks;
}

export function replayJornada({
  matches,
  observations,
  priority,
  now,
  engine,
}: ReplayJornadaInput): ReplayJornadaRow[] {
  return [...matches]
    .sort((a, b) => (a.match.id < b.match.id ? -1 : 1))
    .map(({ match, board }) => {
      const own = observations.filter((o) => o.matchId === match.id);
      const steps = replay({
        match,
        priority: priority(match.competitionId),
        observations: own,
        instants: sweepInstants(match.kickoff),
        engine,
      });
      const last = steps
        .map((s) => s.output.decision)
        .filter((d): d is DecisionDraft => d !== null)
        .at(-1);
      const replayed = last === undefined ? null : stateOf(last);
      const divergent = replayed === null || !same(board, replayed);
      const correction =
        divergent &&
        last !== undefined &&
        board.status === "finished" &&
        last.status === "finished"
          ? // A correction is not a close (SPEC-014 CA-8): RN-02 by SPEC-012
            // CA-4, but never the mark of the forced finish.
            {
              ...last,
              rule: "RN-02" as const,
              forcedFinish: false,
              decidedAt: now,
            }
          : null;
      return {
        matchId: match.id,
        board,
        replay: replayed,
        divergent,
        correction,
        liveTicks: countLiveTicks(steps, own),
      };
    });
}
