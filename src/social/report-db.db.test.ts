import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createSql } from "../db/connect.ts";
import type { Instant } from "../model/index.ts";
import { reportRows } from "./report-db.ts";

// SPEC-079 CA-2 against the local Supabase: the read-only query of the
// report. Rows are committed (the query opens a transaction of its own) and
// removed in afterAll, as the concurrent tests of db.db.test.ts do.
const sql = createSql(process.env);
const committed: string[] = [];

const WINDOW = {
  from: "2026-11-07T00:00:00.000Z" as Instant,
  to: "2026-11-11T00:00:00.000Z" as Instant,
};

async function seedMatch(kickoff: Instant): Promise<string> {
  const id = `test-${crypto.randomUUID()}`;
  await sql`insert into competitions (id, season, name, tier)
    values ('primera-division', '2026-27', 'Test', 1) on conflict do nothing`;
  await sql`insert into teams (id, name) values
      ('celta', 'RC Celta'), ('real-madrid', 'Real Madrid')
    on conflict do nothing`;
  await sql`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, 'primera-division', '2026-27', 12, ${kickoff}, 'celta', 'real-madrid')`;
  committed.push(id);
  return id;
}

async function seedDecision(
  matchId: string,
  version: number,
  status: "scheduled" | "live",
  score: [number, number] | null,
  decidedAt: Instant,
): Promise<string> {
  const [o] = await sql<{ id: string }[]>`insert into observations
      (match_id, source_id, status, home_score, away_score, minute,
       observed_at, received_at, raw_ref)
    values (${matchId}, 'rfef', ${status}, ${score?.[0] ?? null}, ${score?.[1] ?? null},
      ${status === "live" ? 20 : null}, ${decidedAt}, ${decidedAt}, 'raw/test.json.gz')
    returning id`;
  const [d] = await sql<{ id: string }[]>`insert into decisions
      (match_id, version, status, home_score, away_score, minute, qualifier,
       rule, observation_ids, decided_at)
    values (${matchId}, ${version}, ${status}, ${score?.[0] ?? null}, ${score?.[1] ?? null},
      ${status === "live" ? 20 : null}, 'confirmado', 'RN-01',
      ${sql.array([o.id])}::uuid[], ${decidedAt})
    returning id`;
  return d.id;
}

async function seedPending(decisionId: string, matchId: string) {
  const [p] = await sql<{ id: string }[]>`insert into social_posts
      (decision_id, match_id, side, kind) values (${decisionId}, ${matchId}, 'home', 'goal')
    returning id`;
  return p.id;
}

// A match inside the window with three Decisions, the first of them decided
// before the window opens, and one pending row; a match outside the window
// with the same shape.
async function seedBoth() {
  const inside = await seedMatch("2026-11-07T17:30:00.000Z");
  await seedDecision(inside, 1, "scheduled", null, "2026-11-01T10:00:00.000Z");
  await seedDecision(inside, 2, "live", [0, 0], "2026-11-07T17:31:00.000Z");
  const goal = await seedDecision(
    inside,
    3,
    "live",
    [1, 0],
    "2026-11-07T17:50:00.000Z",
  );
  const pending = await seedPending(goal, inside);
  const outside = await seedMatch("2026-11-14T17:30:00.000Z");
  await seedDecision(outside, 1, "live", [0, 0], "2026-11-14T17:31:00.000Z");
  const other = await seedDecision(
    outside,
    2,
    "live",
    [1, 0],
    "2026-11-14T17:50:00.000Z",
  );
  await seedPending(other, outside);
  return { inside, outside, goal, pending };
}

describe("SPEC-079 CA-2 reportRows", () => {
  it("reads only the matches of the window, with every Decision by version and their rows", async () => {
    const { inside, goal, pending } = await seedBoth();
    const rows = await reportRows(sql, WINDOW);
    const matches = rows.matches.filter((m) => committed.includes(m.id));
    expect(matches.map((m) => m.id)).toEqual([inside]);
    expect(matches[0]).toMatchObject({
      season: "2026-27",
      kickoff: "2026-11-07T17:30:00.000Z",
      home: { id: "celta", name: "RC Celta" },
      away: { id: "real-madrid", name: "Real Madrid" },
    });
    const decisions = rows.decisions.filter((d) => d.matchId === inside);
    expect(decisions.map((d) => d.version)).toEqual([1, 2, 3]);
    expect(decisions[0]).toMatchObject({
      status: "scheduled",
      score: null,
      decidedAt: "2026-11-01T10:00:00.000Z",
    });
    expect(decisions[2]).toMatchObject({
      id: goal,
      status: "live",
      score: { home: 1, away: 0 },
      qualifier: "confirmado",
    });
    expect(rows.decisions.some((d) => !committed.includes(d.matchId))).toBe(
      false,
    );
    const posts = rows.posts.filter((p) => committed.includes(p.matchId));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      id: pending,
      decisionId: goal,
      matchId: inside,
      side: "home",
      kind: "goal",
      status: "pending",
      attempts: 0,
      reason: null,
      text: null,
      closedAt: null,
    });
    expect(posts[0]?.createdAt).toMatch(/Z$/);
  });

  it("leaves the pending row pending with attempts = 0", async () => {
    const { pending } = await seedBoth();
    await reportRows(sql, WINDOW);
    const [row] = await sql<{ status: string; attempts: number }[]>`
      select status, attempts from social_posts where id = ${pending}`;
    expect(row).toEqual({ status: "pending", attempts: 0 });
  });

  it("an empty window reads nothing and fails nowhere", async () => {
    const rows = await reportRows(sql, {
      from: "2020-01-01T00:00:00.000Z",
      to: "2020-01-02T00:00:00.000Z",
    });
    expect(rows).toEqual({ matches: [], decisions: [], posts: [] });
  });

  it("the file writes nothing: no insert, update or delete, and the transaction is read only", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./report-db.ts", import.meta.url)),
      "utf8",
    );
    const code = source
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(code).not.toMatch(/\b(insert|update|delete)\b/i);
    expect(code).toMatch(/"read only"/);
  });
});

afterAll(async () => {
  if (committed.length > 0)
    await sql.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      const ids = tx.array(committed);
      await tx`delete from social_posts where match_id = any(${ids})`;
      await tx`delete from decisions where match_id = any(${ids})`;
      await tx`delete from observations where match_id = any(${ids})`;
      await tx`delete from matches where id = any(${ids})`;
    });
  await sql.end();
});
