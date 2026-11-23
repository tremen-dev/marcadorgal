import { describe, expect, it } from "vitest";
import {
  AliasFile,
  type FetchContext,
  type Instant,
  type ParseResult,
  type RawCapture,
  type SourceAdapter,
  SourceConfig,
  SourceId,
} from "@/model";
import { createMemoryRawStore } from "../raw/memory.ts";
import { createRfefExplorer } from "../sources/rfef/explorer.ts";
import { SOURCE_ATTEMPT_TIMEOUT_MS } from "./constants.ts";
import type { WindowRow } from "./db.ts";
import { createMemoryIngestDb } from "./memory.ts";
import { runTick, type TickInput } from "./tick.ts";

// SPEC-093: the tick neither hangs nor stays quiet before a slow or stalled
// explorer. The deadline is injected in ms: nothing here waits ten seconds.

const NOW = "2026-11-01T18:30:00.000Z" as Instant;

const RFEF = SourceConfig.parse({
  id: "rfef",
  kind: "pull",
  competitions: ["segunda-division"],
  priority: { "segunda-division": 50 },
  minIntervalSeconds: 30,
  userAgent: "marcador.gal test (rfef)",
  legalBasis: "test",
});

const row = (
  id: string,
  kickoff: Instant = NOW,
  status = "live",
  season = "2026-27",
): WindowRow =>
  ({
    id,
    competitionId: "segunda-division",
    season,
    kickoff,
    homeTeamId: "a",
    awayTeamId: "b",
    status,
    forcedFinish: null,
    lastObservationAt: null,
  }) as WindowRow;

const emptyParse: ParseResult = {
  observations: [],
  unresolved: [],
  skipped: [],
  requestErrors: [],
};

// An adapter that asks through ctx.fetch, as every real one does.
function askingAdapter(urls: string[]): SourceAdapter {
  return {
    id: SourceId.parse("rfef"),
    kind: "pull",
    async fetch(ctx: FetchContext): Promise<RawCapture> {
      const capture: RawCapture = {
        sourceId: SourceId.parse("rfef"),
        capturedAt: ctx.now,
        requests: [],
      };
      for (const url of urls) {
        const res = await ctx.fetch(url);
        capture.requests.push({
          url,
          method: "GET",
          status: res.status,
          contentType: null,
          body: await res.text(),
        });
      }
      return capture;
    },
    parse: () => emptyParse,
    resolveTeam: () => null,
  };
}

// A fetch that never answers but honours its signal, as undici does.
const hangingFetch = (seen: AbortSignal[] = []) =>
  ((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal) {
        seen.push(signal);
        signal.addEventListener("abort", () => reject(signal.reason));
      }
    })) as unknown as typeof globalThis.fetch;

// A fetch deaf to every signal: only the deadline of the core saves the tick.
const deafFetch = (() =>
  new Promise<Response>(() => {})) as unknown as typeof globalThis.fetch;

// Headers arrive, the body never ends.
const endlessBodyFetch = (() =>
  Promise.resolve(
    new Response(new ReadableStream({ start() {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  )) as unknown as typeof globalThis.fetch;

function harness() {
  const db = createMemoryIngestDb();
  const store = createMemoryRawStore();
  return { db, store };
}

const hooks = (): Pick<TickInput, "sweep" | "social"> => ({
  sweep: async () => ({ matches: 0, decisions: 0, alerts: 0, resolved: 0 }),
  social: async () => ({
    counts: { sent: 0, failed: 0, retried: 0, expired: 0, skipped: 0 },
  }),
});

describe("SPEC-093 CA-1 the deadline of the attempt", () => {
  it("is 10 000 ms by default", () => {
    expect(SOURCE_ATTEMPT_TIMEOUT_MS).toBe(10_000);
  });

  it("aborts a fetch that never answers, closes the attempt not ok and still sweeps and dispatches", async () => {
    const { db, store } = harness();
    db.matches = [row("m1")];
    const signals: AbortSignal[] = [];
    const summary = await runTick({
      db,
      store,
      sources: [RFEF],
      adapterFor: () => askingAdapter(["https://explorer.test/a"]),
      fetch: hangingFetch(signals),
      now: NOW,
      attemptTimeoutMs: 20,
      ...hooks(),
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(true);
    expect(summary.attempts[0].ok).toBe(false);
    expect(summary.attempts[0].error).toMatch(/^rfef: /);
    expect(summary.attempts[0].error).toContain("20 ms");
    expect(db.attempts[0].close).toMatchObject({ ok: false });
    expect(db.attempts[0].close?.error).toBe(summary.attempts[0].error);
    expect(summary.engine).toBeDefined();
    expect(summary.social).toBeDefined();
  });

  it("closes the attempt even when the fetch ignores its signal", async () => {
    const { db, store } = harness();
    db.matches = [row("m1")];
    const summary = await runTick({
      db,
      store,
      sources: [RFEF],
      adapterFor: () => askingAdapter(["https://explorer.test/a"]),
      fetch: deafFetch,
      now: NOW,
      attemptTimeoutMs: 20,
      ...hooks(),
    });
    expect(summary.attempts[0]).toMatchObject({ ok: false });
    expect(summary.attempts[0].error).toContain("20 ms");
    expect(db.attempts[0].close).toMatchObject({ ok: false });
    expect(summary.engine).toBeDefined();
    expect(summary.social).toBeDefined();
  });

  it("covers the body: headers in time and a body that never ends still fail the attempt (explorer adapter)", async () => {
    const { db, store } = harness();
    db.matches = [row("m1")];
    const adapter = createRfefExplorer({
      aliases: AliasFile.parse({
        season: "2026-27",
        source: "rfef",
        teams: [],
      }),
      calendar: [],
      baseUrl: "https://explorer.test",
      token: "tok",
    });
    const summary = await runTick({
      db,
      store,
      sources: [RFEF],
      adapterFor: () => adapter,
      fetch: endlessBodyFetch,
      now: NOW,
      attemptTimeoutMs: 20,
      ...hooks(),
    });
    expect(summary.attempts[0]).toMatchObject({ ok: false });
    expect(summary.attempts[0].error).toMatch(/^rfef: .*20 ms/);
    expect(db.attempts[0].close).toMatchObject({ ok: false });
    expect(summary.engine).toBeDefined();
    expect(summary.social).toBeDefined();
  });

  it("is one deadline for the whole attempt, not one per request", async () => {
    const { db, store } = harness();
    db.matches = [row("m1")];
    // Each request answers in 60 ms: one alone fits in 100, two do not.
    const slow = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(
          () => resolve(new Response("{}", { status: 200 })),
          60,
        );
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(init.signal?.reason);
        });
      })) as unknown as typeof globalThis.fetch;
    const one = await runTick({
      db,
      store,
      sources: [RFEF],
      adapterFor: () => askingAdapter(["https://explorer.test/a"]),
      fetch: slow,
      now: NOW,
      attemptTimeoutMs: 100,
    });
    expect(one.attempts[0]).toMatchObject({ ok: true });

    const other = harness();
    other.db.matches = [row("m1")];
    const two = await runTick({
      db: other.db,
      store: other.store,
      sources: [RFEF],
      adapterFor: () =>
        askingAdapter(["https://explorer.test/a", "https://explorer.test/b"]),
      fetch: slow,
      now: NOW,
      attemptTimeoutMs: 100,
    });
    expect(two.attempts[0]).toMatchObject({ ok: false });
    expect(two.attempts[0].error).toContain("100 ms");
  });

  it("an attempt in time is untouched by the deadline", async () => {
    const { db, store } = harness();
    db.matches = [row("m1")];
    const quick = (() =>
      Promise.resolve(
        new Response("{}", { status: 200 }),
      )) as unknown as typeof globalThis.fetch;
    const summary = await runTick({
      db,
      store,
      sources: [RFEF],
      adapterFor: () => askingAdapter(["https://explorer.test/a"]),
      fetch: quick,
      now: NOW,
      attemptTimeoutMs: 1000,
    });
    expect(summary.attempts[0]).toMatchObject({ ok: true });
  });
});
