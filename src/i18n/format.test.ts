import { describe, expect, it } from "vitest";
import { formatDay, formatTime } from "./format";

describe("CA-10 formatTime (Europe/Madrid, 24 h)", () => {
  it.each([
    ["2026-09-26T16:00:00Z", "18:00"],
    ["2026-09-25T18:30:00Z", "20:30"],
    ["2026-12-05T17:00:00Z", "18:00"],
    ["2026-09-26T22:05:00Z", "00:05"],
  ])("%s → %s", (instant, expected) => {
    expect(formatTime(instant, "gl")).toBe(expected);
    expect(formatTime(instant, "es")).toBe(expected);
  });
});

describe("CA-10 formatDay (weekday abbreviated, no dot, day without zero)", () => {
  it.each([
    ["2026-09-26T16:00:00Z", "sáb 26", "sáb 26"],
    ["2026-09-25T18:30:00Z", "ven 25", "vie 25"],
    ["2026-09-28T19:00:00Z", "luns 28", "lun 28"],
    ["2026-12-05T17:00:00Z", "sáb 5", "sáb 5"],
  ])("%s → gl %s · es %s", (instant, glExpected, esExpected) => {
    expect(formatDay(instant, "gl")).toBe(glExpected);
    expect(formatDay(instant, "es")).toBe(esExpected);
  });
});
