import { readFileSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { RawCapture } from "@/model";
import { goalEvents, goalReferences } from "./events.ts";

// SPEC-025 CA-2 (H-1): the provider's reference of each goal out of raw that
// is already stored. Fixtures of the repo, never the network.
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const iso = (unixSeconds: number, plusSeconds = 0) =>
  new Date((unixSeconds + plusSeconds) * 1000).toISOString();

describe("SPEC-025 CA-2 goalEvents over live-2026-09-26.json", () => {
  const fixtures = goalEvents(fixture("live-2026-09-26.json"));
  const byId = new Map(fixtures.map((f) => [f.fixtureId, f]));

  it("reads every fixture of the body, with its league", () => {
    expect(fixtures.map((f) => f.fixtureId).sort()).toEqual(
      ["1569942", "1570760", "1570762", "1572057", "1612732"].sort(),
    );
    expect(byId.get("1570760")?.leagueId).toBe("435");
  });

  it("Cultural Leonesa 2-0 Coria: two goals in the first half, in order, at minute resolution", () => {
    const first = 1790433000;
    const goals = byId.get("1570760")?.goals ?? [];
    expect(goals).toEqual([
      {
        order: 1,
        elapsed: 17,
        extra: null,
        detail: "Normal Goal",
        teamId: "725",
        interval: { from: iso(first, 16 * 60), to: iso(first, 17 * 60) },
        reason: null,
      },
      {
        order: 2,
        elapsed: 31,
        extra: null,
        detail: "Normal Goal",
        teamId: "725",
        interval: { from: iso(first, 30 * 60), to: iso(first, 31 * 60) },
        reason: null,
      },
    ]);
  });

  it("cards and substitutions are not goals; a match with no goal has none", () => {
    expect(byId.get("1570762")?.goals.map((g) => g.elapsed)).toEqual([20]);
    expect(byId.get("1572057")?.goals).toEqual([]);
  });

  it("Granada 0-2 Andorra has no periods: the goals stay, with no interval and their reason", () => {
    const goals = byId.get("1569942")?.goals ?? [];
    expect(
      goals.map((g) => [g.order, g.elapsed, g.interval, g.reason]),
    ).toEqual([
      [1, 7, null, "no_periods"],
      [2, 33, null, "no_periods"],
    ]);
  });
});

// One fixture with the events the table needs, in the provider's envelope.
function body(
  periods: { first: number | null; second: number | null } | undefined,
  events: unknown[],
  id = 1,
): string {
  return JSON.stringify({
    errors: [],
    response: [
      {
        fixture: { id, ...(periods === undefined ? {} : { periods }) },
        league: { id: 141 },
        events,
      },
    ],
  });
}
const goal = (
  elapsed: number,
  extra: number | null,
  detail = "Normal Goal",
) => ({
  time: { elapsed, extra },
  team: { id: 9 },
  type: "Goal",
  detail,
});

describe("SPEC-025 CA-2 the interval of each goal", () => {
  const first = 1_800_000_000;
  const second = first + 62 * 60;
  const periods = { first, second };
  const only = (events: unknown[], p: typeof periods | undefined = periods) =>
    goalEvents(body(p, events))[0].goals;

  it.each([
    ["first half, minute 1", 1, null, iso(first, 0), iso(first, 60)],
    [
      "first half, minute 45",
      45,
      null,
      iso(first, 44 * 60),
      iso(first, 45 * 60),
    ],
    ["first half added, 45+3", 45, 3, iso(first, 47 * 60), iso(first, 48 * 60)],
    ["second half, minute 46", 46, null, iso(second, 0), iso(second, 60)],
    [
      "second half, minute 57",
      57,
      null,
      iso(second, 11 * 60),
      iso(second, 12 * 60),
    ],
    [
      "second half added, 90+4",
      90,
      4,
      iso(second, 48 * 60),
      iso(second, 49 * 60),
    ],
  ])("%s → [from, to) of 60 s", (_, elapsed, extra, from, to) => {
    const [g] = only([goal(elapsed, extra)]);
    expect(g.interval).toEqual({ from, to });
    expect(g.reason).toBeNull();
  });

  it("a second-half goal without periods.second has no interval", () => {
    const [g] = only([goal(57, null)], { first, second: null as never });
    expect(g.interval).toBeNull();
    expect(g.reason).toBe("no_periods");
  });

  it("without the periods field at all: no interval and the reason", () => {
    const [g] = goalEvents(body(undefined, [goal(10, null)]))[0].goals;
    expect(g).toMatchObject({ interval: null, reason: "no_periods" });
  });

  it("extra time (elapsed above 90) has no period start: no interval", () => {
    const [g] = only([goal(105, null)]);
    expect(g).toMatchObject({ interval: null, reason: "extra_time" });
  });

  it("Missed Penalty is not a goal, and the order is the match's", () => {
    const goals = only([
      goal(60, null),
      goal(12, null, "Penalty"),
      goal(30, null, "Missed Penalty"),
      goal(45, 2, "Own Goal"),
    ]);
    expect(goals.map((g) => [g.order, g.elapsed, g.extra, g.detail])).toEqual([
      [1, 12, null, "Penalty"],
      [2, 45, 2, "Own Goal"],
      [3, 60, null, "Normal Goal"],
    ]);
  });

  it("a body that is not JSON or carries errors gives nothing, never throws", () => {
    expect(goalEvents("not json")).toEqual([]);
    expect(
      goalEvents(JSON.stringify({ errors: { live: "bad" }, response: [] })),
    ).toEqual([]);
  });
});

describe("SPEC-025 CA-2 goalReferences over several stored captures", () => {
  const capture = (capturedAt: string, bodies: string[]): RawCapture => ({
    sourceId: "api-football" as never,
    capturedAt,
    requests: bodies.map((b) => ({
      url: "https://v3.football.api-sports.io/fixtures?ids=1",
      status: 200,
      contentType: "application/json",
      body: b,
    })),
  });

  it("the events of the newest capture, the periods of the newest that has them", () => {
    const first = 1_800_000_000;
    const refs = goalReferences([
      capture("2027-01-01T18:40:00.000Z", [
        body({ first, second: null }, [goal(10, null)]),
      ]),
      // FT: the provider empties periods; a goal was disallowed by VAR.
      capture("2027-01-01T20:00:00.000Z", [
        body({ first: null, second: null }, [goal(10, null), goal(50, null)]),
      ]),
      capture("2027-01-01T19:30:00.000Z", [
        body({ first, second: first + 3600 }, [
          goal(10, null),
          goal(20, null),
          goal(50, null),
        ]),
      ]),
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0].periods).toEqual({ first, second: first + 3600 });
    expect(refs[0].goals.map((g) => [g.elapsed, g.interval?.from])).toEqual([
      [10, iso(first, 9 * 60)],
      [50, iso(first + 3600, 4 * 60)],
    ]);
  });

  it("Girona 2-0 Albacete (247 stored captures): two goals; the 2-1 of 19:45 never was an event", () => {
    const captures = JSON.parse(
      brotliDecompressSync(
        readFileSync(
          new URL(
            "./fixtures/girona-albacete-2026-09-25.json.br",
            import.meta.url,
          ),
        ),
      ).toString("utf8"),
    ) as RawCapture[];
    const [girona] = goalReferences(captures);
    expect(girona.fixtureId).toBe("1569941");
    expect(girona.goals.map((g) => [g.order, g.elapsed, g.reason])).toEqual([
      [1, 6, "no_periods"],
      [2, 43, "no_periods"],
    ]);
  });
});
