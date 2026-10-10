import { describe, expect, it } from "vitest";
import {
  competitionCounts,
  countFilters,
  EMPTY_STATE,
  formatCount,
  fragmentOf,
  parseFragment,
  rowMatches,
  toggleDay,
  withFilter,
} from "./filter";

const DAYS = ["2026-10-02", "2026-10-03", "2026-10-04"];

// SPEC-023 CA-4: day and filter live in the fragment.
describe("SPEC-023 CA-4 parseFragment", () => {
  it.each([
    ["", EMPTY_STATE],
    ["#", EMPTY_STATE],
    ["#d=2026-10-03", { day: "2026-10-03", filter: null }],
    ["#f=live", { day: null, filter: "live" }],
    ["#f=finished", { day: null, filter: "finished" }],
    ["#d=2026-10-04&f=finished", { day: "2026-10-04", filter: "finished" }],
    ["d=2026-10-04&f=live", { day: "2026-10-04", filter: "live" }],
    // Invalid values are ignored one by one: whole xornada, Todos.
    ["#d=2026-10-09", EMPTY_STATE],
    ["#d=03-10-2026&f=live", { day: null, filter: "live" }],
    ["#f=scheduled", EMPTY_STATE],
    ["#d=2026-10-02&f=LIVE", { day: "2026-10-02", filter: null }],
    ["#competition-primera-division", EMPTY_STATE],
    ["#d=%zz", EMPTY_STATE],
  ])("%s", (hash, state) => {
    expect(parseFragment(hash, DAYS)).toEqual(state);
  });
});

describe("SPEC-023 CA-4 fragmentOf", () => {
  it.each([
    [EMPTY_STATE, ""],
    [{ day: "2026-10-11", filter: null }, "#d=2026-10-11"],
    [{ day: null, filter: "live" }, "#f=live"],
    [{ day: "2026-10-11", filter: "finished" }, "#d=2026-10-11&f=finished"],
  ] as const)("%j → %s", (state, hash) => {
    expect(fragmentOf(state)).toBe(hash);
  });

  it("round-trips through parseFragment", () => {
    const state = { day: "2026-10-03", filter: "live" } as const;
    expect(parseFragment(fragmentOf(state), DAYS)).toEqual(state);
  });
});

describe("SPEC-023 CA-2 toggleDay, CA-3 withFilter", () => {
  it("choosing a day selects it; choosing the selected one clears it", () => {
    const one = toggleDay(EMPTY_STATE, "2026-10-03");
    expect(one).toEqual({ day: "2026-10-03", filter: null });
    expect(toggleDay(one, "2026-10-04").day).toBe("2026-10-04");
    expect(toggleDay(one, "2026-10-03")).toEqual(EMPTY_STATE);
  });

  it("the filter combines with the day", () => {
    const state = withFilter({ day: "2026-10-03", filter: null }, "finished");
    expect(state).toEqual({ day: "2026-10-03", filter: "finished" });
    expect(withFilter(state, null)).toEqual({
      day: "2026-10-03",
      filter: null,
    });
  });
});

describe("SPEC-023 CA-2/CA-3 rowMatches", () => {
  const row = (status: string, day = "2026-10-03") => ({ status, day });

  it("with no state every row passes", () => {
    for (const status of [
      "scheduled",
      "live",
      "finished",
      "postponed",
      "suspended",
    ])
      expect(rowMatches(row(status), EMPTY_STATE)).toBe(true);
  });

  it("En xogo is live only; Rematados is finished only", () => {
    const live = { day: null, filter: "live" } as const;
    const finished = { day: null, filter: "finished" } as const;
    expect(rowMatches(row("live"), live)).toBe(true);
    expect(rowMatches(row("suspended"), live)).toBe(false);
    expect(rowMatches(row("scheduled"), live)).toBe(false);
    expect(rowMatches(row("finished"), finished)).toBe(true);
    expect(rowMatches(row("live"), finished)).toBe(false);
  });

  it("the day keeps only its rows, and combines with the filter", () => {
    const state = { day: "2026-10-03", filter: "live" } as const;
    expect(rowMatches(row("live", "2026-10-03"), state)).toBe(true);
    expect(rowMatches(row("live", "2026-10-04"), state)).toBe(false);
    expect(rowMatches(row("finished", "2026-10-03"), state)).toBe(false);
  });
});

describe("SPEC-023 CA-3 countFilters", () => {
  const rows = [
    { status: "live", day: "2026-10-03" },
    { status: "live", day: "2026-10-04" },
    { status: "finished", day: "2026-10-03" },
    { status: "scheduled", day: "2026-10-03" },
    { status: "suspended", day: "2026-10-04" },
  ];

  it("counts over the whole xornada with no day", () => {
    expect(countFilters(rows, null)).toEqual({ all: 5, live: 2, finished: 1 });
  });

  it("counts over the chosen day", () => {
    expect(countFilters(rows, "2026-10-03")).toEqual({
      all: 3,
      live: 1,
      finished: 1,
    });
    expect(countFilters(rows, "2026-10-09")).toEqual({
      all: 0,
      live: 0,
      finished: 0,
    });
  });
});

// SPEC-023 iteration 2 (F-4): the sidebar and each header follow the day and
// the filter chosen.
describe("SPEC-023 F-4 competitionCounts", () => {
  const rows = [
    { status: "live", day: "2026-10-03" },
    { status: "live", day: "2026-10-04" },
    { status: "finished", day: "2026-10-03" },
    { status: "scheduled", day: "2026-10-04" },
  ];

  it("the whole xornada with no state", () => {
    expect(competitionCounts(rows, EMPTY_STATE)).toEqual({
      matching: 4,
      live: 2,
    });
  });

  it("only the rows of the chosen day", () => {
    expect(
      competitionCounts(rows, { day: "2026-10-03", filter: null }),
    ).toEqual({ matching: 2, live: 1 });
  });

  it("only the rows of the chosen filter, combined with the day", () => {
    expect(competitionCounts(rows, { day: null, filter: "finished" })).toEqual({
      matching: 1,
      live: 0,
    });
    expect(
      competitionCounts(rows, { day: "2026-10-04", filter: "live" }),
    ).toEqual({ matching: 1, live: 1 });
  });
});

// SPEC-023 iteration 2 (B-3): «1 partido», «N partidos».
describe("SPEC-023 B-3 formatCount", () => {
  const templates = { one: "{n} partido", other: "{n} partidos" };
  it.each([
    [0, "0 partidos"],
    [1, "1 partido"],
    [2, "2 partidos"],
    [11, "11 partidos"],
  ])("%i → %s", (n, text) => {
    expect(formatCount(templates, n)).toBe(text);
  });
});

// SPEC-028 CA-2: a sidebar anchor in the fragment is not filter state.
describe("SPEC-028 CA-2 parseFragment ignores #xornada-<id>", () => {
  it.each(["#xornada-primera-division", "#xornada-segunda-federacion-g1"])(
    "%s → whole xornada, Todos",
    (hash) => {
      expect(parseFragment(hash, DAYS)).toEqual(EMPTY_STATE);
    },
  );
});
