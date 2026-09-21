import { describe, expect, it } from "vitest";
import { currentRound } from "./current-round.ts";

// Five Sunday rounds: Saturday 18:00, Sunday 12:00 and 16:00, Monday 20:00.
// Median of each round = Sunday 14:00Z.
const sundays = [
  "2026-09-06",
  "2026-09-13",
  "2026-09-20",
  "2026-09-27",
  "2026-10-04",
];
const dayBefore = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
const matches = sundays.flatMap((sunday, i) => {
  const round = i + 1;
  return [
    { round, kickoff: `${dayBefore(sunday, -1)}T18:00:00Z` },
    { round, kickoff: `${sunday}T12:00:00Z` },
    { round, kickoff: `${sunday}T16:00:00Z` },
    { round, kickoff: `${dayBefore(sunday, 1)}T20:00:00Z` },
  ];
});

describe("CA-12 currentRound", () => {
  it("returns null for an empty calendar", () => {
    expect(currentRound([], "2026-09-15T10:00:00Z")).toBeNull();
  });

  it("is 1 before the season and 5 after it", () => {
    expect(currentRound(matches, "2026-08-01T00:00:00Z")).toBe(1);
    expect(currentRound(matches, "2026-11-01T00:00:00Z")).toBe(5);
  });

  it("stays on round 2 on the Tuesday after it", () => {
    expect(currentRound(matches, "2026-09-15T10:00:00Z")).toBe(2);
  });

  it("moves to round 3 on the Thursday before it", () => {
    expect(currentRound(matches, "2026-09-17T10:00:00Z")).toBe(3);
  });

  it("keeps round 2 on Monday 21:00 while its Monday match is being played", () => {
    expect(currentRound(matches, "2026-09-14T21:00:00Z")).toBe(2);
  });

  it("ignores a round-1 match postponed to the date of round 5", () => {
    const postponed = matches.map((m) =>
      m.round === 1 && m.kickoff.startsWith("2026-09-07")
        ? { ...m, kickoff: "2026-10-05T20:00:00Z" }
        : m,
    );
    expect(currentRound(postponed, "2026-09-27T14:00:00Z")).toBe(4);
  });

  it("uses the middle kickoff for an odd number of matches", () => {
    const odd = [
      { round: 1, kickoff: "2026-09-05T18:00:00Z" },
      { round: 1, kickoff: "2026-09-06T16:00:00Z" },
      { round: 1, kickoff: "2026-09-30T20:00:00Z" },
      { round: 2, kickoff: "2026-09-13T16:00:00Z" },
    ];
    // Median of round 1 is 09-06 16:00; round 2 is 09-13 16:00: 09-09 is closer to 1.
    expect(currentRound(odd, "2026-09-09T16:00:00Z")).toBe(1);
  });

  it("picks the lower round on a tie", () => {
    // Exactly halfway between the medians of rounds 1 and 2 (Sunday 14:00Z each).
    expect(currentRound(matches, "2026-09-10T02:00:00Z")).toBe(1);
  });
});
