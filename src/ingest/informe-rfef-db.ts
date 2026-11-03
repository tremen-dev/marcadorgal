import type { Sql, TransactionSql } from "postgres";
import type { Instant, MatchStatus, Score } from "../model/index.ts";
import type {
  RfefAlert,
  RfefAttempt,
  RfefDecision,
  RfefMatch,
  RfefObservation,
} from "./informe-rfef.ts";

// SPEC-039 CA-1/CA-2. The reads of the rfef report, over columns that already
// exist: no migration, no write, no clock. Here and not in the tool so
// npm run test:db exercises them against the real schema. storage.objects is
// read in read only, as the purge of ADR-007 §5 and latencia-db.ts do.

const instant = (value: Date): Instant => value.toISOString();
const scoreOf = (home: number | null, away: number | null): Score | null =>
  home === null || away === null ? null : { home, away };

export type InformeRfefFilas = {
  // The season of the matchday's matches: the alias the acta is resolved with.
  seasons: string[];
  matches: RfefMatch[];
  observations: RfefObservation[];
  alerts: RfefAlert[];
  attempts: RfefAttempt[];
  decisions: RfefDecision[];
};

// The matchday is every match whose kickoff falls inside [desde, hasta], as in
// informe-db.ts. Every observation of those matches counts, whatever its
// observed_at: the rfef's is explorer's lastSeenAt, not the tick's.
export async function informeRfefFilas(
  sql: Sql | TransactionSql,
  desde: Instant,
  hasta: Instant,
): Promise<InformeRfefFilas> {
  const matches = await sql<
    {
      match_id: string;
      competition_id: string;
      competition_name: string;
      season: string;
      round: number;
      kickoff: Date;
      home_team_id: string;
      away_team_id: string;
      home_team_name: string;
      away_team_name: string;
      status: MatchStatus;
      home_score: number | null;
      away_score: number | null;
    }[]
  >`select match_id, competition_id, competition_name, season, round, kickoff,
      home_team_id, away_team_id, home_team_name, away_team_name,
      status, home_score, away_score
    from board
    where kickoff >= ${desde} and kickoff <= ${hasta}
    order by kickoff, match_id`;
  const ids = matches.map((m) => m.match_id);

  const observations =
    ids.length === 0
      ? []
      : await sql<
          {
            id: string;
            match_id: string;
            source_id: string;
            status: MatchStatus;
            home_score: number | null;
            away_score: number | null;
            observed_at: Date;
            received_at: Date;
            raw_ref: string;
          }[]
        >`select id, match_id, source_id, status, home_score, away_score,
            observed_at, received_at, raw_ref
          from observations
          where match_id = any (${sql.array(ids)})
          order by match_id, received_at, id`;

  // The second clock of an observation (ADR-016): the instant the base sealed
  // its raw capture (§3, storage.objects.created_at), and failing that the
  // opened_at of the attempt that brought it (§2). Neither is in the model.
  const refs = [...new Set(observations.map((o) => o.raw_ref))];
  const keys = refs
    .filter((r) => r.startsWith("raw/"))
    .map((r) => r.slice("raw/".length));
  const rawObjects =
    keys.length === 0
      ? []
      : await sql<{ name: string; created_at: Date }[]>`
          select name, created_at from storage.objects
          where bucket_id = 'raw' and name = any (${sql.array(keys)})`;
  const opened =
    refs.length === 0
      ? []
      : await sql<{ raw_ref: string; opened_at: Date }[]>`
          select raw_ref, min(opened_at) as opened_at from ingest_attempts
          where raw_ref = any (${sql.array(refs)}) and opened_at is not null
          group by raw_ref`;
  const sealed = new Map<string, Instant>();
  for (const a of opened) sealed.set(a.raw_ref, instant(a.opened_at));
  for (const r of rawObjects)
    sealed.set(`raw/${r.name}`, instant(r.created_at));

  const alerts = await sql<
    {
      kind: string;
      match_id: string | null;
      opened_at: Date;
      resolved_at: Date | null;
      details: unknown;
    }[]
  >`select kind, match_id, opened_at, resolved_at, details
    from alerts
    where kind in ('conflict', 'regression')
      and opened_at >= ${desde} and opened_at <= ${hasta}
    order by opened_at, kind`;

  const attempts = await sql<
    {
      source_id: string;
      started_at: Date;
      ok: boolean | null;
      error: string | null;
      fuera: string | null;
    }[]
  >`select source_id, started_at,
      case when finished_at is null then null else ok end as ok,
      error, details->>'fueraDeVentana' as fuera
    from ingest_attempts
    where source_id = 'rfef'
      and started_at >= ${desde} and started_at <= ${hasta}
    order by started_at`;

  // CA-1 (c) publicado: every version of the Decision of those matches, with
  // the source of its first observation (the winner it published or kept).
  const decisions =
    ids.length === 0
      ? []
      : await sql<
          {
            match_id: string;
            version: number;
            status: MatchStatus;
            decided_at: Date;
            winner: string | null;
          }[]
        >`select d.match_id, d.version, d.status, d.decided_at,
            o.source_id as winner
          from decisions d
          left join observations o on o.id = d.observation_ids[1]
          where d.match_id = any (${sql.array(ids)})
          order by d.match_id, d.version`;

  return {
    seasons: [...new Set(matches.map((m) => m.season))].sort(),
    matches: matches.map((m) => ({
      id: m.match_id,
      competitionId: m.competition_id,
      competitionName: m.competition_name,
      round: m.round,
      kickoff: instant(m.kickoff),
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeName: m.home_team_name,
      awayName: m.away_team_name,
      status: m.status,
      score: scoreOf(m.home_score, m.away_score),
    })),
    observations: observations.map((o) => ({
      id: o.id,
      matchId: o.match_id,
      sourceId: o.source_id,
      status: o.status,
      score: scoreOf(o.home_score, o.away_score),
      observedAt: instant(o.observed_at),
      receivedAt: instant(o.received_at),
      recordedAt: sealed.get(o.raw_ref) ?? null,
    })),
    alerts: alerts.map((a) => ({
      kind: a.kind,
      matchId: a.match_id,
      openedAt: instant(a.opened_at),
      resolvedAt: a.resolved_at === null ? null : instant(a.resolved_at),
      details: a.details,
    })),
    attempts: attempts.map((a) => ({
      sourceId: a.source_id,
      startedAt: instant(a.started_at),
      ok: a.ok,
      error: a.error,
      fueraDeVentana: a.fuera === null ? 0 : Number(a.fuera),
    })),
    decisions: decisions.map((d) => ({
      matchId: d.match_id,
      version: d.version,
      status: d.status,
      decidedAt: instant(d.decided_at),
      winnerSourceId: d.winner,
    })),
  };
}
