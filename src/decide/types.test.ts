import { describe, expect, it } from "vitest";
import {
  Decision,
  type DecisionId,
  type MatchId,
  type ObservationId,
} from "../model/index.ts";
import {
  CONFLICT_GRACE_MINUTES,
  FORCED_FINISH_MINUTES,
  KICKOFF_GRACE_MINUTES,
  OBSERVATION_WINDOW_MINUTES,
  SILENCE_MINUTES,
} from "./thresholds.ts";
import type { AlertDraft, DecisionDraft } from "./types.ts";

const OBSERVATION = "11111111-1111-4111-8111-111111111111" as ObservationId;
const DECISION = "22222222-2222-4222-8222-222222222222" as DecisionId;

const draft: DecisionDraft = {
  status: "live",
  score: { home: 1, away: 0 },
  minute: 70,
  addedMinute: null,
  matchId: "primera-division-2026-27-j1-celta-deportivo" as MatchId,
  qualifier: "provisional",
  rule: "RN-01",
  observationIds: [OBSERVATION],
  decidedAt: "2026-09-25T19:40:00.000Z",
};

describe("CA-2 DecisionDraft", () => {
  it("becomes a Decision once the database adds id and version", () => {
    const decision = Decision.parse({ ...draft, id: DECISION, version: 1 });
    expect(decision).toMatchObject({ version: 1, rule: "RN-01" });
  });

  it("never carries an id or a version of its own (ADR-006 §3)", () => {
    // @ts-expect-error a draft has no id: the database assigns it
    const withId: DecisionDraft = { ...draft, id: DECISION };
    // @ts-expect-error a draft has no version: the trigger assigns it
    const withVersion: DecisionDraft = { ...draft, version: 1 };
    expect([withId, withVersion]).toHaveLength(2);
  });
});

describe("CA-2 AlertDraft", () => {
  it("admits the four kinds the engine opens", () => {
    const kinds: AlertDraft["kind"][] = [
      "conflict",
      "regression",
      "silence",
      "forced_finish",
    ];
    expect(kinds).toHaveLength(4);
  });

  it("never carries unresolved_team: that one is the adapter's (RN-10)", () => {
    // @ts-expect-error unresolved_team is excluded from AlertDraft
    const kind: AlertDraft["kind"] = "unresolved_team";
    expect(kind).toBe("unresolved_team");
  });
});

describe("CA-2 thresholds", () => {
  it("has the five numbers of ADR-004 with their rule", () => {
    expect({
      OBSERVATION_WINDOW_MINUTES,
      CONFLICT_GRACE_MINUTES,
      SILENCE_MINUTES,
      FORCED_FINISH_MINUTES,
      KICKOFF_GRACE_MINUTES,
    }).toEqual({
      OBSERVATION_WINDOW_MINUTES: 5,
      CONFLICT_GRACE_MINUTES: 3,
      SILENCE_MINUTES: 15,
      FORCED_FINISH_MINUTES: 120,
      KICKOFF_GRACE_MINUTES: 15,
    });
  });
});
