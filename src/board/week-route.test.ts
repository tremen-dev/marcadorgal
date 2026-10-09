import { describe, expect, it } from "vitest";
import type { XornadaIndexEntry } from "./row";
import { weekPage, weekParam } from "./week-route";

// SPEC-027 CA-3 (H-2, H-5): what /xornada/[fecha] answers. First the date
// alone (404 or 308, nothing read), then the week over the index of the
// season of now (307 to the home, 404 outside the season, the page).

const entry = (
  competitionId: string,
  round: number,
  kickoff: string,
  season = "2026-27",
): XornadaIndexEntry =>
  ({
    matchId: `${competitionId}-${round}-${kickoff.slice(5, 16).replace(/\D/g, "")}`,
    competitionId,
    season,
    round,
    kickoff,
    status: "scheduled",
  }) as XornadaIndexEntry;

const index = [
  entry("segunda", 4, "2026-10-03T16:00:00Z"),
  entry("segunda", 4, "2026-10-04T16:00:00Z"),
  entry("segunda", 5, "2026-10-10T16:00:00Z"),
  entry("segunda", 5, "2026-10-11T16:00:00Z"),
  entry("segunda", 6, "2026-10-17T16:00:00Z"),
  entry("segunda", 6, "2026-10-18T16:00:00Z"),
  entry("segunda", 8, "2026-10-31T16:00:00Z"),
];
const now = "2026-10-10T17:00:00Z";

describe("SPEC-027 CA-3 weekParam", () => {
  it.each([
    ["2026-10-03", "gl", { kind: "week", week: "2026-10-03" }],
    ["2026-10-03", "es", { kind: "week", week: "2026-10-03" }],
    // Any other day of the week: 308 to its Saturday, same language.
    [
      "2026-10-06",
      "gl",
      { kind: "redirect", status: 308, location: "/xornada/2026-10-10" },
    ],
    [
      "2026-10-05",
      "es",
      { kind: "redirect", status: 308, location: "/es/xornada/2026-10-03" },
    ],
    [
      "2026-10-26",
      "gl",
      { kind: "redirect", status: 308, location: "/xornada/2026-10-24" },
    ],
    // Not a date YYYY-MM-DD: 404.
    ["2026-02-30", "gl", { kind: "notFound" }],
    ["2026-13-01", "gl", { kind: "notFound" }],
    ["2026-10-3", "gl", { kind: "notFound" }],
    ["20261003", "gl", { kind: "notFound" }],
    ["2026-10-03x", "es", { kind: "notFound" }],
    ["xornada", "gl", { kind: "notFound" }],
    ["", "gl", { kind: "notFound" }],
    // A week key outside the calendar years of the season of now (2026-27:
    // 2026 and 2027) is never one of its weeks: 404 before reading (it
    // would be a new ISR key and one index read per date).
    ["1990-01-06", "gl", { kind: "notFound" }],
    ["2025-12-27", "es", { kind: "notFound" }],
    ["2028-01-01", "gl", { kind: "notFound" }],
    ["2026-01-03", "gl", { kind: "week", week: "2026-01-03" }],
    ["2027-12-25", "es", { kind: "week", week: "2027-12-25" }],
    // A day that is not its week key still gets its 308 (the date alone).
    [
      "1990-01-03",
      "gl",
      { kind: "redirect", status: 308, location: "/xornada/1990-01-06" },
    ],
  ] as const)("%s (%s) → %o", (fecha, locale, out) => {
    expect(weekParam(fecha, locale, now)).toEqual(out);
  });

  it("the season is the one of now", () => {
    expect(weekParam("2028-01-01", "gl", "2027-07-01T00:00:00Z")).toEqual({
      kind: "week",
      week: "2028-01-01",
    });
    expect(weekParam("2026-01-03", "gl", "2027-07-01T00:00:00Z")).toEqual({
      kind: "notFound",
    });
  });
});

describe("SPEC-027 CA-3 weekPage", () => {
  it("a week of the season that is not the home → the page with weekXornada and its arrows", () => {
    expect(weekPage("2026-10-03", "gl", now, index)).toEqual({
      kind: "page",
      matchIds: index.filter((e) => e.round === 4).map((e) => e.matchId),
      arrows: { previous: null, next: "/" },
    });
    expect(weekPage("2026-10-17", "es", now, index)).toEqual({
      kind: "page",
      matchIds: index.filter((e) => e.round === 6).map((e) => e.matchId),
      arrows: { previous: "/es", next: "/es/xornada/2026-10-31" },
    });
  });

  it.each([
    ["gl", "/"],
    ["es", "/es"],
  ] as const)("the home week (%s) → 307 to %s", (locale, location) => {
    expect(weekPage("2026-10-10", locale, now, index)).toEqual({
      kind: "redirect",
      status: 307,
      location,
    });
  });

  it.each([
    ["2026-10-24", "an empty week inside the season"],
    ["2026-05-23", "a week of the previous season"],
    ["2027-08-14", "a week of the next season"],
  ])("%s, %s → 404", (week) => {
    const old = entry("segunda", 38, "2026-05-23T16:00:00Z", "2025-26");
    expect(weekPage(week, "gl", now, [old, ...index])).toEqual({
      kind: "notFound",
    });
  });

  it("an empty season → 404", () => {
    expect(weekPage("2026-10-03", "gl", now, [])).toEqual({
      kind: "notFound",
    });
  });

  it("without a reader or with a failed read → unavailable, no rows, no arrows", () => {
    expect(weekPage("2026-10-03", "es", now, null)).toEqual({
      kind: "unavailable",
    });
  });
});
