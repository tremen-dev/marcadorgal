import { describe, expect, it } from "vitest";
import {
  isRecent,
  pulseIterations,
  RECENT_GOAL_MARKS,
  recentGoals,
  watchRecentGoal,
} from "./recent-goal";

// SPEC-041 CA-3 (H-5): a side's goal is recent while now < scoredAt + N
// minutes, with the clock it is given (the server's at render, the
// browser's after). The answer is the instant it stops being recent.
const AT = "2026-10-03T17:00:00.000Z";
const at = Date.parse(AT);
const S = 1000;
const MIN = 60 * S;

const row = (
  homeScoredAt: string | null,
  awayScoredAt: string | null = null,
) => ({ homeScoredAt, awayScoredAt });

describe("SPEC-041 CA-3 recentGoals", () => {
  it.each([
    ["no goal (null)", row(null), at, 5, { home: null, away: null }],
    [
      "just scored",
      row(AT),
      at,
      5,
      { home: "2026-10-03T17:05:00.000Z", away: null },
    ],
    [
      "N − 1 s",
      row(AT),
      at + 5 * MIN - S,
      5,
      { home: "2026-10-03T17:05:00.000Z", away: null },
    ],
    [
      "exactly N: no longer",
      row(AT),
      at + 5 * MIN,
      5,
      { home: null, away: null },
    ],
    ["past N", row(AT), at + 6 * MIN, 5, { home: null, away: null }],
    [
      "scoredAt in the future (browser behind): recent",
      row(AT),
      at - 2 * MIN,
      5,
      { home: "2026-10-03T17:05:00.000Z", away: null },
    ],
    [
      "another N (3): 3 min is no longer",
      row(AT),
      at + 3 * MIN,
      3,
      { home: null, away: null },
    ],
    [
      "another N (10): 6 min still is",
      row(AT),
      at + 6 * MIN,
      10,
      { home: "2026-10-03T17:10:00.000Z", away: null },
    ],
    [
      "the away side alone",
      row(null, AT),
      at + MIN,
      5,
      { home: null, away: "2026-10-03T17:05:00.000Z" },
    ],
    [
      "both sides, each with its own end",
      row("2026-10-03T16:58:00.000Z", AT),
      at + 2 * MIN + 30 * S,
      5,
      { home: "2026-10-03T17:03:00.000Z", away: "2026-10-03T17:05:00.000Z" },
    ],
    [
      "both sides, one already over",
      row("2026-10-03T16:54:00.000Z", AT),
      at + MIN,
      5,
      { home: null, away: "2026-10-03T17:05:00.000Z" },
    ],
  ] as const)("%s", (_name, r, now, minutes, expected) => {
    expect(recentGoals(r, now, minutes)).toEqual(expected);
  });

  it("the two variants of H-4", () => {
    expect(RECENT_GOAL_MARKS).toEqual(["box", "label"]);
  });
});

// SPEC-041 CA-4: one 1 s pulse per second left, so the CSS stops at the end
// also without JS.
describe("SPEC-041 CA-4 pulseIterations", () => {
  it.each([
    [5 * MIN, 300],
    [5 * MIN - 1, 300],
    [1500, 2],
    [1000, 1],
    [1, 1],
    [0, 0],
    [-S, 0],
  ])("%d ms left: %d pulses", (left, n) => {
    expect(pulseIterations(new Date(at + left).toISOString(), at)).toBe(n);
  });
});

// SPEC-041 CA-5: the browser's clock decides after the render, and one timer
// fires at the end of the window, without the network. A double clock.
function fakeClock(start: number) {
  let now = start;
  let timers: { id: number; at: number; fn: () => void }[] = [];
  let seq = 0;
  return {
    now: () => now,
    setTimeout: (fn: () => void, ms: number) => {
      seq += 1;
      timers.push({ id: seq, at: now + ms, fn });
      return seq;
    },
    clearTimeout: (id: unknown) => {
      timers = timers.filter((t) => t.id !== id);
    },
    pending: () => timers.length,
    // Moves the clock, firing what falls due in order.
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = [...timers].sort((a, b) => a.at - b.at)[0];
        if (next === undefined || next.at > end) break;
        timers = timers.filter((t) => t !== next);
        now = next.at;
        next.fn();
      }
      now = end;
    },
    // A timer the browser fires too early.
    fireEarly(ms: number) {
      const [next] = timers;
      timers = timers.filter((t) => t !== next);
      now += ms;
      next.fn();
    },
  };
}

describe("SPEC-041 CA-5 watchRecentGoal", () => {
  const until = new Date(at + 5 * MIN).toISOString();

  it("reads the browser clock at once, then once more at the end", () => {
    const clock = fakeClock(at + MIN);
    const seen: number[] = [];
    watchRecentGoal(until, clock, (now) => seen.push(now));
    expect(seen).toEqual([at + MIN]);
    expect(clock.pending()).toBe(1);
    clock.advance(4 * MIN - S);
    expect(seen).toEqual([at + MIN]);
    clock.advance(S);
    expect(seen).toEqual([at + MIN, at + 5 * MIN]);
    expect(isRecent(until, seen[1])).toBe(false);
    expect(clock.pending()).toBe(0);
  });

  it("already over in the browser: one reading, no timer", () => {
    const clock = fakeClock(at + 6 * MIN);
    const seen: number[] = [];
    watchRecentGoal(until, clock, (now) => seen.push(now));
    expect(seen).toEqual([at + 6 * MIN]);
    expect(isRecent(until, seen[0])).toBe(false);
    expect(clock.pending()).toBe(0);
  });

  it("a timer fired early arms another for what is left", () => {
    const clock = fakeClock(at);
    const seen: number[] = [];
    watchRecentGoal(until, clock, (now) => seen.push(now));
    clock.fireEarly(5 * MIN - 300);
    expect(isRecent(until, seen[1])).toBe(true);
    expect(clock.pending()).toBe(1);
    clock.advance(300);
    expect(isRecent(until, seen.at(-1) ?? 0)).toBe(false);
  });

  it("stopping it clears the timer", () => {
    const clock = fakeClock(at);
    const stop = watchRecentGoal(until, clock, () => {});
    stop();
    expect(clock.pending()).toBe(0);
  });
});
