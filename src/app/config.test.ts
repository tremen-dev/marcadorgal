import { describe, expect, it } from "vitest";
import { PROVISIONAL_DISPLAYS } from "@/xornada/qualifier";
import { PROVISIONAL_DISPLAY } from "./config";

// SPEC-034 CA-5 (H-1, H-2): the mode lives in one constant of the web.
describe("SPEC-034 CA-5 PROVISIONAL_DISPLAY", () => {
  it("is one of the three modes", () => {
    expect(PROVISIONAL_DISPLAYS).toContain(PROVISIONAL_DISPLAY);
  });

  it("is mark by default (H-2); hidden is valid but not the default (H-4)", () => {
    expect(PROVISIONAL_DISPLAY).toBe("mark");
  });
});
