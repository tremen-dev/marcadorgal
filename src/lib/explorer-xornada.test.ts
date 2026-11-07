import { describe, expect, it } from "vitest";
import { findActiveRound } from "./explorer-xornada.ts";

describe("findActiveRound", () => {
  const fakeCalendar = {
    competition: "liga-f",
    season: "2026-27",
    exportedAt: "2026-11-07T00:00:00Z",
    teams: [],
    ignoredRounds: {},
    matches: [
      {
        externalId: "m1",
        round: 9,
        kickoff: "2026-10-11T00:00:00Z",
        home: "barcelona",
        away: "sevilla",
        timeConfirmed: true,
      },
      {
        externalId: "m2",
        round: 10,
        kickoff: "2026-11-08T11:00:00Z",
        home: "depor-abanca",
        away: "valencia",
        timeConfirmed: true,
      },
      {
        externalId: "m3",
        round: 11,
        kickoff: "2026-11-15T11:00:00Z",
        home: "madrid-cff",
        away: "alaves",
        timeConfirmed: true,
      },
    ],
  };

  it("selects round 10 when now is 2026-11-07", () => {
    const round = findActiveRound(fakeCalendar, "2026-11-07T20:00:00Z");
    expect(round).toBe(10);
  });

  it("selects round 9 when now is 2026-10-10", () => {
    const round = findActiveRound(fakeCalendar, "2026-10-10T20:00:00Z");
    expect(round).toBe(9);
  });
});
