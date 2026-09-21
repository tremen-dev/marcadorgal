import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { loadSeason } from "../calendar/load.ts";
import { AliasFile, CalendarFile } from "../calendar/schema.ts";
import { createSql } from "./connect.ts";

const sql = createSql(process.env);
type Tx = TransactionSql;
const ROLLBACK = Symbol("rollback");

async function rollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  await sql
    .begin(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    })
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });
}

afterAll(() => sql.end());

const season = "2026-27";
const competitionId = "test-cal";
const calendar = CalendarFile.parse({
  competition: { id: competitionId, season, name: "Test Cal", tier: 5 },
  teams: [
    { id: "test-a", name: "A" },
    { id: "test-b", name: "B" },
    { id: "test-c", name: "C" },
    { id: "test-d", name: "D" },
  ],
  matches: [
    {
      round: 1,
      kickoff: "2026-09-06T16:00:00Z",
      home: "test-a",
      away: "test-b",
    },
    {
      round: 1,
      kickoff: "2026-09-06T18:00:00Z",
      home: "test-c",
      away: "test-d",
    },
    {
      round: 2,
      kickoff: "2026-09-13T16:00:00Z",
      home: "test-b",
      away: "test-c",
    },
    {
      round: 2,
      kickoff: "2026-09-13T18:00:00Z",
      home: "test-d",
      away: "test-a",
    },
  ],
});
const aliases = AliasFile.parse({
  source: "test-source",
  season,
  teams: [
    { externalId: "1", externalName: "Team A", teamId: "test-a" },
    { externalId: "2", externalName: "Team B", teamId: "test-b" },
  ],
});
const n = calendar.matches.length;

const load = (tx: Tx, cal = calendar, als = [aliases]) =>
  loadSeason(tx, { season, calendars: [cal], aliases: als });

const countMatches = async (tx: Tx) =>
  (
    await tx`select count(*)::int as count from matches
      where competition_id = ${competitionId} and season = ${season}`
  )[0].count as number;

describe("CA-10 loadSeason", () => {
  it("first load inserts every match, the aliases and a calendar_loads row", () =>
    rollback(async (tx) => {
      const [{ before }] =
        await tx`select count(*)::int as before from calendar_loads where season = ${season}`;
      const summary = await load(tx);
      expect(summary.competitions[competitionId]).toEqual({
        inserted: n,
        updated: 0,
        unchanged: 0,
        orphaned: [],
      });
      expect(summary.aliases).toEqual({ "test-source": 2 });
      expect(await countMatches(tx)).toBe(n);
      const [{ after }] =
        await tx`select count(*)::int as after from calendar_loads where season = ${season}`;
      expect(after).toBe(before + 1);
      const [row] =
        await tx`select summary from calendar_loads where season = ${season} order by loaded_at desc limit 1`;
      expect(row.summary).toEqual(summary);
      const [alias] =
        await tx`select team_id from team_aliases where source_id = 'test-source' and season = ${season} and alias = 'Team A'`;
      expect(alias.team_id).toBe("test-a");
    }));

  it("a second identical load is idempotent", () =>
    rollback(async (tx) => {
      await load(tx);
      const summary = await load(tx);
      expect(summary.competitions[competitionId]).toEqual({
        inserted: 0,
        updated: 0,
        unchanged: n,
        orphaned: [],
      });
      expect(await countMatches(tx)).toBe(n);
    }));

  it("a changed kickoff counts as updated and keeps the id", () =>
    rollback(async (tx) => {
      await load(tx);
      const moved = CalendarFile.parse({
        ...calendar,
        matches: calendar.matches.map((m, i) =>
          i === 0 ? { ...m, kickoff: "2026-09-07T19:00:00Z" } : m,
        ),
      });
      const summary = await load(tx, moved);
      expect(summary.competitions[competitionId]).toMatchObject({
        inserted: 0,
        updated: 1,
        unchanged: n - 1,
      });
      const [row] =
        await tx`select kickoff from matches where id = 'test-cal-2026-27-j1-test-a-test-b'`;
      expect(row.kickoff.toISOString()).toBe("2026-09-07T19:00:00.000Z");
      expect(await countMatches(tx)).toBe(n);
    }));

  it("a match missing from the file is reported as orphaned and kept", () =>
    rollback(async (tx) => {
      await load(tx);
      const fewer = CalendarFile.parse({
        ...calendar,
        matches: calendar.matches.slice(1),
      });
      const summary = await load(tx, fewer);
      expect(summary.competitions[competitionId]).toEqual({
        inserted: 0,
        updated: 0,
        unchanged: n - 1,
        orphaned: ["test-cal-2026-27-j1-test-a-test-b"],
      });
      expect(await countMatches(tx)).toBe(n);
    }));

  it("an alias with an unknown teamId fails the whole load", () =>
    rollback(async (tx) => {
      const broken = AliasFile.parse({
        ...aliases,
        teams: [
          ...aliases.teams,
          { externalId: "9", externalName: "Ghost", teamId: "test-ghost" },
        ],
      });
      await expect(
        tx.savepoint((s) => load(s, calendar, [broken])),
      ).rejects.toMatchObject({ code: "23503" });
      expect(await countMatches(tx)).toBe(0);
    }));

  it("anon cannot read calendar_loads", () =>
    rollback(async (tx) => {
      await load(tx);
      await tx`set local role anon`;
      const [{ count }] =
        await tx`select count(*)::int as count from calendar_loads`;
      expect(count).toBe(0);
    }));
});
