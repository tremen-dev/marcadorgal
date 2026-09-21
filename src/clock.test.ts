import { describe, expect, it } from "vitest";
import { nowInstant } from "./clock.ts";
import { Instant } from "./model/index.ts";

describe("CA-9 nowInstant", () => {
  it("reads the clock as an ISO-8601 instant in UTC", () => {
    const now = nowInstant();
    expect(now).toMatch(/Z$/);
    expect(Instant.parse(now)).toBe(now);
  });

  it("never goes backwards", () => {
    expect(Date.parse(nowInstant())).toBeLessThanOrEqual(
      Date.parse(nowInstant()),
    );
  });
});
