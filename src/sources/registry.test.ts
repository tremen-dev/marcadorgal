import { describe, expect, it } from "vitest";
import {
  FEDERATION_PRIORITY,
  OPERATOR_PRIORITY,
  SourceConfig,
} from "../model/index.ts";
import { SOURCES, sourceConfig } from "./registry.ts";

const FIVE = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];

describe("CA-2 registry", () => {
  it("has exactly one source, api-football, pull, over the five competitions at priority 10", () => {
    expect(SOURCES).toHaveLength(1);
    const [apiFootball] = SOURCES;
    expect(SourceConfig.safeParse(apiFootball).success).toBe(true);
    expect(apiFootball).toMatchObject({
      id: "api-football",
      kind: "pull",
      minIntervalSeconds: 30,
      userAgent: "marcador.gal (ingesta; https://marcador.gal)",
    });
    expect([...apiFootball.competitions].sort()).toEqual([...FIVE].sort());
    expect(apiFootball.priority).toEqual(
      Object.fromEntries(FIVE.map((c) => [c, 10])),
    );
    expect(apiFootball.legalBasis.length).toBeGreaterThan(0);
  });

  it("sourceConfig finds a source by id and returns undefined otherwise", () => {
    expect(sourceConfig("api-football")).toBe(SOURCES[0]);
    expect(sourceConfig("operator")).toBeUndefined();
  });

  it("priority bands: federation 50, operator 100 (N-4)", () => {
    expect(FEDERATION_PRIORITY).toBe(50);
    expect(OPERATOR_PRIORITY).toBe(100);
  });
});

describe("CA-2 SourceConfig", () => {
  const valid = {
    id: "acme",
    kind: "pull",
    competitions: ["primera-division", "segunda-division"],
    priority: { "primera-division": 5, "segunda-division": 5 },
    minIntervalSeconds: 60,
    userAgent: "acme/1.0",
    legalBasis: "contract signed",
  };
  const ok = (v: unknown) => SourceConfig.safeParse(v).success;

  it("accepts a valid configuration", () => {
    expect(ok(valid)).toBe(true);
  });

  it("rejects minIntervalSeconds 0", () => {
    expect(ok({ ...valid, minIntervalSeconds: 0 })).toBe(false);
  });

  it("rejects a priority for a competition it does not cover", () => {
    expect(
      ok({ ...valid, priority: { ...valid.priority, "tercera-rfef-g1": 5 } }),
    ).toBe(false);
  });

  it("rejects a covered competition without priority", () => {
    expect(ok({ ...valid, priority: { "primera-division": 5 } })).toBe(false);
  });

  it("rejects priority 100 (reserved for the operator) and 0", () => {
    expect(
      ok({
        ...valid,
        priority: { "primera-division": 100, "segunda-division": 5 },
      }),
    ).toBe(false);
    expect(
      ok({
        ...valid,
        priority: { "primera-division": 0, "segunda-division": 5 },
      }),
    ).toBe(false);
  });

  it("rejects an empty legalBasis and an empty competition list", () => {
    expect(ok({ ...valid, legalBasis: "" })).toBe(false);
    expect(ok({ ...valid, competitions: [], priority: {} })).toBe(false);
  });

  it("rejects an unknown key", () => {
    expect(ok({ ...valid, apiKey: "secret" })).toBe(false);
  });
});
