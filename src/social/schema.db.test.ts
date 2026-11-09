import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createSql } from "../db/connect.ts";

// SPEC-066 CA-1 (ADR-030 §2): the outbox social_posts against the local
// Supabase. Every case runs in a transaction that is rolled back.
const sql = createSql(process.env);
type Tx = TransactionSql;
const ROLLBACK = Symbol("rollback");

afterAll(() => sql.end());

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
// survives it and the next assertion can go on.
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

const KICKOFF = "2026-11-07T17:30:00.000Z";

async function seedDecision(tx: Tx): Promise<{ matchId: string; decisionId: string }> {
  const matchId = `test-${crypto.randomUUID()}`;
  await tx`insert into competitions (id, season, name, tier)
    values ('primera-division', '2026-27', 'Test', 1) on conflict do nothing`;
  await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
    on conflict do nothing`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${matchId}, 'primera-division', '2026-27', 1, ${KICKOFF}, 'test-home', 'test-away')`;
  const [o] = await tx<{ id: string }[]>`insert into observations
      (match_id, source_id, status, home_score, away_score, minute, observed_at, received_at, raw_ref)
    values (${matchId}, 'rfef', 'live', 1, 0, 20, ${KICKOFF}, ${KICKOFF}, 'raw/test.json.gz')
    returning id`;
  const [d] = await tx<{ id: string }[]>`insert into decisions
      (match_id, status, home_score, away_score, minute, qualifier, rule, observation_ids, decided_at)
    values (${matchId}, 'live', 1, 0, 20, 'confirmado', 'RN-01', ${tx.array([o.id])}::uuid[], ${KICKOFF})
    returning id`;
  return { matchId, decisionId: d.id };
}

const insertPost = (
  tx: Tx,
  decisionId: string,
  matchId: string,
  side: string,
  kind: string,
) =>
  tx<{ id: string; status: string; attempts: number; created_at: Date }[]>`
    insert into social_posts (decision_id, match_id, side, kind)
    values (${decisionId}, ${matchId}, ${side}, ${kind})
    returning id, status, attempts, created_at`;

describe("SPEC-066 CA-1 social_posts", () => {
  it("inserts a row with the defaults: pending, 0 attempts, created_at sealed by Postgres", () =>
    rollback(async (tx) => {
      const { matchId, decisionId } = await seedDecision(tx);
      const [row] = await insertPost(tx, decisionId, matchId, "home", "goal");
      expect(row.status).toBe("pending");
      expect(row.attempts).toBe(0);
      expect(row.created_at).toBeInstanceOf(Date);
      const [cols] = await tx<{ nullable: string[] }[]>`
        select array_agg(column_name::text order by column_name) as nullable
        from information_schema.columns
        where table_schema = 'public' and table_name = 'social_posts'
          and is_nullable = 'YES'`;
      expect(cols.nullable).toEqual([
        "closed_at",
        "provider",
        "provider_post_id",
        "reason",
        "template_id",
        "text",
      ]);
    }));

  it("one row per (decision, side): the second is 23505", () =>
    rollback(async (tx) => {
      const { matchId, decisionId } = await seedDecision(tx);
      await insertPost(tx, decisionId, matchId, "home", "goal");
      expect(
        await pgCode(tx, (s) =>
          insertPost(s, decisionId, matchId, "home", "goal_annulled"),
        ),
      ).toBe("23505");
      // The other side of the same Decision is a different row.
      expect(
        await pgCode(tx, (s) => insertPost(s, decisionId, matchId, "away", "goal")),
      ).toBeUndefined();
    }));

  it.each([
    ["side", "centre", "goal"],
    ["kind", "home", "own_goal"],
  ])("rejects an invented %s (23514)", (_, side, kind) =>
    rollback(async (tx) => {
      const { matchId, decisionId } = await seedDecision(tx);
      expect(
        await pgCode(tx, (s) => insertPost(s, decisionId, matchId, side, kind)),
      ).toBe("23514");
    }),
  );

  it("rejects an invented status (23514) and accepts the six", () =>
    rollback(async (tx) => {
      const { matchId, decisionId } = await seedDecision(tx);
      const [row] = await insertPost(tx, decisionId, matchId, "home", "goal");
      for (const status of [
        "pending",
        "sending",
        "sent",
        "failed",
        "expired",
        "skipped",
      ])
        expect(
          await pgCode(
            tx,
            (s) =>
              s`update social_posts set status = ${status} where id = ${row.id}`,
          ),
        ).toBeUndefined();
      expect(
        await pgCode(
          tx,
          (s) =>
            s`update social_posts set status = 'posted' where id = ${row.id}`,
        ),
      ).toBe("23514");
    }));

  it("needs an existing Decision and an existing match (23503)", () =>
    rollback(async (tx) => {
      const { matchId, decisionId } = await seedDecision(tx);
      expect(
        await pgCode(tx, (s) =>
          insertPost(s, crypto.randomUUID(), matchId, "home", "goal"),
        ),
      ).toBe("23503");
      expect(
        await pgCode(tx, (s) =>
          insertPost(s, decisionId, "no-such-match", "home", "goal"),
        ),
      ).toBe("23503");
    }));

  it("has a partial index over the open rows and RLS enabled with no policy", async () => {
    const indexes = await sql<{ indexdef: string }[]>`
      select indexdef from pg_indexes
      where schemaname = 'public' and tablename = 'social_posts'`;
    const partial = indexes.filter((i) => /WHERE .*status/i.test(i.indexdef));
    expect(partial).toHaveLength(1);
    expect(partial[0].indexdef).toMatch(/'pending'/);
    expect(partial[0].indexdef).toMatch(/'sending'/);
    const [rls] = await sql<{ relrowsecurity: boolean }[]>`
      select relrowsecurity from pg_class
      where oid = 'public.social_posts'::regclass`;
    expect(rls.relrowsecurity).toBe(true);
    const policies = await sql`select 1 from pg_policies
      where schemaname = 'public' and tablename = 'social_posts'`;
    expect(policies).toHaveLength(0);
  });

  it("web_reader gets 42501 on select (ADR-015 §3)", () =>
    rollback(async (tx) => {
      await tx`grant web_reader to postgres`;
      await tx.unsafe("set local role web_reader");
      expect(
        await pgCode(tx, (s) => s`select 1 from public.social_posts`),
      ).toBe("42501");
    }));
});
