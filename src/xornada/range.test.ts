import { describe, expect, it } from "vitest";
import { xornadaSpan } from "./range";
import { xornadaDays } from "./view";

const NOW = "2026-10-10T10:00:00Z";
const days = (...kickoffs: string[]) =>
  xornadaDays(
    kickoffs.map((kickoff) => ({ kickoff })),
    NOW,
  );

// SPEC-028 CA-5 (H-7): the first and last day of the strip, pure.
describe("SPEC-028 CA-5 xornadaSpan", () => {
  it("an empty list has no span", () => {
    expect(xornadaSpan([])).toBeNull();
  });

  it("the first and last date of xornadaDays, with their months", () => {
    const span = xornadaSpan(
      days("2026-10-12T16:00:00Z", "2026-10-10T16:00:00Z"),
    );
    expect(span).toEqual({
      from: { dayOfMonth: 10, monthKey: "month.oct" },
      to: { dayOfMonth: 12, monthKey: "month.oct" },
    });
  });

  it("one day: from and to are the same", () => {
    const span = xornadaSpan(days("2026-10-11T16:00:00Z"));
    expect(span?.from).toEqual(span?.to);
  });
});
