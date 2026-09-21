import type {
  AlertKind,
  Decision,
  DecisionRule,
  Details,
  Instant,
  Match,
  MatchId,
  MatchState,
  MatchStatus,
  Observation,
  ObservationId,
  Qualifier,
} from "../model/index.ts";

// What the engine needs of a match: no teams, no season, no status. The
// current status is the Decision's (ADR-006 §3).
export type EngineMatch = Pick<Match, "id" | "competitionId" | "kickoff">;

// The last observation known of the match, of any age (N-9). The adapter
// knows it beyond the window of observations; absent or null, the engine
// falls back to the freshest of what it was handed. It never changes which
// Decision is produced: it only fills in the details of silence and
// forced_finish, which by definition happen with nothing inside the window.
export type LastHeard = { observedAt: Instant; status: MatchStatus };

// The whole world of the engine (N-2): no clock, no registry, no database.
// Priorities arrive as a function, now as a value.
export type EngineInput = {
  match: EngineMatch;
  current: Decision | null;
  observations: Observation[];
  priority: (sourceId: string) => number | undefined;
  lastHeard?: LastHeard | null;
  now: Instant;
};

// A Decision without id and without version: the database assigns both
// (ADR-006 §3), which is what makes the engine deterministic and replayable.
export type DecisionDraft = MatchState & {
  matchId: MatchId;
  qualifier: Qualifier;
  rule: DecisionRule;
  observationIds: ObservationId[];
  decidedAt: Instant;
};

// The four kinds the engine opens. unresolved_team is the adapter's (RN-10)
// and is the only kind that may lack a match.
export type AlertDraft = {
  kind: Exclude<AlertKind, "unresolved_team">;
  matchId: MatchId;
  details: Details;
};

// resolve carries kinds, not ids: the adapter closes every open alert of that
// kind for the match. Only silence is ever resolved here (RN-05, N-3).
export type EngineOutput = {
  decision: DecisionDraft | null;
  open: AlertDraft[];
  resolve: AlertKind[];
};
