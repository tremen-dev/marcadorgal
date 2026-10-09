import { describe, expect, it } from "vitest";
import type { PublicMatch } from "@/model";
import type { XornadaIndexEntry } from "./row";
import { readHome, readWeekPage } from "./week-read";

// SPEC-027 CA-2, CA-3 (N-1): the same two reads as today, index(season) and
// matches(ids), at most once each per render; a failed read is unavailable.

const entry = (round: number, kickoff: string): XornadaIndexEntry =>
  ({
    matchId: `segunda-${round}-${kickoff.slice(5, 10)}`,
    competitionId: "segunda",
    season: "2026-27",
    round,
    kickoff,
    status: "scheduled",
  }) as XornadaIndexEntry;

const index = [
  entry(4, "2026-10-03T16:00:00Z"),
  entry(5, "2026-10-10T16:00:00Z"),
  entry(6, "2026-10-17T16:00:00Z"),
];
const now = "2026-10-10T17:00:00Z";
const match = (id: string) => ({ matchId: id }) as unknown as PublicMatch;

function fakeReader(fail?: "index" | "matches") {
  const calls: unknown[] = [];
  return {
    calls,
    reader: {
      async index(season: string) {
        calls.push(["index", season]);
        if (fail === "index") throw new Error("down");
        return index;
      },
      async matches(ids: readonly string[]) {
        calls.push(["matches", [...ids]]);
        if (fail === "matches") throw new Error("down");
        return ids.map(match);
      },
    },
  };
}

describe("SPEC-027 readHome", () => {
  it("the current xornada and the arrows of the home week, from one index", async () => {
    const { reader, calls } = fakeReader();
    const out = await readHome(reader, now, "es");
    expect(out.matches.map((m) => m.matchId)).toEqual(["segunda-5-10-10"]);
    expect(out.arrows).toEqual({
      previous: "/es/xornada/2026-10-03",
      next: "/es/xornada/2026-10-17",
    });
    expect(calls).toEqual([
      ["index", "2026-27"],
      ["matches", ["segunda-5-10-10"]],
    ]);
  });
});

describe("SPEC-027 readWeekPage", () => {
  it("a week of the season: the rows of weekXornada and the arrows", async () => {
    const { reader, calls } = fakeReader();
    const out = await readWeekPage(reader, "2026-10-17", "gl", now);
    expect(out).toEqual({
      kind: "page",
      matches: [match("segunda-6-10-17")],
      arrows: { previous: "/", next: null },
    });
    expect(calls).toEqual([
      ["index", "2026-27"],
      ["matches", ["segunda-6-10-17"]],
    ]);
  });

  it("the home week and a week outside: decided from the index alone", async () => {
    const { reader, calls } = fakeReader();
    expect(await readWeekPage(reader, "2026-10-10", "gl", now)).toEqual({
      kind: "redirect",
      status: 307,
      location: "/",
    });
    expect(await readWeekPage(reader, "2026-10-24", "gl", now)).toEqual({
      kind: "notFound",
    });
    expect(calls.filter((c) => (c as unknown[])[0] === "matches")).toEqual([]);
  });

  it.each([
    ["no reader", null],
    ["a failed index", fakeReader("index").reader],
    ["failed rows", fakeReader("matches").reader],
  ])("%s → unavailable", async (_, reader) => {
    expect(await readWeekPage(reader, "2026-10-17", "gl", now)).toEqual({
      kind: "unavailable",
    });
  });
});
