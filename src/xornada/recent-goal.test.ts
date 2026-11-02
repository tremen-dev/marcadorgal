import { describe, expect, it } from "vitest";
import { RECENT_GOAL_MARKS, recentGoals } from "./recent-goal";

// SPEC-041 CA-3 (H-5): a side's goal is recent while now < scoredAt + N
// minutes, with the clock it is given (the server's at render, the
// browser's after). The answer is the instant it stops being recent.
const AT = "2026-10-03T17:00:00.000Z";
const at = Date.parse(AT);
const S = 1000;
const MIN = 60 * S;

const row = (
  homeScoredAt: string | null,
  awayScoredAt: string | null = null,
) => ({ homeScoredAt, awayScoredAt });

describe("SPEC-041 CA-3 recentGoals", () => {
  it.each([
    ["no goal (null)", row(null), at, 5, { home: null, away: null }],
    [
      "just scored",
      row(AT),
      at,
      5,
      { home: "2026-10-03T17:05:00.000Z", away: null },
    ],
    [
      "N − 1 s",
      row(AT),
      at + 5 * MIN - S,
      5,
      { home: "2026-10-03T17:05:00.000Z", away: null },
    ],
    ["exactly N: no longer", row(AT), at + 5 * MIN, 5, { home: null, away: null }],
    ["past N", row(AT), at + 6 * MIN, 5, { home: null, away: null }],
    [
      "scoredAt in the future (browser behind): recent",
      row(AT),
      at - 2 * MIN,
      5,
      { home: "2026-10-03T17:05:00.000Z", away: null },
    ],
    [
      "another N (3): 3 min is no longer",
      row(AT),
      at + 3 * MIN,
      3,
      { home: null, away: null },
    ],
    [
      "another N (10): 6 min still is",
      row(AT),
      at + 6 * MIN,
      10,
      { home: "2026-10-03T17:10:00.000Z", away: null },
    ],
    [
      "the away side alone",
      row(null, AT),
      at + MIN,
      5,
      { home: null, away: "2026-10-03T17:05:00.000Z" },
    ],
    [
      "both sides, each with its own end",
      row("2026-10-03T16:58:00.000Z", AT),
      at + 2 * MIN + 30 * S,
      5,
      { home: "2026-10-03T17:03:00.000Z", away: "2026-10-03T17:05:00.000Z" },
    ],
    [
      "both sides, one already over",
      row("2026-10-03T16:54:00.000Z", AT),
      at + MIN,
      5,
      { home: null, away: "2026-10-03T17:05:00.000Z" },
    ],
  ] as const)("%s", (_name, r, now, minutes, expected) => {
    expect(recentGoals(r, now, minutes)).toEqual(expected);
  });

  it("the two variants of H-4", () => {
    expect(RECENT_GOAL_MARKS).toEqual(["box", "label"]);
  });
});
