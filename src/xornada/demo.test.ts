import { describe, expect, it } from "vitest";
import { PublicMatch } from "@/model";
import { DEMO_MATCHES, isDemoAvailable } from "./demo";
import { buildXornada } from "./view";

const xornada = buildXornada([...DEMO_MATCHES]);
const rows = xornada.flatMap((c) => c.rows);

describe("SPEC-019 CA-5 demonstration data", () => {
  it("every match validates against PublicMatch", () => {
    for (const m of DEMO_MATCHES) {
      expect(PublicMatch.safeParse(m).error).toBeUndefined();
    }
  });

  it("has the five competitions of D-3, one per tier", () => {
    expect(xornada.map((c) => [c.tier, c.name])).toEqual([
      [1, "Primeira División"],
      [2, "Segunda División"],
      [3, "Primeira Federación · Grupo 1"],
      [4, "Segunda Federación · Grupo 1"],
      [5, "Terceira Federación · Grupo 1"],
    ]);
  });

  it("includes Bilbao Athletic and teams without shortName (CA-4)", () => {
    const names = DEMO_MATCHES.flatMap((m) => [m.home, m.away]);
    expect(names.map((t) => t.name)).toContain("Bilbao Athletic");
    expect(names.filter((t) => t.shortName === null).length).toBeGreaterThan(0);
  });

  it("covers every state × allowed qualifier of CA-2", () => {
    const seen = new Set(DEMO_MATCHES.map((m) => `${m.status}·${m.qualifier}`));
    for (const pair of [
      "scheduled·confirmado",
      "scheduled·sen_sinal",
      "live·confirmado",
      "live·provisional",
      "live·sen_sinal",
      "finished·confirmado",
      "finished·provisional",
      "postponed·confirmado",
      "postponed·provisional",
      "suspended·confirmado",
      "suspended·provisional",
    ]) {
      expect(seen, pair).toContain(pair);
    }
  });

  it("covers 45+3 and 46, live without minute, a draw and both winners", () => {
    const minutes = rows.flatMap((r) =>
      r.margin.kind === "minute" ? [r.margin] : [],
    );
    expect(minutes).toContainEqual({
      kind: "minute",
      minute: 45,
      addedMinute: 3,
    });
    expect(minutes).toContainEqual({
      kind: "minute",
      minute: 46,
      addedMinute: null,
    });
    expect(
      rows.some((r) => r.status === "live" && r.margin.kind === "status"),
    ).toBe(true);
    const finished = rows.filter((r) => r.status === "finished");
    expect(finished.map((r) => r.winner)).toEqual(
      expect.arrayContaining([null, "home", "away"]),
    );
  });
});

describe("SPEC-019 CA-5 isDemoAvailable", () => {
  it("is false in production and true anywhere else", () => {
    expect(isDemoAvailable({ VERCEL_ENV: "production" })).toBe(false);
    expect(isDemoAvailable({ VERCEL_ENV: "preview" })).toBe(true);
    expect(isDemoAvailable({ VERCEL_ENV: "development" })).toBe(true);
    expect(isDemoAvailable({})).toBe(true);
  });
});
