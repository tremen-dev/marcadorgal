import { describe, expect, it } from "vitest";
import { createSocialDispatch } from "@/app/social";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { createMemorySocialDb, type MemoryPost } from "@/social/memory";

// SPEC-066 CA-11: what the route wires at the end of every tick. With the
// registry of publishers empty (SPEC-066) the dispatch is always dry.

const NOW = "2026-11-07T18:00:00.000Z" as Instant;

const noFetch = (() => {
  throw new Error("no network in this test");
}) as unknown as typeof fetch;
const at = (minutes: number): Instant => shiftInstant(NOW, minutes * MINUTE_MS);

const post = (overrides: Partial<MemoryPost>): MemoryPost => ({
  id: "p-1",
  decisionId: "d-1",
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
  createdAt: at(-1),
  closedAt: null,
  decidedAt: at(-1),
  season: "2026-27",
  home: { id: "celta", name: "RC Celta" },
  away: { id: "deportivo", name: "RC Deportivo" },
  score: { home: 1, away: 0 },
  minute: 10,
  addedMinute: null,
  ...overrides,
});

describe("SPEC-066 CA-11 createSocialDispatch", () => {
  it("a stale pending row is expired even with nothing else to do", async () => {
    const db = createMemorySocialDb([
      post({ id: "stale", decidedAt: at(-11) }),
    ]);
    const dispatch = createSocialDispatch({}, db, NOW, { fetch: noFetch });
    expect(await dispatch()).toEqual({
      counts: { sent: 0, failed: 0, retried: 0, expired: 1, skipped: 0 },
    });
    expect(db.posts[0].status).toBe("expired");
  });

  it("with no publisher configured it redacts and skips (disabled), with the link when set", async () => {
    const db = createMemorySocialDb([post({ id: "fresh" })]);
    const dispatch = createSocialDispatch(
      { SOCIAL_PUBLISHER: "memory", SOCIAL_LINK_URL: "https://marcador.gal" },
      db,
      NOW,
      { fetch: noFetch },
    );
    expect(await dispatch()).toEqual({
      counts: { sent: 0, failed: 0, retried: 0, expired: 0, skipped: 1 },
    });
    expect(db.posts[0]).toMatchObject({
      status: "skipped",
      reason: "disabled",
    });
    expect(db.posts[0].text?.endsWith("\nhttps://marcador.gal")).toBe(true);
  });

  it("propagates a failure of the port: runTick turns it into socialError", async () => {
    const db = createMemorySocialDb([]);
    db.expire = () => Promise.reject(new Error("relation does not exist"));
    await expect(
      createSocialDispatch({}, db, NOW, { fetch: noFetch })(),
    ).rejects.toThrow(/relation/);
  });
});

// SPEC-067 CA-4, CA-5: SOCIAL_PUBLISHER=buffer with key and channel reaches
// Buffer through the injected fetch, one request per attempt and no other;
// without key or channel it behaves as off and the outcome says
// `unconfigured`, and nothing throws.
describe("SPEC-067 CA-4 createSocialDispatch with buffer", () => {
  const BUFFER_ENV = {
    SOCIAL_PUBLISHER: "buffer",
    BUFFER_API_KEY: "sk-sentinel-0123456789",
    BUFFER_CHANNEL_ID: "ch-test-1",
  };

  function bufferFetch(): { fetch: typeof fetch; calls: RequestInit[] } {
    const calls: RequestInit[] = [];
    const impl = (async (_input: unknown, init?: RequestInit) => {
      calls.push(init ?? {});
      return new Response(
        JSON.stringify({
          data: {
            createPost: {
              __typename: "PostActionSuccess",
              post: { id: `bp-${calls.length}` },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    return { fetch: impl, calls };
  }

  it("with key and channel the dispatch publishes through the Buffer client", async () => {
    const db = createMemorySocialDb([post({ id: "fresh" })]);
    const { fetch, calls } = bufferFetch();
    const outcome = await createSocialDispatch(BUFFER_ENV, db, NOW, {
      fetch,
    })();
    expect(outcome).toEqual({
      counts: { sent: 1, failed: 0, retried: 0, expired: 0, skipped: 0 },
    });
    expect(calls).toHaveLength(1);
    expect(new Headers(calls[0].headers).get("authorization")).toBe(
      "Bearer sk-sentinel-0123456789",
    );
    const sent = JSON.parse(String(calls[0].body));
    expect(sent.query).toMatch(/createPost/);
    expect(sent.variables.input.channelId).toBe("ch-test-1");
    expect(sent.variables.input.text).toBe(db.posts[0].text);
    expect(db.posts[0]).toMatchObject({
      status: "sent",
      provider: "buffer",
      providerPostId: "bp-1",
    });
  });

  it("CA-5: three rows are three createPost and nothing else, no limits and no post queries", async () => {
    const db = createMemorySocialDb([
      post({ id: "a" }),
      post({ id: "b", decisionId: "d-2", score: { home: 2, away: 0 } }),
      post({ id: "c", decisionId: "d-3", score: { home: 3, away: 0 } }),
    ]);
    const { fetch, calls } = bufferFetch();
    await createSocialDispatch(BUFFER_ENV, db, NOW, { fetch })();
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      const sent = JSON.parse(String(call.body));
      expect(sent.query).toMatch(/mutation CreatePost/);
      expect(sent.query).not.toMatch(/dailyPostingLimits|query Post/);
    }
  });

  it.each([
    [
      "without the key",
      { SOCIAL_PUBLISHER: "buffer", BUFFER_CHANNEL_ID: "ch-test-1" },
    ],
    [
      "without the channel",
      { SOCIAL_PUBLISHER: "buffer", BUFFER_API_KEY: "sk-x" },
    ],
    [
      "with both empty",
      {
        SOCIAL_PUBLISHER: "buffer",
        BUFFER_API_KEY: "",
        BUFFER_CHANNEL_ID: " ",
      },
    ],
  ])(
    "buffer %s behaves as off and reports unconfigured without throwing",
    async (_, env) => {
      const db = createMemorySocialDb([post({ id: "fresh" })]);
      const { fetch, calls } = bufferFetch();
      const outcome = await createSocialDispatch(env, db, NOW, { fetch })();
      expect(outcome).toEqual({
        counts: { sent: 0, failed: 0, retried: 0, expired: 0, skipped: 1 },
        error: "unconfigured",
      });
      expect(calls).toHaveLength(0);
      expect(db.posts[0]).toMatchObject({
        status: "skipped",
        reason: "disabled",
      });
      expect(db.posts[0].text).not.toBeNull();
    },
  );

  it("with no SOCIAL_PUBLISHER there is no error: off is not a misconfiguration", async () => {
    const db = createMemorySocialDb([post({ id: "fresh" })]);
    const outcome = await createSocialDispatch(
      { BUFFER_API_KEY: "sk-x", BUFFER_CHANNEL_ID: "ch-1" },
      db,
      NOW,
      { fetch: noFetch },
    );
    expect(await outcome()).toEqual({
      counts: { sent: 0, failed: 0, retried: 0, expired: 0, skipped: 1 },
    });
  });
});
