import type {
  CompetitionId,
  Instant,
  MatchId,
  MatchStatus,
} from "../model/index.ts";
import { PublicMatch } from "../model/index.ts";

// A row of web.xornada as postgres.js returns it: timestamptz as Date
// (SPEC-020 CA-2). Typed loosely on purpose: PublicMatch decides.
export type XornadaDbRow = {
  match_id: string;
  competition_id: string;
  season: string;
  competition_name: string;
  tier: number;
  round: number;
  kickoff: Date;
  home_name: string;
  home_short_name: string | null;
  away_name: string;
  away_short_name: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  minute: number | null;
  added_minute: number | null;
  qualifier: string;
  version: number;
  observed_at: Date | null;
  decided_at: Date | null;
  // SPEC-021 CA-4: the last column of web.xornada.
  half_time: boolean;
};

// What the selection of the current xornada needs of every match (CA-5).
export type XornadaIndexEntry = {
  matchId: MatchId;
  competitionId: CompetitionId;
  season: string;
  round: number;
  kickoff: Instant;
  status: MatchStatus;
};

const iso = (d: Date | null): string | null =>
  d instanceof Date ? d.toISOString() : d;

function candidate(row: XornadaDbRow): unknown {
  const score =
    row.home_score === null && row.away_score === null
      ? null
      : { home: row.home_score, away: row.away_score };
  return {
    matchId: row.match_id,
    competitionId: row.competition_id,
    competitionName: row.competition_name,
    tier: row.tier,
    round: row.round,
    kickoff: iso(row.kickoff),
    home: { name: row.home_name, shortName: row.home_short_name },
    away: { name: row.away_name, shortName: row.away_short_name },
    status: row.status,
    score,
    minute: row.minute,
    // Only live carries added time; anywhere else a value is kept so that
    // PublicMatch rejects it instead of it being dropped in silence.
    ...(row.status === "live" || row.added_minute !== null
      ? { addedMinute: row.added_minute }
      : {}),
    // SPEC-021 CA-6: the same for half-time. A live row without the column
    // (the view before the migration) carries undefined and is rejected.
    ...(row.status === "live" || row.half_time === true
      ? { halfTime: row.half_time }
      : {}),
    qualifier: row.qualifier,
    version: row.version,
    observedAt: iso(row.observed_at),
    decidedAt: iso(row.decided_at),
  };
}

// SPEC-020 CA-4: one bad row never takes the response down; it is left out
// and named so the operator can find it.
export function toPublicMatches(rows: readonly XornadaDbRow[]): PublicMatch[] {
  const out: PublicMatch[] = [];
  for (const row of rows) {
    const parsed = PublicMatch.safeParse(candidate(row));
    if (parsed.success) out.push(parsed.data);
    else
      console.error(
        `web.xornada: row ${row.match_id} is not a PublicMatch, left out: ${parsed.error.issues
          .map((i) => `${i.path.join(".")} ${i.message}`)
          .join("; ")}`,
      );
  }
  return out;
}
