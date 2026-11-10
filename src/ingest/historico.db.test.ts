import type { Sql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createSql } from "../db/connect.ts";
import type { DayMatchesResponse } from "../lib/explorer-client.ts";
import { historicoSync } from "./historico-db.ts";

const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");

async function rollback(fn: (tx: Sql) => Promise<void>) {
  try {
    await sql.begin(async (tx) => {
      await fn(tx as unknown as Sql);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
}

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe("SPEC-060 historico:sync against the database", () => {
  it("consolidates matches, registers goals and is idempotent on repeat", () =>
    rollback(async (tx) => {
      // 1. Seed match
      const matchId = "test-historico-match-1";
      await tx`
        insert into public.competitions (id, season, name, tier)
        values ('primera-division', '2026-27', 'Primera División', 1)
        on conflict do nothing;
      `;
      await tx`
        insert into public.teams (id, name)
        values ('team-celta', 'Celta de Vigo'), ('team-osasuna', 'Osasuna')
        on conflict do nothing;
      `;
      await tx`
        insert into public.matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
        values (${matchId}, 'primera-division', '2026-27', 1, '2026-08-15T19:00:00Z', 'team-celta', 'team-osasuna')
        on conflict (id) do nothing;
      `;

      const fakeDayMatches: DayMatchesResponse = {
        date: "2026-08-15",
        exportedAt: "2026-08-15T22:00:00Z",
        matches: [
          {
            canonicalCompetitionId: "primera-division",
            canonicalHomeTeamId: "team-celta",
            canonicalAwayTeamId: "team-osasuna",
            homeTeam: "Celta de Vigo",
            awayTeam: "Osasuna",
            homeScore: 2,
            awayScore: 1,
            estado: "FINISHED",
            goals: [
              { team: "home", player: "Aspas", minute: 23 },
              { team: "away", player: "Budimir", minute: 60 },
              { team: "home", player: "Swedberg", minute: 85 },
            ],
          },
        ],
      };

      // The export of 08-15 only: the window (SPEC-071) asks its six
      // neighbours too, and they are empty.
      const mockFetcher = async (date: string) =>
        date === "2026-08-15"
          ? fakeDayMatches
          : { ...fakeDayMatches, date, matches: [] };

      // 2. Test --dry-run first: counts reported, no writes
      const dryReport = await historicoSync(
        tx,
        { desde: "2026-08-15", hasta: "2026-08-15", dryRun: true },
        mockFetcher,
      );

      expect(dryReport.matchesConsolidated).toBe(1);
      expect(dryReport.goalsRecorded).toBe(3);

      const [decisionsBefore] =
        await tx`select count(*) from decisions where match_id = ${matchId}`;
      expect(Number(decisionsBefore.count)).toBe(0);

      const [goalsBefore] =
        await tx`select count(*) from match_goals where match_id = ${matchId}`;
      expect(Number(goalsBefore.count)).toBe(0);

      // 3. Real sync execution
      const realReport = await historicoSync(
        tx,
        { desde: "2026-08-15", hasta: "2026-08-15", dryRun: false },
        mockFetcher,
      );

      expect(realReport.matchesConsolidated).toBe(1);
      expect(realReport.goalsRecorded).toBe(3);

      const [decAfter] = await tx`
        select status, home_score, away_score, rule, qualifier
        from decisions where match_id = ${matchId} order by version desc limit 1
      `;
      expect(decAfter).toMatchObject({
        status: "finished",
        home_score: 2,
        away_score: 1,
        rule: "RN-01",
        qualifier: "confirmado",
      });

      const goalsInDb = await tx`
        select team, player, minute from match_goals where match_id = ${matchId} order by minute asc
      `;
      expect(goalsInDb).toEqual([
        { team: "home", player: "Aspas", minute: 23 },
        { team: "away", player: "Budimir", minute: 60 },
        { team: "home", player: "Swedberg", minute: 85 },
      ]);

      // 4. Verification through web.xornada view
      const [viewRow] =
        await tx`select status, home_score, away_score, goals from web.xornada where match_id = ${matchId}`;
      expect(viewRow.status).toBe("finished");
      expect(viewRow.home_score).toBe(2);
      expect(viewRow.away_score).toBe(1);
      expect(viewRow.goals).toHaveLength(3);

      // 5. CA-4 Idempotence: running sync again produces 0 new decisions and preserves goals
      const repeatReport = await historicoSync(
        tx,
        { desde: "2026-08-15", hasta: "2026-08-15", dryRun: false },
        mockFetcher,
      );

      expect(repeatReport.matchesConsolidated).toBe(0);
      expect(repeatReport.goalsRecorded).toBe(3);

      const [decisionsRepeat] =
        await tx`select count(*) from decisions where match_id = ${matchId}`;
      expect(Number(decisionsRepeat.count)).toBe(1);

      const [goalsRepeat] =
        await tx`select count(*) from match_goals where match_id = ${matchId}`;
      expect(Number(goalsRepeat.count)).toBe(3);
    }));
});
