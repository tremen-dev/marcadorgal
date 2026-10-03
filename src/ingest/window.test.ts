import { describe, expect, it } from "vitest";
import {
  type DecisionRule,
  type Instant,
  type MatchStatus,
  MINUTE_MS,
  shiftInstant,
} from "@/model";
import { WINDOW_AFTER_MINUTES, WINDOW_BEFORE_MINUTES } from "./constants.ts";
import { isInWindow, windowKickoffRange } from "./window.ts";

const KICKOFF = "2026-09-25T18:30:00.000Z" as Instant;

const inWindow = (
  minutes: number,
  status: MatchStatus = "scheduled",
  rule: DecisionRule | null = null,
) =>
  isInWindow(
    { kickoff: KICKOFF, status, rule },
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
    expect(inWindow(30, "finished", "RN-01")).toBe(false);
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

// SPEC-013 CA-3 (ADR-010 §3): a finished forced by RN-02 is provisional and
// does not take the match out of its window; the time edge (+150) or the
// final the source confirms do. A confirmed finished still closes at once.
describe("SPEC-013 CA-3 the forced finish keeps the window open", () => {
  it("(i) a confirmed finished at +125 is out", () => {
    expect(inWindow(125, "finished", "RN-01")).toBe(false);
    expect(inWindow(125, "finished", "RN-12")).toBe(false);
    expect(inWindow(125, "finished", "operator")).toBe(false);
  });

  it("(ii) a finished forced by RN-02 at +125 is in", () => {
    expect(inWindow(125, "finished", "RN-02")).toBe(true);
  });

  it("(iii) the same at +151 is out: the time edge rules all the same", () => {
    expect(inWindow(150, "finished", "RN-02")).toBe(false);
    expect(inWindow(151, "finished", "RN-02")).toBe(false);
  });

  it("(iv) a live at +125 is in, as before", () => {
    expect(inWindow(125, "live", "RN-01")).toBe(true);
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
