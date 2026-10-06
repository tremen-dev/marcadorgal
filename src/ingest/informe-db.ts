import type { Sql, TransactionSql } from "postgres";
import type { Instant, MatchStatus, Score } from "../model/index.ts";
import type {
  InformeAlert,
  InformeAttempt,
  InformeCron,
  InformeDecision,
  InformeMatch,
  InformeObservation,
} from "./informe.ts";

// SPEC-009 CA-2/CA-4. The queries of the report, over columns that already
// exist: no migration and nothing instrumented (N-6). They are here and not in
// tools/informe-jornada.mjs so npm run test:db can exercise them against the
// real schema, the way src/ingest/db.ts is exercised by db.db.test.ts.

// Every instant becomes an Instant here: no Date leaves this layer (D-9).
const instant = (value: Date): Instant => value.toISOString();
const scoreOf = (home: number | null, away: number | null): Score | null =>
  home === null || away === null ? null : { home, away };

export type InformeFilas = {
  matches: InformeMatch[];
  observations: InformeObservation[];
  decisions: InformeDecision[];
  attempts: InformeAttempt[];
  alerts: InformeAlert[];
  cron: InformeCron;
};

// The matchday is every match whose kickoff falls inside the window: desde is
// the first kickoff minus ten minutes and hasta the last plus a hundred and
// fifty (N-1), so the bounds catch the whole round and nothing else.
export async function informeFilas(
  sql: Sql | TransactionSql,
  desde: Instant,
  hasta: Instant,
): Promise<InformeFilas> {
  const matches = await sql<
    {
      match_id: string;
      competition_id: string;
      competition_name: string;
      round: number;
      kickoff: Date;
      status: MatchStatus;
      home_score: number | null;
      away_score: number | null;
      decided_at: Date | null;
      rule: string | null;
    }[]
  >`select b.match_id, b.competition_id, b.competition_name, b.round, b.kickoff,
      b.status, b.home_score, b.away_score, b.decided_at, d.rule
    from board b left join decisions d on d.id = b.decision_id
    where b.kickoff >= ${desde} and b.kickoff <= ${hasta}
    order by b.kickoff, b.match_id`;
  const ids = matches.map((m) => m.match_id);

  // Empty matchday: no ids to narrow by, and `= any('{}')` would return
  // nothing anyway. The report is generated whole all the same (CA-1).
  const observations =
    ids.length === 0
      ? []
      : await sql<
          {
            id: string;
            match_id: string;
            observed_at: Date;
            status: MatchStatus;
            home_score: number | null;
            away_score: number | null;
            raw_ref: string;
          }[]
        >`select id, match_id, observed_at, status, home_score, away_score, raw_ref
          from observations
          where match_id = any (${sql.array(ids)})
            and observed_at >= ${desde} and observed_at <= ${hasta}
          order by match_id, observed_at`;

  const decisions =
    ids.length === 0
      ? []
      : await sql<
          {
            id: string;
            match_id: string;
            version: number;
            status: MatchStatus;
            home_score: number | null;
            away_score: number | null;
            rule: string;
            decided_at: Date;
            observation_ids: string[];
          }[]
        >`select id, match_id, version, status, home_score, away_score, rule,
            decided_at, observation_ids
          from decisions
          where match_id = any (${sql.array(ids)})
            and decided_at >= ${desde} and decided_at <= ${hasta}
          order by match_id, version`;

  // requests out of details and never out of net._http_response, which pg_net
  // prunes within hours and does not survive a four day measurement (N-2).
  const attempts = await sql<
    {
      started_at: Date;
      source_id: string;
      ok: boolean | null;
      error: string | null;
      requests: string | null;
    }[]
  >`select started_at, source_id,
      case when finished_at is null then null else ok end as ok,
      error, details->>'requests' as requests
    from ingest_attempts
    where started_at >= ${desde} and started_at <= ${hasta}
    order by started_at`;

  const alerts = await sql<
    {
      kind: string;
      match_id: string | null;
      opened_at: Date;
      resolved_at: Date | null;
      details: unknown;
    }[]
  >`select kind, match_id, opened_at, resolved_at, details
    from alerts where opened_at >= ${desde} and opened_at <= ${hasta}
    order by opened_at, kind`;

  // Last, so that a failure here cannot abort the queries above inside a
  // transaction: pg_cron is informative and the report never throws for it.
  const cron = await informeCron(sql, desde, hasta);

  return {
    cron,
    matches: matches.map((m) => ({
      id: m.match_id,
      competitionId: m.competition_id,
      competitionName: m.competition_name,
      round: m.round,
      kickoff: instant(m.kickoff),
      status: m.status,
      score: scoreOf(m.home_score, m.away_score),
      decidedAt: m.decided_at === null ? null : instant(m.decided_at),
      // The rule of the current Decision, from board's decision_id: what
      // tells a forced RN-02 finished from a confirmed one (SPEC-017 CA-4).
      rule: m.rule,
    })),
    observations: observations.map((o) => ({
      id: o.id,
      matchId: o.match_id,
      observedAt: instant(o.observed_at),
      status: o.status,
      score: scoreOf(o.home_score, o.away_score),
      rawRef: o.raw_ref,
    })),
    decisions: decisions.map((d) => ({
      id: d.id,
      matchId: d.match_id,
      version: d.version,
      status: d.status,
      score: scoreOf(d.home_score, d.away_score),
      rule: d.rule,
      decidedAt: instant(d.decided_at),
      observationIds: d.observation_ids,
    })),
    // A finished attempt with no 'requests' key counts as zero requests, not
    // as a missing number: the tick always writes it when it got that far.
    attempts: attempts.map((a) => ({
      startedAt: instant(a.started_at),
      sourceId: a.source_id,
      ok: a.ok,
      error: a.error,
      requests: a.requests === null ? 0 : Number(a.requests),
    })),
    alerts: alerts.map((a) => ({
      kind: a.kind,
      matchId: a.match_id,
      openedAt: instant(a.opened_at),
      resolvedAt: a.resolved_at === null ? null : instant(a.resolved_at),
      details: a.details,
    })),
  };
}

// SPEC-017 CA-2. The newest contrast stored under this etiqueta, as a raw_ref,
// or null when there is none. Read only, out of the catalogue of Storage, the
// way the purge of ADR-007 §5 lists its keys: the object itself is read back
// through the Storage API by contraste.ts. The etiqueta is the tail of the key
// (ADR-007 §2), compared as text and not with like, whose '_' and '%' mean
// something else.
export async function contrasteGuardado(
  sql: Sql | TransactionSql,
  etiqueta: string,
): Promise<string | null> {
  const cola = `-${etiqueta}.json.gz`;
  const [row] = await sql<{ name: string }[]>`
    select name from storage.objects
    where bucket_id = 'raw' and name is not null
      and right(name, ${cola.length}) = ${cola}
    order by created_at desc, name desc limit 1`;
  return row === undefined ? null : `raw/${row.name}`;
}

// SPEC-017 CA-5 (R-SPEC-009-9). pg_cron's own record of the window, with the
// job name from cron.job, as tools/tick-salud.mjs reads it. Informative: if the
// query fails the report says why and goes on.
export async function informeCron(
  sql: Sql | TransactionSql,
  desde: Instant,
  hasta: Instant,
): Promise<InformeCron> {
  try {
    const rows = await sql<
      { jobname: string; status: string | null; start_time: Date }[]
    >`select coalesce(j.jobname, d.jobid::text) as jobname, d.status, d.start_time
      from cron.job_run_details d left join cron.job j on j.jobid = d.jobid
      where d.start_time >= ${desde} and d.start_time <= ${hasta}
      order by d.start_time`;
    return {
      ejecuciones: rows.map((r) => ({
        jobname: r.jobname,
        status: r.status ?? "sin estado",
        startTime: instant(r.start_time),
      })),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
