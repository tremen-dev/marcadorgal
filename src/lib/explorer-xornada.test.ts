import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "./explorer-client.ts";
import {
  fetchWomenXornadaMatches,
  findActiveRound,
  WOMEN_COMPETITIONS,
} from "./explorer-xornada.ts";

describe("WOMEN_COMPETITIONS", () => {
  it("includes all three female categories: liga-f, primera-federacion-fem, and segunda-federacion-fem-g1", () => {
    expect(WOMEN_COMPETITIONS).toEqual([
      "liga-f",
      "primera-federacion-fem",
      "segunda-federacion-fem-g1",
    ]);
  });
});

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

describe("fetchWomenXornadaMatches", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches matches for all three competitions in parallel and resolves canonical names", async () => {
    vi.spyOn(client, "getOfficialCalendar").mockImplementation(
      async (comp: string) => {
        if (comp === "liga-f") {
          return {
            competition: "liga-f",
            season: "2026-27",
            exportedAt: "2026-11-07T00:00:00Z",
            teams: [
              { externalId: "depor-abanca", externalName: "Deportivo ABANCA" },
              { externalId: "valencia-cf", externalName: "Valencia CF" },
            ],
            ignoredRounds: {},
            matches: [
              {
                externalId: "2026-27-liga-f-j10-depor-valencia",
                round: 10,
                kickoff: "2026-11-09T20:00:00Z",
                home: "depor-abanca",
                away: "valencia-cf",
                timeConfirmed: true,
              },
            ],
          };
        }
        if (comp === "primera-federacion-fem") {
          return {
            competition: "primera-federacion-fem",
            season: "2026-27",
            exportedAt: "2026-11-07T00:00:00Z",
            teams: [
              { externalId: "barcelona-b", externalName: "Barcelona B" },
              { externalId: "alhama-cf", externalName: "Alhama CF" },
            ],
            ignoredRounds: {},
            matches: [
              {
                externalId: "2026-27-1fed-fem-j10-barca-b-alhama",
                round: 10,
                kickoff: "2026-11-09T12:00:00Z",
                home: "barcelona-b",
                away: "alhama-cf",
                timeConfirmed: true,
              },
            ],
          };
        }
        if (comp === "segunda-federacion-fem-g1") {
          return {
            competition: "segunda-federacion-fem-g1",
            season: "2026-27",
            exportedAt: "2026-11-07T00:00:00Z",
            teams: [
              { externalId: "as-celtas", externalName: "RC Celta Femenino" },
              { externalId: "cd-arratia", externalName: "CD Arratia" },
            ],
            ignoredRounds: {},
            matches: [
              {
                externalId: "2026-27-2fed-fem-j10-as-celtas-arratia",
                round: 10,
                kickoff: "2026-11-09T12:00:00Z",
                home: "as-celtas",
                away: "cd-arratia",
                timeConfirmed: true,
              },
            ],
          };
        }
        throw new Error("Unknown competition");
      },
    );

    vi.spyOn(client, "getDayMatches").mockResolvedValue({
      date: "2026-11-09",
      exportedAt: "2026-11-07T00:00:00Z",
      matches: [
        {
          canonicalHomeTeamId: "depor-abanca",
          canonicalAwayTeamId: "valencia-cf",
          estado: "LIVE_PROVISIONAL",
          homeScore: 1,
          awayScore: 0,
          minute: 34,
          goals: [
            {
              team: "home",
              player: "Millene",
              minute: 12,
            },
          ],
        },
      ],
    });

    const matches = await fetchWomenXornadaMatches("2026-11-07T20:00:00Z");

    expect(matches).toHaveLength(3);

    const ligaFMatch = matches.find((m) => m.competitionId === "liga-f");
    expect(ligaFMatch).toBeDefined();
    expect(ligaFMatch?.tier).toBe(1);
    expect(ligaFMatch?.status).toBe("live");
    if (ligaFMatch?.status === "live") {
      expect(ligaFMatch.score).toEqual({ home: 1, away: 0 });
      expect(ligaFMatch.minute).toBe(34);
    }

    const fed1Match = matches.find(
      (m) => m.competitionId === "primera-federacion-fem",
    );
    expect(fed1Match).toBeDefined();
    expect(fed1Match?.tier).toBe(2);
    expect(fed1Match?.status).toBe("scheduled");

    const fed2Match = matches.find(
      (m) => m.competitionId === "segunda-federacion-fem-g1",
    );
    expect(fed2Match).toBeDefined();
    expect(fed2Match?.tier).toBe(3);
    expect(fed2Match?.status).toBe("scheduled");
    expect(fed2Match?.home.name).toBe("RC Celta Femenino / As Celtas");
  });

  it("handles graceful failure when one competition throws an error", async () => {
    vi.spyOn(client, "getOfficialCalendar").mockImplementation(
      async (comp: string) => {
        if (comp === "liga-f") {
          return {
            competition: "liga-f",
            season: "2026-27",
            exportedAt: "2026-11-07T00:00:00Z",
            teams: [],
            ignoredRounds: {},
            matches: [
              {
                externalId: "2026-27-liga-f-j10-depor-valencia",
                round: 10,
                kickoff: "2026-11-09T20:00:00Z",
                home: "depor-abanca",
                away: "valencia-cf",
                timeConfirmed: true,
              },
            ],
          };
        }
        throw new Error("503 Service Unavailable");
      },
    );

    vi.spyOn(client, "getDayMatches").mockResolvedValue({
      date: "2026-11-09",
      exportedAt: "2026-11-07T00:00:00Z",
      matches: [],
    });

    const matches = await fetchWomenXornadaMatches("2026-11-07T20:00:00Z");
    expect(matches).toHaveLength(1);
    expect(matches[0].competitionId).toBe("liga-f");
  });
});
