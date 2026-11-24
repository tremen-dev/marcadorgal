import type { PublicGoal, Score } from "@/model";

// SPEC-094 CA-1: the scorers of each side, squared with its score. The
// score comes from the Decision and the scorers from another clock
// (explorer), so they can disagree: the score always wins. Pure: no clock,
// no network, no React.

export type ScorerLine =
  | { kind: "scorer"; goal: PublicGoal }
  | { kind: "unknown" };

export type SquaredGoals = {
  home: ScorerLine[];
  away: ScorerLine[];
};

const SIDES = ["home", "away"] as const;

// By minute ascending (arrival order on a tie, Array.sort is stable), then
// the goals without minute in arrival order.
const byMinute = (a: PublicGoal, b: PublicGoal): number => {
  if (a.minute === undefined || b.minute === undefined)
    return (a.minute === undefined ? 1 : 0) - (b.minute === undefined ? 1 : 0);
  return a.minute - b.minute;
};

export function squareGoals(
  goals: readonly PublicGoal[] | undefined,
  score: Score | null,
): SquaredGoals {
  const out: SquaredGoals = { home: [], away: [] };
  if (score === null) return out;
  for (const side of SIDES) {
    const n = score[side];
    const known = (goals ?? [])
      .filter((g) => g.team === side)
      .sort(byMinute)
      .slice(0, n)
      .map((goal): ScorerLine => ({ kind: "scorer", goal }));
    const unknown = Array.from(
      { length: n - known.length },
      (): ScorerLine => ({ kind: "unknown" }),
    );
    out[side] = [...known, ...unknown];
  }
  return out;
}
