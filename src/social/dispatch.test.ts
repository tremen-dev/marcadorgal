import { afterEach, describe, expect, it, vi } from "vitest";
import { GOAL_ANNULLED_TEMPLATES, GOAL_TEMPLATES } from "../i18n/social.gl.ts";
import { type Instant, MINUTE_MS, shiftInstant } from "../model/index.ts";
import { socialConfig } from "./config.ts";
import {
  dispatchSocial,
  MAX_ATTEMPTS,
  MAX_POSTS_PER_TICK,
  POST_TTL_MINUTES,
  PUBLISH_TIMEOUT_MS,
} from "./dispatch.ts";
import type { MemoryPost } from "./memory.ts";
import { createMemorySocialDb } from "./memory.ts";
import { seededRng } from "./pick.ts";
import { createMemoryPublisher, type PublishResult } from "./publisher.ts";

// SPEC-066 CA-5, CA-6, CA-7 and the dry mode of CA-10 (ADR-030 §3, §4, §6,
// §7) over the in-memory port; src/social/db.db.test.ts proves the
// postgres.js one. Nothing here touches the network or the clock.

const NOW = "2026-11-07T18:00:00.000Z" as Instant;
const at = (minutes: number): Instant => shiftInstant(NOW, minutes * MINUTE_MS);

const CELTA = { id: "celta", name: "RC Celta" };
const DEPOR = { id: "deportivo", name: "RC Deportivo" };
const MADRID = { id: "real-madrid", name: "Real Madrid" };

let n = 0;
function post(overrides: Partial<MemoryPost> = {}): MemoryPost {
  n += 1;
  return {
    id: `post-${n}`,
    decisionId: `decision-${n}`,
    matchId: "celta-deportivo",
    side: "home",
    kind: "goal",
    status: "pending",
    attempts: 0,
    reason: null,
    templateId: null,
    text: null,
    provider: null,
    providerPostId: null,
    createdAt: at(-1 + n / 1000),
    closedAt: null,
    decidedAt: at(-1),
    season: "2026-27",
    home: CELTA,
    away: DEPOR,
    score: { home: 1, away: 0 },
    minute: 23,
    addedMinute: null,
    ...overrides,
  };
}

const sent = (id: string): PublishResult => ({
  outcome: "sent",
  providerPostId: id,
});
const ON = socialConfig({ SOCIAL_PUBLISHER: "memory" }, ["memory"]);
const OFF = socialConfig({});

function run(
  posts: MemoryPost[],
  script: (PublishResult | Promise<PublishResult>)[],
  options: {
    config?: ReturnType<typeof socialConfig>;
    now?: Instant;
    enabled?: boolean;
    seed?: number;
  } = {},
) {
  const db = createMemorySocialDb(posts);
  const publisher = createMemoryPublisher(script);
  const enabled = options.enabled ?? true;
  const result = dispatchSocial({
    db,
    publisher: enabled ? publisher : null,
    config: options.config ?? (enabled ? ON : OFF),
    now: options.now ?? NOW,
    rng: seededRng(options.seed ?? 1),
  });
  return { db, publisher, result };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("SPEC-066 CA-5 dispatchSocial with the double", () => {
  it("sent: the row is sent with provider, provider_post_id and closed_at, in order of created_at", async () => {
    const second = post({ createdAt: at(-0.5) });
    const first = post({ createdAt: at(-0.9), side: "away" });
    const { db, publisher, result } = run(
      [second, first],
      [sent("x-1"), sent("x-2")],
    );
    expect(await result).toEqual({
      sent: 2,
      failed: 0,
      retried: 0,
      expired: 0,
      skipped: 0,
    });
    expect(publisher.calls).toHaveLength(2);
    expect(publisher.calls[0]).toContain("RC Deportivo");
    const rows = db.posts;
    expect(rows.find((p) => p.id === first.id)).toMatchObject({
      status: "sent",
      attempts: 1,
      provider: "memory",
      providerPostId: "x-1",
    });
    expect(rows.find((p) => p.id === first.id)?.closedAt).not.toBeNull();
    expect(rows.find((p) => p.id === second.id)).toMatchObject({
      status: "sent",
      providerPostId: "x-2",
    });
    // The text sent is the text stored, and it names both teams.
    expect(rows.find((p) => p.id === first.id)?.text).toBe(publisher.calls[0]);
    expect(rows.find((p) => p.id === first.id)?.templateId).toMatch(/^goal-/);
  });

  it("rejected: the row fails and is never retried", async () => {
    const p = post();
    const { db, publisher, result } = run(
      [p],
      [{ outcome: "rejected", reason: "duplicate" }],
    );
    expect(await result).toMatchObject({ sent: 0, failed: 1 });
    expect(db.posts[0]).toMatchObject({
      status: "failed",
      reason: "rejected",
      attempts: 1,
    });
    expect(db.posts[0].closedAt).not.toBeNull();
    expect(publisher.calls).toHaveLength(1);
  });

  it("retry: back to pending, no more calls this tick, same text next time, failed at the third", async () => {
    const a = post({ createdAt: at(-0.9) });
    const b = post({ createdAt: at(-0.5) });
    const retry: PublishResult = { outcome: "retry", reason: "429" };
    const first = run([a, b], [retry]);
    expect(await first.result).toMatchObject({
      retried: 1,
      sent: 0,
      failed: 0,
    });
    expect(first.publisher.calls).toHaveLength(1);
    const rowA = () => first.db.posts.find((p) => p.id === a.id);
    const rowB = () => first.db.posts.find((p) => p.id === b.id);
    expect(rowA()).toMatchObject({ status: "pending", attempts: 1 });
    expect(rowB()).toMatchObject({ status: "pending", attempts: 0 });
    const text = rowA()?.text;
    expect(text).not.toBeNull();

    // Next tick: the same text goes out again.
    const second = run(first.db.posts, [retry, retry], { seed: 99 });
    expect(await second.result).toMatchObject({ retried: 1 });
    expect(second.publisher.calls).toEqual([text]);
    expect(rowA()).toMatchObject({ status: "pending", attempts: 2 });

    // Third retry: attempts exhausted, and the tick goes on with b.
    const third = run(first.db.posts, [retry, sent("x-b")]);
    expect(await third.result).toMatchObject({ failed: 1, retried: 0 });
    expect(third.publisher.calls[0]).toBe(text);
    expect(rowA()).toMatchObject({
      status: "failed",
      reason: "attempts_exhausted",
      attempts: MAX_ATTEMPTS,
    });
    // A retry stops the dispatch for the tick; the exhaustion does not.
    expect(third.publisher.calls).toHaveLength(2);
    expect(rowB()).toMatchObject({ status: "sent" });
  });

  it("unknown: failed with unknown_outcome and no more calls for that row", async () => {
    const a = post();
    const first = run([a], [{ outcome: "unknown", reason: "socket hang up" }]);
    expect(await first.result).toMatchObject({ failed: 1 });
    expect(first.db.posts[0]).toMatchObject({
      status: "failed",
      reason: "unknown_outcome",
      attempts: 1,
    });
    const again = run(first.db.posts, [sent("late")]);
    await again.result;
    expect(again.publisher.calls).toEqual([]);
  });

  it("a publisher that throws counts as unknown", async () => {
    const a = post();
    const db = createMemorySocialDb([a]);
    const result = await dispatchSocial({
      db,
      publisher: {
        id: "broken",
        publish: () => Promise.reject(new Error("ECONNRESET")),
      },
      config: ON,
      now: NOW,
      rng: seededRng(1),
    });
    expect(result).toMatchObject({ failed: 1 });
    expect(db.posts[0]).toMatchObject({
      status: "failed",
      reason: "unknown_outcome",
    });
  });
});

describe("SPEC-066 CA-6 expiry and caps", () => {
  it("a pending row whose Decision is older than 10 min expires without a call", async () => {
    const stale = post({ decidedAt: at(-POST_TTL_MINUTES - 1) });
    const fresh = post({ decidedAt: at(-POST_TTL_MINUTES + 1) });
    const { db, publisher, result } = run([stale, fresh], [sent("x")]);
    expect(await result).toMatchObject({ expired: 1, sent: 1 });
    expect(db.posts.find((p) => p.id === stale.id)).toMatchObject({
      status: "expired",
      text: null,
    });
    expect(db.posts.find((p) => p.id === stale.id)?.closedAt).not.toBeNull();
    expect(publisher.calls).toHaveLength(1);
  });

  it("a sending row that old fails with unknown_outcome, without a call", async () => {
    const stuck = post({
      status: "sending",
      attempts: 1,
      text: "x",
      templateId: "goal-1",
      decidedAt: at(-POST_TTL_MINUTES - 1),
    });
    const { db, publisher, result } = run([stuck], [sent("x")]);
    expect(await result).toMatchObject({ failed: 1, expired: 0, sent: 0 });
    expect(db.posts[0]).toMatchObject({
      status: "failed",
      reason: "unknown_outcome",
    });
    expect(publisher.calls).toHaveLength(0);
  });

  it("a sending row still fresh is nobody's: neither claimed nor expired", async () => {
    const stuck = post({ status: "sending", attempts: 1, text: "x" });
    const { db, publisher, result } = run([stuck], [sent("x")]);
    expect(await result).toEqual({
      sent: 0,
      failed: 0,
      retried: 0,
      expired: 0,
      skipped: 0,
    });
    expect(db.posts[0].status).toBe("sending");
    expect(publisher.calls).toHaveLength(0);
  });

  it("with 6 publishable rows, one dispatch makes 4 calls and leaves 2 pending", async () => {
    const posts = Array.from({ length: 6 }, (_, i) =>
      post({ createdAt: at(-0.9 + i / 100) }),
    );
    const { db, publisher, result } = run(
      posts,
      Array.from({ length: 6 }, (_, i) => sent(`x-${i}`)),
    );
    expect(await result).toMatchObject({ sent: MAX_POSTS_PER_TICK });
    expect(publisher.calls).toHaveLength(4);
    expect(db.posts.filter((p) => p.status === "pending")).toHaveLength(2);
    expect(
      db.posts.filter((p) => p.status === "pending").map((p) => p.id),
    ).toEqual([posts[4].id, posts[5].id]);
  });

  it("a call that does not answer in 5 s counts as unknown (fake clock)", async () => {
    vi.useFakeTimers();
    const never = new Promise<PublishResult>(() => {});
    const a = post();
    const { db, publisher, result } = run([a], [never]);
    await vi.advanceTimersByTimeAsync(PUBLISH_TIMEOUT_MS - 1);
    expect(db.posts[0].status).toBe("sending");
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ failed: 1 });
    expect(db.posts[0]).toMatchObject({
      status: "failed",
      reason: "unknown_outcome",
    });
    expect(publisher.calls).toHaveLength(1);
  });
});

describe("SPEC-066 CA-7 what never goes out", () => {
  it("a row whose team is not watched is skipped (not_watched), with no text and outside the cap", async () => {
    const foreign = Array.from({ length: 5 }, (_, i) =>
      post({
        side: "away",
        home: CELTA,
        away: MADRID,
        matchId: "celta-madrid",
        createdAt: at(-0.9 + i / 100),
      }),
    );
    const ours = post({ createdAt: at(-0.5) });
    const { db, publisher, result } = run([...foreign, ours], [sent("x")]);
    expect(await result).toMatchObject({ skipped: 5, sent: 1 });
    for (const f of foreign)
      expect(db.posts.find((p) => p.id === f.id)).toMatchObject({
        status: "skipped",
        reason: "not_watched",
        text: null,
        templateId: null,
      });
    expect(publisher.calls).toHaveLength(1);
  });

  it("the watched list of the variable replaces the default", async () => {
    const madrid = post({ side: "away", away: MADRID });
    const celta = post();
    const { db, publisher, result } = run([madrid, celta], [sent("x")], {
      config: socialConfig(
        { SOCIAL_PUBLISHER: "memory", SOCIAL_WATCHED_TEAMS: "real-madrid" },
        ["memory"],
      ),
    });
    expect(await result).toMatchObject({ skipped: 1, sent: 1 });
    expect(db.posts.find((p) => p.id === madrid.id)?.status).toBe("sent");
    expect(db.posts.find((p) => p.id === celta.id)?.reason).toBe("not_watched");
    expect(publisher.calls[0]).toContain("Real Madrid");
  });

  it("a goal_annulled is skipped (goal_not_posted) unless the last goal of that match and side went out", async () => {
    const neverPosted = post({ kind: "goal_annulled", matchId: "m-1" });
    const goalFailed = post({
      matchId: "m-2",
      status: "failed",
      reason: "rejected",
    });
    const annulledAfterFailed = post({ kind: "goal_annulled", matchId: "m-2" });
    const goalSent = post({
      matchId: "m-3",
      status: "sent",
      providerPostId: "p",
    });
    const annulledAfterSent = post({
      kind: "goal_annulled",
      matchId: "m-3",
      score: { home: 0, away: 0 },
    });
    // The other side's goal does not count.
    const awayGoalSent = post({ matchId: "m-4", side: "away", status: "sent" });
    const homeAnnulled = post({ kind: "goal_annulled", matchId: "m-4" });
    const { db, publisher, result } = run(
      [
        neverPosted,
        goalFailed,
        annulledAfterFailed,
        goalSent,
        annulledAfterSent,
        awayGoalSent,
        homeAnnulled,
      ],
      [sent("x")],
    );
    expect(await result).toMatchObject({ skipped: 3, sent: 1 });
    for (const id of [neverPosted.id, annulledAfterFailed.id, homeAnnulled.id])
      expect(db.posts.find((p) => p.id === id)).toMatchObject({
        status: "skipped",
        reason: "goal_not_posted",
        text: null,
      });
    expect(db.posts.find((p) => p.id === annulledAfterSent.id)).toMatchObject({
      status: "sent",
    });
    expect(publisher.calls).toHaveLength(1);
    expect(publisher.calls[0]).toContain("0-0");
    expect(GOAL_ANNULLED_TEMPLATES.map((t) => t.id)).toContain(
      db.posts.find((p) => p.id === annulledAfterSent.id)?.templateId,
    );
  });

  it("the last goal is the newest by created_at, not any goal", async () => {
    const oldSent = post({ matchId: "m-1", status: "sent", createdAt: at(-5) });
    const newFailed = post({
      matchId: "m-1",
      status: "failed",
      reason: "rejected",
      createdAt: at(-2),
    });
    const annulled = post({ kind: "goal_annulled", matchId: "m-1" });
    const { db, result } = run([oldSent, newFailed, annulled], [sent("x")]);
    expect(await result).toMatchObject({ skipped: 1, sent: 0 });
    expect(db.posts.find((p) => p.id === annulled.id)?.reason).toBe(
      "goal_not_posted",
    );
  });
});

describe("SPEC-066 CA-9 the exclusions of the selector", () => {
  it("excludes the last template of the same kind of the team and the last of the account", async () => {
    const lastOfTeam = post({
      status: "sent",
      templateId: "goal-1",
      text: "x",
      createdAt: at(-5),
    });
    const lastOfAccount = post({
      matchId: "lugo-arosa",
      home: { id: "lugo", name: "CD Lugo" },
      away: { id: "arosa", name: "Arosa SC" },
      status: "sent",
      templateId: "goal-2",
      text: "y",
      createdAt: at(-3),
    });
    const next = post({ createdAt: at(-0.5) });
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const posts = [lastOfTeam, lastOfAccount, { ...next }];
      const { db, result } = run(posts, [sent("x")], { seed });
      await result;
      const picked = db.posts.find((p) => p.id === next.id)?.templateId;
      if (picked !== null && picked !== undefined) seen.add(picked);
    }
    expect(seen.has("goal-1")).toBe(false);
    expect(seen.has("goal-2")).toBe(false);
    expect(seen.size).toBe(GOAL_TEMPLATES.length - 2);
  });

  it("the last template of the team is per kind: a goal does not exclude an annulled one", async () => {
    const lastGoal = post({
      status: "sent",
      templateId: "goal-1",
      text: "x",
      createdAt: at(-5),
    });
    const annulled = post({ kind: "goal_annulled", createdAt: at(-0.5) });
    const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed += 1) {
      const { db, result } = run([lastGoal, { ...annulled }], [sent("x")], {
        seed,
      });
      await result;
      const picked = db.posts.find((p) => p.id === annulled.id)?.templateId;
      if (picked) seen.add(picked);
    }
    // The account's last template is a goal one: it excludes nothing here.
    expect(seen.size).toBe(GOAL_ANNULLED_TEMPLATES.length);
  });
});

describe("SPEC-066 CA-10 dry mode", () => {
  it("off: watched rows are skipped (disabled) with text and template, and the double gets no call", async () => {
    const ours = post();
    const foreign = post({ side: "away", away: MADRID });
    const { db, publisher, result } = run([ours, foreign], [sent("x")], {
      enabled: false,
    });
    expect(await result).toEqual({
      sent: 0,
      failed: 0,
      retried: 0,
      expired: 0,
      skipped: 2,
    });
    expect(publisher.calls).toEqual([]);
    const row = db.posts.find((p) => p.id === ours.id);
    expect(row).toMatchObject({ status: "skipped", reason: "disabled" });
    expect(row?.text).toContain("RC Celta");
    expect(row?.text).toContain("1-0");
    expect(row?.templateId).toMatch(/^goal-/);
    expect(row?.closedAt).not.toBeNull();
    expect(db.posts.find((p) => p.id === foreign.id)).toMatchObject({
      status: "skipped",
      reason: "not_watched",
      text: null,
    });
  });

  it("off: an annulled goal after a goal skipped by disabled is redacted too", async () => {
    const goal = post({
      status: "skipped",
      reason: "disabled",
      text: "x",
      templateId: "goal-1",
    });
    const annulled = post({ kind: "goal_annulled" });
    const { db, result } = run([goal, annulled], [], { enabled: false });
    expect(await result).toMatchObject({ skipped: 1 });
    expect(db.posts.find((p) => p.id === annulled.id)).toMatchObject({
      status: "skipped",
      reason: "disabled",
    });
    expect(db.posts.find((p) => p.id === annulled.id)?.templateId).toMatch(
      /^annulled-/,
    );
  });

  it("the link of the configuration is the last line of the text", async () => {
    const ours = post();
    const { db, result } = run([ours], [sent("x")], {
      config: socialConfig(
        {
          SOCIAL_PUBLISHER: "memory",
          SOCIAL_LINK_URL: "https://marcador.gal/xornada/2026-11-07",
        },
        ["memory"],
      ),
    });
    await result;
    expect(
      db.posts[0].text?.endsWith("\nhttps://marcador.gal/xornada/2026-11-07"),
    ).toBe(true);
  });
});
