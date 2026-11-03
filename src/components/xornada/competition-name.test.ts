import { describe, expect, it } from "vitest";
import { competitionNameSegments } from "./competition-name";

// SPEC-045 CA-3 (H-1): the name breaks only before « · »; every segment, and
// so the last «· Grupo 1», is indivisible; they are the canonical
// name, unchanged (D-2), when joined by the breakable space they sit on.
describe("SPEC-045 CA-3 competitionNameSegments", () => {
  it.each([
    ["Primeira División", ["Primeira División"]],
    ["Primeira Federación · Grupo 1", ["Primeira Federación", "· Grupo 1"]],
    ["A · B · C", ["A", "· B", "· C"]],
    ["Sen punto·medio", ["Sen punto·medio"]],
  ])("%s", (name, segments) => {
    expect(competitionNameSegments(name)).toEqual(segments);
    expect(competitionNameSegments(name).join(" ")).toBe(name);
  });
});
