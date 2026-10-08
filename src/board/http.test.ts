import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicMatch } from "@/model";
import { BOARD_CACHE_CONTROL, boardResponse } from "./http";

// SPEC-020 CA-7 (ADR-014 §6, N-3): GET /api/board with the reader injected.
const NOW = "2026-10-10T17:00:00.000Z";

const match = {
  matchId: "celta-coruna-2026-10-10",
  competitionId: "primera-division",
  competitionName: "Primeira División",
  tier: 1,
  round: 9,
  kickoff: "2026-10-10T16:00:00.000Z",
  home: { name: "Real Club Celta de Vigo", shortName: "Celta" },
  away: { name: "Real Club Deportivo de La Coruña", shortName: "Deportivo" },
  status: "live",
  score: { home: 1, away: 0 },
  minute: 45,
  addedMinute: 3,
  halfTime: false,
  qualifier: "confirmado",
  version: 4,
  observedAt: "2026-10-10T16:47:00.000Z",
  decidedAt: "2026-10-10T16:47:05.000Z",
} as PublicMatch;

const read = (matches: PublicMatch[] | null) =>
  vi.fn(async (_now: string) => matches);

const strongEtag = (body: string) =>
  `"${createHash("sha256").update(body).digest("base64url")}"`;

afterEach(() => vi.restoreAllMocks());

describe("SPEC-020 CA-7 boardResponse", () => {
  it("200 { matches } with the cache directives and a strong ETag of the body", async () => {
    const reader = read([match]);
    const res = await boardResponse(reader, NOW, null);
    expect(reader).toHaveBeenCalledWith(NOW);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ matches: [match] });
    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=10, stale-while-revalidate=30",
    );
    expect(BOARD_CACHE_CONTROL).toBe(
      "public, s-maxage=10, stale-while-revalidate=30",
    );
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(res.headers.get("etag")).toBe(strongEtag(body));
    expect(res.headers.get("etag")).not.toMatch(/^W\//);
  });

  it("the ETag changes with any field, not only with a higher version (N-3)", async () => {
    const a = await boardResponse(read([match]), NOW, null);
    const b = await boardResponse(
      read([{ ...match, score: { home: 1, away: 1 } } as PublicMatch]),
      NOW,
      null,
    );
    expect(a.headers.get("etag")).not.toBe(b.headers.get("etag"));
  });

  it("SPEC-021 CA-6: returns halfTime as the reader gives it", async () => {
    const atHalfTime = { ...match, halfTime: true } as PublicMatch;
    const res = await boardResponse(read([atHalfTime]), NOW, null);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { matches: PublicMatch[] };
    expect(body.matches[0]).toMatchObject({ status: "live", halfTime: true });
    const before = await boardResponse(read([match]), NOW, null);
    expect(res.headers.get("etag")).not.toBe(before.headers.get("etag"));
  });

  it("an empty xornada is still 200 with an empty list", async () => {
    const res = await boardResponse(read([]), NOW, null);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ matches: [] });
  });

  it.each([
    (etag: string) => etag,
    (etag: string) => `"other", ${etag}`,
    (etag: string) => `W/${etag}`,
    () => "*",
  ])("If-None-Match that matches → 304 without body (%#)", async (header) => {
    const first = await boardResponse(read([match]), NOW, null);
    const etag = first.headers.get("etag") ?? "";
    const res = await boardResponse(read([match]), NOW, header(etag));
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
    expect(res.headers.get("etag")).toBe(etag);
    expect(res.headers.get("cache-control")).toBe(BOARD_CACHE_CONTROL);
  });

  it("If-None-Match that does not match → 200", async () => {
    const res = await boardResponse(read([match]), NOW, '"stale"');
    expect(res.status).toBe(200);
  });

  it("a failed read → 503 no-store, logged, no ETag", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await boardResponse(
      async () => {
        throw new Error("connect ECONNREFUSED");
      },
      NOW,
      null,
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("etag")).toBeNull();
    expect(error).toHaveBeenCalled();
  });

  it("no reader (DATABASE_URL_PUBLIC missing) → 503 no-store", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await boardResponse(read(null), NOW, null);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
