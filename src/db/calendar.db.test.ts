import type { Sql, TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import type { Instant } from "@/model";
import { loadSeason } from "../calendar/load.ts";
import { AliasFile, CalendarFile } from "../calendar/schema.ts";
import { createIngestDb } from "../ingest/db.ts";
import { decideMatches } from "../ingest/engine.ts";
import { SOURCES } from "../sources/registry.ts";
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

  it("a shortName added to a team reaches teams and board, and is nulled when removed", () =>
    rollback(async (tx) => {
      await load(tx);
      const withShort = CalendarFile.parse({
        ...calendar,
        teams: calendar.teams.map((t) =>
          t.id === "test-a" ? { ...t, shortName: "Short A" } : t,
        ),
      });
      await load(tx, withShort);
      const [team] = await tx`select short_name from teams where id = 'test-a'`;
      expect(team.short_name).toBe("Short A");
      const [row] =
        await tx`select home_short_name, away_short_name from board where match_id = 'test-cal-2026-27-j1-test-a-test-b'`;
      expect(row).toEqual({
        home_short_name: "Short A",
        away_short_name: null,
      });
      await load(tx);
      const [again] =
        await tx`select short_name from teams where id = 'test-a'`;
      expect(again.short_name).toBeNull();
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

// SPEC-035 CA-7 (ADR-019 §5): the load of the calendar against two real
// engines, each on its own connection. These rows are committed, because a
// transaction that waits for another one only sees what that one commits;
// the afterAll removes them as replica, past the append-only triggers.
const sqlA = createSql(process.env);
const sqlB = createSql(process.env);
const sqlC = createSql(process.env);
const sqlW = createSql(process.env);
const lockSeason = "2026-27";
const lockKickoff = "2026-09-25T18:00:00.000Z" as Instant;
const movedKickoff = "2026-09-26T19:00:00.000Z";
const compX = "test-c35a";
const compY = "test-c35b";
const lockTeams = [
  { id: "test-c35-x", name: "X" },
  { id: "test-c35-y", name: "Y" },
];
const calendarOf = (
  id: string,
  matches: { round: number; home: string; away: string }[],
  kickoff: string,
) =>
  CalendarFile.parse({
    competition: { id, season: lockSeason, name: `Test ${id}`, tier: 5 },
    teams: lockTeams,
    matches: matches.map((m) => ({ ...m, kickoff })),
  });
// m1 and m2 in one competition, m3 in the other; the ids sort m1 < m2 < m3.
const xy = { home: "test-c35-x", away: "test-c35-y" };
const yx = { home: "test-c35-y", away: "test-c35-x" };
const m1 = `${compX}-${lockSeason}-j1-test-c35-x-test-c35-y`;
const m2 = `${compX}-${lockSeason}-j2-test-c35-y-test-c35-x`;
const m3 = `${compY}-${lockSeason}-j1-test-c35-x-test-c35-y`;

afterAll(async () => {
  await sqlW.begin(async (tx) => {
    await tx`set local session_replication_role = replica`;
    const ids = tx.array([m1, m2, m3]);
    await tx`delete from decisions where match_id = any(${ids})`;
    await tx`delete from alerts where match_id = any(${ids})`;
    await tx`delete from observations where match_id = any(${ids})`;
    await tx`delete from matches where id = any(${ids})`;
    await tx`delete from calendar_loads
      where summary -> 'competitions' ?| ${tx.array([compX, compY])}`;
    await tx`delete from competitions where id = any(${tx.array([compX, compY])})`;
    await tx`delete from teams where id = any(${tx.array(lockTeams.map((t) => t.id))})`;
  });
  await Promise.all([sqlA.end(), sqlB.end(), sqlC.end(), sqlW.end()]);
});

const pidOf = async (s: Sql | Tx) => {
  const [row] = await s<{ pid: number }[]>`select pg_backend_pid() as pid`;
  return row.pid;
};

// Waits until the backend is waiting on a lock, without a sleep standing in
// for the proof.
async function waitUntilBlocked(pid: number): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const [row] = await sqlW<{ n: number }[]>`
      select count(*)::int as n from pg_stat_activity
      where pid = ${pid} and wait_event_type = 'Lock'`;
    if (row.n > 0) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`backend ${pid} never waited on a lock`);
}

const outcome = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: { code?: string; message?: string }) => `${e.code} ${e.message}`,
  );

describe("SPEC-035 CA-7 the calendar load does not deadlock with the engine", () => {
  it("afterInsert on m2, sweep on m1..m3 and a load in file order m3, m1, m2 all commit", async () => {
    // The season as it stands before the push, committed.
    await sqlW.begin((tx) =>
      loadSeason(tx, {
        season: lockSeason,
        calendars: [
          calendarOf(
            compX,
            [
              { round: 1, ...xy },
              { round: 2, ...yx },
            ],
            lockKickoff,
          ),
          calendarOf(compY, [{ round: 1, ...xy }], lockKickoff),
        ],
        aliases: [],
      }),
    );

    // A: an afterInsert on m2, left open.
    let releaseA!: () => void;
    const released = new Promise<void>((r) => {
      releaseA = r;
    });
    let ranA!: () => void;
    const aRan = new Promise<void>((r) => {
      ranA = r;
    });
    const aDone = createIngestDb(sqlA).transaction(async (tx) => {
      await decideMatches(tx, [m2], lockKickoff, SOURCES);
      ranA();
      await released;
    });
    let b: Promise<string> = Promise.resolve("ok");
    let c: Promise<string> = Promise.resolve("ok");
    try {
      await aRan;
      // B: the sweep over m1..m3, two competitions: holds m1, waits on m2.
      let pidB!: (pid: number) => void;
      const bPid = new Promise<number>((r) => {
        pidB = r;
      });
      b = outcome(
        createIngestDb(sqlB).transaction(async (tx) => {
          pidB(await pidOf(tx.sql));
          return decideMatches(tx, [m1, m2, m3], lockKickoff, SOURCES);
        }),
      );
      await waitUntilBlocked(await bPid);

      // C: the push, competition Y first, then X: m3, m1, m2.
      let pidC!: (pid: number) => void;
      const cPid = new Promise<number>((r) => {
        pidC = r;
      });
      c = outcome(
        sqlC.begin(async (tx) => {
          pidC(await pidOf(tx));
          await loadSeason(tx, {
            season: lockSeason,
            calendars: [
              calendarOf(compY, [{ round: 1, ...xy }], movedKickoff),
              calendarOf(
                compX,
                [
                  { round: 1, ...xy },
                  { round: 2, ...yx },
                ],
                movedKickoff,
              ),
            ],
            aliases: [],
          });
        }),
      );
      await waitUntilBlocked(await cPid);
    } finally {
      releaseA();
      await aDone;
    }
    expect({ sweep: await b, load: await c }).toEqual({
      sweep: "ok",
      load: "ok",
    });
    const rows = await sqlW<{ id: string; kickoff: Date }[]>`
      select id, kickoff from matches where id in ${sqlW([m1, m2, m3])}
      order by id`;
    expect(rows.map((r) => r.kickoff.toISOString())).toEqual([
      "2026-09-26T19:00:00.000Z",
      "2026-09-26T19:00:00.000Z",
      "2026-09-26T19:00:00.000Z",
    ]);
  });
});
