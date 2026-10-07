import { describe, expect, it } from "vitest";
import type { MatchStatus } from "@/model";
import { currentXornada, readCurrentXornada, seasonOf } from "./current";
import type { XornadaIndexEntry } from "./row";

// SPEC-020 CA-5 (H-1, H-2): per competition, the round of currentRound
// (median kickoff closest to now, lower on a tie) plus its live matches of
// other rounds; only the season of now (July rule of calendario:xornada).

const entry = (
  competitionId: string,
  round: number,
  kickoff: string,
  status: MatchStatus = "scheduled",
  season = "2026-27",
): XornadaIndexEntry =>
  ({
    matchId: `${competitionId}-${round}-${kickoff.slice(5, 13).replace(/\D/g, "")}`,
    competitionId,
    season,
    round,
    kickoff,
    status,
  }) as XornadaIndexEntry;

// Segunda: Saturday and Sunday at 16:00Z; medians on Sunday 04:00Z, so the
// midpoint between J5 and J6 is Wednesday 2026-10-14T16:00Z.
const segunda = [
  entry("segunda-division", 3, "2026-09-26T16:00:00Z", "finished"),
  entry("segunda-division", 3, "2026-09-27T16:00:00Z", "finished"),
  entry("segunda-division", 4, "2026-10-03T16:00:00Z", "finished"),
  entry("segunda-division", 4, "2026-10-04T16:00:00Z", "finished"),
  entry("segunda-division", 5, "2026-10-10T16:00:00Z"),
  entry("segunda-division", 5, "2026-10-11T16:00:00Z"),
  entry("segunda-division", 6, "2026-10-17T16:00:00Z"),
  entry("segunda-division", 6, "2026-10-18T16:00:00Z"),
];

// Tercera, with a Monday match in each round.
const tercera = [
  entry("tercera-rfef-g1", 5, "2026-10-10T16:00:00Z", "finished"),
  entry("tercera-rfef-g1", 5, "2026-10-11T10:00:00Z", "finished"),
  entry("tercera-rfef-g1", 5, "2026-10-11T16:00:00Z", "finished"),
  entry("tercera-rfef-g1", 5, "2026-10-12T19:00:00Z", "live"),
  entry("tercera-rfef-g1", 6, "2026-10-17T16:00:00Z"),
  entry("tercera-rfef-g1", 6, "2026-10-18T10:00:00Z"),
  entry("tercera-rfef-g1", 6, "2026-10-18T16:00:00Z"),
  entry("tercera-rfef-g1", 6, "2026-10-19T19:00:00Z"),
];

// Primera on the same weekends, with its own round numbers.
const primera = [
  entry("primera-division", 8, "2026-10-10T19:00:00Z"),
  entry("primera-division", 8, "2026-10-11T19:00:00Z"),
  entry("primera-division", 9, "2026-10-17T19:00:00Z"),
  entry("primera-division", 9, "2026-10-18T19:00:00Z"),
];

const rounds = (out: XornadaIndexEntry[]) =>
  Object.fromEntries(
    [...new Set(out.map((e) => e.competitionId))].map((c) => [
      c,
      [
        ...new Set(
          out.filter((e) => e.competitionId === c).map((e) => e.round),
        ),
      ],
    ]),
  );

describe("SPEC-020 CA-5 seasonOf", () => {
  it.each([
    ["2026-10-10T17:00:00Z", "2026-27"],
    ["2027-03-01T00:00:00Z", "2026-27"],
    ["2027-06-30T23:59:59Z", "2026-27"],
    ["2027-07-01T00:00:00Z", "2027-28"],
    ["2099-08-01T00:00:00Z", "2099-00"],
  ])("%s is in season %s", (now, season) => {
    expect(seasonOf(now)).toBe(season);
  });
});

describe("SPEC-020 CA-5 currentXornada", () => {
  it("Saturday of J5 → J5, every match of it and nothing else", () => {
    const out = currentXornada(segunda, "2026-10-10T17:00:00Z");
    expect(out).toEqual(segunda.filter((e) => e.round === 5));
  });

  it.each([
    ["2026-10-14T15:59:00Z", 5],
    ["2026-10-14T16:01:00Z", 6],
  ])(
    "Wednesday %s, around the midpoint between medians → J%i",
    (now, round) => {
      expect(rounds(currentXornada(segunda, now))).toEqual({
        "segunda-division": [round],
      });
    },
  );

  it("an exact tie goes to the lower round", () => {
    expect(rounds(currentXornada(segunda, "2026-10-14T16:00:00Z"))).toEqual({
      "segunda-division": [5],
    });
  });

  it("the Monday match stays in its round", () => {
    const out = currentXornada(tercera, "2026-10-12T20:00:00Z");
    expect(rounds(out)).toEqual({ "tercera-rfef-g1": [5] });
    expect(out.map((e) => e.kickoff)).toContain("2026-10-12T19:00:00Z");
  });

  it("each competition in its own round", () => {
    const out = currentXornada(
      [...primera, ...segunda, ...tercera],
      "2026-10-10T17:00:00Z",
    );
    expect(rounds(out)).toEqual({
      "primera-division": [8],
      "segunda-division": [5],
      "tercera-rfef-g1": [5],
    });
  });

  it("a live J3 match, postponed and played now, shows in the J5 view", () => {
    const postponed = entry(
      "segunda-division",
      3,
      "2026-10-10T15:30:00Z",
      "live",
    );
    const out = currentXornada([...segunda, postponed], "2026-10-10T17:00:00Z");
    expect(out).toContain(postponed);
    expect(out.filter((e) => e.round === 3)).toEqual([postponed]);
    expect(out.filter((e) => e.round === 5)).toHaveLength(2);
  });

  it("a competition without matches in the season does not come out", () => {
    const old = [
      entry(
        "primera-rfef-g1",
        30,
        "2026-05-10T16:00:00Z",
        "finished",
        "2025-26",
      ),
      entry("primera-rfef-g1", 31, "2026-05-17T16:00:00Z", "live", "2025-26"),
    ];
    expect(
      rounds(currentXornada([...old, ...primera], "2026-10-10T17:00:00Z")),
    ).toEqual({ "primera-division": [8] });
    expect(currentXornada([], "2026-10-10T17:00:00Z")).toEqual([]);
  });
});

describe("SPEC-020 CA-5 readCurrentXornada", () => {
  it("reads the index of the season of now, then only the selected matches", async () => {
    const calls: unknown[] = [];
    const reader = {
      index: async (season: string) => {
        calls.push(["index", season]);
        return [...primera, ...segunda];
      },
      matches: async (ids: readonly string[]) => {
        calls.push(["matches", [...ids]]);
        return [];
      },
    };
    await readCurrentXornada(reader, "2026-10-10T17:00:00Z");
    expect(calls).toEqual([
      ["index", "2026-27"],
      [
        "matches",
        [
          ...primera.filter((e) => e.round === 8),
          ...segunda.filter((e) => e.round === 5),
        ].map((e) => e.matchId),
      ],
    ]);
  });
});
