import type { MatchStatus, SourceConfig } from "../model/index.ts";

// ADR-027 §1-§2 (SPEC-048): the frontier ingest -> engine. In a competition
// listed in liveObservedOnly of a source, the live observations of that
// source are stored as always but never reach the engine: they do not win
// RN-01, do not confirm and are not "heard" for RN-05 nor for lastHeard.
// Every other status enters as today, and so does everything of a source
// that is not in the registry (the operator). Pure: no clock, no network, no
// database; src/decide/ does not know any of this.

type Observed = { sourceId: string; status: MatchStatus };

export function admittedByEngine(
  sources: readonly SourceConfig[],
  competitionId: string,
): (observation: Observed) => boolean {
  const observedOnly = new Set<string>();
  for (const source of sources)
    if (source.liveObservedOnly.some((c) => c === competitionId))
      observedOnly.add(source.id);
  return (o) => o.status !== "live" || !observedOnly.has(o.sourceId);
}

export function forEngine<T extends Observed>(
  sources: readonly SourceConfig[],
  competitionId: string,
  observations: readonly T[],
): T[] {
  return observations.filter(admittedByEngine(sources, competitionId));
}
