import type { Sql, TransactionSql } from "postgres";
import type { Instant, MatchStatus, Score } from "../model/index.ts";
import type {
  InformeAlert,
  InformeAttempt,
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
    }[]
  >`select match_id, competition_id, competition_name, round, kickoff, status,
      home_score, away_score, decided_at
    from board where kickoff >= ${desde} and kickoff <= ${hasta}
    order by kickoff, match_id`;
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

  return {
    matches: matches.map((m) => ({
      id: m.match_id,
      competitionId: m.competition_id,
      competitionName: m.competition_name,
      round: m.round,
      kickoff: instant(m.kickoff),
      status: m.status,
      score: scoreOf(m.home_score, m.away_score),
      decidedAt: m.decided_at === null ? null : instant(m.decided_at),
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
