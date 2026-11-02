import type { Instant } from "@/model";

// SPEC-041: the number of the side that scored a little while ago pulses.
// Pure: the clock comes as a parameter (the server's at render, the
// browser's after it, H-5); the window and the variant come from the web's
// configuration (src/app/config.ts), never from here.

// H-4: a neutral box around the number, or a «GOL» pill next to it.
export const RECENT_GOAL_MARKS = ["box", "label"] as const;
export type RecentGoalMark = (typeof RECENT_GOAL_MARKS)[number];

// Per side, the instant its goal stops being recent, or null.
export type RecentGoals = { home: Instant | null; away: Instant | null };

type Scored = { homeScoredAt: Instant | null; awayScoredAt: Instant | null };

const MINUTE_MS = 60_000;

// Recent while now < scoredAt + minutes; a scoredAt ahead of the clock (a
// browser behind) is recent too.
function until(
  scoredAt: Instant | null,
  now: number,
  minutes: number,
): Instant | null {
  if (scoredAt === null) return null;
  const end = Date.parse(scoredAt) + minutes * MINUTE_MS;
  return now < end ? new Date(end).toISOString() : null;
}

export function recentGoals(
  row: Scored,
  now: number,
  minutes: number,
): RecentGoals {
  return {
    home: until(row.homeScoredAt, now, minutes),
    away: until(row.awayScoredAt, now, minutes),
  };
}

// Whether a mark that ends at `until` still shows at `now`.
export const isRecent = (until: Instant, now: number): boolean =>
  now < Date.parse(until);

// CA-4: one 1 s pulse per second left (rounded up), so the animation stops
// on its own at the end of the window, also without JavaScript.
export function pulseIterations(until: Instant, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(until) - now) / 1000));
}

// The browser's clock and timers, given so the watch is testable.
export type RecentGoalClock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
};

// CA-5 (H-5): reads the browser's clock at once (the render's may be
// another's) and once more when the mark ends, without the network; a timer
// fired early arms another for what is left. Returns the stop.
export function watchRecentGoal(
  until: Instant,
  clock: RecentGoalClock,
  onNow: (now: number) => void,
): () => void {
  const end = Date.parse(until);
  let timer: unknown;
  let armed = false;
  const arm = () => {
    const now = clock.now();
    onNow(now);
    armed = now < end;
    if (armed) timer = clock.setTimeout(arm, end - now);
  };
  arm();
  return () => {
    if (armed) clock.clearTimeout(timer);
    armed = false;
  };
}
