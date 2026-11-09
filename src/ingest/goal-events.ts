import type { DecisionDraft } from "../decide/index.ts";
import type { Decision } from "../model/index.ts";

// SPEC-066 CA-2, ADR-030 §1: a goal is the difference between the current
// Decision and the one about to be written, per side, both in live. The
// score goes up and the new Decision is confirmado: goal. The score goes
// down, with any qualifier: goal_annulled (a correction is never silenced).
// Nothing else is a goal: not the first live, not a final (H-3 of EPIC-007),
// not a provisional that is confirmed later with the same score (H-2). Pure:
// no SQL and no clock, and src/decide/ knows nothing of it.

export const SIDES = ["home", "away"] as const;
export type Side = (typeof SIDES)[number];

export const GOAL_EVENT_KINDS = ["goal", "goal_annulled"] as const;
export type GoalEventKind = (typeof GOAL_EVENT_KINDS)[number];

export type GoalEvent = { side: Side; kind: GoalEventKind };

export function goalEvents(
  current: Decision | null,
  next: DecisionDraft,
): GoalEvent[] {
  if (current === null) return [];
  if (current.status !== "live" || next.status !== "live") return [];
  const events: GoalEvent[] = [];
  for (const side of SIDES) {
    const before = current.score[side];
    const after = next.score[side];
    if (after > before && next.qualifier === "confirmado")
      events.push({ side, kind: "goal" });
    else if (after < before) events.push({ side, kind: "goal_annulled" });
  }
  return events;
}
