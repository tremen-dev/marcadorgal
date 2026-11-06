import { describe, expect, it } from "vitest";
import { type MatchStatus, SourceConfig } from "../model/index.ts";
import { SOURCES } from "../sources/registry.ts";
import { admittedByEngine, forEngine } from "./live-observed-only.ts";

// SPEC-048 CA-2 (ADR-027 §1): what the engine never receives when a source has
// liveObservedOnly configured.
const CONFIG_WITH_FILTER = [
  SOURCES[0],
  SourceConfig.parse({
    ...SOURCES[1],
    liveObservedOnly: ["primera-division", "segunda-division"],
  }),
];
const obs = (sourceId: string, status: MatchStatus) => ({ sourceId, status });
const admits = (competition: string, sourceId: string, status: MatchStatus) =>
  admittedByEngine(CONFIG_WITH_FILTER, competition)(obs(sourceId, status));

describe("SPEC-048 CA-2 live observed only", () => {
  it.each(["primera-division", "segunda-division"])(
    "drops the rfef live in %s",
    (competition) => {
      expect(admits(competition, "rfef", "live")).toBe(false);
    },
  );

  it.each(["finished", "scheduled", "postponed", "suspended"] as const)(
    "keeps the rfef %s in primera-division",
    (status) => {
      expect(admits("primera-division", "rfef", status)).toBe(true);
    },
  );

  it("keeps the rfef live in primera-rfef-g1", () => {
    expect(admits("primera-rfef-g1", "rfef", "live")).toBe(true);
  });

  it("keeps the api-football live in primera-division", () => {
    expect(admits("primera-division", "api-football", "live")).toBe(true);
  });

  it.each(["live", "finished", "scheduled"] as const)(
    "always keeps the operator (%s)",
    (status) => {
      expect(admits("primera-division", "operator", status)).toBe(true);
      expect(admits("segunda-division", "operator", status)).toBe(true);
    },
  );

  it("forEngine filters a list and keeps its order and its rows", () => {
    const rows = [
      { id: 1, ...obs("rfef", "live") },
      { id: 2, ...obs("api-football", "live") },
      { id: 3, ...obs("rfef", "finished") },
    ];
    expect(forEngine(CONFIG_WITH_FILTER, "primera-division", rows)).toEqual([
      rows[1],
      rows[2],
    ]);
    expect(forEngine(CONFIG_WITH_FILTER, "primera-rfef-g1", rows)).toEqual(
      rows,
    );
  });

  it("is pure: an empty registry keeps everything", () => {
    expect(
      forEngine([], "primera-division", [obs("rfef", "live")]),
    ).toHaveLength(1);
  });

  it("with deployed SOURCES (reverted for explorer v2.0 with MARCA), rfef live is admitted in every competition", () => {
    expect(
      admittedByEngine(SOURCES, "primera-division")(obs("rfef", "live")),
    ).toBe(true);
    expect(
      admittedByEngine(SOURCES, "segunda-division")(obs("rfef", "live")),
    ).toBe(true);
  });
});
