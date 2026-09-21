import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  HOUR_MS,
  Instant,
  instantDiff,
  MINUTE_MS,
  shiftInstant,
} from "./index.ts";

const NOW = "2026-09-25T18:30:00.000Z" as Instant;

describe("SPEC-006 instant arithmetic", () => {
  it("shifts forward and backward and stays an Instant", () => {
    expect(shiftInstant(NOW, 10 * MINUTE_MS)).toBe("2026-09-25T18:40:00.000Z");
    expect(shiftInstant(NOW, -150 * MINUTE_MS)).toBe(
      "2026-09-25T16:00:00.000Z",
    );
    expect(shiftInstant(NOW, -30 * DAY_MS)).toBe("2026-08-26T18:30:00.000Z");
    expect(Instant.parse(shiftInstant(NOW, HOUR_MS))).toBeDefined();
  });

  it("measures the distance between two instants", () => {
    expect(instantDiff(NOW, shiftInstant(NOW, 25_000))).toBe(25_000);
    expect(instantDiff(shiftInstant(NOW, 25_000), NOW)).toBe(-25_000);
  });

  it("has the three durations of the core", () => {
    expect([MINUTE_MS, HOUR_MS, DAY_MS]).toEqual([
      60_000, 3_600_000, 86_400_000,
    ]);
  });
});
