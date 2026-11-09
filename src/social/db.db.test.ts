import type { Sql, TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createSql } from "../db/connect.ts";
import { type Instant, MINUTE_MS, shiftInstant } from "../model/index.ts";
import { socialConfig } from "./config.ts";
import { createSocialDb } from "./db.ts";
import { dispatchSocial, POST_TTL_MINUTES } from "./dispatch.ts";
import { seededRng } from "./pick.ts";
import {
  createMemoryPublisher,
  type PublishResult,
  type SocialPublisher,
} from "./publisher.ts";

// SPEC-066 CA-5, CA-6, CA-7 against the local Supabase: the postgres.js
// SocialDb, and two concurrent dispatches over the same rows. Rolled back
// where one connection is enough; committed and cleaned where two are not.
const sql = createSql(process.env);
type Tx = TransactionSql;
const ROLLBACK = Symbol("rollback");

const KICKOFF = "2026-11-07T17:30:00.000Z" as Instant;
const at = (minutes: number): Instant =>
  shiftInstant(KICKOFF, minutes * MINUTE_MS);
const NOW = at(30);

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

// Teams with the ids of Equipo galego (data/galegos/2026-27.json) so the
// default of SOCIAL_WATCHED_TEAMS watches them, and one that is not.
async function seedMatch(
  q: Sql | Tx,
  home = "celta",
  away = "deportivo",
): Promise<string> {
  const id = `test-${crypto.randomUUID()}`;
  await q`insert into competitions (id, season, name, tier)
    values ('primera-division', '2026-27', 'Test', 1) on conflict do nothing`;
  await q`insert into teams (id, name) values
      ('celta', 'RC Celta'), ('deportivo', 'RC Deportivo'),
      ('real-madrid', 'Real Madrid')
    on conflict do nothing`;
  await q`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, 'primera-division', '2026-27', 12, ${KICKOFF}, ${home}, ${away})`;
  return id;
}

// A live Decision at `decidedAt` with the given score and minute, and one
// outbox row for it.
async function seedPost(
  q: Sql | Tx,
  matchId: string,
  options: {
    side?: "home" | "away";
    kind?: "goal" | "goal_annulled";
    score?: [number, number];
    minute?: number | null;
    addedMinute?: number | null;
    decidedAt?: Instant;
    status?: string;
    reason?: string | null;
    text?: string | null;
    templateId?: string | null;
    attempts?: number;
  } = {},
): Promise<string> {
  const [home, away] = options.score ?? [1, 0];
  const decidedAt = options.decidedAt ?? at(20);
  const [o] = await q<{ id: string }[]>`insert into observations
      (match_id, source_id, status, home_score, away_score, minute, added_minute,
       observed_at, received_at, raw_ref)
    values (${matchId}, 'rfef', 'live', ${home}, ${away}, ${options.minute ?? 20},
      ${options.addedMinute ?? null}, ${decidedAt}, ${decidedAt}, 'raw/test.json.gz')
    returning id`;
  const [d] = await q<{ id: string }[]>`insert into decisions
      (match_id, status, home_score, away_score, minute, added_minute, qualifier,
       rule, observation_ids, decided_at)
    values (${matchId}, 'live', ${home}, ${away}, ${options.minute ?? 20},
      ${options.addedMinute ?? null}, 'confirmado', 'RN-01',
      ${q.array([o.id])}::uuid[], ${decidedAt})
    returning id`;
  const [p] = await q<{ id: string }[]>`insert into social_posts
      (decision_id, match_id, side, kind, status, reason, text, template_id, attempts)
    values (${d.id}, ${matchId}, ${options.side ?? "home"}, ${options.kind ?? "goal"},
      ${options.status ?? "pending"}, ${options.reason ?? null},
      ${options.text ?? null}, ${options.templateId ?? null}, ${options.attempts ?? 0})
    returning id`;
  return p.id;
}

const postRow = async (q: Sql | Tx, id: string) => {
  const [row] = await q<
    {
      status: string;
      attempts: number;
      reason: string | null;
      text: string | null;
      template_id: string | null;
      provider: string | null;
      provider_post_id: string | null;
      closed_at: Date | null;
    }[]
  >`select status, attempts, reason, text, template_id, provider,
      provider_post_id, closed_at from social_posts where id = ${id}`;
  return row;
};

const sent = (id: string): PublishResult => ({
  outcome: "sent",
  providerPostId: id,
});
const ON = socialConfig({ SOCIAL_PUBLISHER: "memory" }, ["memory"]);

// Inside a rolled-back transaction the "short transaction of its own" of the
// claim is a savepoint: postgres.js's TransactionSql has begin as savepoint.
const dbOf = (q: Sql | Tx) => createSocialDb(q as Sql);

describe("SPEC-066 CA-6 expire through the database", () => {
  it("pending -> expired, sending -> failed (unknown_outcome), fresh rows untouched", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const old = at(30 - POST_TTL_MINUTES - 1);
      const stalePending = await seedPost(tx, m, { decidedAt: old });
      const staleSending = await seedPost(tx, m, {
        decidedAt: old,
        status: "sending",
        attempts: 1,
        text: "x",
        templateId: "goal-1",
        side: "away",
      });
      const fresh = await seedPost(tx, m, { decidedAt: at(29) });
      const closed = await seedPost(tx, m, {
        decidedAt: old,
        status: "sent",
        side: "away",
      });
      const cutoff = shiftInstant(NOW, -POST_TTL_MINUTES * MINUTE_MS);
      expect(await dbOf(tx).expire(cutoff)).toEqual({ expired: 1, failed: 1 });
      expect(await postRow(tx, stalePending)).toMatchObject({
        status: "expired",
      });
      expect((await postRow(tx, stalePending)).closed_at).toBeInstanceOf(Date);
      expect(await postRow(tx, staleSending)).toMatchObject({
        status: "failed",
        reason: "unknown_outcome",
        text: "x",
      });
      expect((await postRow(tx, fresh)).status).toBe("pending");
      expect((await postRow(tx, closed)).status).toBe("sent");
      // Again: nothing left to expire.
      expect(await dbOf(tx).expire(cutoff)).toEqual({ expired: 0, failed: 0 });
    }));
});

describe("SPEC-066 CA-5 claim and finish through the database", () => {
  it("claims the oldest pending row with its context and writes a send", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const first = await seedPost(tx, m, {
        score: [1, 0],
        minute: 45,
        addedMinute: 2,
      });
      const second = await seedPost(tx, m, { side: "away", score: [1, 1] });
      const db = dbOf(tx);
      const claimed = await db.claim((post) => {
        expect(post).toMatchObject({
          id: first,
          matchId: m,
          side: "home",
          kind: "goal",
          attempts: 0,
          text: null,
          templateId: null,
          season: "2026-27",
          home: { id: "celta", name: "RC Celta" },
          away: { id: "deportivo", name: "RC Deportivo" },
          score: { home: 1, away: 0 },
          minute: 45,
          addedMinute: 2,
          lastGoal: null,
          lastTemplateOfTeam: null,
          lastTemplateOfAccount: null,
        });
        return { kind: "send", text: "T1", templateId: "goal-1" };
      });
      expect(claimed?.post.id).toBe(first);
      expect(await postRow(tx, first)).toMatchObject({
        status: "sending",
        attempts: 1,
        text: "T1",
        template_id: "goal-1",
        closed_at: null,
      });
      // The second claim is the other row, with the first as the account's
      // last template; the home goal is not the away side's last goal.
      const next = await db.claim((post) => {
        expect(post).toMatchObject({
          id: second,
          side: "away",
          lastGoal: null,
          lastTemplateOfTeam: null,
          lastTemplateOfAccount: "goal-1",
        });
        return {
          kind: "skip",
          reason: "not_watched",
          text: null,
          templateId: null,
        };
      });
      expect(next?.outcome.kind).toBe("skip");
      expect(await postRow(tx, second)).toMatchObject({
        status: "skipped",
        reason: "not_watched",
        attempts: 0,
      });
      expect((await postRow(tx, second)).closed_at).toBeInstanceOf(Date);
      // Nothing pending: null, and decide is not called.
      expect(
        await db.claim(() => {
          throw new Error("must not be called");
        }),
      ).toBeNull();
    }));

  it("the context carries the last goal of the match and side and the team's last template of the kind", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      await seedPost(tx, m, {
        status: "failed",
        reason: "rejected",
        text: "old",
        templateId: "goal-3",
        decidedAt: at(10),
      });
      await seedPost(tx, m, {
        status: "sent",
        text: "newer",
        templateId: "goal-2",
        decidedAt: at(15),
      });
      // Another match, same team (celta away): its template counts for the team.
      const other = await seedMatch(tx, "deportivo", "celta");
      await seedPost(tx, other, {
        side: "away",
        status: "sent",
        text: "elsewhere",
        templateId: "goal-5",
        decidedAt: at(18),
      });
      // The same team's annulled: another kind, so not the team's last of goal.
      await seedPost(tx, m, {
        kind: "goal_annulled",
        status: "skipped",
        reason: "disabled",
        text: "ann",
        templateId: "annulled-1",
        decidedAt: at(19),
      });
      const target = await seedPost(tx, m, { decidedAt: at(20) });
      await dbOf(tx).claim((post) => {
        expect(post.id).toBe(target);
        expect(post.lastGoal).toEqual({ status: "sent", reason: null });
        expect(post.lastTemplateOfTeam).toBe("goal-5");
        expect(post.lastTemplateOfAccount).toBe("annulled-1");
        return {
          kind: "skip",
          reason: "disabled",
          text: "t",
          templateId: "goal-1",
        };
      });
      expect(await postRow(tx, target)).toMatchObject({
        status: "skipped",
        reason: "disabled",
        text: "t",
        template_id: "goal-1",
      });
    }));

  it("finish writes sent, failed and pending, and ignores a row that is not sending", () =>
    rollback(async (tx) => {
      const m = await seedMatch(tx);
      const db = dbOf(tx);
      const claimOne = async (): Promise<string> => {
        const claimed = await db.claim(() => ({
          kind: "send",
          text: "T",
          templateId: "goal-1",
        }));
        if (claimed === null) throw new Error("nothing to claim");
        return claimed.post.id;
      };
      await seedPost(tx, m, { decidedAt: at(10) });
      await seedPost(tx, m, { decidedAt: at(11), side: "away" });
      await seedPost(tx, m, { decidedAt: at(12) });
      const a = await claimOne();
      const b = await claimOne();
      const c = await claimOne();
      await db.finish(a, {
        status: "sent",
        provider: "memory",
        providerPostId: "x-1",
      });
      await db.finish(b, { status: "failed", reason: "rejected" });
      await db.finish(c, { status: "pending" });
      expect(await postRow(tx, a)).toMatchObject({
        status: "sent",
        provider: "memory",
        provider_post_id: "x-1",
      });
      expect((await postRow(tx, a)).closed_at).toBeInstanceOf(Date);
      expect(await postRow(tx, b)).toMatchObject({
        status: "failed",
        reason: "rejected",
      });
      expect(await postRow(tx, c)).toMatchObject({
        status: "pending",
        attempts: 1,
        text: "T",
        closed_at: null,
      });
      // A finish on a closed row changes nothing.
      await db.finish(a, { status: "failed", reason: "rejected" });
      expect((await postRow(tx, a)).status).toBe("sent");
    }));
});

// Two dispatches at once need two real connections and committed rows; the
// afterAll removes them (decisions and observations as replica, past the
// append-only triggers).
const sqlA = createSql(process.env);
const sqlB = createSql(process.env);
const committed: string[] = [];

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
  await Promise.all([sql.end(), sqlA.end(), sqlB.end()]);
});

// A publisher that takes its time, so the two dispatches overlap.
const slow = (inner: SocialPublisher, ms: number): SocialPublisher => ({
  id: inner.id,
  publish: (text) =>
    new Promise((resolve) => setTimeout(resolve, ms)).then(() =>
      inner.publish(text),
    ),
});

describe("SPEC-066 CA-5 two concurrent dispatches over the same rows", () => {
  it("call the publisher once per row and leave every row sent once", async () => {
    const m = await seedMatch(sql);
    committed.push(m);
    const ids: string[] = [];
    for (let i = 0; i < 4; i += 1)
      ids.push(
        await seedPost(sql, m, {
          side: i % 2 === 0 ? "home" : "away",
          score: [Math.ceil((i + 1) / 2), Math.floor((i + 1) / 2)],
          decidedAt: at(25 + i),
        }),
      );
    const a = createMemoryPublisher([
      sent("a-1"),
      sent("a-2"),
      sent("a-3"),
      sent("a-4"),
    ]);
    const b = createMemoryPublisher([
      sent("b-1"),
      sent("b-2"),
      sent("b-3"),
      sent("b-4"),
    ]);
    const [ra, rb] = await Promise.all([
      dispatchSocial({
        db: createSocialDb(sqlA),
        publisher: slow(a, 100),
        config: ON,
        now: NOW,
        rng: seededRng(1),
      }),
      dispatchSocial({
        db: createSocialDb(sqlB),
        publisher: slow(b, 100),
        config: ON,
        now: NOW,
        rng: seededRng(2),
      }),
    ]);
    expect(ra.sent + rb.sent).toBe(4);
    expect(a.calls.length + b.calls.length).toBe(4);
    // Both really ran at once: each took rows while the other was calling.
    expect(a.calls.length).toBeGreaterThan(0);
    expect(b.calls.length).toBeGreaterThan(0);
    const rows = await sql<
      {
        id: string;
        status: string;
        attempts: number;
        text: string;
        provider_post_id: string;
      }[]
    >`select id, status, attempts, text, provider_post_id from social_posts
       where match_id = ${m} order by created_at`;
    expect(rows.map((r) => r.status)).toEqual(["sent", "sent", "sent", "sent"]);
    expect(rows.map((r) => r.attempts)).toEqual([1, 1, 1, 1]);
    expect(new Set(rows.map((r) => r.provider_post_id)).size).toBe(4);
    // The texts that went out are exactly the texts stored.
    expect([...a.calls, ...b.calls].sort()).toEqual(
      rows.map((r) => r.text).sort(),
    );
  });
});
