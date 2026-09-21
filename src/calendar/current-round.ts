import type { Instant, Match } from "../model/index.ts";

// Median kickoff per round (mean of the two central ones when even); the
// current round is the one whose median is closest to now, lower round on a
// tie; null for an empty calendar (SPEC-004 N-5).
export function currentRound(
  matches: Pick<Match, "round" | "kickoff">[],
  now: Instant,
): number | null {
  const byRound = new Map<number, number[]>();
  for (const m of matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(Date.parse(m.kickoff));
    byRound.set(m.round, list);
  }
  const at = Date.parse(now);
  let best: { round: number; distance: number } | null = null;
  for (const [round, kickoffs] of byRound) {
    const distance = Math.abs(median(kickoffs) - at);
    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && round < best.round)
    )
      best = { round, distance };
  }
  return best?.round ?? null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
