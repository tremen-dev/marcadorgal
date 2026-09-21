import type {
  Decision,
  DecisionId,
  Instant,
  Observation,
} from "../model/index.ts";
import { instantDiff } from "../model/index.ts";
import { decide } from "./engine.ts";
import type { EngineMatch, EngineOutput } from "./types.ts";

export type ReplayInput = {
  match: EngineMatch;
  priority: (sourceId: string) => number | undefined;
  observations: Observation[];
  // Extra moments to evaluate: what nobody observes (RN-05, the forced finish
  // of RN-02) only happens when someone looks.
  instants?: Instant[];
};

export type ReplayStep = { now: Instant; output: EngineOutput };

// Ids and versions exist here only to chain one step to the next: the real
// ones are the database's (ADR-006 §3), and deriving them from the index is
// what keeps the replay deterministic (ADR-004, criterion 4).
const chained = (version: number): DecisionId =>
  `00000000-0000-4000-8000-${String(version).padStart(12, "0")}` as DecisionId;

const ascending = (a: Instant, b: Instant) => instantDiff(b, a);

// Folds decide() over the instants of the log: given the observations, it
// reproduces the decisions.
export function replay({
  match,
  priority,
  observations,
  instants = [],
}: ReplayInput): ReplayStep[] {
  const moments = [
    ...new Set([...observations.map((o) => o.observedAt), ...instants]),
  ].sort(ascending);

  let current: Decision | null = null;
  let version = 0;
  const steps: ReplayStep[] = [];
  for (const now of moments) {
    const output = decide({
      match,
      current,
      observations: observations.filter(
        (o) => instantDiff(o.observedAt, now) >= 0,
      ),
      priority,
      now,
    });
    if (output.decision !== null) {
      version += 1;
      current = {
        ...output.decision,
        id: chained(version),
        version,
      } as Decision;
    }
    steps.push({ now, output });
  }
  return steps;
}
