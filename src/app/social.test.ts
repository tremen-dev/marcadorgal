import { describe, expect, it } from "vitest";
import { createSocialDispatch } from "@/app/social";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { createMemorySocialDb, type MemoryPost } from "@/social/memory";

// SPEC-066 CA-11: what the route wires at the end of every tick. With the
// registry of publishers empty (SPEC-066) the dispatch is always dry.

const NOW = "2026-11-07T18:00:00.000Z" as Instant;
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
    const dispatch = createSocialDispatch({}, db, NOW);
    expect(await dispatch()).toEqual({
      sent: 0,
      failed: 0,
      retried: 0,
      expired: 1,
      skipped: 0,
    });
    expect(db.posts[0].status).toBe("expired");
  });

  it("with no publisher configured it redacts and skips (disabled), with the link when set", async () => {
    const db = createMemorySocialDb([post({ id: "fresh" })]);
    const dispatch = createSocialDispatch(
      { SOCIAL_PUBLISHER: "buffer", SOCIAL_LINK_URL: "https://marcador.gal" },
      db,
      NOW,
    );
    expect(await dispatch()).toMatchObject({ skipped: 1, sent: 0 });
    expect(db.posts[0]).toMatchObject({
      status: "skipped",
      reason: "disabled",
    });
    expect(db.posts[0].text?.endsWith("\nhttps://marcador.gal")).toBe(true);
  });

  it("propagates a failure of the port: runTick turns it into socialError", async () => {
    const db = createMemorySocialDb([]);
    db.expire = () => Promise.reject(new Error("relation does not exist"));
    await expect(createSocialDispatch({}, db, NOW)()).rejects.toThrow(
      /relation/,
    );
  });
});
