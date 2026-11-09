import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROVISIONAL_DISPLAYS } from "@/xornada/qualifier";
import { RECENT_GOAL_MARKS } from "@/xornada/recent-goal";
import {
  PROVISIONAL_DISPLAY,
  RECENT_GOAL_MARK,
  RECENT_GOAL_MINUTES,
  recentGoalMark,
  SHOW_DAY_STRIP,
  SHOW_TABLE_LINK,
  showDayStrip,
  showTableLink,
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
describe("SPEC-041 CA-3 RECENT_GOAL_MINUTES", () => {
  it("the window is a positive whole number of minutes, 5 by default", () => {
    expect(Number.isInteger(RECENT_GOAL_MINUTES)).toBe(true);
    expect(RECENT_GOAL_MINUTES).toBeGreaterThan(0);
    expect(RECENT_GOAL_MINUTES).toBe(5);
  });
});

// SPEC-042 CA-1: the «GOL» pill by default.
describe("SPEC-042 CA-1 RECENT_GOAL_MARK", () => {
  it("is one of the two variants, label by default", () => {
    expect(RECENT_GOAL_MARKS).toContain(RECENT_GOAL_MARK);
    expect(RECENT_GOAL_MARK).toBe("label");
  });
});

// SPEC-042 CA-2: the variable RECENT_GOAL_MARK, exact comparison. The old
// name, built so that `git grep` does not find it, no longer counts.
const OLD_NAME = ["E2E", "RECENT_GOAL_MARK"].join("_");

describe("SPEC-042 CA-2 recentGoalMark(env)", () => {
  it.each([
    [{ RECENT_GOAL_MARK: "box" }, "box"],
    [{ RECENT_GOAL_MARK: "label" }, "label"],
    [{}, "label"],
    [{ RECENT_GOAL_MARK: undefined }, "label"],
    [{ RECENT_GOAL_MARK: "" }, "label"],
    [{ RECENT_GOAL_MARK: "pulse" }, "label"],
    [{ RECENT_GOAL_MARK: "Box" }, "label"],
    [{ RECENT_GOAL_MARK: " box" }, "label"],
    [{ [OLD_NAME]: "box" }, "label"],
  ])("%j -> %s", (env, expected) => {
    expect(recentGoalMark(env)).toBe(expected);
  });
});

// SPEC-042 CA-4 (pattern of SPEC-020 CA-3): documented, with no value.
describe("SPEC-042 CA-4 .env.example", () => {
  it("names RECENT_GOAL_MARK with no value, and not the old name", () => {
    const example = readFileSync(
      fileURLToPath(new URL("../../.env.example", import.meta.url)),
      "utf8",
    );
    expect(example).toMatch(/^RECENT_GOAL_MARK=$/m);
    expect(example).not.toContain(OLD_NAME);
  });
});

describe("SHOW_DAY_STRIP", () => {
  it("is a boolean, false (hidden) by default", () => {
    expect(typeof SHOW_DAY_STRIP).toBe("boolean");
    expect(SHOW_DAY_STRIP).toBe(false);
  });
});

describe("showDayStrip(env)", () => {
  it.each([
    [{ SHOW_DAY_STRIP: "true" }, true],
    [{ SHOW_DAY_STRIP: "1" }, true],
    [{ SHOW_DAY_STRIP: "false" }, false],
    [{ SHOW_DAY_STRIP: "0" }, false],
    [{}, false],
    [{ SHOW_DAY_STRIP: undefined }, false],
    [{ SHOW_DAY_STRIP: "" }, false],
    [{ SHOW_DAY_STRIP: "yes" }, false],
    [{ DAY_STRIP: "true" }, true],
    [{ DAY_STRIP: "1" }, true],
    [{ DAY_STRIP: "false" }, false],
  ])("%j -> %s", (env, expected) => {
    expect(showDayStrip(env)).toBe(expected);
  });
});

describe(".env.example SHOW_DAY_STRIP", () => {
  it("names SHOW_DAY_STRIP with no value", () => {
    const example = readFileSync(
      fileURLToPath(new URL("../../.env.example", import.meta.url)),
      "utf8",
    );
    expect(example).toMatch(/^SHOW_DAY_STRIP=$/m);
  });
});

describe("SHOW_TABLE_LINK", () => {
  it("is a boolean, false (hidden) by default", () => {
    expect(typeof SHOW_TABLE_LINK).toBe("boolean");
    expect(SHOW_TABLE_LINK).toBe(false);
  });
});

describe("showTableLink(env)", () => {
  it.each([
    [{ SHOW_TABLE_LINK: "true" }, true],
    [{ SHOW_TABLE_LINK: "1" }, true],
    [{ SHOW_TABLE_LINK: "false" }, false],
    [{ SHOW_TABLE_LINK: "0" }, false],
    [{}, false],
    [{ SHOW_TABLE_LINK: undefined }, false],
    [{ SHOW_TABLE_LINK: "" }, false],
    [{ SHOW_TABLE_LINK: "yes" }, false],
  ])("%j -> %s", (env, expected) => {
    expect(showTableLink(env)).toBe(expected);
  });
});

describe(".env.example SHOW_TABLE_LINK", () => {
  it("names SHOW_TABLE_LINK with no value", () => {
    const example = readFileSync(
      fileURLToPath(new URL("../../.env.example", import.meta.url)),
      "utf8",
    );
    expect(example).toMatch(/^SHOW_TABLE_LINK=$/m);
  });
});
