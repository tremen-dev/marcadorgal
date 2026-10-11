import { describe, expect, it, vi } from "vitest";
import { AliasFile } from "../../model/index.ts";
import { buildPlan, calibrate, formatPlan, planRounds } from "./calibration.ts";

// SPEC-032: the calibration of the RFEF cadence. Every test runs against a
// fetch double: no request ever leaves for marcadores.rfef.es.

const noFetch = () =>
  vi.fn(async (): Promise<Response> => {
    throw new Error("no request may leave in this test");
  });

describe("CA-1 dry-run plan", () => {
  it("has the six steps, max(30 min, 10 requests) each, ~175 rounds and ~3 h", () => {
    const plan = buildPlan();
    expect(plan.steps.map((s) => s.intervalSeconds)).toEqual([
      180, 120, 90, 60, 45, 30,
    ]);
    expect(plan.steps.map((s) => s.rounds)).toEqual([10, 15, 20, 30, 40, 60]);
    expect(plan.steps.map((s) => s.seconds)).toEqual(Array(6).fill(1800));
    expect(plan.rounds).toBe(175);
    // One portada for the session on top of one POST per round.
    expect(plan.maxRequests).toBe(176);
    expect(plan.seconds).toBe(3 * 3600);
  });

  it("the rounds: todos first and last, Sch_en_juego=1 in between", () => {
    const rounds = planRounds(buildPlan());
    expect(rounds).toHaveLength(175);
    expect(rounds[0]).toMatchObject({
      index: 1,
      intervalSeconds: 180,
      nInStep: 1,
      variant: "todos",
    });
    expect(rounds[174]).toMatchObject({
      index: 175,
      intervalSeconds: 30,
      nInStep: 60,
      variant: "todos",
    });
    expect(rounds.slice(1, -1).every((r) => r.variant === "enjuego")).toBe(
      true,
    );
    expect(rounds[10]).toMatchObject({ intervalSeconds: 120, nInStep: 1 });
  });

  it("--dry-run prints the plan and makes 0 calls", async () => {
    const fetch = noFetch();
    const log: string[] = [];
    const result = await calibrate(
      { dryRun: true, lastRequest: null, lastLogged: null },
      {
        fetch,
        now: () => Date.parse("2026-10-17T15:00:00Z"),
        sleep: async () => {},
        record: async () => {},
        log: (m) => log.push(m),
        calendar: [],
        aliases: AliasFile.parse({
          source: "rfef",
          season: "2026-27",
          teams: [],
        }),
      },
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(result.kind).toBe("dry-run");
    const text = log.join("\n");
    expect(text).toBe(formatPlan(buildPlan()).join("\n"));
    for (const s of ["180 s", "120 s", "90 s", "60 s", "45 s", "30 s"])
      expect(text).toContain(s);
    expect(text).toMatch(/176/);
    expect(text).toMatch(/3 h/);
  });
});
