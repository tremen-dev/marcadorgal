import { describe, expect, it } from "vitest";
import { xornadaDays } from "@/xornada/view";
import { xornadaHeading, xornadaRange } from "./labels";

const NOW = "2026-10-10T10:00:00Z";
const days = (...kickoffs: string[]) =>
  xornadaDays(
    kickoffs.map((kickoff) => ({ kickoff })),
    NOW,
  );

// SPEC-028 CA-5 (H-7): «10–12 out», en dash U+2013, no year, no weekday,
// Europe/Madrid dates (already in days).
describe("SPEC-028 CA-5 xornadaRange", () => {
  it.each([
    [
      "same month",
      ["2026-10-10T16:00:00Z", "2026-10-11T16:00:00Z", "2026-10-12T18:00:00Z"],
      "10–12 out",
      "10–12 oct",
    ],
    [
      "two months",
      ["2026-09-30T18:00:00Z", "2026-10-02T18:00:00Z"],
      "30 set – 2 out",
      "30 sep – 2 oct",
    ],
    ["one day", ["2026-10-11T16:00:00Z"], "11 out", "11 oct"],
    // 2026-10-25 03:00 CEST → 02:00 CET: the Madrid dates, not UTC's.
    [
      "across the clock change",
      ["2026-10-23T22:30:00Z", "2026-10-25T23:30:00Z"],
      "24–26 out",
      "24–26 oct",
    ],
    [
      "two months and a year",
      ["2026-12-30T18:00:00Z", "2027-01-02T18:00:00Z"],
      "30 dec – 2 xan",
      "30 dic – 2 ene",
    ],
  ])("%s", (_, kickoffs, gl, es) => {
    expect(xornadaRange(days(...kickoffs), "gl")).toBe(gl);
    expect(xornadaRange(days(...kickoffs), "es")).toBe(es);
  });

  it("an empty list is null", () => {
    expect(xornadaRange([], "gl")).toBeNull();
    expect(xornadaRange([], "es")).toBeNull();
  });

  it("the dash is U+2013 and there is no leading zero", () => {
    const label = xornadaRange(
      days("2026-10-02T16:00:00Z", "2026-10-05T16:00:00Z"),
      "gl",
    );
    expect(label).toBe("2–5 out");
  });
});

// SPEC-028 CA-6: the text of the visible <h1>.
describe("SPEC-028 CA-6 xornadaHeading", () => {
  it("«Xornada · range» / «Jornada · range»", () => {
    const d = days("2026-10-10T16:00:00Z", "2026-10-12T18:00:00Z");
    expect(xornadaHeading(d, "gl")).toBe("Xornada · 10–12 out");
    expect(xornadaHeading(d, "es")).toBe("Jornada · 10–12 oct");
  });

  it("without days, the title alone", () => {
    expect(xornadaHeading([], "gl")).toBe("Xornada");
    expect(xornadaHeading([], "es")).toBe("Jornada");
  });
});
