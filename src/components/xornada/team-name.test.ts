import { describe, expect, it } from "vitest";
import type { XornadaRow } from "@/xornada/view";
import { teamNameTone } from "./team-name";

type Case = Pick<
  XornadaRow,
  "status" | "winner" | "homeGalician" | "awayGalician"
>;

const row = (over: Partial<Case>): Case => ({
  status: "finished",
  winner: null,
  homeGalician: false,
  awayGalician: false,
  ...over,
});

// SPEC-019: winner in 600, loser and postponed dimmed. SPEC-033 CA-5 (H-5):
// an Equipo galego in 600 and --marca; losing or postponed, --marca-deep.
describe("SPEC-033 CA-5 teamNameTone", () => {
  it.each([
    // [case, side, tone]
    [row({ winner: "home" }), "home", "winner"],
    [row({ winner: "home" }), "away", "loser"],
    [row({ status: "postponed" }), "home", "dim"],
    [row({ status: "live" }), "home", "plain"],
    [row({ status: "live", homeGalician: true }), "home", "galician"],
    [row({ winner: "home", homeGalician: true }), "home", "galician"],
    [row({ winner: "away", homeGalician: true }), "home", "galicianDeep"],
    [row({ status: "postponed", awayGalician: true }), "away", "galicianDeep"],
    [row({ status: "scheduled", awayGalician: true }), "away", "galician"],
    [row({ status: "finished", homeGalician: true }), "home", "galician"],
    [row({ status: "suspended", homeGalician: true }), "home", "galician"],
  ] as const)("%o %s → %s", (r, side, tone) => {
    expect(teamNameTone(r, side)).toBe(tone);
  });
});
