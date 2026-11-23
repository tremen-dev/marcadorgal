import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AliasFile,
  type FetchContext,
  type Instant,
  ParseResult,
  type RawCapture,
  type SourceAdapter,
  SourceConfig,
  SourceId,
} from "@/model";
import { createMemoryRawStore } from "../raw/memory.ts";
import {
  createRfefExplorer,
  type DeclaredFixture,
} from "../sources/rfef/explorer.ts";
import { SOURCE_ATTEMPT_TIMEOUT_MS } from "./constants.ts";
import type { WindowRow } from "./db.ts";
import { createMemoryIngestDb } from "./memory.ts";
import { tickSalud } from "./salud.ts";
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

// SPEC-093 CA-4: explorer answers but stopped rereading. Its observations
// keep coming with an old lastSeenAt, RN-01 drops them and RN-05 opens
// silence: the failure of the source looks like silence of the match. The
// attempt says it instead, without touching what is inserted or decided.
describe("SPEC-093 CA-4 the stalled source", () => {
  const at = (minutes: number) =>
    new Date(Date.parse(NOW) + minutes * 60_000).toISOString() as Instant;

  const live = (matchId: string, observedAt: Instant) => ({
    matchId,
    status: "live" as const,
    score: { home: 1, away: 0 },
    minute: null,
    addedMinute: null,
    observedAt,
  });

  const withReadings = (
    readings: { matchId: string; readAt: Instant }[],
    observations: unknown[] = [],
  ): ParseResult =>
    ParseResult.parse({
      observations,
      unresolved: [],
      skipped: [],
      requestErrors: [],
      readings,
    });

  const noNetwork = (() => {
    throw new Error("no network");
  }) as unknown as typeof globalThis.fetch;

  const stub = (result: ParseResult): SourceAdapter => ({
    id: SourceId.parse("rfef"),
    kind: "pull",
    async fetch(ctx: FetchContext): Promise<RawCapture> {
      return {
        sourceId: SourceId.parse("rfef"),
        capturedAt: ctx.now,
        requests: [
          {
            url: "https://explorer.test/api/export/matches?date=2026-11-01",
            status: 200,
            contentType: "application/json",
            body: "{}",
          },
        ],
      };
    },
    parse: () => result,
    resolveTeam: () => null,
  });

  async function tick(rows: WindowRow[], result: ParseResult) {
    const { db, store } = harness();
    db.matches = rows;
    const inserted: string[] = [];
    const summary = await runTick({
      db,
      store,
      sources: [RFEF],
      adapterFor: () => stub(result),
      fetch: noNetwork,
      now: NOW,
      afterInsert: async (_tx, observations) => {
        inserted.push(...observations.map((o) => o.matchId));
      },
    });
    return { db, summary, inserted };
  }

  it("a started live match whose newest reading is older than 5 min closes the attempt not ok, and inserts and decides all the same", async () => {
    const { db, summary, inserted } = await tick(
      [row("m1", at(-30), "live")],
      withReadings([{ matchId: "m1", readAt: at(-7) }], [live("m1", at(-7))]),
    );
    expect(summary.attempts[0]).toMatchObject({
      ok: false,
      error: "rfef: fuente estancada: última lectura hace 7 min",
      observations: 1,
    });
    expect(db.observations.map((o) => o.matchId)).toEqual(["m1"]);
    expect(inserted).toEqual(["m1"]);
    expect(db.attempts[0].close).toMatchObject({
      ok: false,
      error: "rfef: fuente estancada: última lectura hace 7 min",
      details: { ultimaLectura: at(-7), edadLecturaMin: 7 },
    });

    const report = tickSalud({
      now: NOW,
      secrets: [],
      jobs: [{ jobname: "ingest-tick", schedule: "30 seconds", active: true }],
      runs: [
        { jobname: "ingest-tick", status: "succeeded", startTime: at(-1) },
      ],
      responses: [],
      attempts: db.attempts.map((a) => ({
        startedAt: a.startedAt,
        sourceId: a.sourceId,
        ok: a.close?.ok ?? null,
        error: a.close?.error ?? null,
        details: a.close?.details ?? null,
      })),
      alerts: [],
      matches: [],
    });
    expect(report.ok).toBe(false);
    expect(report.text).toContain("REVISAR");
    expect(report.text).toContain("fuente estancada");
  });

  it("the newest reading counts: one fresh among old ones keeps it ok, with the fields", async () => {
    const { db, summary } = await tick(
      [row("m1", at(-30), "live"), row("m2", at(-20), "scheduled")],
      withReadings([
        { matchId: "m1", readAt: at(-9) },
        { matchId: "m2", readAt: at(-3) },
      ]),
    );
    expect(summary.attempts[0]).toMatchObject({ ok: true });
    expect(summary.attempts[0].error).toBeUndefined();
    expect(db.attempts[0].close).toMatchObject({
      ok: true,
      details: { ultimaLectura: at(-3), edadLecturaMin: 3 },
    });
  });

  it("exactly 5 min is still inside the window", async () => {
    const { summary } = await tick(
      [row("m1", at(-30), "live")],
      withReadings([{ matchId: "m1", readAt: at(-5) }]),
    );
    expect(summary.attempts[0]).toMatchObject({ ok: true });
  });

  it("without a started match not closed there is neither verdict nor fields", async () => {
    for (const rows of [
      [row("m1", at(5), "scheduled")],
      [row("m1", at(-100), "finished")],
      [row("m1", at(-100), "postponed")],
    ]) {
      const { db, summary } = await tick(
        rows,
        withReadings([{ matchId: "m1", readAt: at(-60) }]),
      );
      expect(summary.attempts[0]).toMatchObject({ ok: true });
      expect(db.attempts[0].close?.details).not.toHaveProperty("ultimaLectura");
      expect(db.attempts[0].close?.details).not.toHaveProperty(
        "edadLecturaMin",
      );
    }
  });

  it("only readings of the started matches count: an old reading of another match decides nothing", async () => {
    const { db, summary } = await tick(
      [row("m1", at(-30), "live"), row("m2", at(5), "scheduled")],
      withReadings([{ matchId: "m2", readAt: at(-60) }]),
    );
    expect(summary.attempts[0]).toMatchObject({ ok: true });
    expect(db.attempts[0].close?.details).not.toHaveProperty("ultimaLectura");
  });

  it("the match in recovery does not count", async () => {
    const { db, store } = harness();
    db.matches = [row("m1", at(5), "scheduled")];
    db.recoverable = [row("r1", at(-24 * 60), "scheduled")];
    const summary = await runTick({
      db,
      store,
      sources: [RFEF],
      adapterFor: () =>
        stub(withReadings([{ matchId: "r1", readAt: at(-60) }])),
      fetch: noNetwork,
      now: NOW,
    });
    expect(summary.attempts[0]).toMatchObject({ ok: true });
    expect(db.attempts[0].close?.details).not.toHaveProperty("ultimaLectura");
  });

  it("over the real export: Amorebieta–Gimnástica live, last read at 18:12:37, is a stalled source at 18:20 and not at 18:14", async () => {
    const root = new URL("../../", import.meta.url);
    const read = (rel: string) => readFileSync(new URL(rel, root), "utf8");
    const frozen = "src/sources/rfef/fixtures";
    const declared = (
      JSON.parse(read(`${frozen}/calendario-2026-27/segunda-rfef-g1.json`)) as {
        matches: {
          round: number;
          kickoff: string;
          home: string;
          away: string;
        }[];
      }
    ).matches.map(
      (m) =>
        ({
          id: `segunda-rfef-g1-2026-27-j${m.round}-${m.home}-${m.away}`,
          competitionId: "segunda-rfef-g1",
          round: m.round,
          kickoff: m.kickoff,
          homeTeamId: m.home,
          awayTeamId: m.away,
        }) as DeclaredFixture,
    );
    const adapter = createRfefExplorer({
      aliases: AliasFile.parse(
        JSON.parse(read(`${frozen}/alias-2026-27-rfef.json`)),
      ),
      calendar: declared,
      baseUrl: "https://explorer.test",
      token: "tok",
    });
    const body = read(`${frozen}/export/export-local-2026-11-01.json`);
    const okFetch = (() =>
      Promise.resolve(
        new Response(body, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )) as unknown as typeof globalThis.fetch;
    const source = SourceConfig.parse({
      ...RFEF,
      competitions: ["segunda-rfef-g1"],
      priority: { "segunda-rfef-g1": 50 },
    });
    const id = "segunda-rfef-g1-2026-27-j9-amorebieta-gimnastica";
    const run = async (now: Instant) => {
      const { db, store } = harness();
      db.matches = [
        {
          ...row(id, "2026-11-01T17:00:00.000Z" as Instant, "live"),
          competitionId: "segunda-rfef-g1",
          homeTeamId: "amorebieta",
          awayTeamId: "gimnastica",
        } as WindowRow,
      ];
      const summary = await runTick({
        db,
        store,
        sources: [source],
        adapterFor: () => adapter,
        fetch: okFetch,
        now,
      });
      return { db, summary };
    };

    const late = await run("2026-11-01T18:20:00.000Z" as Instant);
    expect(late.summary.attempts[0]).toMatchObject({
      ok: false,
      error: "rfef: fuente estancada: última lectura hace 7 min",
    });
    expect(late.db.observations.map((o) => o.matchId)).toEqual([id]);
    expect(late.db.attempts[0].close?.details).toMatchObject({
      ultimaLectura: "2026-11-01T18:12:37.720Z",
      edadLecturaMin: 7,
    });

    const fresh = await run("2026-11-01T18:14:00.000Z" as Instant);
    expect(fresh.summary.attempts[0]).toMatchObject({ ok: true });
    expect(fresh.db.attempts[0].close?.details).toMatchObject({
      ultimaLectura: "2026-11-01T18:12:37.720Z",
      edadLecturaMin: 1,
    });
  });
});
