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
