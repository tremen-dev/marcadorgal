import { describe, expect, it } from "vitest";
import { PROVISIONAL_DISPLAYS } from "@/xornada/qualifier";
import { RECENT_GOAL_MARKS } from "@/xornada/recent-goal";
import {
  PROVISIONAL_DISPLAY,
  RECENT_GOAL_MARK,
  RECENT_GOAL_MINUTES,
  recentGoalMark,
} from "./config";

// SPEC-034 CA-5 (H-1, H-2): the mode lives in one constant of the web.
describe("SPEC-034 CA-5 PROVISIONAL_DISPLAY", () => {
  it("is one of the three modes", () => {
    expect(PROVISIONAL_DISPLAYS).toContain(PROVISIONAL_DISPLAY);
  });

  it("is mark by default (H-2); hidden is valid but not the default (H-4)", () => {
    expect(PROVISIONAL_DISPLAY).toBe("mark");
  });
});

// SPEC-041 CA-3 (H-4): global to the web, never per competition.
describe("SPEC-041 CA-3 RECENT_GOAL_MINUTES and RECENT_GOAL_MARK", () => {
  it("the window is a positive whole number of minutes, 5 by default", () => {
    expect(Number.isInteger(RECENT_GOAL_MINUTES)).toBe(true);
    expect(RECENT_GOAL_MINUTES).toBeGreaterThan(0);
    expect(RECENT_GOAL_MINUTES).toBe(5);
  });

  it("the mark is one of the two variants, box by default", () => {
    expect(RECENT_GOAL_MARKS).toContain(RECENT_GOAL_MARK);
    expect(RECENT_GOAL_MARK).toBe("box");
  });

  // CA-6: the test build switches the variant; nothing else does.
  it("only the test build's variable changes it, and only to a valid variant", () => {
    expect(recentGoalMark({})).toBe("box");
    expect(recentGoalMark({ E2E_RECENT_GOAL_MARK: "label" })).toBe("label");
    expect(recentGoalMark({ E2E_RECENT_GOAL_MARK: "box" })).toBe("box");
    expect(recentGoalMark({ E2E_RECENT_GOAL_MARK: "pulse" })).toBe("box");
    expect(recentGoalMark({ E2E_RECENT_GOAL_MARK: "" })).toBe("box");
  });
});
