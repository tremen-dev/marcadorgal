import { describe, expect, it } from "vitest";
import {
  type Instant,
  type MatchStatus,
  MINUTE_MS,
  shiftInstant,
} from "@/model";
import { WINDOW_AFTER_MINUTES, WINDOW_BEFORE_MINUTES } from "./constants.ts";
import { isInWindow, windowKickoffRange } from "./window.ts";

const KICKOFF = "2026-09-25T18:30:00.000Z" as Instant;

const inWindow = (minutes: number, status: MatchStatus = "scheduled") =>
  isInWindow(
    { kickoff: KICKOFF, status },
    shiftInstant(KICKOFF, minutes * MINUTE_MS),
  );

describe("CA-3 isInWindow", () => {
  it("opens ten minutes before kickoff", () => {
    expect(inWindow(-11)).toBe(false);
    expect(inWindow(-10)).toBe(true);
  });

  it("closes a hundred and fifty minutes after kickoff", () => {
    expect(inWindow(149)).toBe(true);
    expect(inWindow(150)).toBe(false);
  });

  it("leaves a finished match out even inside the range", () => {
    expect(inWindow(30, "finished")).toBe(false);
  });

  it.each<MatchStatus>(["scheduled", "live", "postponed", "suspended"])(
    "keeps a %s match inside the range",
    (status) => {
      expect(inWindow(30, status)).toBe(true);
    },
  );

  it("uses the constants of the spec", () => {
    expect([WINDOW_BEFORE_MINUTES, WINDOW_AFTER_MINUTES]).toEqual([10, 150]);
  });
});

describe("CA-6 windowKickoffRange", () => {
  it("bounds kickoff by now minus 150 and now plus 10 minutes", () => {
    expect(windowKickoffRange("2026-09-25T18:30:00.000Z" as Instant)).toEqual({
      from: "2026-09-25T16:00:00.000Z",
      to: "2026-09-25T18:40:00.000Z",
    });
  });
});
