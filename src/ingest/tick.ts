import {
  type Instant,
  Observation,
  type SourceAdapter,
  type SourceConfig,
  type WindowMatch,
} from "../model/index.ts";
import { storeCapture } from "../raw/capture.ts";
import type { RawStore } from "../raw/store.ts";
import type { IngestDb, IngestTx, WindowRow } from "./db.ts";
import type { EngineCounts } from "./engine.ts";
import { errorMessage, type PurgeOutcome, purgeRaw } from "./purge.ts";

export type AttemptSummary = {
  sourceId: string;
  season: string;
  attemptId?: string;
  skipped?: "cadence";
  ok: boolean;
  error?: string;
  rawRef?: string;
  matches: number;
  requests: number;
  observations: number;
  unresolved: number;
  skippedItems: number;
  alerts: number;
};

export type TickSummary = {
  now: Instant;
  inWindow: number;
  purge: PurgeOutcome;
  attempts: AttemptSummary[];
  engine?: EngineCounts;
  engineError?: string;
};

// Where the engine plugs in (ADR-008 §6, N-11): inside the same transaction
// as the observations, and never without observations.
export type AfterInsert = (
  tx: IngestTx,
  observations: Observation[],
) => Promise<void>;

// The second hook of the engine (H-2): once per tick, over every match in
// window and in its own transaction, because RN-05 and the forced finish of
// RN-02 are born of the absence of observations, not of their arrival.
export type EngineSweep = (matches: WindowRow[]) => Promise<EngineCounts>;

export type TickInput = {
  db: IngestDb;
  store: RawStore;
  sources: readonly SourceConfig[];
  adapterFor: (config: SourceConfig, season: string) => SourceAdapter;
  fetch: typeof globalThis.fetch;
  now: Instant;
  afterInsert?: AfterInsert;
  sweep?: EngineSweep;
};

const toWindowMatch = ({
  id,
  competitionId,
  season,
  kickoff,
  homeTeamId,
  awayTeamId,
}: WindowRow): WindowMatch => ({
  id,
  competitionId,
  season,
  kickoff,
  homeTeamId,
  awayTeamId,
});

const emptySummary = (
  sourceId: string,
  season: string,
  matches: number,
): AttemptSummary => ({
  sourceId,
  season,
  ok: false,
  matches,
  requests: 0,
  observations: 0,
  unresolved: 0,
  skippedItems: 0,
  alerts: 0,
});

// One tick: retention, window, and one attempt per pull source and season.
// Nothing is asked of a provider outside the window (RN-08) and the clock is
// never read here: now arrives from the route or the CLI (ADR-008 §7).
export async function runTick(input: TickInput): Promise<TickSummary> {
  const { db, store, sources, now, sweep } = input;
  const purge = await purgeRaw({ db, store, now });
  const matches = await db.windowMatches(now);
  const summary: TickSummary = {
    now,
    inWindow: matches.length,
    purge,
    attempts: [],
  };
  if (matches.length === 0) return summary;

  const bySeason = new Map<string, WindowRow[]>();
  for (const match of matches) {
    const list = bySeason.get(match.season);
    if (list === undefined) bySeason.set(match.season, [match]);
    else list.push(match);
  }
  const seasons = [...bySeason.keys()].sort();

  for (const config of sources) {
    if (config.kind !== "pull") continue;
    const covered = new Set<string>(config.competitions);
    for (const season of seasons) {
      const own = (bySeason.get(season) ?? []).filter((m) =>
        covered.has(m.competitionId),
      );
      if (own.length === 0) continue;
      try {
        summary.attempts.push(await runAttempt(input, config, season, own));
      } catch (e) {
        // A source that falls never touches the others (ADR-003).
        summary.attempts.push({
          ...emptySummary(config.id, season, own.length),
          error: errorMessage(e),
        });
      }
    }
  }

  // After every attempt and outside their transaction: what the sweep writes
  // is born of the absence of observations (H-2). A failure of its own never
  // brings the tick down.
  if (sweep !== undefined) {
    try {
      summary.engine = await sweep(matches);
    } catch (e) {
      summary.engineError = errorMessage(e);
    }
  }
  return summary;
}

async function runAttempt(
  { db, store, adapterFor, fetch, now, afterInsert }: TickInput,
  config: SourceConfig,
  season: string,
  own: WindowRow[],
): Promise<AttemptSummary> {
  const base = emptySummary(config.id, season, own.length);

  const opened = await db.openAttempt(
    config.id,
    now,
    config.minIntervalSeconds,
  );
  // Cadence (RN-08): the source is skipped and nothing is asked of it.
  if ("skipped" in opened) return { ...base, skipped: "cadence" };
  const attemptId = opened.id;

  let rawRef: string | undefined;
  let requests = 0;
  try {
    const adapter = adapterFor(config, season);
    const pull = adapter.fetch;
    if (pull === undefined)
      throw new Error(`pull source ${config.id} has no fetch`);

    const present = new Set(own.map((m) => m.competitionId));
    const capture = await pull.call(adapter, {
      now,
      competitions: config.competitions.filter((c) => present.has(c)),
      matches: own.map(toWindowMatch),
      fetch,
      userAgent: config.userAgent,
    });
    requests = capture.requests.length;

    // Raw before parse, in the strong sense (D-6, RN-09, ADR-007 §6).
    const ref = await storeCapture(store, capture, attemptId);
    rawRef = ref;

    const parsed = adapter.parse(capture);
    // The core owns id, sourceId, receivedAt and rawRef (SPEC-005 N-1);
    // observed_at is the source's clock (RN-11).
    const observations = parsed.observations.map((o) =>
      Observation.parse({
        ...o,
        id: crypto.randomUUID(),
        sourceId: config.id,
        observedAt: o.observedAt ?? capture.capturedAt,
        receivedAt: now,
        rawRef: ref,
      }),
    );

    const alerts = await db.transaction(async (tx) => {
      await tx.insertObservations(observations);
      const count = await tx.openUnresolvedAlerts(
        config.id,
        ref,
        parsed.unresolved,
      );
      if (observations.length > 0) await afterInsert?.(tx, observations);
      return count;
    });

    const result: AttemptSummary = {
      ...base,
      attemptId,
      ok: true,
      rawRef: ref,
      requests,
      observations: observations.length,
      unresolved: parsed.unresolved.length,
      skippedItems: parsed.skipped.length,
      alerts,
    };
    await db.closeAttempt(attemptId, {
      finishedAt: now,
      ok: true,
      rawRef: ref,
      observations: observations.length,
      details: {
        season,
        matches: base.matches,
        requests,
        unresolved: result.unresolved,
        skipped: result.skippedItems,
        alerts,
      },
    });
    return result;
  } catch (e) {
    const error = errorMessage(e);
    await db.closeAttempt(attemptId, {
      finishedAt: now,
      ok: false,
      error,
      rawRef,
      observations: 0,
      details: { season, matches: base.matches, requests },
    });
    return { ...base, attemptId, error, rawRef, requests };
  }
}
