import { readFileSync } from "node:fs";
import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { getSql } from "./client.ts";

// SPEC-020 CA-2 (ADR-014 §2-§4): web.xornada, web_reader and the end of the
// anonymous read. Every case runs in a transaction that is rolled back.
const sql = getSql();
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

// The error code of a statement run in its own savepoint, so the transaction
// survives a 42501 and the next case can go on.
async function pgCode(
  tx: Tx,
  fn: (s: Tx) => Promise<unknown>,
): Promise<string | undefined> {
  try {
    await tx.savepoint((s) => fn(s as Tx));
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}

async function seedMatch(tx: Tx): Promise<string> {
  const id = `test:${crypto.randomUUID()}`;
  await tx`insert into competitions (id, season, name, tier) values ('test-comp', '2026-27', 'Test', 5)`;
  await tx`insert into teams (id, name, short_name) values ('test-home', 'Home FC', 'Home'), ('test-away', 'Away CF', null)`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, 'test-comp', '2026-27', 3, '2026-09-20T16:00:00Z', 'test-home', 'test-away')`;
  return id;
}

async function seedDecision(tx: Tx, matchId: string): Promise<void> {
  const [{ id }] = await tx`insert into observations ${tx({
    match_id: matchId,
    source_id: "test",
    observed_at: "2026-09-20T16:47:00Z",
    raw_ref: "raw/test.json",
    status: "live",
    home_score: 2,
    away_score: 1,
    minute: 45,
    added_minute: 3,
  })} returning id`;
  await tx`insert into decisions ${tx({
    match_id: matchId,
    status: "live",
    home_score: 2,
    away_score: 1,
    minute: 45,
    added_minute: 3,
    qualifier: "provisional",
    rule: "operator",
    observation_ids: [id],
    decided_at: "2026-09-20T16:47:05Z",
  })}`;
}

// postgres created web_reader in the migration and holds ADMIN on it; the
// membership that lets it SET ROLE lives only inside this transaction.
const asRole = async (
  tx: Tx,
  role: "web_reader" | "anon" | "authenticated",
) => {
  if (role === "web_reader") await tx`grant web_reader to postgres`;
  await tx.unsafe(`set local role ${role}`);
};

const PUBLIC_TABLES = [
  "competitions",
  "teams",
  "matches",
  "observations",
  "decisions",
] as const;

afterAll(() => sql.end());

describe("SPEC-020 CA-2 web.xornada", () => {
  it("has exactly the columns of ADR-014 §3 plus season, in order", async () => {
    const cols = await sql`select column_name from information_schema.columns
      where table_schema = 'web' and table_name = 'xornada' order by ordinal_position`;
    expect(cols.map((c) => c.column_name)).toEqual([
      "match_id",
      "competition_id",
      "season",
      "competition_name",
      "tier",
      "round",
      "kickoff",
      "home_name",
      "home_short_name",
      "away_name",
      "away_short_name",
      "status",
      "home_score",
      "away_score",
      "minute",
      "added_minute",
      "qualifier",
      "version",
      "observed_at",
      "decided_at",
    ]);
  });

  it("is the only relation of the web schema, and web is not exposed by the API", async () => {
    const rels = await sql`select c.relname, c.relkind from pg_class c
      join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'web'`;
    expect(rels.map((r) => [r.relname, r.relkind])).toEqual([["xornada", "v"]]);
    const config = readFileSync("supabase/config.toml", "utf8");
    const schemas = config.match(/^schemas = \[(.*)\]$/m)?.[1] ?? "";
    expect(schemas).toContain('"public"');
    expect(schemas).not.toContain("web");
  });

  it("a match without Decision: scheduled, confirmado, version 0, nulls", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const [row] = await tx`select * from web.xornada where match_id = ${m}`;
      expect(row).toEqual({
        match_id: m,
        competition_id: "test-comp",
        season: "2026-27",
        competition_name: "Test",
        tier: 5,
        round: 3,
        kickoff: new Date("2026-09-20T16:00:00Z"),
        home_name: "Home FC",
        home_short_name: "Home",
        away_name: "Away CF",
        away_short_name: null,
        status: "scheduled",
        home_score: null,
        away_score: null,
        minute: null,
        added_minute: null,
        qualifier: "confirmado",
        version: 0,
        observed_at: null,
        decided_at: null,
      });
    }));

  it("a match with Decision: its latest version and observed_at", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      await seedDecision(tx, m);
      const [row] = await tx`select * from web.xornada where match_id = ${m}`;
      expect(row).toMatchObject({
        status: "live",
        home_score: 2,
        away_score: 1,
        minute: 45,
        added_minute: 3,
        qualifier: "provisional",
        version: 1,
        observed_at: new Date("2026-09-20T16:47:00Z"),
        decided_at: new Date("2026-09-20T16:47:05Z"),
      });
    }));
});

describe("SPEC-020 CA-2 web_reader", () => {
  it("is a login role with no password in the repo and no other power", async () => {
    const [role] = await sql`select rolcanlogin, rolsuper, rolcreaterole,
      rolcreatedb, rolbypassrls, rolreplication from pg_roles where rolname = 'web_reader'`;
    expect(role).toEqual({
      rolcanlogin: true,
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolbypassrls: false,
      rolreplication: false,
    });
    const migrations = readFileSync(
      "supabase/migrations/20261007120000_spec020_web_xornada.sql",
      "utf8",
    );
    expect(migrations).not.toMatch(/password/i);
  });

  it("has USAGE on web and SELECT on web.xornada only", async () => {
    const grants = await sql`select table_schema, table_name, privilege_type
      from information_schema.role_table_grants where grantee = 'web_reader'
      order by 1, 2, 3`;
    expect(grants.map((g) => Object.values(g))).toEqual([
      ["web", "xornada", "SELECT"],
    ]);
    const [{ usage }] =
      await sql`select has_schema_privilege('web_reader', 'web', 'USAGE') as usage`;
    expect(usage).toBe(true);
  });

  it("reads the view", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      await seedDecision(tx, m);
      await asRole(tx, "web_reader");
      const rows = await tx`select * from web.xornada where match_id = ${m}`;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: "live", version: 1 });
    }));

  it.each(["matches", "decisions", "observations", "board", "alerts"])(
    "gets 42501 reading public.%s",
    (table) =>
      rollback(async (tx) => {
        await asRole(tx, "web_reader");
        expect(
          await pgCode(tx, (s) => s.unsafe(`select 1 from public.${table}`)),
        ).toBe("42501");
      }),
  );

  it("gets 42501 on any INSERT", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      await asRole(tx, "web_reader");
      const inserts = [
        (s: Tx) =>
          s`insert into public.alerts (kind, match_id, details) values ('silence', ${m}, '{}')`,
        (s: Tx) =>
          s`insert into public.decisions (match_id, status, qualifier, rule, observation_ids)
            values (${m}, 'scheduled', 'confirmado', 'operator', '{}')`,
        (s: Tx) =>
          s`insert into public.observations (match_id, source_id, observed_at, raw_ref, status)
            values (${m}, 'test', now(), 'raw/x', 'scheduled')`,
        (s: Tx) =>
          s`insert into public.teams (id, name) values ('x-team', 'X')`,
      ];
      for (const insert of inserts) {
        expect(await pgCode(tx, insert)).toBe("42501");
      }
      // The view is not updatable (55000 comes before the ACL check), so the
      // privilege itself is what is checked there.
      const [{ insert }] =
        await tx`select has_table_privilege('web.xornada', 'INSERT') as insert`;
      expect(insert).toBe(false);
    }));
});

describe.each(["anon", "authenticated"] as const)(
  "SPEC-020 CA-2 %s reads nothing",
  (role) => {
    it.each(PUBLIC_TABLES)("0 rows in public.%s", (table) =>
      rollback(async (tx) => {
        const m = await seedMatch(tx);
        await seedDecision(tx, m);
        await asRole(tx, role);
        const rows = await tx.unsafe(`select * from public.${table}`);
        expect(rows).toHaveLength(0);
      }),
    );

    // The SELECT on board is revoked (ADR-014 §2 supersedes ADR-006 §6):
    // stronger than 0 rows, the relation cannot be read at all.
    it("42501 on public.board", () =>
      rollback(async (tx) => {
        await seedMatch(tx);
        await asRole(tx, role);
        expect(await pgCode(tx, (s) => s`select * from public.board`)).toBe(
          "42501",
        );
      }));

    it("42501 on web.xornada", () =>
      rollback(async (tx) => {
        await seedMatch(tx);
        await asRole(tx, role);
        expect(await pgCode(tx, (s) => s`select * from web.xornada`)).toBe(
          "42501",
        );
      }));
  },
);
