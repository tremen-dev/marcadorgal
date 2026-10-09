import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import {
  toPublicMatch,
  toPublicMatches,
  type XornadaDbRow,
} from "../board/row.ts";
import { getSql } from "./client.ts";

// SPEC-024 CA-1 and CA-2 (ADR-014 §5, N-2, H-6): the trigger that sends the
// row of web.xornada to board:<season>, created disabled, and the policy that
// lets anon receive it and nobody send. Every case is rolled back.
const sql = getSql();
type Tx = TransactionSql;
const ROLLBACK = Symbol("rollback");
const SEASON = "2026-27";
const TOPIC = `board:${SEASON}`;

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
  const id = `test-${crypto.randomUUID()}`;
  await tx`insert into competitions (id, season, name, tier) values ('test-comp', ${SEASON}, 'Test', 5)
    on conflict do nothing`;
  await tx`insert into teams (id, name, short_name) values ('test-home', 'Home FC', 'Home'), ('test-away', 'Away CF', null)
    on conflict do nothing`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, 'test-comp', ${SEASON}, 3, '2026-09-20T16:00:00Z', 'test-home', 'test-away')`;
  return id;
}

async function insertDecision(tx: Tx, matchId: string): Promise<void> {
  const [{ id }] = await tx`insert into observations ${tx({
    match_id: matchId,
    source_id: "test",
    observed_at: "2026-09-20T16:47:00.123456Z",
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
    rule: "RN-01",
    observation_ids: [id],
    decided_at: "2026-09-20T16:47:05Z",
  })}`;
}

const boardMessages = (tx: Tx) =>
  tx<
    {
      topic: string;
      event: string;
      private: boolean;
      payload: Record<string, unknown>;
      extension: string;
    }[]
  >`
    select topic, event, private, payload, extension from realtime.messages
    where topic like 'board:%' and payload ->> 'match_id' like 'test-%'`;

const asRole = async (tx: Tx, role: "anon" | "authenticated") => {
  await tx.unsafe(`set local role ${role}`);
};

afterAll(() => sql.end());

describe("SPEC-024 CA-1 board_delta", () => {
  it("exists on public.decisions, AFTER INSERT FOR EACH ROW, and is created disabled (H-6)", async () => {
    const rows = await sql`select t.tgenabled, t.tgtype, p.proname, n.nspname
      from pg_trigger t join pg_proc p on p.oid = t.tgfoid
      join pg_namespace n on n.oid = p.pronamespace
      where t.tgrelid = 'public.decisions'::regclass and t.tgname = 'board_delta'`;
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.tgenabled).toBe("D");
    expect(row.nspname).toBe("private");
    // tgtype bits: 1 ROW, 2 BEFORE, 4 INSERT. ROW | INSERT, not BEFORE.
    expect(row.tgtype & 1).toBe(1);
    expect(row.tgtype & 2).toBe(0);
    expect(row.tgtype & 4).toBe(4);
  });

  it("disabled, inserting a Decision leaves no row in realtime.messages", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      await insertDecision(tx, m);
      expect(await boardMessages(tx)).toEqual([]);
    }));

  it("enabled, a Decision sends the row of web.xornada to board:<season>, private, event decision", () =>
    rollback(async (tx) => {
      await tx`alter table public.decisions enable trigger board_delta`;
      const m = await seedMatch(tx);
      await insertDecision(tx, m);
      const messages = await boardMessages(tx);
      expect(messages).toHaveLength(1);
      const [msg] = messages;
      expect(msg).toMatchObject({
        topic: TOPIC,
        event: "decision",
        private: true,
        extension: "broadcast",
      });
      const [{ row }] =
        await tx`select to_jsonb(x) as row from web.xornada x where match_id = ${m}`;
      const cols = await tx`select column_name from information_schema.columns
        where table_schema = 'web' and table_name = 'xornada'`;
      // realtime.send appends the id of the message itself (not ours).
      const { id, ...payload } = msg.payload;
      expect(typeof id).toBe("string");
      expect(Object.keys(payload).sort()).toEqual(
        cols.map((c) => c.column_name).sort(),
      );
      expect(payload).toEqual(row);
      expect(payload).toMatchObject({
        match_id: m,
        status: "live",
        version: 1,
      });
      // CA-3 end to end: the payload and the reader give the same PublicMatch.
      const viewRows = await tx<
        XornadaDbRow[]
      >`select * from web.xornada where match_id = ${m}`;
      expect(toPublicMatch(msg.payload)).toEqual(toPublicMatches(viewRows)[0]);
      for (const key of Object.keys(msg.payload)) {
        expect(key).not.toMatch(
          /^(rule|observation_ids|forced_finish)$|_source_id$/,
        );
      }
    }));

  it("an error while sending is a warning and never aborts the Decision", () =>
    rollback(async (tx) => {
      await tx`alter table public.decisions enable trigger board_delta`;
      await tx.unsafe(`create or replace function private.send_board_delta(p_match_id text)
        returns void language plpgsql security definer set search_path = '' as $$
        begin raise exception 'boom %', p_match_id; end $$`);
      const m = await seedMatch(tx);
      await insertDecision(tx, m);
      const decisions =
        await tx`select version from public.decisions where match_id = ${m}`;
      expect(decisions).toEqual([{ version: 1 }]);
      expect(await boardMessages(tx)).toEqual([]);
    }));

  it("both functions are security definer with an empty search_path", async () => {
    const rows = await sql`select p.proname, p.prosecdef, p.proconfig
      from pg_proc p where p.pronamespace = 'private'::regnamespace order by 1`;
    expect(rows.map((r) => r.proname)).toEqual([
      "board_delta",
      "send_board_delta",
    ]);
    for (const r of rows) {
      expect(r.prosecdef).toBe(true);
      expect(r.proconfig).toEqual(['search_path=""']);
    }
  });
});

describe("SPEC-024 CA-2 board_receive and private", () => {
  const seedMessages = async (tx: Tx) => {
    await tx`insert into realtime.messages (topic, extension, payload, event, private)
      values (${TOPIC}, 'broadcast', '{"match_id":"test-a"}', 'decision', true),
             ('other:x', 'broadcast', '{"match_id":"test-b"}', 'decision', true),
             (${TOPIC}, 'presence', '{"match_id":"test-c"}', 'decision', true)`;
  };
  const visible = (tx: Tx) =>
    tx<{ topic: string; extension: string }[]>`
      select topic, extension from realtime.messages
      where payload ->> 'match_id' like 'test-%' order by topic`;

  it("is the only policy of realtime.messages: SELECT for anon", async () => {
    const rows = await sql`select policyname, cmd, roles from pg_policies
      where schemaname = 'realtime' and tablename = 'messages'`;
    expect(rows).toEqual([
      { policyname: "board_receive", cmd: "SELECT", roles: ["anon"] },
    ]);
  });

  it("anon on a board:% topic sees its broadcast messages and no others", () =>
    rollback(async (tx) => {
      await seedMessages(tx);
      await tx`select set_config('realtime.topic', ${TOPIC}, true)`;
      await asRole(tx, "anon");
      expect(await visible(tx)).toEqual([
        { topic: TOPIC, extension: "broadcast" },
      ]);
    }));

  it("anon on another topic, or with none, sees nothing", () =>
    rollback(async (tx) => {
      await seedMessages(tx);
      await asRole(tx, "anon");
      expect(await visible(tx)).toEqual([]);
      await tx`select set_config('realtime.topic', 'other:x', true)`;
      expect(await visible(tx)).toEqual([]);
    }));

  it("anon cannot send: INSERT, UPDATE and DELETE do nothing or fail", () =>
    rollback(async (tx) => {
      await seedMessages(tx);
      await tx`select set_config('realtime.topic', ${TOPIC}, true)`;
      await asRole(tx, "anon");
      expect(
        await pgCode(
          tx,
          (
            s,
          ) => s`insert into realtime.messages (topic, extension, payload, event, private)
          values (${TOPIC}, 'broadcast', '{"match_id":"test-fake"}', 'decision', true)`,
        ),
      ).toBe("42501");
      const updated = await tx`update realtime.messages set payload = '{}'
        where payload ->> 'match_id' like 'test-%' returning 1`;
      expect(updated).toHaveLength(0);
      expect(await pgCode(tx, (s) => s`delete from realtime.messages`)).toBe(
        "42501",
      );
    }));

  it("authenticated sees none", () =>
    rollback(async (tx) => {
      await seedMessages(tx);
      await tx`select set_config('realtime.topic', ${TOPIC}, true)`;
      await asRole(tx, "authenticated");
      expect(await visible(tx)).toEqual([]);
    }));

  it.each(["anon", "authenticated", "web_reader"])(
    "%s has no USAGE on private nor EXECUTE on its functions",
    async (role) => {
      const [{ usage }] =
        await sql`select has_schema_privilege(${role}, 'private', 'USAGE') as usage`;
      expect(usage).toBe(false);
      const fns = await sql`select p.oid::regprocedure::text as fn,
        has_function_privilege(${role}, p.oid, 'EXECUTE') as exec
        from pg_proc p where p.pronamespace = 'private'::regnamespace`;
      expect(fns.length).toBe(2);
      for (const f of fns) expect(f.exec, f.fn).toBe(false);
    },
  );

  it("private is outside the API schemas and PUBLIC has nothing on it", async () => {
    const [{ acl }] =
      await sql`select nspacl::text as acl from pg_namespace where nspname = 'private'`;
    expect(acl ?? "").not.toMatch(/(^|[{,])=/);
    const { readFileSync } = await import("node:fs");
    const config = readFileSync("supabase/config.toml", "utf8");
    const schemas = config.match(/^schemas = \[(.*)\]$/m)?.[1] ?? "";
    expect(schemas).not.toContain("private");
  });
});
