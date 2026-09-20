import { describe, expect, it } from "vitest";
import {
  AlertId,
  AlertKind,
  CompetitionId,
  DecisionId,
  DecisionRule,
  Instant,
  MatchId,
  MatchStatus,
  ObservationId,
  Qualifier,
  Season,
  SourceId,
  TeamId,
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

describe("CA-4 branded ids", () => {
  it("slug ids accept slugs and reject anything else", () => {
    expect(CompetitionId.safeParse("tercera-rfef-g1").success).toBe(true);
    expect(CompetitionId.safeParse("Tercera RFEF").success).toBe(false);
    expect(TeamId.safeParse("ud-ourense").success).toBe(true);
    expect(TeamId.safeParse("-ud-ourense").success).toBe(false);
    expect(SourceId.safeParse("operator").success).toBe(true);
    expect(SourceId.safeParse("").success).toBe(false);
  });

  it("MatchId is any non-empty string", () => {
    expect(
      MatchId.safeParse("2026-27:tercera-rfef-g1:r1:ud-ourense-cd-ourense")
        .success,
    ).toBe(true);
    expect(MatchId.safeParse("").success).toBe(false);
  });

  it("log ids are uuids", () => {
    const uuid = "018f3b7e-1c2a-7d5e-9a3f-1234567890ab";
    expect(ObservationId.safeParse(uuid).success).toBe(true);
    expect(DecisionId.safeParse(uuid).success).toBe(true);
    expect(AlertId.safeParse(uuid).success).toBe(true);
    expect(ObservationId.safeParse("not-a-uuid").success).toBe(false);
  });

  it("brands are distinct at the type level", () => {
    const team: TeamId = TeamId.parse("ud-ourense");
    // @ts-expect-error a TeamId is not a CompetitionId
    const competition: CompetitionId = team;
    expect(competition).toBe(team);
  });
});
