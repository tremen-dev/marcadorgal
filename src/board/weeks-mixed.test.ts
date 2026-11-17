import { describe, expect, it } from "vitest";
import { currentXornada } from "./current";
import { MIXED_WEEKS_INDEX as index } from "./fixtures/semana-mixta-2026-11";
import type { XornadaIndexEntry } from "./row";
import { readHome } from "./week-read";
import { weekPage } from "./week-route";
import {
  homeArrows,
  homeWeek,
  homeWeeks,
  type Neighbours,
  neighbourWeeks,
  seasonWeeks,
  weekHref,
  weekXornada,
} from "./weeks";

// SPEC-092: when / mixes weeks (the rounds currentRound chooses per
// competition live in more than one week), the home week H is the only
// covered one (all of its rounds chosen), or none; every week stays
// reachable from /. Over the real calendar of November 2026 (fixture).

const T1 = "2026-11-17T10:00:00Z";
const T2 = "2026-11-14T12:00:00Z";
const T3 = "2026-11-18T16:00:00Z";
const T4 = "2026-11-19T12:00:00Z";

describe("SPEC-092 CA-1 homeWeeks and homeWeek", () => {
  it.each([
    [T1, ["2026-11-14", "2026-11-21"], "2026-11-14"],
    [T2, ["2026-11-07", "2026-11-14"], "2026-11-14"],
    [T3, ["2026-11-14", "2026-11-21"], null],
    [T4, ["2026-11-21"], "2026-11-21"],
  ] as const)("%s → S %o, H %s", (now, weeks, home) => {
    expect(homeWeeks(index, now)).toEqual(weeks);
    expect(homeWeek(index, now)).toBe(home);
  });

  it("an empty index → S [], H null", () => {
    expect(homeWeeks([], T1)).toEqual([]);
    expect(homeWeek([], T1)).toBeNull();
  });
});

describe("SPEC-092 CA-2 homeArrows", () => {
  it.each([
    [T1, "/xornada/2026-11-07", "/xornada/2026-11-21"],
    [T2, "/xornada/2026-11-07", "/xornada/2026-11-21"],
    [T3, "/xornada/2026-11-14", "/xornada/2026-11-21"],
    [T4, "/xornada/2026-11-14", "/xornada/2026-11-28"],
  ] as const)("%s → ‹ %s, › %s (gl and es)", (now, previous, next) => {
    expect(homeArrows(index, now, "gl")).toEqual({ previous, next });
    expect(homeArrows(index, now, "es")).toEqual({
      previous: `/es${previous}`,
      next: `/es${next}`,
    });
  });

  it("an empty index has no arrows", () => {
    expect(homeArrows([], T1, "gl")).toEqual({ previous: null, next: null });
  });

  it("readHome gives the arrows of homeArrows", async () => {
    const reader = {
      async index() {
        return [...index];
      },
      async matches() {
        return [];
      },
    };
    for (const now of [T1, T3])
      expect((await readHome(reader, now, "es")).arrows).toEqual(
        homeArrows(index, now, "es"),
      );
  });
});

// weekPage is pure: memoised so that the walk of CA-4 stays fast.
const pages = new Map<string, ReturnType<typeof weekPage>>();
function page(week: string, now: string): ReturnType<typeof weekPage> {
  const key = `${now} ${week}`;
  const known = pages.get(key);
  if (known !== undefined) return known;
  const out = weekPage(week, "gl", now, index as XornadaIndexEntry[]);
  pages.set(key, out);
  return out;
}

describe("SPEC-092 CA-3 weekPage", () => {
  it("T1: the week of H is 307; the other shown week is a page", () => {
    expect(page("2026-11-14", T1)).toEqual({
      kind: "redirect",
      status: 307,
      location: "/",
    });
    const w21 = page("2026-11-21", T1);
    expect(w21.kind).toBe("page");
    if (w21.kind === "page") {
      expect(w21.arrows).toEqual({
        previous: "/",
        next: "/xornada/2026-11-28",
      });
      expect(w21.matchIds).toEqual(
        weekXornada(index, "2026-11-21").map((e) => e.matchId),
      );
    }
    const w07 = page("2026-11-07", T1);
    expect(w07.kind === "page" && w07.arrows.next).toBe("/");
  });

  it("T3: no H, both shown weeks are pages linked to each other", () => {
    const w14 = page("2026-11-14", T3);
    const w21 = page("2026-11-21", T3);
    expect(w14.kind === "page" && w14.arrows).toEqual({
      previous: "/xornada/2026-11-07",
      next: "/xornada/2026-11-21",
    });
    expect(w21.kind === "page" && w21.arrows).toEqual({
      previous: "/xornada/2026-11-14",
      next: "/xornada/2026-11-28",
    });
  });

  it("T4: the week of H is 307 again", () => {
    expect(page("2026-11-21", T4)).toEqual({
      kind: "redirect",
      status: 307,
      location: "/",
    });
  });

  it("404 outside the weeks of the season, unchanged", () => {
    expect(page("2026-12-12", T1)).toEqual({ kind: "notFound" });
  });
});

// Resolve an href of an arrow into the arrows of what it shows: / is the
// home; a week is its page, or / when it redirects there.
function arrowsOf(href: string, now: string): Neighbours {
  if (href === "/") return homeArrows(index, now, "gl");
  const out = page(href.replace("/xornada/", ""), now);
  if (out.kind === "redirect") return arrowsOf(out.location, now);
  if (out.kind !== "page") throw new Error(`${href}: ${out.kind}`);
  return out.arrows;
}

const START = Date.parse("2026-11-09T00:00:00Z");
const END = Date.parse("2026-11-26T00:00:00Z");
const instants: string[] = [];
for (let t = START; t <= END; t += 15 * 60_000)
  instants.push(new Date(t).toISOString().replace(".000Z", "Z"));

describe("SPEC-092 CA-4 every week reachable (every 15 min, 2026-11-09 → 2026-11-26)", () => {
  const weeks = seasonWeeks(index);

  it.each(instants)("%s", (now) => {
    const shown = homeWeeks(index, now);
    const home = homeWeek(index, now);
    const mixed = shown.length > 1;

    // (a) Following ‹/› from / reaches every week of the fixture.
    const reached = new Set<string>();
    const pending = ["/"];
    const seen = new Set<string>();
    while (pending.length > 0) {
      const href = pending.pop() as string;
      if (seen.has(href)) continue;
      seen.add(href);
      if (href === "/") {
        if (home !== null) reached.add(home);
      } else reached.add(href.replace("/xornada/", ""));
      const { previous, next } = arrowsOf(href, now);
      for (const h of [previous, next]) if (h !== null) pending.push(h);
    }
    expect([...reached].sort()).toEqual(weeks);

    // (b) With a mix, no week with a round / does not paint redirects.
    if (mixed) {
      const painted = new Set(currentXornada(index, now).map((e) => e.matchId));
      for (const w of weeks)
        if (weekXornada(index, w).some((e) => !painted.has(e.matchId)))
          expect(page(w, now).kind).not.toBe("redirect");
    }

    // (c) For every week W ≠ H with a previous one, the next of its
    // previous is W; from /, ‹ then › comes back to / when H exists.
    for (const w of weeks) {
      if (w === home) continue;
      const { previous } = neighbourWeeks(weeks, w);
      if (previous === null) continue;
      expect(arrowsOf(weekHref(previous, home, "gl"), now).next).toBe(
        weekHref(w, home, "gl"),
      );
    }
    if (home !== null) {
      const back = homeArrows(index, now, "gl").previous;
      if (back !== null) expect(arrowsOf(back, now).next).toBe("/");
    }

    // (d) Without a mix, the formulas of SPEC-027 CA-2.
    if (!mixed && shown.length === 1) {
      const max = shown[0];
      expect(home).toBe(max);
      const { previous, next } = neighbourWeeks(weeks, max);
      expect(homeArrows(index, now, "gl")).toEqual({
        previous: previous === null ? null : weekHref(previous, max, "gl"),
        next: next === null ? null : weekHref(next, max, "gl"),
      });
    }
  });

  it("the mix lasts from Wednesday to Thursday 02:30Z (N-2)", () => {
    expect(homeWeeks(index, "2026-11-19T02:15:00Z").length).toBe(2);
    expect(homeWeeks(index, "2026-11-19T02:30:00Z").length).toBe(1);
  });
});
