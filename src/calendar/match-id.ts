import type { CompetitionId, MatchId, Season, TeamId } from "../model/index.ts";

export type MatchIdParts = {
  competitionId: CompetitionId | string;
  season: Season | string;
  round: number;
  homeTeamId: TeamId | string;
  awayTeamId: TeamId | string;
};

// <competition>-<season>-j<round>-<home>-<away>, no zero padding (N-2).
export function matchId(parts: MatchIdParts): MatchId {
  const { competitionId, season, round, homeTeamId, awayTeamId } = parts;
  if (!Number.isInteger(round) || round < 1) {
    throw new RangeError(`round must be an integer >= 1, got ${round}`);
  }
  return `${competitionId}-${season}-j${round}-${homeTeamId}-${awayTeamId}` as MatchId;
}
