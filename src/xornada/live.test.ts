import { describe, expect, it } from "vitest";
import type { PublicMatch } from "@/model";
import {
  applyBoard,
  applyDelta,
  boardMatches,
  initialBoard,
  UNKNOWN_REQUEST_MS,
} from "./live";
import { xornadaDays } from "./view";

// SPEC-024 CA-4 (H-1, H-7): the pure state of the screen in the client.

const NOW = "2026-10-10T17:00:00.000Z";
const T0 = Date.parse(NOW);

function match(
  id: string,
  version: number,
  extra: Partial<PublicMatch> = {},
): PublicMatch {
  return {
    matchId: id,
    competitionId: "primera-division",
    competitionName: "Primeira División",
    tier: 1,
    round: 9,
    kickoff: "2026-10-10T16:00:00.000Z",
    home: { name: "Home", shortName: null },
    away: { name: "Away", shortName: null },
    status: "live",
    score: { home: version, away: 0 },
    minute: 50,
    addedMinute: null,
    halfTime: false,
    qualifier: "confirmado",
    version,
    observedAt: "2026-10-10T16:55:00.000Z",
    decidedAt: "2026-10-10T16:55:05.000Z",
    ...extra,
  } as PublicMatch;
}

const board = (...matches: PublicMatch[]) =>
  initialBoard(matches, xornadaDays(matches, NOW));

describe("SPEC-024 CA-4 applyDelta", () => {
  const a2 = match("a", 2);
  const start = board(a2, match("b", 1));

  it.each([
    ["equal version", match("a", 2, { score: { home: 9, away: 9 } })],
    [
      "lower version",
      match("a", 1, {
        status: "finished",
        minute: null,
      } as Partial<PublicMatch>),
    ],
  ])("%s: nothing changes, nothing is asked", (_n, delta) => {
    const out = applyDelta(start, delta, T0);
    expect(out.board).toBe(start);
    expect(out.request).toBe(false);
  });

  it("higher version: replaces the painted match, asks nothing", () => {
    const a3 = match("a", 3, { score: { home: 3, away: 1 } });
    const out = applyDelta(start, a3, T0);
    expect(out.request).toBe(false);
    expect(boardMatches(out.board).find((m) => m.matchId === "a")).toEqual(a3);
    expect(boardMatches(out.board)).toHaveLength(2);
    // The days are not recalculated by a delta.
    expect(out.board.days).toBe(start.days);
  });

  it("unknown matchId: not painted, asks /api/board", () => {
    const out = applyDelta(start, match("z", 1), T0);
    expect(out.request).toBe(true);
    expect(boardMatches(out.board).map((m) => m.matchId)).toEqual(["a", "b"]);
  });

  it("unknown matchIds ask at most once every 30 s", () => {
    const first = applyDelta(start, match("z", 1), T0);
    const second = applyDelta(first.board, match("y", 1), T0 + 10_000);
    expect(second.request).toBe(false);
    const third = applyDelta(
      second.board,
      match("y", 1),
      T0 + UNKNOWN_REQUEST_MS,
    );
    expect(third.request).toBe(true);
    expect(UNKNOWN_REQUEST_MS).toBe(30_000);
  });
});

describe("SPEC-024 CA-4 applyBoard (a 200 of /api/board)", () => {
  it("adds and removes matches by its list, and only then recalculates the days", () => {
    const start = board(match("a", 1), match("b", 1));
    const c = match("c", 1, { kickoff: "2026-10-11T16:00:00.000Z" });
    const out = applyBoard(start, [match("a", 1), c], NOW);
    expect(boardMatches(out).map((m) => m.matchId)).toEqual(["a", "c"]);
    expect(out.days.map((d) => d.date)).toEqual(["2026-10-10", "2026-10-11"]);
  });

  it("a higher version in the list replaces; a lower one never undoes a delta", () => {
    const start = board(match("a", 3), match("b", 1));
    const out = applyBoard(start, [match("a", 2), match("b", 4)], NOW);
    const byId = new Map<string, PublicMatch>(
      boardMatches(out).map((m) => [m.matchId, m]),
    );
    expect(byId.get("a")?.version).toBe(3);
    expect(byId.get("b")?.version).toBe(4);
  });
});
