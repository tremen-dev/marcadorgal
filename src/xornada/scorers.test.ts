import { describe, expect, it } from "vitest";
import type { PublicGoal } from "@/model";
import { type ScorerLine, squareGoals } from "./scorers";

// SPEC-094 CA-1: the lines of each side add up to its score.

const g = (
  team: "home" | "away",
  player: string,
  minute?: number,
  extra: Partial<PublicGoal> = {},
): PublicGoal => ({
  team,
  player,
  ...(minute === undefined ? {} : { minute }),
  ...extra,
});

// A line as a short word: the player, or «?» for a line without author.
const names = (lines: readonly ScorerLine[]) =>
  lines.map((l) => (l.kind === "scorer" ? l.goal.player : "?"));

describe("SPEC-094 CA-1 squareGoals", () => {
  it("gives both sides empty with a null score, with goals or without", () => {
    for (const goals of [[], undefined, [g("home", "A", 10)]])
      expect(squareGoals(goals, null)).toEqual({ home: [], away: [] });
  });

  it("2–1 without any scorer: two unknown lines and one", () => {
    const out = squareGoals([], { home: 2, away: 1 });
    expect(out.home).toEqual([{ kind: "unknown" }, { kind: "unknown" }]);
    expect(out.away).toEqual([{ kind: "unknown" }]);
    expect(squareGoals(undefined, { home: 2, away: 1 })).toEqual(out);
  });

  it("1–0 with two home scorers keeps the first by minute", () => {
    const out = squareGoals([g("home", "Late", 80), g("home", "Early", 12)], {
      home: 1,
      away: 0,
    });
    expect(names(out.home)).toEqual(["Early"]);
    expect(out.away).toEqual([]);
  });

  it("2–1 with one scorer: the scorer, then the unknown lines", () => {
    const out = squareGoals([g("home", "Only", 30)], { home: 2, away: 1 });
    expect(names(out.home)).toEqual(["Only", "?"]);
    expect(names(out.away)).toEqual(["?"]);
  });

  it("0–0 live with a listed goal shows nothing", () => {
    expect(
      squareGoals([g("away", "Early bird", 5)], { home: 0, away: 0 }),
    ).toEqual({ home: [], away: [] });
  });

  it("one side without scorers and the other with all of them", () => {
    const out = squareGoals([g("away", "B2", 70), g("away", "B1", 20)], {
      home: 3,
      away: 2,
    });
    expect(names(out.home)).toEqual(["?", "?", "?"]);
    expect(names(out.away)).toEqual(["B1", "B2"]);
  });

  it("orders by minute, arrival order on a tie, then the goals without minute in arrival order", () => {
    const out = squareGoals(
      [
        g("home", "NoMin1"),
        g("home", "Forty B", 40),
        g("home", "Ten", 10),
        g("home", "NoMin2"),
        g("home", "Forty A", 40),
      ],
      { home: 5, away: 0 },
    );
    expect(names(out.home)).toEqual([
      "Ten",
      "Forty B",
      "Forty A",
      "NoMin1",
      "NoMin2",
    ]);
  });

  it("drops the goals without minute first when there are too many", () => {
    const out = squareGoals([g("home", "NoMin"), g("home", "Sixty", 60)], {
      home: 1,
      away: 0,
    });
    expect(names(out.home)).toEqual(["Sixty"]);
  });

  it("counts an own goal on the side it goes up to (goal.team)", () => {
    const own = g("home", "Rival defender", 33, { ownGoal: true });
    const out = squareGoals([own, g("away", "Striker", 50)], {
      home: 2,
      away: 1,
    });
    expect(out.home).toEqual([
      { kind: "scorer", goal: own },
      { kind: "unknown" },
    ]);
    expect(names(out.away)).toEqual(["Striker"]);
  });

  it("always gives as many lines as the score on each side", () => {
    const goals = [
      g("home", "A", 1),
      g("home", "B", 2),
      g("away", "C"),
      g("away", "D", 9),
    ];
    for (let home = 0; home <= 4; home++)
      for (let away = 0; away <= 4; away++) {
        const out = squareGoals(goals, { home, away });
        expect(out.home).toHaveLength(home);
        expect(out.away).toHaveLength(away);
      }
  });
});
