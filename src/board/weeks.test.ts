import { describe, expect, it } from "vitest";
import type { MatchStatus } from "@/model";
import type { XornadaIndexEntry } from "./row";
import {
  homeWeek,
  neighbourWeeks,
  seasonWeeks,
  weekArrows,
  weekHref,
  weekOf,
  weekXornada,
} from "./weeks";

// SPEC-027 CA-1 and CA-2 (H-1, H-3): the week of play, Tuesday 00:00 to
// Tuesday 00:00 Europe/Madrid, keyed by its Saturday; a round lives in the
// week of its median kickoff. Pure: `now` is always given.

const entry = (
  competitionId: string,
  round: number,
  kickoff: string,
  status: MatchStatus = "scheduled",
  season = "2026-27",
): XornadaIndexEntry =>
  ({
    matchId: `${competitionId}-${round}-${kickoff.slice(5, 16).replace(/\D/g, "")}`,
    competitionId,
    season,
    round,
    kickoff,
    status,
  }) as XornadaIndexEntry;

const ids = (out: readonly XornadaIndexEntry[]) =>
  out.map((e) => e.matchId).sort();

describe("SPEC-027 CA-1 weekOf", () => {
  it.each([
    // Tuesday 00:00 Madrid (CEST, UTC+2) opens the week of Saturday 10.
    ["2026-10-05T22:00:00Z", "2026-10-10"],
    ["2026-10-09T18:00:00Z", "2026-10-10"],
    ["2026-10-10T16:00:00Z", "2026-10-10"],
    // Monday 23:59 Madrid is still the weekend; Tuesday 00:00 is the next.
    ["2026-10-12T21:59:00Z", "2026-10-10"],
    ["2026-10-12T22:00:00Z", "2026-10-17"],
    // Change of time on Sunday 2026-10-25 (CEST → CET at 01:00Z).
    ["2026-10-25T00:30:00Z", "2026-10-24"],
    ["2026-10-25T01:30:00Z", "2026-10-24"],
    ["2026-10-26T22:59:00Z", "2026-10-24"],
    ["2026-10-26T23:00:00Z", "2026-10-31"],
    // Across a month and a year.
    ["2026-12-29T10:00:00Z", "2027-01-02"],
  ])("%s is in the week of %s", (instant, week) => {
    expect(weekOf(instant)).toBe(week);
  });
});

describe("SPEC-027 CA-1 weekXornada and seasonWeeks", () => {
  it("a Friday-to-Monday round goes to its Saturday", () => {
    const round = [
      entry("tercera", 5, "2026-10-09T18:00:00Z"),
      entry("tercera", 5, "2026-10-10T16:00:00Z"),
      entry("tercera", 5, "2026-10-11T10:00:00Z"),
      entry("tercera", 5, "2026-10-12T19:00:00Z"),
    ];
    expect(seasonWeeks(round)).toEqual(["2026-10-10"]);
    expect(ids(weekXornada(round, "2026-10-10"))).toEqual(ids(round));
  });

  it("a Monday match at 23:59 stays in the round; the round's week follows its median", () => {
    const round = [
      entry("tercera", 5, "2026-10-10T16:00:00Z"),
      entry("tercera", 5, "2026-10-11T16:00:00Z"),
      entry("tercera", 5, "2026-10-12T21:59:00Z"),
    ];
    const next = [entry("tercera", 6, "2026-10-12T22:00:00Z")];
    expect(ids(weekXornada([...round, ...next], "2026-10-10"))).toEqual(
      ids(round),
    );
    expect(ids(weekXornada([...round, ...next], "2026-10-17"))).toEqual(
      ids(next),
    );
  });

  it("a round across the change of time keeps its Saturday", () => {
    const round = [
      entry("segunda", 10, "2026-10-24T14:00:00Z"),
      entry("segunda", 10, "2026-10-25T15:00:00Z"),
      entry("segunda", 10, "2026-10-26T22:59:00Z"),
    ];
    expect(seasonWeeks(round)).toEqual(["2026-10-24"]);
  });

  it("a Wednesday round and a weekend round of one competition share the week", () => {
    const midweek = [
      entry("segunda", 7, "2026-10-14T17:00:00Z"),
      entry("segunda", 7, "2026-10-14T19:00:00Z"),
    ];
    const weekend = [
      entry("segunda", 8, "2026-10-17T16:00:00Z"),
      entry("segunda", 8, "2026-10-18T16:00:00Z"),
    ];
    expect(seasonWeeks([...midweek, ...weekend])).toEqual(["2026-10-17"]);
    expect(ids(weekXornada([...midweek, ...weekend], "2026-10-17"))).toEqual(
      ids([...midweek, ...weekend]),
    );
  });

  it("a J3 match postponed and played in the week of J8 stays in the week of J3, whatever its state", () => {
    const j3 = [
      entry("segunda", 3, "2026-09-12T16:00:00Z", "finished"),
      entry("segunda", 3, "2026-09-13T16:00:00Z", "finished"),
      entry("segunda", 3, "2026-09-13T18:00:00Z", "finished"),
    ];
    const postponed = entry("segunda", 3, "2026-10-21T19:00:00Z", "live");
    const j8 = [
      entry("segunda", 8, "2026-10-24T14:00:00Z"),
      entry("segunda", 8, "2026-10-25T16:00:00Z"),
    ];
    const index = [...j3, postponed, ...j8];
    expect(ids(weekXornada(index, "2026-09-12"))).toEqual(
      ids([...j3, postponed]),
    );
    expect(ids(weekXornada(index, "2026-10-24"))).toEqual(ids(j8));
    expect(seasonWeeks(index)).toEqual(["2026-09-12", "2026-10-24"]);
  });

  it("a competition on a break is absent from that week; empty weeks are skipped", () => {
    const index = [
      entry("primera", 8, "2026-10-10T19:00:00Z"),
      entry("primera", 9, "2026-10-24T19:00:00Z"),
      entry("segunda", 9, "2026-10-17T16:00:00Z"),
      entry("tercera", 9, "2026-10-31T16:00:00Z"),
    ];
    expect(
      weekXornada(index, "2026-10-17").map((e) => e.competitionId),
    ).toEqual(["segunda"]);
    expect(seasonWeeks(index)).toEqual([
      "2026-10-10",
      "2026-10-17",
      "2026-10-24",
      "2026-10-31",
    ]);
    expect(
      seasonWeeks(index.filter((e) => e.competitionId === "primera")),
    ).toEqual(["2026-10-10", "2026-10-24"]);
  });

  it("the same round number in two competitions is two rounds", () => {
    const index = [
      entry("primera", 5, "2026-10-10T19:00:00Z"),
      entry("tercera", 5, "2026-10-17T16:00:00Z"),
    ];
    expect(seasonWeeks(index)).toEqual(["2026-10-10", "2026-10-17"]);
  });

  it("an empty index has no weeks and no xornada", () => {
    expect(seasonWeeks([])).toEqual([]);
    expect(weekXornada([], "2026-10-10")).toEqual([]);
  });
});

// Three competitions on the weekends of October 2026, each with its own
// round numbers. Medians: Primera Saturday 19:00Z, Segunda Sunday 04:00Z,
// Tercera Monday 05:30Z (a Monday match in each round).
const weekends = ["2026-10-03", "2026-10-10", "2026-10-17", "2026-10-24"];
const plus = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
const primera = weekends.flatMap((sat, i) => [
  entry("primera", 7 + i, `${sat}T17:00:00Z`),
  entry("primera", 7 + i, `${sat}T21:00:00Z`),
]);
const segunda = weekends.flatMap((sat, i) => [
  entry("segunda", 4 + i, `${sat}T16:00:00Z`),
  entry("segunda", 4 + i, `${plus(sat, 1)}T16:00:00Z`),
]);
const tercera = weekends.flatMap((sat, i) => [
  entry("tercera", 5 + i, `${plus(sat, 1)}T16:00:00Z`),
  entry("tercera", 5 + i, `${plus(sat, 2)}T19:00:00Z`),
]);
const season = [...primera, ...segunda, ...tercera];

describe("SPEC-027 CA-2 homeWeek and the neighbours", () => {
  it("Saturday of Segunda J5 → home is that week; ‹ the week of J4, › the week of J6", () => {
    const now = "2026-10-10T17:00:00Z";
    expect(homeWeek(segunda, now)).toBe("2026-10-10");
    expect(neighbourWeeks(seasonWeeks(segunda), "2026-10-10")).toEqual({
      previous: "2026-10-03",
      next: "2026-10-17",
    });
    expect(weekArrows(segunda, "2026-10-10", now, "gl")).toEqual({
      previous: "/xornada/2026-10-03",
      next: "/xornada/2026-10-17",
    });
  });

  it("Wednesday past every midpoint → home is the next week; ‹ is the weekend played, and it is /", () => {
    const now = "2026-10-14T20:00:00Z";
    const index = [...primera, ...segunda];
    expect(homeWeek(index, now)).toBe("2026-10-17");
    expect(weekArrows(index, "2026-10-17", now, "es")).toEqual({
      previous: "/es/xornada/2026-10-10",
      next: "/es/xornada/2026-10-24",
    });
    // From the week played, › goes back to the home, not to a page of it.
    expect(weekArrows(index, "2026-10-10", now, "es")).toEqual({
      previous: "/es/xornada/2026-10-03",
      next: "/es",
    });
  });

  it("mixed Wednesday: Primera already in the next round, Tercera not → home is the next week and ‹ brings Primera J8 and Tercera J6", () => {
    const now = "2026-10-14T12:00:00Z";
    expect(homeWeek(season, now)).toBe("2026-10-17");
    const previous = neighbourWeeks(seasonWeeks(season), "2026-10-17").previous;
    expect(previous).toBe("2026-10-10");
    const rounds = Object.fromEntries(
      ["primera", "tercera"].map((c) => [
        c,
        [
          ...new Set(
            weekXornada(season, previous ?? "")
              .filter((e) => e.competitionId === c)
              .map((e) => e.round),
          ),
        ],
      ]),
    );
    expect(rounds).toEqual({ primera: [8], tercera: [6] });
  });

  it("a break of every competition is skipped", () => {
    const index = season.filter((e) => !e.kickoff.startsWith("2026-10-1"));
    expect(seasonWeeks(index)).toEqual(["2026-10-03", "2026-10-24"]);
    expect(neighbourWeeks(seasonWeeks(index), "2026-10-03").next).toBe(
      "2026-10-24",
    );
    expect(
      weekArrows(index, "2026-10-24", "2026-10-03T12:00:00Z", "gl"),
    ).toEqual({ previous: "/", next: null });
  });

  it("the first and the last week have no neighbour on their side", () => {
    const weeks = seasonWeeks(season);
    expect(neighbourWeeks(weeks, "2026-10-03").previous).toBeNull();
    expect(neighbourWeeks(weeks, "2026-10-24").next).toBeNull();
    expect(
      weekArrows(season, "2026-10-03", "2026-10-10T17:00:00Z", "gl"),
    ).toEqual({ previous: null, next: "/" });
  });

  it("only the season of now counts", () => {
    const old = entry(
      "primera",
      38,
      "2026-05-23T19:00:00Z",
      "finished",
      "2025-26",
    );
    expect(homeWeek([old, ...segunda], "2026-10-10T17:00:00Z")).toBe(
      "2026-10-10",
    );
    expect(
      weekArrows([old, ...segunda], "2026-10-03", "2026-10-10T17:00:00Z", "gl")
        .previous,
    ).toBeNull();
    expect(homeWeek([], "2026-10-10T17:00:00Z")).toBeNull();
  });

  it("symmetry: for every week W ≠ home with a previous one, the next of its previous is W", () => {
    for (const now of [
      "2026-10-03T12:00:00Z",
      "2026-10-10T17:00:00Z",
      "2026-10-14T12:00:00Z",
      "2026-10-24T20:00:00Z",
    ]) {
      const home = homeWeek(season, now);
      for (const week of seasonWeeks(season)) {
        if (week === home) continue;
        const { previous } = neighbourWeeks(seasonWeeks(season), week);
        if (previous === null) continue;
        expect(neighbourWeeks(seasonWeeks(season), previous).next).toBe(week);
        const back = weekArrows(season, previous, now, "gl").next;
        expect(back).toBe(weekHref(week, home, "gl"));
      }
    }
  });

  it.each([
    ["2026-10-10", "2026-10-10", "gl", "/"],
    ["2026-10-10", "2026-10-10", "es", "/es"],
    ["2026-10-03", "2026-10-10", "gl", "/xornada/2026-10-03"],
    ["2026-10-17", "2026-10-10", "es", "/es/xornada/2026-10-17"],
    ["2026-10-17", null, "gl", "/xornada/2026-10-17"],
  ] as const)("weekHref(%s, home %s, %s) → %s", (week, home, locale, href) => {
    expect(weekHref(week, home, locale)).toBe(href);
  });
});
