import type { Sql, TransactionSql } from "postgres";
import type { EngineMatch } from "../decide/index.ts";
import type {
  CompetitionId,
  MatchId,
  MatchStatus,
  SourceConfig,
} from "../model/index.ts";
import {
  insertDecision,
  type ObservationRow,
  priorityLookup,
  toObservation,
} from "./engine.ts";
import type {
  BoardState,
  ReplayJornadaInput,
  ReplayJornadaRow,
} from "./replay-jornada.ts";

// SPEC-012 CA-4, the database half. Reads what replayJornada needs and, only
// when asked (--aplicar), adds the corrective Decisions. Nothing is updated
// and nothing is deleted (RN-07): the only statement that writes is the
// insert of engine.ts, the same the tick uses.

type BoardRow = {
  match_id: string;
  competition_id: string;
  kickoff: Date;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
};

const boardState = (row: BoardRow): BoardState => ({
  status: row.status,
  score:
    row.home_score === null || row.away_score === null
      ? null
      : { home: row.home_score, away: row.away_score },
});

// The matchday is every match whose kickoff falls inside the window, as in
// informe-db.ts (SPEC-009 N-1), and its observations inside the same window.
export async function replayJornadaFilas(
  sql: Sql | TransactionSql,
  desde: string,
  hasta: string,
): Promise<Pick<ReplayJornadaInput, "matches" | "observations">> {
  const boards = await sql<BoardRow[]>`
    select match_id, competition_id, kickoff, status, home_score, away_score
    from board where kickoff >= ${desde} and kickoff <= ${hasta}
    order by match_id`;
  const ids = boards.map((b) => b.match_id);
  const observations =
    ids.length === 0
      ? []
      : await sql<ObservationRow[]>`
          select id, match_id, source_id, status, home_score, away_score, minute,
            added_minute, half_time, observed_at, received_at, raw_ref
          from observations
          where match_id = any (${sql.array(ids)})
            and observed_at >= ${desde} and observed_at <= ${hasta}
          order by match_id, observed_at, id`;
  return {
    matches: boards.map((row) => ({
      match: {
        id: row.match_id as MatchId,
        competitionId: row.competition_id as CompetitionId,
        kickoff: row.kickoff.toISOString(),
      } satisfies EngineMatch,
      board: boardState(row),
    })),
    observations: observations.map(toObservation),
  };
}

// The registry, per competition, exactly as the tick reads it (RN-01).
export const replayPriority =
  (sources: readonly SourceConfig[]) => (competitionId: CompetitionId) =>
    priorityLookup(sources, competitionId);

// One Decision per divergent finished match, never a log. The caller owns the
// transaction: all of them or none.
export async function aplicarCorrecciones(
  tx: TransactionSql,
  rows: readonly ReplayJornadaRow[],
): Promise<number> {
  let added = 0;
  for (const row of rows) {
    if (row.correction === null) continue;
    await insertDecision(tx, row.correction);
    added += 1;
  }
  return added;
}
