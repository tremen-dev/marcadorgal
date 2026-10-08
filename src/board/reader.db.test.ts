import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getSql } from "@/db/client";
import { PublicMatch } from "@/model";
import { createXornadaReader } from "./reader.ts";

// SPEC-020 CA-4 against the local Supabase, as web_reader: every case of the
// screen comes out of web.xornada as a valid PublicMatch (F-SPEC-019-3).
const sql = getSql();
const ROLLBACK = Symbol("rollback");
afterAll(() => sql.end());

async function rollback(fn: (tx: TransactionSql) => Promise<void>) {
  await sql
    .begin(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    })
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });
}

type Seed = {
  id: string;
  decision?: Record<string, string | number | null>;
};

const SEEDS: Seed[] = [
  { id: "t-no-decision" },
  {
    id: "t-scheduled-sen-sinal",
    decision: { status: "scheduled", qualifier: "sen_sinal" },
  },
  {
    id: "t-live-45-3",
    decision: {
      status: "live",
      home_score: 2,
      away_score: 1,
      minute: 45,
      added_minute: 3,
    },
  },
  {
    id: "t-live-sen-sinal",
    decision: {
      status: "live",
      home_score: 0,
      away_score: 0,
      minute: null,
      qualifier: "sen_sinal",
    },
  },
  {
    id: "t-finished",
    decision: { status: "finished", home_score: 3, away_score: 0 },
  },
  {
    id: "t-postponed-provisional",
    decision: { status: "postponed", qualifier: "provisional" },
  },
  {
    id: "t-suspended",
    decision: { status: "suspended", home_score: 1, away_score: 1 },
  },
];

async function seed(tx: TransactionSql) {
  await tx`insert into competitions (id, season, name, tier) values ('t-comp', '2026-27', 'Test', 4)`;
  await tx`insert into teams (id, name, short_name) values ('t-home', 'Home FC', 'Home'), ('t-away', 'Away CF', null)`;
  for (const [i, s] of SEEDS.entries()) {
    await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
      values (${s.id}, 't-comp', '2026-27', 2, ${`2026-10-10T1${i}:00:00Z`}, 't-home', 't-away')`;
    if (!s.decision) continue;
    const { qualifier = "confirmado", ...rest } = s.decision;
    const state = {
      home_score: null,
      away_score: null,
      minute: null,
      added_minute: null,
      ...rest,
    };
    const [{ id }] = await tx`insert into observations ${tx({
      match_id: s.id,
      source_id: "test",
      observed_at: "2026-10-10T17:00:00Z",
      raw_ref: "raw/test.json",
      ...state,
    })} returning id`;
    await tx`insert into decisions ${tx({
      match_id: s.id,
      qualifier,
      rule: "operator",
      observation_ids: [id],
      ...state,
    })}`;
  }
}

describe("SPEC-020 CA-4 createXornadaReader as web_reader", () => {
  it("reads every case of the screen as a valid PublicMatch", () =>
    rollback(async (tx) => {
      await seed(tx);
      await tx`grant web_reader to postgres`;
      await tx`set local role web_reader`;
      const error = vi.spyOn(console, "error");
      const reader = createXornadaReader(tx);
      const ids = SEEDS.map((s) => s.id);
      const matches = await reader.matches(ids);
      expect(error).not.toHaveBeenCalled();
      expect(matches.map((m) => m.matchId).sort()).toEqual([...ids].sort());
      for (const m of matches) {
        expect(PublicMatch.safeParse(m).success, m.matchId).toBe(true);
        expect(m.kickoff).toMatch(/Z$/);
      }
      const byId = new Map<string, PublicMatch>(
        matches.map((m) => [m.matchId, m]),
      );
      expect(byId.get("t-no-decision")).toMatchObject({
        status: "scheduled",
        qualifier: "confirmado",
        version: 0,
        decidedAt: null,
      });
      expect(byId.get("t-live-45-3")).toMatchObject({
        minute: 45,
        addedMinute: 3,
        version: 1,
      });
      expect(byId.get("t-postponed-provisional")).toMatchObject({
        status: "postponed",
        qualifier: "provisional",
      });

      const index = await reader.index("2026-27");
      const mine = index.filter((e) => e.competitionId === "t-comp");
      expect(mine).toHaveLength(SEEDS.length);
      expect(mine.find((e) => e.matchId === "t-live-45-3")).toEqual({
        matchId: "t-live-45-3",
        competitionId: "t-comp",
        season: "2026-27",
        round: 2,
        kickoff: "2026-10-10T12:00:00.000Z",
        status: "live",
      });
    }));
});
