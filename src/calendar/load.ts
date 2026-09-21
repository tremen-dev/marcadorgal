import type { TransactionSql } from "postgres";
import type { MatchId } from "../model/index.ts";
import { matchId } from "./match-id.ts";
import type { AliasFile, CalendarFile } from "./schema.ts";

export type CompetitionLoadSummary = {
  inserted: number;
  updated: number;
  unchanged: number;
  orphaned: MatchId[];
};

export type LoadSummary = {
  season: string;
  competitions: Record<string, CompetitionLoadSummary>;
  aliases: Record<string, number>;
};

export type LoadInput = {
  season: string;
  calendars: CalendarFile[];
  aliases: AliasFile[];
};

// Idempotent upsert of a season inside the given transaction. Nothing is ever
// deleted: matches in the database but not in the file are reported as
// orphaned and left alone (N-3).
export async function loadSeason(
  tx: TransactionSql,
  { season, calendars, aliases }: LoadInput,
): Promise<LoadSummary> {
  const summary: LoadSummary = { season, competitions: {}, aliases: {} };

  for (const { competition, teams, matches } of calendars) {
    await tx`insert into competitions (id, season, name, tier)
      values (${competition.id}, ${season}, ${competition.name}, ${competition.tier})
      on conflict (id, season) do update set name = excluded.name, tier = excluded.tier`;

    await tx`insert into teams ${tx(teams, "id", "name")}
      on conflict (id) do update set name = excluded.name`;

    const existing = new Map<string, number>(
      (
        await tx<
          { id: string; kickoff: Date }[]
        >`select id, kickoff from matches
          where competition_id = ${competition.id} and season = ${season}`
      ).map((m) => [m.id, m.kickoff.getTime()]),
    );

    const counts: CompetitionLoadSummary = {
      inserted: 0,
      updated: 0,
      unchanged: 0,
      orphaned: [],
    };
    const seen = new Set<string>();
    const rows = matches.map((m) => {
      const id = matchId({
        competitionId: competition.id,
        season,
        round: m.round,
        homeTeamId: m.home,
        awayTeamId: m.away,
      });
      const before = existing.get(id);
      if (before === undefined) counts.inserted++;
      else if (before !== Date.parse(m.kickoff)) counts.updated++;
      else counts.unchanged++;
      seen.add(id);
      return {
        id,
        competition_id: competition.id,
        season,
        round: m.round,
        kickoff: m.kickoff,
        home_team_id: m.home,
        away_team_id: m.away,
      };
    });
    counts.orphaned = [...existing.keys()]
      .filter((id) => !seen.has(id))
      .sort() as MatchId[];

    await tx`insert into matches ${tx(rows)}
      on conflict (id) do update set kickoff = excluded.kickoff`;
    summary.competitions[competition.id] = counts;
  }

  for (const file of aliases) {
    const rows = file.teams.map((t) => ({
      source_id: file.source,
      season,
      alias: t.externalName,
      team_id: t.teamId,
    }));
    if (rows.length > 0)
      await tx`insert into team_aliases ${tx(rows)}
        on conflict (source_id, season, alias) do update set team_id = excluded.team_id`;
    summary.aliases[file.source] = rows.length;
  }

  await tx`insert into calendar_loads (season, summary)
    values (${season}, ${tx.json(summary)})`;
  return summary;
}
