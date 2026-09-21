import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { sql } from "./client";

type Tx = TransactionSql;
const ROLLBACK = Symbol("rollback");

// Runs fn inside a transaction that is always rolled back.
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

async function pgCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}

async function seedMatch(tx: Tx): Promise<string> {
  const id = `test:${crypto.randomUUID()}`;
  await tx`insert into competitions (id, season, name, tier) values ('test-comp', '2026-27', 'Test', 5)`;
  await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, 'test-comp', '2026-27', 1, '2026-09-20T16:00:00Z', 'test-home', 'test-away')`;
  return id;
}

const observation = (tx: Tx, matchId: string, state: Record<string, unknown>) =>
  tx`insert into observations ${tx({
    match_id: matchId,
    source_id: "test",
    observed_at: "2026-09-20T16:30:00Z",
    raw_ref: "raw/test.json",
    ...state,
  })} returning id`;

const decision = (
  tx: Tx,
  matchId: string,
  row: Record<string, unknown>,
  observationIds: string[],
) =>
  tx`insert into decisions ${tx({
    match_id: matchId,
    status: "live",
    home_score: 1,
    away_score: 0,
    minute: 30,
    qualifier: "confirmado",
    rule: "operator",
    observation_ids: observationIds,
    ...row,
  })} returning id, version`;

afterAll(() => sql.end());

describe("CA-9 schema", () => {
  it("has the ten tables and no timestamp without time zone", async () => {
    const tables = await sql`select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;
    expect(tables.map((t) => t.table_name)).toEqual([
      "alerts",
      "calendar_loads",
      "competitions",
      "decisions",
      "ingest_attempts",
      "matches",
      "observations",
      "raw_purges",
      "team_aliases",
      "teams",
    ]);
    const [{ count }] =
      await sql`select count(*)::int as count from information_schema.columns
      where table_schema = 'public' and data_type = 'timestamp without time zone'`;
    expect(count).toBe(0);
  });

  it("rejects an unknown status", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      expect(await pgCode(observation(tx, m, { status: "halftime" }))).toBe(
        "23514",
      );
    }));

  it("rejects live without score", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      expect(
        await pgCode(observation(tx, m, { status: "live", minute: 10 })),
      ).toBe("23514");
    }));

  it("rejects scheduled with score", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      expect(
        await pgCode(
          observation(tx, m, {
            status: "scheduled",
            home_score: 0,
            away_score: 0,
          }),
        ),
      ).toBe("23514");
    }));

  it("requires raw_ref", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      expect(
        await pgCode(
          observation(tx, m, { status: "scheduled", raw_ref: null }),
        ),
      ).toBe("23502");
    }));
});

describe("CA-10 append-only and version", () => {
  it("rejects update and delete on observations and decisions", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const [{ id: oid }] = await observation(tx, m, { status: "scheduled" });
      const [{ id: did }] = await decision(tx, m, {}, [oid]);
      const mutations = [
        (s: Tx) => s`update observations set source_id = 'x' where id = ${oid}`,
        (s: Tx) => s`delete from observations where id = ${oid}`,
        (s: Tx) => s`update decisions set rule = 'RN-01' where id = ${did}`,
        (s: Tx) => s`delete from decisions where id = ${did}`,
      ];
      for (const mutate of mutations) {
        await expect(tx.savepoint((s) => mutate(s))).rejects.toThrow(
          /append-only/,
        );
      }
    }));

  it("rejects truncate", async () => {
    await expect(sql`truncate observations`).rejects.toThrow(/append-only/);
    await expect(sql`truncate decisions`).rejects.toThrow(/append-only/);
  });

  it("assigns version 1 and 2 when it is not given", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const [{ id: oid }] = await observation(tx, m, { status: "scheduled" });
      const [first] = await decision(tx, m, {}, [oid]);
      const [second] = await decision(tx, m, {}, [oid]);
      expect([first.version, second.version]).toEqual([1, 2]);
    }));

  it("rejects an explicit repeated version", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const [{ id: oid }] = await observation(tx, m, { status: "scheduled" });
      await decision(tx, m, { version: 1 }, [oid]);
      expect(await pgCode(decision(tx, m, { version: 1 }, [oid]))).toBe(
        "23505",
      );
    }));
});

describe("CA-11 board", () => {
  it("shows a match without decision as scheduled with null score", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const [row] = await tx`select * from board where match_id = ${m}`;
      expect(row).toMatchObject({
        match_id: m,
        competition_name: "Test",
        tier: 5,
        round: 1,
        home_team_name: "Home",
        home_short_name: null,
        away_team_name: "Away",
        away_short_name: null,
        status: "scheduled",
        home_score: null,
        away_score: null,
        minute: null,
        qualifier: null,
        decision_id: null,
        decision_version: null,
        decided_at: null,
        observed_at: null,
      });
    }));

  it("shows the latest decision and the observed_at of its observations", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const [{ id: o1 }] = await observation(tx, m, {
        status: "live",
        home_score: 0,
        away_score: 0,
        minute: 1,
        observed_at: "2026-09-20T16:01:00Z",
      });
      const [{ id: o2 }] = await observation(tx, m, {
        status: "live",
        home_score: 1,
        away_score: 0,
        minute: 30,
        observed_at: "2026-09-20T16:30:00Z",
      });
      await decision(tx, m, { home_score: 0, minute: 1 }, [o1]);
      const [{ id: d2 }] = await decision(tx, m, {}, [o1, o2]);
      const [row] = await tx`select * from board where match_id = ${m}`;
      expect(row).toMatchObject({
        status: "live",
        home_score: 1,
        away_score: 0,
        minute: 30,
        qualifier: "confirmado",
        decision_id: d2,
        decision_version: 2,
      });
      expect(row.observed_at.toISOString()).toBe("2026-09-20T16:30:00.000Z");
    }));

  it("has exactly the columns of the spec, in order", async () => {
    const cols = await sql`select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'board' order by ordinal_position`;
    expect(cols.map((c) => c.column_name)).toEqual([
      "match_id",
      "competition_id",
      "season",
      "competition_name",
      "tier",
      "round",
      "kickoff",
      "home_team_id",
      "home_team_name",
      "home_short_name",
      "away_team_id",
      "away_team_name",
      "away_short_name",
      "status",
      "home_score",
      "away_score",
      "minute",
      "added_minute",
      "qualifier",
      "decision_id",
      "decision_version",
      "decided_at",
      "observed_at",
    ]);
  });

  it("has one row per match", async () => {
    const [{ board }] = await sql`select count(*)::int as board from board`;
    const [{ matches }] =
      await sql`select count(*)::int as matches from matches`;
    expect(board).toBe(matches);
  });
});

describe("CA-12 extensions and RLS", () => {
  it("has pg_cron and pg_net", async () => {
    const rows =
      await sql`select extname from pg_extension where extname in ('pg_cron', 'pg_net')`;
    expect(rows.map((r) => r.extname).sort()).toEqual(["pg_cron", "pg_net"]);
  });

  it("enables RLS on the nine tables and reads only the public five", async () => {
    const rows = await sql`select c.relname, c.relrowsecurity,
        (select count(*)::int from pg_policies p where p.tablename = c.relname) as policies
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by c.relname`;
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    expect(
      Object.fromEntries(rows.map((r) => [r.relname, r.policies])),
    ).toEqual({
      alerts: 0,
      calendar_loads: 0,
      competitions: 1,
      decisions: 1,
      ingest_attempts: 0,
      matches: 1,
      observations: 1,
      raw_purges: 0,
      team_aliases: 0,
      teams: 1,
    });
    const policies =
      await sql`select tablename, cmd, roles, qual from pg_policies where schemaname = 'public'`;
    for (const p of policies) {
      expect(p.cmd).toBe("SELECT");
      expect(p.qual).toBe("true");
      expect([...p.roles].sort()).toEqual(["anon", "authenticated"]);
    }
  });

  it("board runs as the invoker", async () => {
    const [{ options }] =
      await sql`select reloptions as options from pg_class where relname = 'board'`;
    expect(options).toContain("security_invoker=true");
  });

  it("anon cannot see alerts nor write observations, but can read board", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      await tx`insert into alerts (kind, match_id, details) values ('silence', ${m}, '{}')`;
      await tx`set local role anon`;
      const [{ count }] = await tx`select count(*)::int as count from alerts`;
      expect(count).toBe(0);
      await expect(tx`select * from board`).resolves.toBeDefined();
      expect(await pgCode(observation(tx, m, { status: "scheduled" }))).toBe(
        "42501",
      );
    }));
});

describe("SPEC-006 CA-1 added_minute, raw_purges and the raw bucket", () => {
  it("accepts added_minute on live", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const [row] = await observation(tx, m, {
        status: "live",
        home_score: 1,
        away_score: 0,
        minute: 45,
        added_minute: 3,
      });
      expect(row.id).toBeDefined();
    }));

  it.each([
    ["finished with added_minute", { status: "finished", added_minute: 3 }],
    [
      "live with added_minute 0",
      { status: "live", minute: 45, added_minute: 0 },
    ],
    [
      "live with added_minute 31",
      { status: "live", minute: 45, added_minute: 31 },
    ],
  ])("rejects %s", (_name, state) =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      expect(
        await pgCode(
          observation(tx, m, { home_score: 1, away_score: 0, ...state }),
        ),
      ).toBe("23514");
    }),
  );

  it("rejects an empty raw_ref", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      expect(
        await pgCode(observation(tx, m, { status: "scheduled", raw_ref: "" })),
      ).toBe("23514");
    }));

  it("rejects added_minute outside live on decisions too", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const [{ id: oid }] = await observation(tx, m, { status: "scheduled" });
      expect(
        await pgCode(
          decision(
            tx,
            m,
            { status: "finished", minute: null, added_minute: 3 },
            [oid],
          ),
        ),
      ).toBe("23514");
    }));

  it("shows the added_minute of the current decision on board", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const [{ id: oid }] = await observation(tx, m, {
        status: "live",
        home_score: 1,
        away_score: 0,
        minute: 45,
        added_minute: 3,
      });
      await decision(tx, m, { minute: 45, added_minute: 3 }, [oid]);
      const [row] = await tx`select * from board where match_id = ${m}`;
      expect(row).toMatchObject({ minute: 45, added_minute: 3 });
    }));

  it("keeps a details column on ingest_attempts", () =>
    rollback(async (tx) => {
      const [row] = await tx`insert into ingest_attempts (source_id, details)
        values ('test', ${tx.json({ season: "2026-27" })}) returning details`;
      expect(row.details).toEqual({ season: "2026-27" });
    }));

  it("records a purge in raw_purges and rejects a negative count", () =>
    rollback(async (tx) => {
      const [row] = await tx`insert into raw_purges (ok, deleted)
        values (true, 7) returning id, started_at, ok, deleted, finished_at, error`;
      expect(row).toMatchObject({ ok: true, deleted: 7, error: null });
      expect(
        await pgCode(
          tx.savepoint((s) => s`insert into raw_purges (deleted) values (-1)`),
        ),
      ).toBe("23514");
    }));

  it("has a private raw bucket that anon cannot list", () =>
    rollback(async (tx) => {
      const [bucket] =
        await tx`select public from storage.buckets where id = 'raw'`;
      expect(bucket.public).toBe(false);
      await tx`set local role anon`;
      const [{ count }] =
        await tx`select count(*)::int as count from storage.objects where bucket_id = 'raw'`;
      expect(count).toBe(0);
    }));
});

describe("SPEC-007 CA-1 the forced_finish alert kind", () => {
  it("accepts forced_finish with a real match", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const [row] = await tx`insert into alerts (kind, match_id, details)
        values ('forced_finish', ${m}, '{"score": {"home": 1, "away": 0}}')
        returning id, kind, resolved_at`;
      expect(row).toMatchObject({ kind: "forced_finish", resolved_at: null });
    }));

  it("rejects forced_finish without a match (alerts_check)", () =>
    rollback(async (tx) => {
      expect(
        await pgCode(
          tx.savepoint(
            (s) =>
              s`insert into alerts (kind, match_id, details) values ('forced_finish', null, '{}')`,
          ),
        ),
      ).toBe("23514");
    }));

  it("rejects an unknown kind (alerts_kind_check)", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      expect(
        await pgCode(
          tx.savepoint(
            (s) =>
              s`insert into alerts (kind, match_id, details) values ('whatever', ${m}, '{}')`,
          ),
        ),
      ).toBe("23514");
    }));

  it("still accepts unresolved_team without a match", () =>
    rollback(async (tx) => {
      const [row] = await tx`insert into alerts (kind, match_id, details)
        values ('unresolved_team', null, '{}') returning id`;
      expect(row.id).toBeDefined();
    }));
});
