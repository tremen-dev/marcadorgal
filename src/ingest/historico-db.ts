import type { Sql, TransactionSql } from "postgres";
import {
  type DayMatchesResponse,
  getDayMatches,
} from "../lib/explorer-client.ts";
import {
  type HistoricoArgs,
  type HistoricoSyncReport,
  type MatchToSync,
  planDaySync,
} from "./historico.ts";

type MatchDbRow = {
  match_id: string;
  competition_id: string;
  round: number;
  kickoff: Date;
  madrid_date: string;
  home_name: string;
  home_short_name: string | null;
  away_name: string;
  away_short_name: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  version: number;
};

export async function fetchMatchesInDateRange(
  sql: Sql | TransactionSql,
  desde: string,
  hasta: string,
): Promise<Map<string, MatchToSync[]>> {
  const rows = await sql<MatchDbRow[]>`
    select
      m.id as match_id,
      m.competition_id,
      m.round,
      m.kickoff,
      to_char(m.kickoff at time zone 'Europe/Madrid', 'YYYY-MM-DD') as madrid_date,
      h.name as home_name,
      h.short_name as home_short_name,
      a.name as away_name,
      a.short_name as away_short_name,
      coalesce(d.status, 'scheduled') as status,
      d.home_score,
      d.away_score,
      coalesce(d.version, 0) as version
    from public.matches m
    join public.teams h on h.id = m.home_team_id
    join public.teams a on a.id = m.away_team_id
    left join lateral (
      select d.status, d.home_score, d.away_score, d.version
      from public.decisions d
      where d.match_id = m.id
      order by d.version desc
      limit 1
    ) d on true
    where (m.kickoff at time zone 'Europe/Madrid')::date >= ${desde}::date
      and (m.kickoff at time zone 'Europe/Madrid')::date <= ${hasta}::date
    order by m.kickoff, m.id;
  `;

  const map = new Map<string, MatchToSync[]>();
  for (const r of rows) {
    const list = map.get(r.madrid_date) ?? [];
    list.push({
      matchId: r.match_id,
      competitionId: r.competition_id,
      round: r.round,
      kickoff: r.kickoff.toISOString(),
      homeName: r.home_name,
      homeShortName: r.home_short_name,
      awayName: r.away_name,
      awayShortName: r.away_short_name,
      status: r.status,
      homeScore: r.home_score,
      awayScore: r.away_score,
      version: r.version,
    });
    map.set(r.madrid_date, list);
  }
  return map;
}

export async function historicoSync(
  sql: Sql | TransactionSql,
  args: HistoricoArgs,
  fetcher: (date: string) => Promise<DayMatchesResponse> = getDayMatches,
): Promise<HistoricoSyncReport> {
  const matchesByDate = await fetchMatchesInDateRange(
    sql,
    args.desde,
    args.hasta,
  );

  const report: HistoricoSyncReport = {
    desde: args.desde,
    hasta: args.hasta,
    dryRun: args.dryRun,
    datesProcessed: 0,
    matchesScanned: 0,
    matchesConsolidated: 0,
    goalsRecorded: 0,
    detailsByCompetition: {},
  };

  const dates = [...matchesByDate.keys()].sort();
  const runTransaction =
    typeof (sql as Sql).begin === "function"
      ? (fn: (tx: TransactionSql) => Promise<void>) => (sql as Sql).begin(fn)
      : (fn: (tx: TransactionSql) => Promise<void>) =>
          (sql as TransactionSql).savepoint(fn);

  for (const date of dates) {
    const localMatches = matchesByDate.get(date) ?? [];
    if (localMatches.length === 0) continue;

    report.datesProcessed += 1;
    report.matchesScanned += localMatches.length;

    let explorerResponse: DayMatchesResponse;
    try {
      explorerResponse = await fetcher(date);
    } catch (e) {
      console.warn(
        `[historico:sync] Non se puideron obter partidos de Explorer para ${date}:`,
        e,
      );
      continue;
    }

    const dayPlan = planDaySync(
      date,
      localMatches,
      explorerResponse.matches ?? [],
    );

    if (args.dryRun) {
      for (const p of dayPlan.matches) {
        const comp = p.match.competitionId;
        report.detailsByCompetition[comp] ??= { matches: 0, goals: 0 };

        if (p.needsDecision) {
          report.matchesConsolidated += 1;
          report.detailsByCompetition[comp].matches += 1;
        }

        if (p.goals.length > 0) {
          report.goalsRecorded += p.goals.length;
          report.detailsByCompetition[comp].goals += p.goals.length;
        }
      }
      continue;
    }

    // Execución real en transacción atómica por data/xornada
    await runTransaction(async (tx) => {
      for (const p of dayPlan.matches) {
        const comp = p.match.competitionId;
        report.detailsByCompetition[comp] ??= { matches: 0, goals: 0 };

        if (p.needsDecision && p.finalScore) {
          const [obs] = await tx<{ id: string }[]>`
            insert into public.observations (
              match_id, source_id, status, home_score, away_score,
              minute, observed_at, received_at, raw_ref
            ) values (
              ${p.match.matchId}, 'rfef', 'finished',
              ${p.finalScore.home}, ${p.finalScore.away},
              null, ${p.match.kickoff}, now(), 'historico-sync'
            ) returning id;
          `;

          await tx`
            insert into public.decisions (
              match_id, version, status, home_score, away_score,
              minute, qualifier, rule, observation_ids, decided_at
            ) values (
              ${p.match.matchId}, ${p.match.version + 1}, 'finished',
              ${p.finalScore.home}, ${p.finalScore.away},
              null, 'confirmado', 'RN-01', array[${obs.id}]::uuid[], now()
            );
          `;

          report.matchesConsolidated += 1;
          report.detailsByCompetition[comp].matches += 1;
        }

        // Reemprazo determinista e idempotente de goles
        await tx`delete from public.match_goals where match_id = ${p.match.matchId};`;

        if (p.goals.length > 0) {
          for (const g of p.goals) {
            await tx`
              insert into public.match_goals (
                match_id, team, player, minute, penalty, own_goal
              ) values (
                ${p.match.matchId}, ${g.team}, ${g.player}, ${g.minute},
                ${g.penalty ?? false}, ${g.ownGoal ?? false}
              );
            `;
          }
          report.goalsRecorded += p.goals.length;
          report.detailsByCompetition[comp].goals += p.goals.length;
        }
      }
    });
  }

  return report;
}
