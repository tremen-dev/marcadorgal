import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AliasFile } from "./alias.ts";
import { SkippedReason } from "./source.ts";

// SPEC-031 CA-6, model part: codgrupo -> competition lives in an optional
// `competitions` map, and two new skipped reasons for the RFEF.
describe("SPEC-031 CA-6 model", () => {
  it("AliasFile accepts an optional competitions map", () => {
    const file = {
      source: "rfef",
      season: "2026-27",
      teams: [],
      competitions: { "26991073": "tercera-rfef-g1" },
    };
    expect(AliasFile.parse(file).competitions).toEqual({
      "26991073": "tercera-rfef-g1",
    });
    expect(() =>
      AliasFile.parse({ ...file, competitions: { "1": "Not A Slug" } }),
    ).toThrow();
  });

  it("api-football.json still validates", () => {
    const raw = readFileSync(
      new URL("../../data/alias/2026-27/api-football.json", import.meta.url),
      "utf8",
    );
    expect(() => AliasFile.parse(JSON.parse(raw))).not.toThrow();
  });

  it("SkippedReason gains ambiguous_state and suspended_without_score", () => {
    expect(SkippedReason.parse("ambiguous_state")).toBe("ambiguous_state");
    expect(SkippedReason.parse("suspended_without_score")).toBe(
      "suspended_without_score",
    );
  });
});
