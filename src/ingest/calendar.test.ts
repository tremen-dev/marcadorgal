import { describe, expect, it } from "vitest";
import { loadDeclaredCalendar } from "./calendar.ts";

// SPEC-038 CA-7: the declared calendar of a season reaches the adapter of
// the rfef as a traced file, like the alias (ADR-008 §8, loadAliasFile).

const FIVE = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];

describe("loadDeclaredCalendar", () => {
  it("loads the 1.834 matches of 2026-27 with id, competition, round, kickoff and teams", () => {
    const calendar = loadDeclaredCalendar("2026-27");
    expect(calendar).toHaveLength(1834);
    expect(new Set(calendar.map((m) => m.competitionId))).toEqual(
      new Set(FIVE),
    );
    expect(calendar).toContainEqual({
      id: "segunda-division-2026-27-j6-albacete-cordoba",
      competitionId: "segunda-division",
      round: 6,
      kickoff: expect.stringMatching(/^2026-09-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
      homeTeamId: "albacete",
      awayTeamId: "cordoba",
    });
    for (const m of calendar)
      expect(m.id).toBe(
        `${m.competitionId}-2026-27-j${m.round}-${m.homeTeamId}-${m.awayTeamId}`,
      );
  });

  it("is memoized per season: a tick every 30 s does not read the disk every 30 s", () => {
    expect(loadDeclaredCalendar("2026-27")).toBe(
      loadDeclaredCalendar("2026-27"),
    );
  });

  it("names the season, not the path, when there is no calendar", () => {
    expect(() => loadDeclaredCalendar("1999-00")).toThrow(
      "no calendar for 1999-00",
    );
  });
});
