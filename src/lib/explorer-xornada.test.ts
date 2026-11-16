import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "./explorer-client.ts";
import {
  fetchWomenXornadaMatches,
  findActiveRound,
  WOMEN_COMPETITIONS,
} from "./explorer-xornada.ts";

describe("WOMEN_COMPETITIONS", () => {
  // SPEC-088 CA-1: the federation calendars of explorer are generated.
  it("is only liga-f, the competition with an official calendar", () => {
    expect(WOMEN_COMPETITIONS).toEqual(["liga-f"]);
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

  it("asks only liga-f even if the federation calendars answer (SPEC-088 CA-1)", async () => {
    const calendar = vi
      .spyOn(client, "getOfficialCalendar")
      .mockImplementation(async (comp: string) => {
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
      });

    vi.spyOn(client, "getDayMatches").mockResolvedValue({
      date: "2026-11-09",
      exportedAt: "2026-11-07T00:00:00Z",
      matches: [
        {
          // SPEC-070 CA-6: the row has to say its competition to be used.
          canonicalCompetitionId: "liga-f",
          canonicalHomeTeamId: "depor-abanca",
          canonicalAwayTeamId: "valencia-cf",
          estado: "LIVE_PROVISIONAL",
          homeScore: 1,
          awayScore: 0,
          minute: 34,
          // SPEC-086 CA-3, CA-6: its clock, inside the live window.
          lastSeenAt: "2026-11-09T20:34:00Z",
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

    expect(matches).toHaveLength(1);
    expect(calendar.mock.calls.map((c) => c[0])).toEqual(["liga-f"]);

    const ligaFMatch = matches.find((m) => m.competitionId === "liga-f");
    expect(ligaFMatch).toBeDefined();
    expect(ligaFMatch?.tier).toBe(1);
    expect(ligaFMatch?.status).toBe("live");
    if (ligaFMatch?.status === "live") {
      expect(ligaFMatch.score).toEqual({ home: 1, away: 0 });
      expect(ligaFMatch.minute).toBe(34);
    }
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

describe("SPEC-070 CA-6 the women xornada pairs by competition", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const ligaFOnly = async (comp: string) => {
    if (comp !== "liga-f") throw new Error("not this one");
    return {
      competition: "liga-f",
      season: "2026-27",
      exportedAt: "2026-11-07T00:00:00Z",
      teams: [],
      ignoredRounds: {},
      matches: [
        {
          externalId: "liga-f-2026-27-j10-depor-abanca-valencia-cf",
          round: 10,
          kickoff: "2026-11-09T11:00:00Z",
          home: "depor-abanca",
          away: "valencia-cf",
          timeConfirmed: true,
        },
      ],
    };
  };

  const row = (
    competition: string | undefined,
    homeScore: number,
    player: string,
  ) => ({
    codActa: `${competition}-${homeScore}`,
    canonicalCompetitionId: competition,
    canonicalHomeTeamId: "depor-abanca",
    canonicalAwayTeamId: "valencia-cf",
    estado: "FINISHED" as const,
    homeScore,
    awayScore: 0,
    lastSeenAt: "2026-11-09T13:00:00Z",
    goals: [{ team: "home" as const, player, minute: 10 }],
  });

  it("same canonical teams, other competition: only the liga-f row is used", async () => {
    vi.spyOn(client, "getOfficialCalendar").mockImplementation(ligaFOnly);
    vi.spyOn(client, "getDayMatches").mockResolvedValue({
      date: "2026-11-09",
      exportedAt: "2026-11-09T20:00:00Z",
      // The other competition last: the old Map kept the last one.
      matches: [
        row("liga-f", 2, "Ligaf"),
        row("primera-federacion-fem", 5, "Otra"),
      ],
    });
    const [m] = await fetchWomenXornadaMatches("2026-11-08T20:00:00Z");
    expect(m?.status).toBe("finished");
    expect(m?.score).toEqual({ home: 2, away: 0 });
    expect(m?.goals?.map((g) => g.player)).toEqual(["Ligaf"]);
  });

  it("a row without competition is not used", async () => {
    vi.spyOn(client, "getOfficialCalendar").mockImplementation(ligaFOnly);
    vi.spyOn(client, "getDayMatches").mockResolvedValue({
      date: "2026-11-09",
      exportedAt: "2026-11-09T20:00:00Z",
      matches: [row(undefined, 4, "Sen competición")],
    });
    const [m] = await fetchWomenXornadaMatches("2026-11-08T20:00:00Z");
    expect(m?.status).toBe("scheduled");
    expect(m?.goals).toBeUndefined();
  });

  // Refined by SPEC-086 CA-1: the ambiguous match no longer comes out as
  // scheduled, it does not come out.
  it("two rows of the same competition and teams: the match does not come out", async () => {
    vi.spyOn(client, "getOfficialCalendar").mockImplementation(ligaFOnly);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(client, "getDayMatches").mockResolvedValue({
      date: "2026-11-09",
      exportedAt: "2026-11-09T20:00:00Z",
      matches: [row("liga-f", 2, "Unha"), row("liga-f", 3, "Outra")],
    });
    const matches = await fetchWomenXornadaMatches("2026-11-08T20:00:00Z");
    expect(matches).toEqual([]);
    const text = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(text).toContain("liga-f-2026-27-j10-depor-abanca-valencia-cf");
  });
});
