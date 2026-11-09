import { describe, expect, it } from "vitest";
import type { SocialTemplate } from "../i18n/social.gl.ts";
import { pickTemplate, seededRng } from "./pick.ts";

// SPEC-066 CA-9 (ADR-030 §6): the selector is pure; the RNG is injected.

const T = (n: number): SocialTemplate => ({ id: `goal-${n}`, text: `${n}` });
const FIVE = [T(1), T(2), T(3), T(4), T(5)];

describe("SPEC-066 CA-9 pickTemplate", () => {
  it("is deterministic with a seeded RNG", () => {
    const a = pickTemplate(FIVE, new Set(), seededRng(42));
    const b = pickTemplate(FIVE, new Set(), seededRng(42));
    expect(a).toEqual(b);
    const sequence = (seed: number) => {
      const rng = seededRng(seed);
      return Array.from(
        { length: 10 },
        () => pickTemplate(FIVE, new Set(), rng).id,
      );
    };
    expect(sequence(7)).toEqual(sequence(7));
    expect(sequence(7)).not.toEqual(sequence(8));
  });

  it("in 1.000 draws never picks an excluded one and picks every other one", () => {
    const excluded = new Set(["goal-2", "goal-4"]);
    const rng = seededRng(1);
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const picked = pickTemplate(FIVE, excluded, rng);
      expect(excluded.has(picked.id)).toBe(false);
      seen.add(picked.id);
    }
    expect([...seen].sort()).toEqual(["goal-1", "goal-3", "goal-5"]);
  });

  it("with everything excluded, it falls back to the whole list rather than nothing", () => {
    const excluded = new Set(FIVE.map((t) => t.id));
    expect(FIVE).toContainEqual(pickTemplate(FIVE, excluded, seededRng(3)));
  });

  it("refuses an empty list", () => {
    expect(() => pickTemplate([], new Set(), seededRng(3))).toThrow(/empty/);
  });

  it("maps the RNG over the candidates in order (0 is the first, 1- is the last)", () => {
    expect(pickTemplate(FIVE, new Set(), () => 0).id).toBe("goal-1");
    expect(pickTemplate(FIVE, new Set(), () => 0.999).id).toBe("goal-5");
    expect(pickTemplate(FIVE, new Set(["goal-1"]), () => 0).id).toBe("goal-2");
  });
});
