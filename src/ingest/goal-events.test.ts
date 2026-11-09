import { describe, expect, it } from "vitest";
import type { DecisionDraft } from "../decide/index.ts";
import type {
  Decision,
  DecisionId,
  Instant,
  MatchId,
  MatchStatus,
  ObservationId,
  Qualifier,
} from "../model/index.ts";
import { goalEvents } from "./goal-events.ts";

// SPEC-066 CA-2 (ADR-030 §1): the pure rule that turns two consecutive
// Decisions into goal events. No SQL, no clock: both sides are given.

const MATCH = "test-match" as MatchId;
const AT = "2026-11-07T17:30:00.000Z" as Instant;

type Score = [home: number, away: number];

function state(status: MatchStatus, score: Score | null) {
  if (status === "live")
    return {
      status,
      score: { home: (score as Score)[0], away: (score as Score)[1] },
      minute: 30,
      addedMinute: null,
    };
  if (status === "finished" || status === "suspended")
    return {
      status,
      score: { home: (score as Score)[0], away: (score as Score)[1] },
      minute: null,
    };
  return { status, score: null, minute: null };
}

const current = (
  status: MatchStatus,
  score: Score | null,
  qualifier: Qualifier = "confirmado",
): Decision =>
  ({
    ...state(status, score),
    id: "00000000-0000-0000-0000-000000000001" as DecisionId,
    matchId: MATCH,
    version: 1,
    qualifier,
    rule: "RN-01",
    observationIds: ["00000000-0000-0000-0000-000000000002" as ObservationId],
    decidedAt: AT,
    scoredBy: { home: null, away: null },
    forcedFinish: null,
  }) as Decision;

const next = (
  status: MatchStatus,
  score: Score | null,
  qualifier: Qualifier = "confirmado",
): DecisionDraft =>
  ({
    ...state(status, score),
    matchId: MATCH,
    qualifier,
    rule: "RN-01",
    observationIds: ["00000000-0000-0000-0000-000000000003" as ObservationId],
    decidedAt: AT,
  }) as DecisionDraft;

describe("SPEC-066 CA-2 goalEvents", () => {
  it.each<{
    name: string;
    current: Decision | null;
    next: DecisionDraft;
    events: { side: "home" | "away"; kind: "goal" | "goal_annulled" }[];
  }>([
    {
      name: "live 0-0 -> live 1-0 confirmado = goal home",
      current: current("live", [0, 0]),
      next: next("live", [1, 0]),
      events: [{ side: "home", kind: "goal" }],
    },
    {
      name: "live 0-0 -> live 1-0 provisional = nothing (H-1, H-2)",
      current: current("live", [0, 0]),
      next: next("live", [1, 0], "provisional"),
      events: [],
    },
    {
      name: "live 0-0 -> live 1-0 sen_sinal = nothing",
      current: current("live", [0, 0]),
      next: next("live", [1, 0], "sen_sinal"),
      events: [],
    },
    {
      name: "current sen_sinal 1-0 -> confirmado 2-0 = goal home",
      current: current("live", [1, 0], "sen_sinal"),
      next: next("live", [2, 0]),
      events: [{ side: "home", kind: "goal" }],
    },
    {
      name: "live 1-0 -> live 0-0 confirmado = goal_annulled home",
      current: current("live", [1, 0]),
      next: next("live", [0, 0]),
      events: [{ side: "home", kind: "goal_annulled" }],
    },
    {
      name: "live 1-0 -> live 0-0 provisional = goal_annulled home (H-3)",
      current: current("live", [1, 0]),
      next: next("live", [0, 0], "provisional"),
      events: [{ side: "home", kind: "goal_annulled" }],
    },
    {
      name: "live 0-1 -> live 0-0 sen_sinal = goal_annulled away",
      current: current("live", [0, 1]),
      next: next("live", [0, 0], "sen_sinal"),
      events: [{ side: "away", kind: "goal_annulled" }],
    },
    {
      name: "live 0-0 -> live 1-1 = two events, home first",
      current: current("live", [0, 0]),
      next: next("live", [1, 1]),
      events: [
        { side: "home", kind: "goal" },
        { side: "away", kind: "goal" },
      ],
    },
    {
      name: "live 0-0 -> live 2-0 = one event",
      current: current("live", [0, 0]),
      next: next("live", [2, 0]),
      events: [{ side: "home", kind: "goal" }],
    },
    {
      name: "live 1-0 -> live 0-1 = annulled home and goal away",
      current: current("live", [1, 0]),
      next: next("live", [0, 1]),
      events: [
        { side: "home", kind: "goal_annulled" },
        { side: "away", kind: "goal" },
      ],
    },
    {
      name: "no current, live 1-0 = nothing",
      current: null,
      next: next("live", [1, 0]),
      events: [],
    },
    {
      name: "scheduled -> live 1-0 = nothing",
      current: current("scheduled", null),
      next: next("live", [1, 0]),
      events: [],
    },
    {
      name: "live 1-0 -> finished 2-0 = nothing (H-3 of the epic)",
      current: current("live", [1, 0]),
      next: next("finished", [2, 0]),
      events: [],
    },
    {
      name: "live 1-0 -> suspended 1-0 = nothing",
      current: current("live", [1, 0]),
      next: next("suspended", [1, 0]),
      events: [],
    },
    {
      name: "live 1-0 -> live 1-0 (minute only) = nothing",
      current: current("live", [1, 0]),
      next: next("live", [1, 0]),
      events: [],
    },
  ])("$name", ({ current, next, events }) => {
    expect(goalEvents(current, next)).toEqual(events);
  });
});
