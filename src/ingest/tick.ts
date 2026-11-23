import { OBSERVATION_WINDOW_MINUTES } from "../decide/thresholds.ts";
import {
  HOUR_MS,
  type Instant,
  type MatchId,
  MINUTE_MS,
  Observation,
  type SourceAdapter,
  type SourceConfig,
  type SourceReading,
  shiftInstant,
  type WindowMatch,
} from "../model/index.ts";
import { storeCapture } from "../raw/capture.ts";
import type { RawStore } from "../raw/store.ts";
import { madridDateOf } from "../sources/rfef/explorer.ts";
import {
  RECOVERY_HORIZON_HOURS,
  RECOVERY_POLL_MINUTES,
  SOURCE_ATTEMPT_TIMEOUT_MS,
} from "./constants.ts";
import type { IngestDb, IngestTx, WindowRow } from "./db.ts";
import type { EngineCounts } from "./engine.ts";
import { errorMessage, type PurgeOutcome, purgeRaw } from "./purge.ts";
import { planRecovery } from "./recuperacion-rfef.ts";
import { isDueForPoll, isInExtension } from "./window.ts";

// The counters of a recovery inside an attempt (SPEC-044 CA-5, ADR-025 §5):
// ingest_attempts.details.recuperacion, and AttemptSummary.recovered. An
// attempt without the set has neither.
export type RecoverySummary = {
  partidos: number;
  fechas: number;
  insertadas: number;
  duplicadas: number;
  descartadasLive: number;
};

export type AttemptSummary = {
  sourceId: string;
  season: string;
  attemptId?: string;
  // cadence (RN-08) or a lock held by someone else (SPEC-029 CA-1).
  skipped?: "cadence" | "locked";
  ok: boolean;
  error?: string;
  rawRef?: string;
  matches: number;
  requests: number;
  observations: number;
  unresolved: number;
  skippedItems: number;
  alerts: number;
  // Requests of the capture the adapter could not interpret (SPEC-011 CA-5).
  // An attempt with any of these is ok = false and still saved what the other
  // requests brought: the report of the matchday can then tell an attempt with
  // an incident from a lost one.
  requestErrors: number;
  // Observations of matches outside the window of this tick, dropped before
  // the insert and never seen by the engine (SPEC-038 CA-6, ADR-023 §5): a
  // source that brings the whole day (the export of explorer) only feeds the
  // window. Also in ingest_attempts.details.fueraDeVentana.
  outOfWindow: number;
  // The recovery set this attempt carried (SPEC-044 CA-5), if any.
  recovered?: RecoverySummary;
};

// The counters of the social dispatch (SPEC-066 CA-11, ADR-030 §3). The
// shape of src/social/dispatch.ts SocialCounts, declared here because the
// ingest never imports src/social (CA-12): the route wires both.
export type SocialCounts = {
  sent: number;
  failed: number;
  retried: number;
  expired: number;
  skipped: number;
};

export type TickSummary = {
  now: Instant;
  inWindow: number;
  purge: PurgeOutcome;
  attempts: AttemptSummary[];
  engine?: EngineCounts;
  engineError?: string;
  social?: SocialCounts;
  socialError?: string;
};

// Where the engine plugs in (ADR-008 §6, N-11): inside the same transaction
// as the observations, and never without observations. The third parameter
// (SPEC-044 CA-4, ADR-025 §4) names the matches in recovery among them: the
// engine runs for those at the hour of their observation.
export type AfterInsert = (
  tx: IngestTx,
  observations: Observation[],
  options?: { recovered: ReadonlySet<MatchId> },
) => Promise<void>;

// The second hook of the engine (H-2): once per tick, over every match in
// window and in its own transaction, because RN-05 and the forced finish of
// RN-02 are born of the absence of observations, not of their arrival.
export type EngineSweep = (matches: WindowRow[]) => Promise<EngineCounts>;

// The third hook (SPEC-066 CA-11, ADR-030 §3): the social dispatch, after
// the sweep, outside every transaction of the engine and in every tick,
// window or not. The route wires it; npm run ingest:tick does not.
// What the hook answers: its counters and, when the publisher is named but
// unconfigured (SPEC-067 CA-4), an error for the summary. A thrown error is
// the other way to the same line.
export type SocialOutcome = { counts: SocialCounts; error?: string };

export type SocialDispatch = () => Promise<SocialOutcome>;

export type TickInput = {
  db: IngestDb;
  store: RawStore;
  sources: readonly SourceConfig[];
  adapterFor: (config: SourceConfig, season: string) => SourceAdapter;
  fetch: typeof globalThis.fetch;
  now: Instant;
  afterInsert?: AfterInsert;
  sweep?: EngineSweep;
  social?: SocialDispatch;
  // The deadline of each attempt in ms (SPEC-093 CA-1):
  // SOURCE_ATTEMPT_TIMEOUT_MS unless a test injects a shorter one.
  attemptTimeoutMs?: number;
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
  requestErrors: 0,
  outOfWindow: 0,
});

// The error of an attempt is one line: tick:salud prints it inline and the
// report of the matchday has to explain every not ok row (SPEC-009 CA-7).
const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

// The deadline of an attempt (SPEC-093 CA-1): the core puts it on the fetch
// it hands the adapter, which never reads a clock, and also races it against
// the whole fetch of the adapter, so a body that never ends or a fetch deaf
// to its signal still closes the attempt in time. One deadline for every
// request of the attempt, not one per request.
async function withDeadline<T>(
  sourceId: string,
  ms: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error(
        `${sourceId}: sin respuesta de la fuente en el plazo del intento (${ms} ms)`,
      );
      controller.abort(error);
      reject(error);
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}

const fetchWithSignal =
  (fetch: typeof globalThis.fetch, signal: AbortSignal): typeof fetch =>
  (input, init) =>
    fetch(input, {
      ...init,
      signal:
        init?.signal == null ? signal : AbortSignal.any([init.signal, signal]),
    });

// How old the newest reading of the source is (SPEC-093 CA-4), over the
// matches of the window (never the recovery set) that have kicked off and are
// not closed: only of those must the source be rereading something. Without
// such a match, or without a reading of one, there is no verdict.
type ReadingAge = {
  ultimaLectura: Instant;
  edadLecturaMin: number;
  stale: boolean;
};

function readingAge(
  own: readonly WindowRow[],
  readings: readonly SourceReading[],
  now: Instant,
): ReadingAge | null {
  const started = new Set(
    own
      .filter(
        (m) =>
          Date.parse(m.kickoff) <= Date.parse(now) &&
          (m.status === "scheduled" || m.status === "live"),
      )
      .map((m) => m.id as string),
  );
  let newest: Instant | null = null;
  for (const r of readings)
    if (
      started.has(r.matchId) &&
      (newest === null || Date.parse(r.readAt) > Date.parse(newest))
    )
      newest = r.readAt;
  if (newest === null) return null;
  const age = Date.parse(now) - Date.parse(newest);
  return {
    ultimaLectura: newest,
    edadLecturaMin: Math.floor(age / MINUTE_MS),
    // RN-01 drops what is older than this: past it, the source is stalled.
    stale: age > OBSERVATION_WINDOW_MINUTES * MINUTE_MS,
  };
}

// One tick: retention, window, one attempt per pull source and season, the
// sweep and, last, the social dispatch (SPEC-066 CA-11), which runs whether
// or not anything was in window. Nothing is asked of a provider outside the
// window (RN-08) and the clock is never read here: now arrives from the route
// or the CLI (ADR-008 §7).
export async function runTick(input: TickInput): Promise<TickSummary> {
  const summary = await runIngest(input);
  // Its failure is a line of the summary and of the row (ADR-030 §3), never
  // the tick's: the Decisions are already committed when it starts.
  if (input.social !== undefined) {
    try {
      const outcome = await input.social();
      summary.social = outcome.counts;
      if (outcome.error !== undefined) summary.socialError = outcome.error;
    } catch (e) {
      summary.socialError = errorMessage(e);
    }
  }
  return summary;
}

async function runIngest(input: TickInput): Promise<TickSummary> {
  const { db, store, sources, now, sweep } = input;
  const purge = await purgeRaw({ db, store, now });
  const matches = await db.windowMatches(now);
  const summary: TickSummary = {
    now,
    inWindow: matches.length,
    purge,
    attempts: [],
  };

  // The recovery set of each source with a horizon (ADR-025 §2, §5), when
  // it is its turn: a tick without a window but with something to recover
  // still runs. The sweep never sees these matches.
  const recoverable = new Map<string, WindowRow[]>();
  for (const config of sources) {
    if (config.kind !== "pull") continue;
    const horizon = RECOVERY_HORIZON_HOURS[config.id] ?? 0;
    if (horizon <= 0) continue;
    const last = await db.lastRecoveryAttemptAt(
      config.id,
      shiftInstant(now, -HOUR_MS),
    );
    if (
      last !== null &&
      Date.parse(now) - Date.parse(last) < RECOVERY_POLL_MINUTES * MINUTE_MS
    )
      continue;
    const covered = new Set<string>(config.competitions);
    const own = (await db.recoveryMatches(now, horizon)).filter((m) =>
      covered.has(m.competitionId),
    );
    if (own.length > 0) recoverable.set(config.id, own);
  }
  if (matches.length === 0 && recoverable.size === 0) return summary;

  // The extension of the window is asked for at its own pace (ADR-013 §1,
  // SPEC-018 CA-3): a match there that is not due is left out of every
  // attempt, and a tick with nothing due asks nobody. The sweep still sees
  // every match in window, because RN-05 is born of absence.
  const polled = matches.filter((m) =>
    isDueForPoll(
      { kickoff: m.kickoff, lastObservationAt: m.lastObservationAt ?? null },
      now,
    ),
  );

  const bySeason = new Map<string, WindowRow[]>();
  for (const match of polled) {
    const list = bySeason.get(match.season);
    if (list === undefined) bySeason.set(match.season, [match]);
    else list.push(match);
  }
  const seasons = [...bySeason.keys()].sort();

  // The whole window of the tick, extension included, whether or not every
  // match is due this time: what an observation may be about (CA-6).
  const windowIds = new Set(matches.map((m) => m.id));

  for (const config of sources) {
    if (config.kind !== "pull") continue;
    const covered = new Set<string>(config.competitions);
    // The seasons of this source: its window plus its recovery set.
    const recovering = recoverable.get(config.id) ?? [];
    const ownSeasons = [
      ...new Set([...seasons, ...recovering.map((m) => m.season)]),
    ].sort();
    for (const season of ownSeasons) {
      const own = (bySeason.get(season) ?? []).filter((m) =>
        covered.has(m.competitionId),
      );
      const recovered = recovering.filter((m) => m.season === season);
      if (own.length === 0 && recovered.length === 0) continue;
      try {
        summary.attempts.push(
          await runAttempt(input, config, season, own, windowIds, recovered),
        );
      } catch (e) {
        // A source that falls never touches the others (ADR-003).
        summary.attempts.push({
          ...emptySummary(config.id, season, own.length + recovered.length),
          error: errorMessage(e),
        });
      }
    }
  }

  // After every attempt and outside their transaction: what the sweep writes
  // is born of the absence of observations (H-2). A failure of its own never
  // brings the tick down. It sees the window and only the window (ADR-025
  // §5): nothing in recovery is closed by RN-05 or RN-02.
  if (sweep !== undefined && matches.length > 0) {
    try {
      summary.engine = await sweep(matches);
    } catch (e) {
      summary.engineError = errorMessage(e);
    }
  }
  return summary;
}

async function runAttempt(
  {
    db,
    store,
    adapterFor,
    fetch,
    now,
    afterInsert,
    attemptTimeoutMs = SOURCE_ATTEMPT_TIMEOUT_MS,
  }: TickInput,
  config: SourceConfig,
  season: string,
  own: WindowRow[],
  windowIds: ReadonlySet<string>,
  recovered: WindowRow[],
): Promise<AttemptSummary> {
  const base = emptySummary(config.id, season, own.length + recovered.length);
  const recoveredIds: ReadonlySet<MatchId> = new Set(
    recovered.map((m) => m.id),
  );

  const opened = await db.openAttempt(
    config.id,
    now,
    config.minIntervalSeconds,
  );
  // Cadence (RN-08) or a held lock (SPEC-029 CA-1): the source is skipped
  // and nothing is asked of it.
  if ("skipped" in opened) return { ...base, skipped: opened.skipped };
  const attemptId = opened.id;

  let rawRef: string | undefined;
  let requests = 0;
  try {
    const adapter = adapterFor(config, season);
    const pull = adapter.fetch;
    if (pull === undefined)
      throw new Error(`pull source ${config.id} has no fetch`);

    // A match in the extension never adds its competition to live=: the
    // source does not give it live, and ids= is what brings it (CA-3). Nor
    // does a match in recovery: the window and the recovery set go in one
    // capture (ADR-025 §5).
    const present = new Set(
      own.filter((m) => !isInExtension(m, now)).map((m) => m.competitionId),
    );
    const capture = await withDeadline(config.id, attemptTimeoutMs, (signal) =>
      pull.call(adapter, {
        now,
        competitions: config.competitions.filter((c) => present.has(c)),
        matches: [...own, ...recovered].map(toWindowMatch),
        fetch: fetchWithSignal(fetch, signal),
        userAgent: config.userAgent,
      }),
    );
    requests = capture.requests.length;

    // Raw before parse, in the strong sense (D-6, RN-09, ADR-007 §6).
    const ref = await storeCapture(store, capture, attemptId);
    rawRef = ref;

    const parsed = adapter.parse(capture);
    // Only the window of this tick and its recovery set (SPEC-038 CA-6,
    // ADR-023 §5, ADR-025 §2): the raw capture keeps the whole day, the log
    // of observations does not, and the engine never hears of a match it is
    // not listening to.
    const accepted = parsed.observations.filter(
      (o) => windowIds.has(o.matchId) || recoveredIds.has(o.matchId),
    );
    const outOfWindow = parsed.observations.length - accepted.length;
    // The core owns id, sourceId, receivedAt and rawRef (SPEC-005 N-1);
    // observed_at is the source's clock (RN-11).
    const toObservation = (o: (typeof accepted)[number]) =>
      Observation.parse({
        ...o,
        id: crypto.randomUUID(),
        sourceId: config.id,
        observedAt: o.observedAt ?? capture.capturedAt,
        receivedAt: now,
        rawRef: ref,
      });
    const inWindow = accepted
      .filter((o) => !recoveredIds.has(o.matchId))
      .map(toObservation);
    const inRecovery = accepted
      .filter((o) => recoveredIds.has(o.matchId))
      .map(toObservation);

    const { alerts, recovery } = await db.transaction(async (tx) => {
      // The plan of the recovery (CA-3) is made inside the transaction,
      // against the last observation this source left for each match.
      const plan =
        recovered.length === 0
          ? null
          : planRecovery({
              observations: inRecovery,
              currents: recovered.map((m) => ({
                matchId: m.id,
                decisionId: null,
                status: m.status,
                score: null,
                forcedFinish: m.forcedFinish,
              })),
              lastOwn: await tx.lastOwnObservations(config.id, [
                ...recoveredIds,
              ]),
              inCommonWindow: windowIds,
            });
      const observations = [...inWindow, ...(plan?.insert ?? [])];
      await tx.insertObservations(observations);
      const count = await tx.openUnresolvedAlerts(
        config.id,
        ref,
        parsed.unresolved,
      );
      if (observations.length > 0)
        await afterInsert?.(
          tx,
          observations,
          plan === null ? undefined : { recovered: recoveredIds },
        );
      const summary: RecoverySummary | undefined =
        plan === null
          ? undefined
          : {
              partidos: recovered.length,
              fechas: new Set(recovered.map((m) => madridDateOf(m.kickoff)))
                .size,
              insertadas: plan.insert.length,
              duplicadas: plan.dropped.duplicate,
              descartadasLive: plan.dropped.live,
            };
      return { alerts: count, recovery: summary, inserted: observations };
    });
    const observations = inWindow.length + (recovery?.insertadas ?? 0);

    // A request the adapter could not interpret does not undo the attempt: the
    // observations of the others are already in. It does keep it off green,
    // because an ok = true with a provider error inside would turn
    // ingest_attempts.ok into "the tick did not crash" (N-2). No new AlertKind
    // and no migration: a transport or request-shape failure is not a match
    // state (D-9), and its home is this row (ADR-003).
    const broken = parsed.requestErrors;
    // A source that answers but stopped rereading (SPEC-093 CA-4) is the
    // same kind of failure (N-2, D-9): its observations are in and the engine
    // decided as always, but the row is not ok. Never a state of the match.
    const age = readingAge(own, parsed.readings ?? [], now);
    const stale = age?.stale === true;
    const ok = broken.length === 0 && !stale;
    const errors = [
      ...(broken.length === 0
        ? []
        : [
            `${config.id}: ${broken.length} de ${requests} peticiones con error del proveedor: ${oneLine(broken[0].error)}`,
          ]),
      ...(stale
        ? [
            `${config.id}: fuente estancada: última lectura hace ${age.edadLecturaMin} min`,
          ]
        : []),
    ];
    const error = ok ? undefined : errors.join(" · ");

    const result: AttemptSummary = {
      ...base,
      attemptId,
      ok,
      error,
      rawRef: ref,
      requests,
      observations,
      unresolved: parsed.unresolved.length,
      skippedItems: parsed.skipped.length,
      alerts,
      requestErrors: broken.length,
      outOfWindow,
      ...(recovery === undefined ? {} : { recovered: recovery }),
    };
    await db.closeAttempt(attemptId, {
      finishedAt: now,
      ok,
      error,
      rawRef: ref,
      observations,
      details: {
        season,
        matches: base.matches,
        requests,
        unresolved: result.unresolved,
        skipped: result.skippedItems,
        alerts,
        requestErrors: broken.length,
        fueraDeVentana: outOfWindow,
        ...(recovery === undefined ? {} : { recuperacion: recovery }),
        ...(age === null
          ? {}
          : {
              ultimaLectura: age.ultimaLectura,
              edadLecturaMin: age.edadLecturaMin,
            }),
      },
    });
    return result;
  } catch (e) {
    const error = errorMessage(e);
    // A failed attempt that took the recovery set still counts for the pace
    // of ADR-025 §5 (H-8): with explorer down, the set is asked every five
    // minutes, not every tick. Nothing of it was inserted.
    const recovery: RecoverySummary | undefined =
      recovered.length === 0
        ? undefined
        : {
            partidos: recovered.length,
            fechas: new Set(recovered.map((m) => madridDateOf(m.kickoff))).size,
            insertadas: 0,
            duplicadas: 0,
            descartadasLive: 0,
          };
    await db.closeAttempt(attemptId, {
      finishedAt: now,
      ok: false,
      error,
      rawRef,
      observations: 0,
      details: {
        season,
        matches: base.matches,
        requests,
        ...(recovery === undefined ? {} : { recuperacion: recovery }),
      },
    });
    return { ...base, attemptId, error, rawRef, requests };
  }
}
