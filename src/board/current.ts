import { currentRound } from "../calendar/current-round.ts";
import type { Instant, PublicMatch } from "../model/index.ts";
import type { XornadaIndexEntry } from "./row.ts";

// «La xornada actual» (SPEC-020 CA-5, H-1, H-2). Pure: no clock, no db. It
// does not exist as one set across competitions (ADR-014 §5), so it is chosen
// per competition: the round of currentRound (median kickoff closest to now,
// lower on a tie, as calendario:xornada) plus the live matches of other
// rounds of that competition (a postponed match played midweek).

// Seasons start in summer: before July the season began the previous year
// (the rule of calendario:xornada).
export function seasonOf(now: Instant): string {
  const d = new Date(now);
  const start =
    d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function currentXornada<T extends XornadaIndexEntry>(
  index: readonly T[],
  now: Instant,
): T[] {
  const season = seasonOf(now);
  const byCompetition = new Map<string, T[]>();
  for (const e of index) {
    if (e.season !== season) continue;
    const group = byCompetition.get(e.competitionId) ?? [];
    group.push(e);
    byCompetition.set(e.competitionId, group);
  }
  const round = new Map<string, number | null>();
  for (const [competition, group] of byCompetition)
    round.set(competition, currentRound(group, now));
  return index.filter(
    (e) =>
      e.season === season &&
      (e.round === round.get(e.competitionId) || e.status === "live"),
  );
}

// The reader is passed in (SPEC-020 CA-7): the index of the season of now,
// the selection, and then the full rows of the selected matches only.
export async function readCurrentXornada(
  reader: {
    index(season: string): Promise<XornadaIndexEntry[]>;
    matches(ids: readonly string[]): Promise<PublicMatch[]>;
  },
  now: Instant,
): Promise<PublicMatch[]> {
  const index = await reader.index(seasonOf(now));
  return reader.matches(currentXornada(index, now).map((e) => e.matchId));
}
