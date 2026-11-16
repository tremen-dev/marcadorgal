import { describe, expect, it } from "vitest";
import { directosDate } from "./directos.ts";

// SPEC-087: /directos and /es/directos. Every test runs without network and
// with a fixed clock: now is a parameter, never read inside the logic.

const NOW = "2026-11-16T10:00:00Z";

describe("SPEC-087 CA-1 directosDate", () => {
  it("without date: today in Europe/Madrid", () => {
    expect(directosDate(undefined, NOW)).toBe("2026-11-16");
  });

  it("edge: at 23:30Z of the 15th it is already the 16th in Madrid", () => {
    expect(directosDate(undefined, "2026-11-15T23:30:00Z")).toBe("2026-11-16");
    expect(directosDate("2026-11-23", "2026-11-15T23:30:00Z")).toBe(
      "2026-11-23",
    );
    expect(directosDate("2026-11-24", "2026-11-15T23:30:00Z")).toBeNull();
  });

  it.each([
    "2026-11-16",
    "2026-11-09",
    "2026-11-23",
    "2026-11-12",
  ])("a real date within ±7 days: %s", (raw) => {
    expect(directosDate(raw, NOW)).toBe(raw);
  });

  it.each([
    ["2026-02-30", "not a calendar date"],
    ["2026-1-5", "no padding"],
    ["20261116", "no dashes"],
    ["2026-11-16T00:00", "an instant, not a date"],
    ["2026-11-24", "8 days ahead"],
    ["2026-11-08", "8 days behind"],
    ["2027-11-16", "a year ahead"],
    ["", "empty"],
  ])("null for %s (%s)", (raw) => {
    expect(directosDate(raw, NOW)).toBeNull();
  });

  it("null for a repeated value (string[])", () => {
    expect(directosDate(["2026-11-16", "2026-11-15"], NOW)).toBeNull();
    expect(directosDate(["2026-11-16"], NOW)).toBeNull();
  });
});
