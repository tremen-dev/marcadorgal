import type {
  CompetitionId,
  Instant,
  MatchId,
  MatchStatus,
} from "../model/index.ts";
import { PublicMatch } from "../model/index.ts";

// A timestamptz of web.xornada: a Date from postgres.js (the reader), or the
// string of to_jsonb in the Realtime payload (SPEC-024 CA-3).
export type XornadaInstant = Date | string;

// A row of web.xornada as postgres.js returns it: timestamptz as Date
// (SPEC-020 CA-2), or as the trigger sends it (SPEC-024 N-2). Typed loosely
// on purpose: PublicMatch decides.
export type XornadaDbRow = {
  match_id: string;
  competition_id: string;
  season: string;
  competition_name: string;
  tier: number;
  round: number;
  kickoff: XornadaInstant;
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
  observed_at: XornadaInstant | null;
  decided_at: XornadaInstant | null;
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

// Any offset becomes Z. A string that is no instant is kept as it is, so
// that PublicMatch rejects it instead of it being invented.
function iso(d: XornadaInstant | null): string | null {
  if (d instanceof Date) return d.toISOString();
  if (typeof d !== "string") return d;
  const ms = Date.parse(d);
  return Number.isNaN(ms) ? d : new Date(ms).toISOString();
}

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
// and named so the operator can find it. SPEC-024 CA-3: the one conversion,
// for the reader and for the Realtime payload (unknown until checked).
export function toPublicMatch(row: unknown): PublicMatch | null {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    console.error(`web.xornada: a row that is not an object, left out`);
    return null;
  }
  const parsed = PublicMatch.safeParse(candidate(row as XornadaDbRow));
  if (parsed.success) return parsed.data;
  console.error(
    `web.xornada: row ${String((row as { match_id?: unknown }).match_id)} is not a PublicMatch, left out: ${parsed.error.issues
      .map((i) => `${i.path.join(".")} ${i.message}`)
      .join("; ")}`,
  );
  return null;
}

export function toPublicMatches(rows: readonly XornadaDbRow[]): PublicMatch[] {
  const out: PublicMatch[] = [];
  for (const row of rows) {
    const match = toPublicMatch(row);
    if (match !== null) out.push(match);
  }
  return out;
}
