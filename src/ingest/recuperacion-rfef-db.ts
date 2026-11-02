import type { Sql, TransactionSql } from "postgres";
import {
  DAY_MS,
  type Instant,
  type MatchStatus,
  Observation,
  type SourceAdapter,
  type SourceConfig,
  shiftInstant,
} from "../model/index.ts";
import { storeCapture } from "../raw/capture.ts";
import type { RawStore } from "../raw/store.ts";
import { madridDateOf } from "../sources/rfef/explorer.ts";
import type { Details, IngestDb } from "./db.ts";
import { decideRecovered, type EngineCounts, openAlert } from "./engine.ts";
import { errorMessage } from "./purge.ts";
import {
  planLines,
  planRecovery,
  type RecoveryCurrent,
  type RecoveryPlan,
} from "./recuperacion-rfef.ts";
import { isInWindow } from "./window.ts";

// SPEC-044 CA-6 (ADR-025 §6), the database half of npm run rfef:recuperar:
// the declared matches of a range of Europe/Madrid dates, one attempt of
// the rfef under its cadence, one capture with one GET per date (only
// explorer: the adapter knows no other host), raw before parse (RN-09), and
// —without --dry-run— the plan of CA-3 applied in one transaction: the
// observations inserted, the engine at the hour of the observation (CA-4)
// and one conflict alert per closed match that disagrees (H-7). Nothing
// here writes a Decision by hand (D-5, ADR-019 §2).

export const RECOVERY_TOOL = "rfef:recuperar";

// A declared match of the range as the board has it, with what the window
// and the plan need of its current Decision.
export type RecoveryCandidate = RecoveryCurrent & {
  competitionId: string;
  season: string;
  kickoff: Instant;
  homeTeamId: string;
  awayTeamId: string;
  decidedAt: Instant | null;
};

type CandidateRow = {
  match_id: string;
  competition_id: string;
  season: string;
  kickoff: Date;
  home_team_id: string;
  away_team_id: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  decision_id: string | null;
  forced_finish: boolean | null;
  decided_at: Date | null;
};

const instant = (value: Date): Instant => value.toISOString();

// The matches whose kickoff falls on a Europe/Madrid date of [desde, hasta]:
// the query takes a day of margin on each side in UTC and madridDateOf
// decides, as the adapter does when it asks (ADR-023 §4).
export async function recoveryCandidates(
  sql: Sql | TransactionSql,
  desde: string,
  hasta: string,
): Promise<RecoveryCandidate[]> {
  const from = shiftInstant(`${desde}T00:00:00.000Z`, -DAY_MS);
  const to = shiftInstant(`${hasta}T00:00:00.000Z`, 2 * DAY_MS);
  const rows = await sql<CandidateRow[]>`
    select b.match_id, b.competition_id, b.season, b.kickoff, b.home_team_id,
      b.away_team_id, b.status, b.home_score, b.away_score, b.decision_id,
      d.forced_finish, d.decided_at
    from board b left join decisions d on d.id = b.decision_id
    where b.kickoff >= ${from} and b.kickoff < ${to}
    order by b.kickoff, b.match_id`;
  return rows
    .filter((r) => {
      const day = madridDateOf(instant(r.kickoff));
      return day >= desde && day <= hasta;
    })
    .map((r) => ({
      matchId: r.match_id,
      competitionId: r.competition_id,
      season: r.season,
      kickoff: instant(r.kickoff),
      homeTeamId: r.home_team_id,
      awayTeamId: r.away_team_id,
      status: r.status,
      score:
        r.home_score === null || r.away_score === null
          ? null
          : { home: r.home_score, away: r.away_score },
      decisionId: r.decision_id,
      forcedFinish: r.forced_finish,
      decidedAt: r.decided_at === null ? null : instant(r.decided_at),
    }));
}

// The counts the tool prints before and after (CA-6): what the run may
// change, and the attempts of the rfef, which it always adds one to.
export type RecoveryCounts = {
  decisions: number;
  observationsRfef: number;
  alerts: number;
  attemptsRfef: number;
};

export async function recoveryCounts(
  sql: Sql | TransactionSql,
): Promise<RecoveryCounts> {
  const [row] = await sql<
    {
      decisions: number;
      observations_rfef: number;
      alerts: number;
      attempts_rfef: number;
    }[]
  >`select
      (select count(*)::int from decisions) as decisions,
      (select count(*)::int from observations where source_id = 'rfef') as observations_rfef,
      (select count(*)::int from alerts) as alerts,
      (select count(*)::int from ingest_attempts where source_id = 'rfef') as attempts_rfef`;
  return {
    decisions: row.decisions,
    observationsRfef: row.observations_rfef,
    alerts: row.alerts,
    attemptsRfef: row.attempts_rfef,
  };
}

export type RecuperarOptions = {
  sql: Sql | TransactionSql;
  db: IngestDb;
  store: RawStore;
  adapterFor: (config: SourceConfig, season: string) => SourceAdapter;
  config: SourceConfig;
  sources: readonly SourceConfig[];
  fetch: typeof globalThis.fetch;
  // The clock is the shell's (ADR-008 §7): read when the attempt is opened
  // and again on every retry of the cadence.
  clock: () => Instant;
  desde: string;
  hasta: string;
  dryRun: boolean;
  // The wait between retries of the cadence, injectable for the tests.
  sleep?: (ms: number) => Promise<void>;
  retryMs?: number;
  deadlineMs?: number;
};

export type RecuperarResult =
  | { outcome: "sin-partidos"; candidates: RecoveryCandidate[] }
  | { outcome: "ocupado"; candidates: RecoveryCandidate[]; waitedMs: number }
  | {
      outcome: "en-seco" | "aplicado";
      candidates: RecoveryCandidate[];
      attemptId: string;
      rawRef: string;
      requests: number;
      plan: RecoveryPlan;
      lines: string[];
      fueraDeRango: number;
      before: RecoveryCounts;
      after: RecoveryCounts;
      decided: EngineCounts | null;
      alertsOpened: number;
    };

// Retried every five seconds up to a minute and a half: a tick fires every
// 30 s and holds the cadence of the rfef for 25 s of them (ADR-008 §3).
const RETRY_MS = 5_000;
const DEADLINE_MS = 90_000;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function recuperarRfef(
  options: RecuperarOptions,
): Promise<RecuperarResult> {
  const {
    sql,
    db,
    store,
    adapterFor,
    config,
    sources,
    fetch,
    clock,
    desde,
    hasta,
    dryRun,
    sleep = defaultSleep,
    retryMs = RETRY_MS,
    deadlineMs = DEADLINE_MS,
  } = options;

  const candidates = await recoveryCandidates(sql, desde, hasta);
  if (candidates.length === 0) return { outcome: "sin-partidos", candidates };
  const seasons = [...new Set(candidates.map((c) => c.season))];
  if (seasons.length !== 1)
    throw new Error(`el rango cruza temporadas: ${seasons.join(", ")}`);
  const season = seasons[0];
  const before = await recoveryCounts(sql);

  // One attempt, under the cadence of the registry (RN-08): if the tick
  // holds it, wait for a gap; with none before the deadline, ask nothing.
  let now = clock();
  let waited = 0;
  let opened = await db.openAttempt(config.id, now, config.minIntervalSeconds);
  while ("skipped" in opened) {
    if (waited >= deadlineMs)
      return { outcome: "ocupado", candidates, waitedMs: waited };
    await sleep(retryMs);
    waited += retryMs;
    now = clock();
    opened = await db.openAttempt(config.id, now, config.minIntervalSeconds);
  }
  const attemptId = opened.id;

  const candidateIds = new Set(candidates.map((c) => c.matchId));
  // A match in the common window at now is the tick's (ADR-025 §2).
  const inCommonWindow = new Set(
    candidates
      .filter((c) =>
        isInWindow(
          {
            kickoff: c.kickoff,
            status: c.status,
            forcedFinish: c.forcedFinish,
            decidedAt: c.decidedAt,
          },
          now,
        ),
      )
      .map((c) => c.matchId),
  );
  const fechas = new Set(candidates.map((c) => madridDateOf(c.kickoff))).size;
  const toolDetails = { herramienta: RECOVERY_TOOL, desde, hasta, dryRun };

  let rawRef: string | undefined;
  try {
    const adapter = adapterFor(config, season);
    const pull = adapter.fetch;
    if (pull === undefined)
      throw new Error(`pull source ${config.id} has no fetch`);
    // One capture, one GET per date with matches: the adapter asks by the
    // Europe/Madrid dates of the kickoffs it receives (SPEC-038 CA-2).
    const capture = await pull.call(adapter, {
      now,
      competitions: [],
      matches: candidates.map((c) => ({
        id: c.matchId,
        competitionId: c.competitionId,
        season: c.season,
        kickoff: c.kickoff,
        homeTeamId: c.homeTeamId,
        awayTeamId: c.awayTeamId,
      })) as never,
      fetch,
      userAgent: config.userAgent,
    });
    // Raw before parse, in the strong sense (D-6, RN-09, ADR-007 §6).
    rawRef = await storeCapture(store, capture, attemptId);
    const ref = rawRef;
    const parsed = adapter.parse(capture);

    // Only the matches of the range: the export brings the whole day.
    const own = parsed.observations.filter((o) => candidateIds.has(o.matchId));
    const fueraDeRango = parsed.observations.length - own.length;
    const observations = own.map((o) =>
      Observation.parse({
        ...o,
        id: crypto.randomUUID(),
        sourceId: config.id,
        observedAt: o.observedAt ?? capture.capturedAt,
        receivedAt: now,
        rawRef: ref,
      }),
    );

    // The plan (CA-3) against the last observation the rfef left for each
    // match, and —applied— the insert, the engine (CA-4) and the alerts, in
    // the same transaction: all of it or none.
    const applied = await db.transaction(async (tx) => {
      const lastOwn = await tx.lastOwnObservations(config.id, [
        ...candidateIds,
      ]);
      const plan = planRecovery({
        observations,
        currents: candidates,
        lastOwn,
        inCommonWindow,
      });
      if (dryRun) return { plan, decided: null, alertsOpened: 0 };
      await tx.insertObservations(plan.insert);
      const grouped = new Set(plan.groups.flatMap((g) => g.matchIds));
      const decided = await decideRecovered(
        tx,
        plan.insert.filter((o) => grouped.has(o.matchId)),
        sources,
      );
      let alertsOpened = 0;
      for (const closed of plan.closed)
        if (closed.alert !== undefined)
          alertsOpened += await openAlert(tx.sql, closed.alert);
      return { plan, decided, alertsOpened };
    });
    const { plan, decided, alertsOpened } = applied;
    const inserted = dryRun ? 0 : plan.insert.length;

    const broken = parsed.requestErrors;
    const ok = broken.length === 0;
    const error = ok
      ? undefined
      : `${config.id}: ${broken.length} de ${capture.requests.length} peticiones con error del proveedor: ${broken[0].error.replace(/\s+/g, " ").trim()}`;
    const details: Details = {
      season,
      matches: candidates.length,
      requests: capture.requests.length,
      unresolved: parsed.unresolved.length,
      skipped: parsed.skipped.length,
      alerts: alertsOpened,
      requestErrors: broken.length,
      fueraDeVentana: fueraDeRango,
      recuperacion: {
        partidos: candidates.length,
        fechas,
        insertadas: inserted,
        duplicadas: plan.dropped.duplicate,
        descartadasLive: plan.dropped.live,
        ...toolDetails,
        cerradosCoinciden: plan.closed.filter((c) => c.agrees).length,
        cerradosDiscrepan: plan.closed.filter((c) => !c.agrees).length,
        alertas: alertsOpened,
        decididas: decided?.decisions ?? 0,
      },
    };
    await db.closeAttempt(attemptId, {
      finishedAt: now,
      ok,
      error,
      rawRef: ref,
      observations: inserted,
      details,
    });
    const after = await recoveryCounts(sql);
    return {
      outcome: dryRun ? "en-seco" : "aplicado",
      candidates,
      attemptId,
      rawRef: ref,
      requests: capture.requests.length,
      plan,
      lines: planLines(plan, candidates, observations),
      fueraDeRango,
      before,
      after,
      decided,
      alertsOpened,
    };
  } catch (e) {
    await db.closeAttempt(attemptId, {
      finishedAt: now,
      ok: false,
      error: errorMessage(e),
      rawRef,
      observations: 0,
      details: {
        season,
        matches: candidates.length,
        recuperacion: { partidos: candidates.length, fechas, ...toolDetails },
      },
    });
    throw e;
  }
}
