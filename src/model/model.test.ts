import { describe, expect, it } from "vitest";
import {
  Alert,
  AlertId,
  AlertKind,
  Competition,
  CompetitionId,
  Decision,
  DecisionId,
  DecisionRule,
  Instant,
  Match,
  MatchId,
  MatchState,
  MatchStatus,
  Observation,
  ObservationId,
  Qualifier,
  Season,
  SourceId,
  Team,
  TeamId,
} from "./index.ts";

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

  it("MatchId is a slug", () => {
    expect(
      MatchId.safeParse("tercera-rfef-g1-2026-27-j1-ud-ourense-cd-arenteiro")
        .success,
    ).toBe(true);
    expect(
      MatchId.safeParse("2026-27:tercera-rfef-g1:r1:ud-ourense:cd-arenteiro")
        .success,
    ).toBe(false);
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

describe("CA-5 match state with score", () => {
  const ok = (v: unknown) => MatchState.safeParse(v).success;
  const score = { home: 1, away: 0 };

  it("accepts the five states with their score and minute shapes", () => {
    expect(ok({ status: "scheduled", score: null, minute: null })).toBe(true);
    expect(ok({ status: "postponed", score: null, minute: null })).toBe(true);
    expect(ok({ status: "live", score, minute: 37 })).toBe(true);
    expect(ok({ status: "live", score, minute: null })).toBe(true);
    expect(ok({ status: "finished", score, minute: null })).toBe(true);
    expect(ok({ status: "suspended", score, minute: null })).toBe(true);
  });

  it("covers exactly the MatchStatus vocabulary", () => {
    expect(MatchState.options.map((o) => o.shape.status.value)).toEqual(
      MatchStatus.options,
    );
  });

  it("rejects live without score", () => {
    expect(ok({ status: "live", score: null, minute: 10 })).toBe(false);
  });

  it("rejects scheduled with score", () => {
    expect(ok({ status: "scheduled", score, minute: null })).toBe(false);
  });

  it("rejects finished with minute", () => {
    expect(ok({ status: "finished", score, minute: 90 })).toBe(false);
  });

  it("bounds minute and score", () => {
    expect(ok({ status: "live", score, minute: 131 })).toBe(false);
    expect(ok({ status: "live", score, minute: -1 })).toBe(false);
    expect(
      ok({ status: "live", score: { home: -1, away: 0 }, minute: 1 }),
    ).toBe(false);
    expect(
      ok({ status: "live", score: { home: 1.5, away: 0 }, minute: 1 }),
    ).toBe(false);
  });
});

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const fixtures = {
  competition: {
    id: "tercera-rfef-g1",
    season: "2026-27",
    name: "Tercera RFEF Grupo 1",
    tier: 5,
  },
  team: { id: "ud-ourense", name: "UD Ourense" },
  match: {
    id: "tercera-rfef-g1-2026-27-j1-ud-ourense-cd-arenteiro",
    competitionId: "tercera-rfef-g1",
    season: "2026-27",
    round: 1,
    kickoff: "2026-09-20T16:00:00Z",
    homeTeamId: "ud-ourense",
    awayTeamId: "cd-arenteiro",
  },
  observation: {
    id: uuid(1),
    matchId: "tercera-rfef-g1-2026-27-j1-ud-ourense-cd-arenteiro",
    sourceId: "operator",
    status: "live",
    score: { home: 1, away: 0 },
    minute: 37,
    observedAt: "2026-09-20T16:37:00Z",
    receivedAt: "2026-09-20T16:37:05Z",
    rawRef: "raw/operator/2026-09-20T16:37:05Z.json",
  },
  decision: {
    id: uuid(2),
    matchId: "tercera-rfef-g1-2026-27-j1-ud-ourense-cd-arenteiro",
    version: 1,
    status: "live",
    score: { home: 1, away: 0 },
    minute: 37,
    qualifier: "confirmado",
    rule: "operator",
    observationIds: [uuid(1)],
    decidedAt: "2026-09-20T16:37:06Z",
  },
  alert: {
    id: uuid(3),
    kind: "unresolved_team",
    matchId: null,
    openedAt: "2026-09-20T16:37:06Z",
    resolvedAt: null,
    details: { rawRef: "raw/x.json", home: "Ourense", away: "Arenteiro" },
  },
} as const;

describe("CA-6 entities", () => {
  it("parse the fixtures", () => {
    expect(Competition.safeParse(fixtures.competition).success).toBe(true);
    expect(Team.safeParse(fixtures.team).success).toBe(true);
    expect(Match.safeParse(fixtures.match).success).toBe(true);
    expect(Observation.safeParse(fixtures.observation).success).toBe(true);
    expect(Decision.safeParse(fixtures.decision).success).toBe(true);
    expect(Alert.safeParse(fixtures.alert).success).toBe(true);
  });

  it("Team shortName is optional, non-empty and different from name (N-11)", () => {
    expect(
      Team.safeParse({ ...fixtures.team, shortName: "Ourense" }).success,
    ).toBe(true);
    expect(Team.safeParse({ ...fixtures.team, shortName: "" }).success).toBe(
      false,
    );
    expect(
      Team.safeParse({ ...fixtures.team, shortName: "UD Ourense" }).success,
    ).toBe(false);
    expect(Team.parse(fixtures.team)).not.toHaveProperty("shortName");
  });

  it("Competition tier is 1..5", () => {
    expect(
      Competition.safeParse({ ...fixtures.competition, tier: 6 }).success,
    ).toBe(false);
    expect(
      Competition.safeParse({ ...fixtures.competition, tier: 0 }).success,
    ).toBe(false);
  });

  it("Match round is >= 1 and home differs from away", () => {
    expect(Match.safeParse({ ...fixtures.match, round: 0 }).success).toBe(
      false,
    );
    expect(
      Match.safeParse({ ...fixtures.match, awayTeamId: "ud-ourense" }).success,
    ).toBe(false);
  });

  it("Observation carries the match state and a non-empty rawRef", () => {
    expect(
      Observation.safeParse({ ...fixtures.observation, rawRef: "" }).success,
    ).toBe(false);
    expect(
      Observation.safeParse({ ...fixtures.observation, score: null }).success,
    ).toBe(false);
  });

  it("Decision needs version >= 1, at least one observation and sen_sinal only when live", () => {
    expect(
      Decision.safeParse({ ...fixtures.decision, version: 0 }).success,
    ).toBe(false);
    expect(
      Decision.safeParse({ ...fixtures.decision, observationIds: [] }).success,
    ).toBe(false);
    expect(
      Decision.safeParse({ ...fixtures.decision, qualifier: "sen_sinal" })
        .success,
    ).toBe(true);
    expect(
      Decision.safeParse({
        ...fixtures.decision,
        status: "finished",
        minute: null,
        qualifier: "sen_sinal",
      }).success,
    ).toBe(false);
  });

  it("Alert needs a match unless the team is unresolved", () => {
    expect(
      Alert.safeParse({ ...fixtures.alert, kind: "conflict" }).success,
    ).toBe(false);
    expect(
      Alert.safeParse({
        ...fixtures.alert,
        kind: "conflict",
        matchId: fixtures.match.id,
      }).success,
    ).toBe(true);
  });
});

describe("CA-7 JSON round trip", () => {
  const entities = [
    ["Competition", Competition, fixtures.competition],
    ["Team", Team, fixtures.team],
    ["Match", Match, fixtures.match],
    ["Observation", Observation, fixtures.observation],
    ["Decision", Decision, fixtures.decision],
    ["Alert", Alert, fixtures.alert],
  ] as const;

  it.each(entities)(
    "%s survives parse → stringify → parse",
    (_name, schema, fixture) => {
      const first = schema.parse(fixture);
      const json = JSON.stringify(first);
      expect(json).not.toContain("Date");
      expect(schema.parse(JSON.parse(json))).toEqual(first);
    },
  );

  it("no Date instance leaves the model", () => {
    const walk = (v: unknown): boolean =>
      v instanceof Date ||
      (typeof v === "object" && v !== null && Object.values(v).some(walk));
    for (const [, schema, fixture] of entities)
      expect(walk(schema.parse(fixture))).toBe(false);
  });
});
