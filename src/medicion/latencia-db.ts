import type { Sql, TransactionSql } from "postgres";
import type { Instant, MatchStatus } from "../model/index.ts";
import type {
  LatAttempt,
  LatDecision,
  LatObservation,
  LatRawObject,
} from "./latencia.ts";

// SPEC-025 CA-4/CA-7. The reads of the measurement, and nothing else: no
// write, no clock. Here and not in src/ingest/ (CA-7: src/ingest unchanged),
// and not in the tool, so npm run test:db exercises them against the schema.
// storage.objects is read in read only, the way the purge of ADR-007 §5 does.

const instant = (value: Date): Instant => value.toISOString();
const total = (home: number | null, away: number | null) =>
  home === null || away === null ? null : home + away;

export type LatenciaMatch = {
  id: string;
  competitionId: string;
  season: string;
};

export type LatenciaFilas = {
  matches: LatenciaMatch[];
  observations: (LatObservation & { status: MatchStatus })[];
  decisions: LatDecision[];
  attempts: LatAttempt[];
  rawObjects: LatRawObject[];
  // Requests to the provider per UTC day (details.requests), for the
  // projected scenario of a 15 s tick (CA-5).
  peticionesPorDia: { dia: string; total: number }[];
};

// The matchday is every match whose kickoff falls inside [desde, hasta], as
// in the report of SPEC-009 (informe-db.ts).
export async function latenciaFilas(
  sql: Sql | TransactionSql,
  desde: Instant,
  hasta: Instant,
): Promise<LatenciaFilas> {
  const matches = await sql<
    { id: string; competition_id: string; season: string }[]
  >`select id, competition_id, season from matches
    where kickoff >= ${desde} and kickoff <= ${hasta}
    order by kickoff, id`;
  const ids = matches.map((m) => m.id);

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
          order by match_id, observed_at`;

  const decisions =
    ids.length === 0
      ? []
      : await sql<
          {
            id: string;
            match_id: string;
            version: number;
            home_score: number | null;
            away_score: number | null;
            decided_at: Date;
            recorded_at: Date | null;
            observation_ids: string[];
          }[]
        >`select id, match_id, version, home_score, away_score, decided_at,
            recorded_at, observation_ids
          from decisions
          where match_id = any (${sql.array(ids)})
          order by match_id, version`;

  // The raw objects the observations cite: name is raw_ref without "raw/".
  const keys = [
    ...new Set(
      observations
        .map((o) => o.raw_ref)
        .filter((r) => r.startsWith("raw/"))
        .map((r) => r.slice("raw/".length)),
    ),
  ];
  // The attempts of the window, and those that brought a cited observation
  // even if they started after it (the window is by kickoff).
  const refs = [...new Set(observations.map((o) => o.raw_ref))];
  const attempts = await sql<
    {
      raw_ref: string | null;
      started_at: Date;
      opened_at: Date | null;
      requests: string | null;
    }[]
  >`select raw_ref, started_at, opened_at, details->>'requests' as requests
    from ingest_attempts
    where (started_at >= ${desde} and started_at <= ${hasta})
      or raw_ref = any (${sql.array(refs.length === 0 ? [""] : refs)})
    order by started_at`;

  const rawObjects =
    keys.length === 0
      ? []
      : await sql<{ name: string; created_at: Date }[]>`
          select name, created_at from storage.objects
          where bucket_id = 'raw' and name = any (${sql.array(keys)})`;

  const porDia = new Map<string, number>();
  for (const a of attempts) {
    const started = instant(a.started_at);
    if (started < desde || started > hasta) continue;
    const dia = started.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + Number(a.requests ?? 0));
  }

  return {
    matches: matches.map((m) => ({
      id: m.id,
      competitionId: m.competition_id,
      season: m.season,
    })),
    observations: observations.map((o) => ({
      id: o.id,
      matchId: o.match_id,
      observedAt: instant(o.observed_at),
      total: total(o.home_score, o.away_score),
      rawRef: o.raw_ref,
      status: o.status,
    })),
    decisions: decisions.map((d) => ({
      id: d.id,
      matchId: d.match_id,
      version: d.version,
      total: total(d.home_score, d.away_score),
      decidedAt: instant(d.decided_at),
      recordedAt: d.recorded_at === null ? null : instant(d.recorded_at),
      observationIds: d.observation_ids,
    })),
    attempts: attempts.map((a) => ({
      rawRef: a.raw_ref,
      startedAt: instant(a.started_at),
      openedAt: a.opened_at === null ? null : instant(a.opened_at),
    })),
    rawObjects: rawObjects.map((r) => ({
      rawRef: `raw/${r.name}`,
      createdAt: instant(r.created_at),
    })),
    peticionesPorDia: [...porDia]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, n]) => ({ dia, total: n })),
  };
}
