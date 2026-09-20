import { describe, expect, it } from "vitest";
import {
  AlertKind,
  DecisionRule,
  Instant,
  MatchStatus,
  Qualifier,
  Season,
} from "./index";

describe("CA-2 closed vocabularies", () => {
  it("MatchStatus has the five states in order", () => {
    expect(MatchStatus.options).toEqual([
      "scheduled",
      "live",
      "finished",
      "postponed",
      "suspended",
    ]);
    expect(MatchStatus.safeParse("halftime").success).toBe(false);
  });

  it("Qualifier has the three qualifiers", () => {
    expect(Qualifier.options).toEqual([
      "confirmado",
      "provisional",
      "sen_sinal",
    ]);
  });

  it("DecisionRule lists operator and the deciding rules only", () => {
    expect(DecisionRule.options).toEqual([
      "operator",
      "RN-01",
      "RN-02",
      "RN-03",
      "RN-05",
    ]);
    expect(DecisionRule.safeParse("RN-04").success).toBe(false);
    expect(DecisionRule.safeParse("RN-06").success).toBe(false);
  });

  it("AlertKind has the four kinds", () => {
    expect(AlertKind.options).toEqual([
      "conflict",
      "regression",
      "silence",
      "unresolved_team",
    ]);
  });

  it("Season is YYYY-YY", () => {
    expect(Season.safeParse("2026-27").success).toBe(true);
    expect(Season.safeParse("2026/27").success).toBe(false);
  });
});

describe("CA-3 instants", () => {
  it("accepts ISO-8601 UTC with Z, with or without milliseconds", () => {
    expect(Instant.safeParse("2026-09-20T18:30:00Z").success).toBe(true);
    expect(Instant.safeParse("2026-09-20T18:30:00.000Z").success).toBe(true);
  });

  it("rejects offsets, local time, Date and epoch numbers", () => {
    expect(Instant.safeParse("2026-09-20T20:30:00+02:00").success).toBe(false);
    expect(Instant.safeParse("2026-09-20T18:30:00").success).toBe(false);
    expect(Instant.safeParse(new Date()).success).toBe(false);
    expect(Instant.safeParse(1758393000).success).toBe(false);
  });
});
