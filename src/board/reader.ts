import "server-only";
import postgres, { type Sql, type TransactionSql } from "postgres";
import { sqlOptionsFor } from "../db/connect.ts";
import type { Instant, PublicMatch } from "../model/index.ts";
import { readCurrentXornada } from "./current.ts";
import {
  toPublicMatches,
  type XornadaDbRow,
  type XornadaIndexEntry,
} from "./row.ts";

// The public reader (SPEC-020 CA-4, ADR-014 §4): the only module that reads
// DATABASE_URL_PUBLIC, the login of web_reader, which can SELECT web.xornada
// and nothing else. The owner URL of the tick is never touched here.

export type XornadaReader = {
  index(season: string): Promise<XornadaIndexEntry[]>;
  matches(ids: readonly string[]): Promise<PublicMatch[]>;
};

type IndexRow = {
  match_id: string;
  competition_id: string;
  season: string;
  round: number;
  kickoff: Date;
  status: string;
};

// A pool or a transaction (the tests read as web_reader inside one that is
// rolled back); both are queried the same way.
export function createXornadaReader(db: Sql | TransactionSql): XornadaReader {
  const sql = db as Sql;
  return {
    async index(season) {
      const rows = await sql<IndexRow[]>`
        select match_id, competition_id, season, round, kickoff, status
        from web.xornada where season = ${season}`;
      return rows.map((r) => ({
        matchId: r.match_id,
        competitionId: r.competition_id,
        season: r.season,
        round: r.round,
        kickoff: r.kickoff.toISOString(),
        status: r.status,
      })) as XornadaIndexEntry[];
    },
    async matches(ids) {
      if (ids.length === 0) return [];
      const rows = await sql<XornadaDbRow[]>`
        select * from web.xornada where match_id = any(${ids as string[]})
        order by kickoff, match_id`;
      return toPublicMatches(rows);
    },
  };
}

// One small pool per runtime, opened on first use, never at import time:
// next build runs without DATABASE_URL_PUBLIC (CA-7). null when the variable
// is missing: the caller says «not available», it never invents a xornada.
let pool: Sql | undefined;

export function publicXornadaReader(): XornadaReader | null {
  const url = process.env.DATABASE_URL_PUBLIC;
  if (!url) return null;
  pool ??= postgres(url, {
    ...sqlOptionsFor(url),
    max: 2,
    idle_timeout: 20,
    connect_timeout: 5,
  });
  return createXornadaReader(pool);
}

// SPEC-024 CA-6: the season of the served xornada names the Realtime
// channel (board:<season>); the page takes it from here, like its data.
export { seasonOf } from "./current.ts";

// The current xornada for the page and /api/board (CA-6, CA-7): null when
// there is no reader; a failed read throws and the caller decides.
export async function readPublicXornada(
  now: Instant,
): Promise<PublicMatch[] | null> {
  const reader = publicXornadaReader();
  return reader === null ? null : readCurrentXornada(reader, now);
}
