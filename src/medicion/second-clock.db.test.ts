import { readFileSync } from "node:fs";
import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { createSql } from "../db/connect.ts";
import { createIngestDb } from "../ingest/db.ts";
import { insertDecision } from "../ingest/engine.ts";

// SPEC-025 CA-1 (ADR-016): the second clock is Postgres's, sealed by column
// default; no code writes it. Always rolled back, except the attempt opened by
// the real port, which is deleted at the end (ingest_attempts is an ops table).

const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");
const MIGRATION = readFileSync(
  new URL(
    "../../supabase/migrations/20261009180000_spec025_second_clock.sql",
    import.meta.url,
  ),
  "utf8",
);

// A window nobody else occupies (see informe.db.test.ts).
const KICKOFF = "2027-07-11T16:00:00.000Z" as Instant;
const at = (minutes: number): Instant =>
  shiftInstant(KICKOFF, minutes * MINUTE_MS);

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

async function seedMatch(tx: TransactionSql): Promise<string> {
  const id = `test-${crypto.randomUUID()}`;
  await tx`insert into competitions (id, season, name, tier)
    values ('primera-division', '2026-27', 'Test', 1) on conflict do nothing`;
  await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
    on conflict do nothing`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, 'primera-division', '2026-27', 1, ${KICKOFF}, 'test-home', 'test-away')`;
  return id;
}

async function observe(
  tx: TransactionSql,
  matchId: string,
  rawRef: string,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into observations (match_id, source_id, status, home_score, away_score,
      minute, observed_at, received_at, raw_ref)
    values (${matchId}, 'api-football', 'live', 1, 0, 20, ${at(20)}, ${at(20)}, ${rawRef})
    returning id`;
  return row.id;
}

const insertRawDecision = (tx: TransactionSql, matchId: string, obs: string) =>
  tx`insert into decisions (match_id, status, home_score, away_score, minute,
      qualifier, rule, observation_ids, decided_at)
    values (${matchId}, 'live', 1, 0, 20, 'confirmado', 'RN-01',
      ${tx.array([obs])}::uuid[], ${at(20)})`;

describe("SPEC-025 CA-1 the migration of the second clock", () => {
  it("leaves the rows written before it null and seals the new ones", () =>
    rollback(async (tx) => {
      // The schema as it was before the migration, inside this transaction.
      await tx`alter table ingest_attempts drop column opened_at`;
      await tx`alter table decisions drop column recorded_at`;
      const matchId = await seedMatch(tx);
      const obs = await observe(tx, matchId, "raw/test/before.json.gz");
      const [before] = await tx<{ id: string }[]>`
        insert into ingest_attempts (source_id, started_at)
        values ('test-spec025-before', ${at(19)}) returning id`;
      await insertRawDecision(tx, matchId, obs);

      await tx.unsafe(MIGRATION);

      const [prev] = await tx<{ opened_at: Date | null }[]>`
        select opened_at from ingest_attempts where id = ${before.id}`;
      expect(prev.opened_at).toBeNull();
      const [prevDecision] = await tx<{ recorded_at: Date | null }[]>`
        select recorded_at from decisions where match_id = ${matchId} and version = 1`;
      expect(prevDecision.recorded_at).toBeNull();

      const [after] = await tx<{ opened_at: Date | null }[]>`
        insert into ingest_attempts (source_id, started_at)
        values ('test-spec025-after', ${at(20)}) returning opened_at`;
      expect(after.opened_at).toBeInstanceOf(Date);
      await insertRawDecision(tx, matchId, obs);
      const [next] = await tx<{ recorded_at: Date | null }[]>`
        select recorded_at from decisions where match_id = ${matchId} and version = 2`;
      expect(next.recorded_at).toBeInstanceOf(Date);
    }));

  it("is nullable, with clock_timestamp() as default, on both tables", async () => {
    const rows = await sql<
      {
        table_name: string;
        column_name: string;
        is_nullable: string;
        column_default: string | null;
        data_type: string;
      }[]
    >`select table_name, column_name, is_nullable, column_default, data_type
      from information_schema.columns
      where table_schema = 'public'
        and (table_name, column_name) in
          (('ingest_attempts', 'opened_at'), ('decisions', 'recorded_at'))
      order by table_name`;
    expect(rows).toEqual([
      {
        table_name: "decisions",
        column_name: "recorded_at",
        is_nullable: "YES",
        column_default: "clock_timestamp()",
        data_type: "timestamp with time zone",
      },
      {
        table_name: "ingest_attempts",
        column_name: "opened_at",
        is_nullable: "YES",
        column_default: "clock_timestamp()",
        data_type: "timestamp with time zone",
      },
    ]);
  });
});

describe("SPEC-025 CA-1 the real port seals both instants", () => {
  it("an attempt and a Decision written by the code carry them, recorded_at ≥ opened_at", async () => {
    const sourceId = `test-spec025-${crypto.randomUUID()}`;
    const db = createIngestDb(sql);
    const opened = await db.openAttempt(sourceId, at(20), 30);
    if (!("id" in opened)) throw new Error("the attempt was skipped");
    try {
      const rawRef = `raw/test/${opened.id}.json.gz`;
      await db.closeAttempt(opened.id, {
        finishedAt: at(20),
        ok: true,
        rawRef,
        observations: 1,
        details: {},
      });
      await rollback(async (tx) => {
        const matchId = await seedMatch(tx);
        const obs = await observe(tx, matchId, rawRef);
        await insertDecision(tx, {
          matchId: matchId as never,
          status: "live",
          score: { home: 1, away: 0 },
          minute: 20,
          addedMinute: null,
          qualifier: "confirmado",
          rule: "RN-01",
          observationIds: [obs as never],
          decidedAt: at(20),
        } as never);
        // The attempt that brought the observation the Decision cites.
        const [row] = await tx<
          { opened_at: Date | null; recorded_at: Date | null }[]
        >`select a.opened_at, d.recorded_at
          from decisions d
          join observations o on o.id = any (d.observation_ids)
          join ingest_attempts a on a.raw_ref = o.raw_ref
          where d.match_id = ${matchId}`;
        expect(row.opened_at).toBeInstanceOf(Date);
        expect(row.recorded_at).toBeInstanceOf(Date);
        expect(
          (row.recorded_at as Date).getTime() -
            (row.opened_at as Date).getTime(),
        ).toBeGreaterThanOrEqual(0);
      });
    } finally {
      await sql`delete from ingest_attempts where source_id = ${sourceId}`;
    }
  });
});

describe("SPEC-025 CA-1 nothing public carries them (ADR-016 §4)", () => {
  it("web.xornada and public.board have neither column", async () => {
    const rows = await sql<{ table_schema: string; column_name: string }[]>`
      select table_schema, column_name from information_schema.columns
      where (table_schema, table_name) in (('web', 'xornada'), ('public', 'board'))
        and column_name in ('opened_at', 'recorded_at')`;
    expect(rows).toEqual([]);
  });

  it("the board_delta payload (a row of web.xornada) has neither key", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      const obs = await observe(tx, matchId, "raw/test/payload.json.gz");
      await insertRawDecision(tx, matchId, obs);
      // The same expression private.send_board_delta sends.
      const [row] = await tx<{ payload: Record<string, unknown> }[]>`
        select to_jsonb(x) as payload from web.xornada x where x.match_id = ${matchId}`;
      expect(row.payload.version).toBe(1);
      expect(Object.keys(row.payload)).not.toContain("recorded_at");
      expect(Object.keys(row.payload)).not.toContain("opened_at");
    }));
});
