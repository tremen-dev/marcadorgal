import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  AliasFile,
  type CompetitionId,
  type FetchContext,
  type Instant,
  MINUTE_MS,
  ParseResult,
  type RawCapture,
  type SourceAdapter,
  SourceConfig,
  SourceId,
  shiftInstant,
  type WindowMatch,
} from "@/model";
import { createMemoryRawStore } from "../raw/memory.ts";
import { createApiFootballResults } from "../sources/api-football/results.ts";
import { SOURCES } from "../sources/registry.ts";
import { adapterFor } from "./adapters.ts";
import type { WindowRow } from "./db.ts";
import { createMemoryIngestDb } from "./memory.ts";
import { runTick } from "./tick.ts";
import { isInWindow } from "./window.ts";

const NOW = "2026-09-25T18:30:00.000Z" as Instant;
const CAPTURED_AT = "2026-09-25T18:30:02.000Z" as Instant;

const config = (id: string, competitions: string[]): SourceConfig =>
  SourceConfig.parse({
    id,
    kind: "pull",
    competitions,
    priority: Object.fromEntries(competitions.map((c) => [c, 10])),
    minIntervalSeconds: 30,
    userAgent: `marcador.gal test (${id})`,
    legalBasis: "test",
  });

const PRIMERA = config("primera-source", [
  "primera-division",
  "segunda-division",
]);
const SEGUNDA = config("other-source", ["primera-division"]);

const match = (
  id: string,
  competitionId: string,
  season = "2026-27",
): WindowRow =>
  ({
    id,
    competitionId,
    season,
    kickoff: NOW,
    homeTeamId: "celta",
    awayTeamId: "deportivo",
    status: "live",
  }) as WindowRow;

const capture = (requests = 1): RawCapture => ({
  sourceId: SourceId.parse("primera-source"),
  capturedAt: CAPTURED_AT,
  requests: Array.from({ length: requests }, (_, i) => ({
    url: `https://example.test/fixtures?ids=${i}`,
    status: 200,
    contentType: "application/json",
    body: '{"response":[]}',
  })),
});

const emptyParse: ParseResult = {
  observations: [],
  unresolved: [],
  skipped: [],
  requestErrors: [],
};

type StubOptions = {
  id?: string;
  log?: string[];
  onFetch?: (ctx: FetchContext) => void;
  fetchError?: Error;
  parseError?: Error;
  result?: ParseResult;
  capture?: RawCapture;
};

function stubAdapter(options: StubOptions = {}): SourceAdapter {
  const id = SourceId.parse(options.id ?? "primera-source");
  return {
    id,
    kind: "pull",
    async fetch(ctx: FetchContext): Promise<RawCapture> {
      options.log?.push("fetch");
      options.onFetch?.(ctx);
      if (options.fetchError) throw options.fetchError;
      return options.capture ?? capture();
    },
    parse(): ParseResult {
      options.log?.push("parse");
      if (options.parseError) throw options.parseError;
      return options.result ?? emptyParse;
    },
    resolveTeam: () => null,
  };
}

// A fetch that fails the test if the tick ever reaches the network itself:
// only the adapter talks to a provider.
const forbiddenFetch = (() => {
  throw new Error("the tick must not fetch by itself");
}) as unknown as typeof globalThis.fetch;

function harness(options: { log?: string[] } = {}) {
  const log = options.log ?? [];
  const db = createMemoryIngestDb(log);
  const store = createMemoryRawStore(log);
  return { db, store, log };
}

describe("CA-7 nothing in window", () => {
  it("asks nobody and opens no attempt", async () => {
    const { db, store } = harness();
    const adapterFor = vi.fn(() => stubAdapter());
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor,
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(summary).toMatchObject({ now: NOW, inWindow: 0, attempts: [] });
    expect(adapterFor).not.toHaveBeenCalled();
    expect(db.attempts).toEqual([]);
    expect(db.log).not.toContain("openAttempt:primera-source");
  });
});

describe("CA-7 what the adapter receives", () => {
  it("gets only its matches, its competitions, the user agent and now", async () => {
    const { db, store } = harness();
    db.matches = [
      match("m1", "primera-division"),
      match("m2", "segunda-division"),
      match("m3", "tercera-rfef-g1"),
    ];
    let seen: FetchContext | undefined;
    await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ onFetch: (ctx) => (seen = ctx) }),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(seen?.now).toBe(NOW);
    expect(seen?.userAgent).toBe(PRIMERA.userAgent);
    expect(seen?.competitions).toEqual([
      "primera-division",
      "segunda-division",
    ] as CompetitionId[]);
    expect(seen?.matches).toEqual<WindowMatch[]>([
      {
        id: "m1",
        competitionId: "primera-division",
        season: "2026-27",
        kickoff: NOW,
        homeTeamId: "celta",
        awayTeamId: "deportivo",
      },
      {
        id: "m2",
        competitionId: "segunda-division",
        season: "2026-27",
        kickoff: NOW,
        homeTeamId: "celta",
        awayTeamId: "deportivo",
      },
    ] as WindowMatch[]);
  });

  it("stores the raw capture before parsing it", async () => {
    const log: string[] = [];
    const { db, store } = harness({ log });
    db.matches = [match("m1", "primera-division")];
    await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ log }),
      fetch: forbiddenFetch,
      now: NOW,
    });
    const put = log.findIndex((l) => l.startsWith("put:"));
    expect(put).toBeGreaterThan(-1);
    expect(put).toBeLessThan(log.indexOf("parse"));
  });
});

describe("CA-7 a successful attempt", () => {
  const result: ParseResult = ParseResult.parse({
    observations: [
      {
        matchId: "m1",
        status: "live",
        score: { home: 1, away: 0 },
        minute: 45,
        addedMinute: 3,
      },
    ],
    unresolved: [
      {
        reason: "unknown_team",
        externalCompetition: "140",
        externalMatchId: "999",
        home: { externalId: "1", externalName: "Home FC" },
        away: { externalId: "2", externalName: "Away FC" },
        status: "NS",
      },
    ],
    skipped: [
      { externalMatchId: "998", status: "WO", reason: "unsupported_status" },
    ],
    requestErrors: [],
  });

  it("writes the observation with the core keys and opens the alert", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ result }),
      fetch: forbiddenFetch,
      now: NOW,
    });

    const [attempt] = summary.attempts;
    expect(attempt).toMatchObject({
      sourceId: "primera-source",
      season: "2026-27",
      ok: true,
      matches: 1,
      requests: 1,
      observations: 1,
      unresolved: 1,
      skippedItems: 1,
      alerts: 1,
    });
    expect(attempt.rawRef).toMatch(/^raw\/primera-source\/2026-09-25\//);

    expect(db.observations).toHaveLength(1);
    expect(db.observations[0]).toMatchObject({
      matchId: "m1",
      sourceId: "primera-source",
      observedAt: CAPTURED_AT,
      receivedAt: NOW,
      rawRef: attempt.rawRef,
      status: "live",
      minute: 45,
      addedMinute: 3,
    });
    expect(db.observations[0].id).toMatch(/^[0-9a-f-]{36}$/);

    expect(db.alerts).toEqual([
      {
        sourceId: "primera-source",
        rawRef: attempt.rawRef,
        items: result.unresolved,
      },
    ]);
  });

  it("keeps the observedAt the adapter gives when it gives one", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const dated: ParseResult = ParseResult.parse({
      ...result,
      observations: [
        { ...result.observations[0], observedAt: "2026-09-25T18:29:00.000Z" },
      ],
    });
    await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ result: dated }),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(db.observations[0].observedAt).toBe("2026-09-25T18:29:00.000Z");
  });

  it("closes the attempt with the counters in details", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ result }),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(db.attempts[0].close).toMatchObject({
      ok: true,
      observations: 1,
      finishedAt: NOW,
      details: {
        season: "2026-27",
        matches: 1,
        requests: 1,
        unresolved: 1,
        skipped: 1,
        alerts: 1,
      },
    });
  });
});

describe("CA-7 failures are isolated", () => {
  it("records the fetch error and lets the next source run", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA, SEGUNDA],
      adapterFor: (c) =>
        c.id === "primera-source"
          ? stubAdapter({ fetchError: new Error("api-football responded 503") })
          : stubAdapter({ id: "other-source" }),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(summary.attempts).toHaveLength(2);
    expect(summary.attempts[0]).toMatchObject({
      sourceId: "primera-source",
      ok: false,
      error: "api-football responded 503",
    });
    expect(summary.attempts[0].rawRef).toBeUndefined();
    expect(summary.attempts[1]).toMatchObject({
      sourceId: "other-source",
      ok: true,
    });
    expect(db.attempts[0].close).toMatchObject({
      ok: false,
      error: "api-football responded 503",
    });
  });

  it("never parses when the capture could not be stored", async () => {
    const log: string[] = [];
    const { db, store } = harness({ log });
    db.matches = [match("m1", "primera-division")];
    const failing = {
      ...store,
      put: vi.fn(async () => {
        throw new Error("storage responded 500");
      }),
    };
    const parse = vi.fn(() => emptyParse);
    const adapter = { ...stubAdapter({ log }), parse };
    const summary = await runTick({
      db,
      store: failing,
      sources: [PRIMERA],
      adapterFor: () => adapter,
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(parse).not.toHaveBeenCalled();
    expect(db.observations).toEqual([]);
    expect(summary.attempts[0]).toMatchObject({
      ok: false,
      error: "storage responded 500",
    });
    expect(summary.attempts[0].rawRef).toBeUndefined();
  });

  it("keeps the raw_ref when parse is the one that fails", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () =>
        stubAdapter({ parseError: new Error("api-football returned errors") }),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(summary.attempts[0]).toMatchObject({
      ok: false,
      error: "api-football returned errors",
    });
    expect(summary.attempts[0].rawRef).toMatch(/^raw\//);
    expect(db.attempts[0].close?.rawRef).toBe(summary.attempts[0].rawRef);
  });

  it("closes the attempt with an error when the transaction fails", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const failing = {
      ...db,
      transaction: async () => {
        throw new Error("could not commit");
      },
    };
    const summary = await runTick({
      db: failing,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter(),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(summary.attempts[0]).toMatchObject({
      ok: false,
      error: "could not commit",
    });
  });
});

describe("CA-7 afterInsert", () => {
  it("runs inside the transaction, between begin and commit", async () => {
    const log: string[] = [];
    const { db, store } = harness({ log });
    db.matches = [match("m1", "primera-division")];
    const result: ParseResult = ParseResult.parse({
      observations: [
        {
          matchId: "m1",
          status: "finished",
          score: { home: 2, away: 1 },
          minute: null,
        },
      ],
      unresolved: [],
      skipped: [],
      requestErrors: [],
    });
    let received: unknown[] = [];
    await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ result }),
      fetch: forbiddenFetch,
      now: NOW,
      afterInsert: async (_tx, observations) => {
        log.push("afterInsert");
        received = observations;
      },
    });
    expect(received).toHaveLength(1);
    expect(log.indexOf("begin")).toBeLessThan(log.indexOf("afterInsert"));
    expect(log.indexOf("afterInsert")).toBeLessThan(log.indexOf("commit"));
    expect(log.indexOf("insertObservations:1")).toBeLessThan(
      log.indexOf("afterInsert"),
    );
  });

  it("is not called when there are no observations", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const afterInsert = vi.fn(async () => {});
    await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter(),
      fetch: forbiddenFetch,
      now: NOW,
      afterInsert,
    });
    expect(afterInsert).not.toHaveBeenCalled();
  });
});

describe("CA-7 cadence", () => {
  it("skips the source without asking the provider", async () => {
    const log: string[] = [];
    const { db, store } = harness({ log });
    db.matches = [match("m1", "primera-division")];
    db.cadence.set("primera-source", "2026-09-25T18:29:50.000Z" as Instant);
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ log }),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(summary.attempts[0]).toMatchObject({
      sourceId: "primera-source",
      skipped: "cadence",
      ok: false,
      observations: 0,
    });
    expect(log).not.toContain("fetch");
    expect(db.observations).toEqual([]);
  });
});

describe("SPEC-029 CA-1", () => {
  it("skips a locked source without asking it, keeps on with the others and sweeps", async () => {
    const log: string[] = [];
    const { db, store } = harness({ log });
    db.matches = [match("m1", "primera-division")];
    db.locked.add("primera-source");
    const sweep = vi.fn(async () => ({}) as never);
    const fetched: string[] = [];
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA, SEGUNDA],
      adapterFor: (c) =>
        stubAdapter({ id: c.id, log, onFetch: () => fetched.push(c.id) }),
      fetch: forbiddenFetch,
      now: NOW,
      sweep,
    });
    expect(summary.attempts[0]).toMatchObject({
      sourceId: "primera-source",
      skipped: "locked",
      ok: false,
      observations: 0,
    });
    expect(summary.attempts[1]).toMatchObject({ sourceId: "other-source" });
    expect(summary.attempts[1].skipped).toBeUndefined();
    expect(fetched).toEqual(["other-source"]);
    expect(db.attempts.map((a) => a.sourceId)).toEqual(["other-source"]);
    expect(sweep).toHaveBeenCalledTimes(1);
  });
});

describe("CA-7 two seasons", () => {
  it("opens one attempt per source and season", async () => {
    const { db, store } = harness();
    db.matches = [
      match("m1", "primera-division", "2026-27"),
      match("m2", "primera-division", "2027-28"),
    ];
    const seasons: string[] = [];
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: (_c, season) => {
        seasons.push(season);
        return stubAdapter();
      },
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(seasons).toEqual(["2026-27", "2027-28"]);
    expect(summary.attempts.map((a) => a.season)).toEqual([
      "2026-27",
      "2027-28",
    ]);
  });
});

describe("CA-8 a failed purge never stops the tick", () => {
  it("reports the purge as failed and still runs the attempts", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    db.stale = ["api-football/2026-08-01/a.json.gz"];
    const failing = {
      ...store,
      remove: async () => {
        throw new Error("storage responded 500");
      },
    };
    const summary = await runTick({
      db,
      store: failing,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter(),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(summary.purge).toBe("failed");
    expect(summary.attempts).toHaveLength(1);
    expect(summary.attempts[0].ok).toBe(true);
  });

  it("reports the purge as ran when there is nothing stale", async () => {
    const { db, store } = harness();
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter(),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(summary.purge).toBe("ran");
  });
});

describe("CA-10 the engine sweep (H-2)", () => {
  const counts = { matches: 2, decisions: 1, alerts: 1, resolved: 0 };

  it("is not called when nothing is in window", async () => {
    const { db, store } = harness();
    const sweep = vi.fn(async () => counts);
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter(),
      fetch: forbiddenFetch,
      now: NOW,
      sweep,
    });
    expect(sweep).not.toHaveBeenCalled();
    expect(summary.engine).toBeUndefined();
    expect(summary.engineError).toBeUndefined();
  });

  it("receives every match in window and reports its counters", async () => {
    const { db, store } = harness();
    db.matches = [
      match("m1", "primera-division"),
      match("m2", "segunda-division"),
    ];
    const sweep = vi.fn(async (_matches: WindowRow[]) => counts);
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter(),
      fetch: forbiddenFetch,
      now: NOW,
      sweep,
    });
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(sweep.mock.calls[0][0]).toEqual(db.matches);
    expect(summary.engine).toEqual(counts);
    expect(summary.engineError).toBeUndefined();
  });

  it("never brings the tick down when it fails", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter(),
      fetch: forbiddenFetch,
      now: NOW,
      sweep: async () => {
        throw new Error("deadlock detected");
      },
    });
    expect(summary.engineError).toBe("deadlock detected");
    expect(summary.engine).toBeUndefined();
    expect(summary.attempts).toHaveLength(1);
    expect(summary.attempts[0]).toMatchObject({ ok: true });
  });

  it("runs after the attempts and outside their transaction", async () => {
    const log: string[] = [];
    const { db, store } = harness({ log });
    db.matches = [match("m1", "primera-division")];
    await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ log }),
      fetch: forbiddenFetch,
      now: NOW,
      sweep: async () => {
        log.push("sweep");
        return counts;
      },
    });
    expect(log.lastIndexOf("commit")).toBeLessThan(log.indexOf("sweep"));
    expect(log.lastIndexOf("closeAttempt:true")).toBeLessThan(
      log.indexOf("sweep"),
    );
    expect(log.indexOf("sweep")).toBe(log.length - 1);
  });
});

// ---------------------------------------------------------------------------
// SPEC-011 CA-5 an attempt whose capture had a broken request keeps what the
// good ones brought, and is still ok = false.

describe("SPEC-011 CA-5 a partial attempt", () => {
  const LIVE_ERROR =
    'api-football returned errors: {"live":"The Live field does not match the regular expression: [id-id-id...] or string: all."}';
  const requestError = (i: number) => ({
    url: `https://v3.football.api-sports.io/fixtures?live=43${i}`,
    error: LIVE_ERROR,
  });
  const observation = {
    matchId: "m1",
    status: "live" as const,
    score: { home: 1, away: 0 },
    minute: 45,
    addedMinute: 3,
  };

  it("saves the observations of the good request, closes ok false and counts the incident", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const result = ParseResult.parse({
      observations: [observation],
      unresolved: [],
      skipped: [],
      requestErrors: [requestError(9)],
    });
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ result, capture: capture(2) }),
      fetch: forbiddenFetch,
      now: NOW,
    });

    // The observations are in: this is the whole point of the fix.
    expect(db.observations).toHaveLength(1);
    expect(db.observations[0]).toMatchObject({
      matchId: "m1",
      rawRef: expect.any(String),
    });

    const [attempt] = summary.attempts;
    expect(attempt).toMatchObject({
      ok: false,
      requests: 2,
      observations: 1,
      requestErrors: 1,
    });
    expect(attempt.rawRef).toMatch(/^raw\//);
    expect(attempt.error).toBe(
      `primera-source: 1 de 2 peticiones con error del proveedor: ${LIVE_ERROR}`,
    );

    const close = db.attempts[0].close;
    expect(close).toMatchObject({
      ok: false,
      observations: 1,
      details: {
        season: "2026-27",
        matches: 1,
        requests: 2,
        unresolved: 0,
        skipped: 0,
        alerts: 0,
        requestErrors: 1,
      },
    });
    expect(close?.rawRef).toBe(attempt.rawRef);
    expect(close?.error).toContain("1 de 2 peticiones con error del proveedor");
    // One line, so tick:salud and the report of the matchday stay readable.
    expect(close?.error).not.toContain("\n");
  });

  it("runs afterInsert and opens the alerts of a partial attempt, in the same transaction", async () => {
    const log: string[] = [];
    const { db, store } = harness({ log });
    db.matches = [match("m1", "primera-division")];
    const result = ParseResult.parse({
      observations: [observation],
      unresolved: [
        {
          reason: "unknown_team",
          externalCompetition: "140",
          externalMatchId: "999",
          home: { externalId: "1", externalName: "Home FC" },
          away: { externalId: "2", externalName: "Away FC" },
          status: "NS",
        },
      ],
      skipped: [],
      requestErrors: [requestError(9)],
    });
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ result, capture: capture(2), log }),
      fetch: forbiddenFetch,
      now: NOW,
      afterInsert: async () => {
        log.push("afterInsert");
      },
    });
    expect(summary.attempts[0]).toMatchObject({
      ok: false,
      alerts: 1,
      requestErrors: 1,
    });
    expect(db.alerts).toHaveLength(1);
    expect(log.indexOf("begin")).toBeLessThan(log.indexOf("afterInsert"));
    expect(log.indexOf("afterInsert")).toBeLessThan(log.indexOf("commit"));
    // Raw before parse holds, exactly as before (RN-09).
    expect(log.findIndex((l) => l.startsWith("put:"))).toBeLessThan(
      log.indexOf("parse"),
    );
  });

  it("with every request broken closes ok false with no observation and the full count", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const result = ParseResult.parse({
      observations: [],
      unresolved: [],
      skipped: [],
      requestErrors: [requestError(9), requestError(5)],
    });
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ result, capture: capture(2) }),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(db.observations).toEqual([]);
    expect(summary.attempts[0]).toMatchObject({
      ok: false,
      observations: 0,
      requestErrors: 2,
    });
    expect(summary.attempts[0].error).toBe(
      `primera-source: 2 de 2 peticiones con error del proveedor: ${LIVE_ERROR}`,
    );
    expect(db.attempts[0].close).toMatchObject({
      ok: false,
      observations: 0,
      details: { requests: 2, requestErrors: 2 },
    });
    // It still kept the raw: that is how this was diagnosed at all.
    expect(db.attempts[0].close?.rawRef).toMatch(/^raw\//);
  });

  it("a clean capture is still ok true, with the count at zero", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter(),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(summary.attempts[0]).toMatchObject({ ok: true, requestErrors: 0 });
    expect(summary.attempts[0].error).toBeUndefined();
    const details = db.attempts[0].close?.details as { requestErrors?: number };
    expect(details.requestErrors ?? 0).toBe(0);
    expect(db.attempts[0].close?.ok).toBe(true);
  });
});

// SPEC-018 CA-3 (ADR-013 §1): a match in the extension of the window is asked
// for only by ids=, at most every 5 minutes, and never adds its competition to
// live=. Proved with the real API-Football adapter over a fetch double.
describe("SPEC-018 CA-3 the extension only asks by ids=", () => {
  const API = config("api-football", [
    "primera-rfef-g1",
    "segunda-rfef-g1",
    "tercera-rfef-g1",
  ]);
  const LATE = shiftInstant(NOW, -200 * MINUTE_MS);
  const ALIASES: AliasFile = AliasFile.parse({
    source: "api-football",
    season: "2026-27",
    teams: [],
    matches: {
      "101": "segunda-rfef-g1-2026-27-j5-a-b",
      "102": "segunda-rfef-g1-2026-27-j5-c-d",
      "103": "tercera-rfef-g1-2026-27-j5-e-f",
      "201": "primera-rfef-g1-2026-27-j5-g-h",
      "202": "tercera-rfef-g1-2026-27-j5-i-j",
    },
  });

  const row = (
    id: string,
    competitionId: string,
    kickoff: Instant,
    status: WindowRow["status"],
    lastObservationAt: Instant | null,
  ): WindowRow =>
    ({
      id,
      competitionId,
      season: "2026-27",
      kickoff,
      homeTeamId: "a",
      awayTeamId: "b",
      status,
      forcedFinish: null,
      lastObservationAt,
    }) as WindowRow;

  const fetchDouble = () => {
    const urls: string[] = [];
    const fetch = (async (url: string) => {
      urls.push(String(url));
      return new Response('{"errors":[],"response":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof globalThis.fetch;
    return { urls, fetch };
  };

  const run = async (matches: WindowRow[]) => {
    const { db, store } = harness();
    db.matches = matches;
    const { urls, fetch } = fetchDouble();
    const adapterFor = vi.fn(() =>
      createApiFootballResults({ aliases: ALIASES, apiKey: "test-key" }),
    );
    const sweep = vi.fn(async (_m: WindowRow[]) => ({
      matches: 0,
      decisions: 0,
      alerts: 0,
      resolved: 0,
    }));
    const summary = await runTick({
      db,
      store,
      sources: [API],
      adapterFor,
      fetch,
      now: NOW,
      sweep,
    });
    return { db, urls, adapterFor, sweep, summary };
  };

  // N-4: one of the three is a finished with the mark that RN-02 forced from a
  // late live decided at its +200, five minutes ago; isInWindow keeps it in
  // window (CA-2) and the tick asks for it like the others.
  it("three extension matches that are due go in one ids= and no live=, one a forced finish decided at +200", async () => {
    const FORCED_KICKOFF = shiftInstant(NOW, -205 * MINUTE_MS);
    const forcedAt = shiftInstant(FORCED_KICKOFF, 200 * MINUTE_MS);
    const forced = {
      ...row(
        "tercera-rfef-g1-2026-27-j5-e-f",
        "tercera-rfef-g1",
        FORCED_KICKOFF,
        "finished",
        forcedAt,
      ),
      forcedFinish: true,
    };
    expect(isInWindow({ ...forced, decidedAt: forcedAt }, NOW)).toBe(true);
    const { urls, db } = await run([
      row(
        "segunda-rfef-g1-2026-27-j5-a-b",
        "segunda-rfef-g1",
        LATE,
        "scheduled",
        null,
      ),
      row(
        "segunda-rfef-g1-2026-27-j5-c-d",
        "segunda-rfef-g1",
        LATE,
        "scheduled",
        shiftInstant(NOW, -5 * MINUTE_MS),
      ),
      forced,
    ]);
    expect(urls).toEqual([
      "https://v3.football.api-sports.io/fixtures?ids=101-102-103",
    ]);
    expect(db.attempts).toHaveLength(1);
  });

  it("with only extension matches and none due there is no attempt and no request", async () => {
    const recent = shiftInstant(NOW, -2 * MINUTE_MS);
    const { urls, db, adapterFor, sweep, summary } = await run([
      row(
        "segunda-rfef-g1-2026-27-j5-a-b",
        "segunda-rfef-g1",
        LATE,
        "scheduled",
        recent,
      ),
      row(
        "tercera-rfef-g1-2026-27-j5-e-f",
        "tercera-rfef-g1",
        LATE,
        "scheduled",
        recent,
      ),
    ]);
    expect(urls).toEqual([]);
    expect(db.attempts).toEqual([]);
    expect(adapterFor).not.toHaveBeenCalled();
    expect(summary.attempts).toEqual([]);
    // The engine still sweeps every match in window: RN-05 reads absence.
    expect(sweep.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("an extension match does not add its competition to live=, and one not due is not asked for", async () => {
    const { urls } = await run([
      row(
        "primera-rfef-g1-2026-27-j5-g-h",
        "primera-rfef-g1",
        NOW,
        "live",
        NOW,
      ),
      row(
        "tercera-rfef-g1-2026-27-j5-i-j",
        "tercera-rfef-g1",
        NOW,
        "live",
        NOW,
      ),
      row(
        "segunda-rfef-g1-2026-27-j5-a-b",
        "segunda-rfef-g1",
        LATE,
        "scheduled",
        shiftInstant(NOW, -6 * MINUTE_MS),
      ),
      row(
        "segunda-rfef-g1-2026-27-j5-c-d",
        "segunda-rfef-g1",
        LATE,
        "scheduled",
        shiftInstant(NOW, -1 * MINUTE_MS),
      ),
    ]);
    expect(urls).toEqual([
      "https://v3.football.api-sports.io/fixtures?live=435-439",
      "https://v3.football.api-sports.io/fixtures?ids=101-201-202",
    ]);
  });
});

// ---------------------------------------------------------------------------
// SPEC-038 CA-6 (ADR-023 §5): the export of explorer brings the whole day,
// and the tick only listens to the window. An observation of a match outside
// the window of this tick is dropped, counted in details.fueraDeVentana and
// never reaches the engine. API-Football asks only for the window, so for it
// the count is zero and nothing changes.

describe("SPEC-038 CA-6 observations outside the window", () => {
  const finished = (matchId: string) => ({
    matchId,
    status: "finished" as const,
    score: { home: 2, away: 1 },
    minute: null,
  });

  it("drops the observation of a match outside the window, counts it and does not run the engine for it", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const result = ParseResult.parse({
      // m1 is in window; the other finished in the morning (out of window).
      observations: [finished("m1"), finished("m-morning")],
      unresolved: [],
      skipped: [],
      requestErrors: [],
    });
    const received: string[] = [];
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ result }),
      fetch: forbiddenFetch,
      now: NOW,
      afterInsert: async (_tx, observations) => {
        received.push(...observations.map((o) => o.matchId));
      },
    });
    expect(db.observations.map((o) => o.matchId)).toEqual(["m1"]);
    expect(received).toEqual(["m1"]);
    expect(summary.attempts[0]).toMatchObject({
      ok: true,
      observations: 1,
      outOfWindow: 1,
    });
    expect(db.attempts[0].close).toMatchObject({
      ok: true,
      observations: 1,
      details: { matches: 1, fueraDeVentana: 1 },
    });
  });

  it("with every observation outside the window inserts nothing and never calls afterInsert", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    const result = ParseResult.parse({
      observations: [finished("m-morning"), finished("m-other")],
      unresolved: [],
      skipped: [],
      requestErrors: [],
    });
    const afterInsert = vi.fn(async () => {});
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () => stubAdapter({ result }),
      fetch: forbiddenFetch,
      now: NOW,
      afterInsert,
    });
    expect(db.observations).toEqual([]);
    expect(afterInsert).not.toHaveBeenCalled();
    expect(summary.attempts[0]).toMatchObject({
      ok: true,
      observations: 0,
      outOfWindow: 2,
    });
    expect(db.attempts[0].close?.details).toMatchObject({ fueraDeVentana: 2 });
  });

  it("the window is the whole window of the tick: a match in the extension not due this tick is still accepted", async () => {
    const { db, store } = harness();
    const late = shiftInstant(NOW, -200 * MINUTE_MS);
    const extension: WindowRow = {
      ...match("m-ext", "primera-division"),
      kickoff: late,
      status: "scheduled",
      forcedFinish: null,
      // Heard two minutes ago: not due (ADR-013 §1), but in window.
      lastObservationAt: shiftInstant(NOW, -2 * MINUTE_MS),
    };
    db.matches = [match("m1", "primera-division"), extension];
    const result = ParseResult.parse({
      observations: [finished("m1"), finished("m-ext")],
      unresolved: [],
      skipped: [],
      requestErrors: [],
    });
    let asked: string[] = [];
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () =>
        stubAdapter({
          result,
          onFetch: (ctx) => {
            asked = ctx.matches.map((m) => m.id);
          },
        }),
      fetch: forbiddenFetch,
      now: NOW,
    });
    expect(asked).toEqual(["m1"]);
    expect(db.observations.map((o) => o.matchId).sort()).toEqual([
      "m-ext",
      "m1",
    ]);
    expect(summary.attempts[0]).toMatchObject({
      observations: 2,
      outOfWindow: 0,
    });
  });

  it("api-football does not change: the provider answers what ids= asked, so zero are counted", async () => {
    const root = new URL("../../", import.meta.url);
    const aliases = AliasFile.parse(
      JSON.parse(
        readFileSync(
          new URL("data/alias/2026-27/api-football.json", root),
          "utf8",
        ),
      ),
    );
    const fixture = JSON.parse(
      readFileSync(
        new URL("src/sources/api-football/fixtures/ids-2026-09-21.json", root),
        "utf8",
      ),
    ) as { response: { fixture: { id: number } }[] };
    const MATCH = "segunda-division-2026-27-j6-albacete-cordoba";
    const fixtureId = Object.entries(aliases.matches ?? {}).find(
      ([, id]) => id === MATCH,
    )?.[0];
    if (fixtureId === undefined) throw new Error("no alias for the match");
    const { db, store } = harness();
    db.matches = [{ ...match(MATCH, "segunda-division"), kickoff: NOW }];
    const urls: string[] = [];
    // The provider answers exactly the ids it was asked for, as the real one.
    const fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      urls.push(url);
      const ids = new Set((url.match(/ids=([\d-]+)/)?.[1] ?? "").split("-"));
      const response = fixture.response.filter((f) =>
        ids.has(String(f.fixture.id)),
      );
      return new Response(JSON.stringify({ errors: [], response }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof globalThis.fetch;
    const summary = await runTick({
      db,
      store,
      sources: [config("api-football", ["segunda-division"])],
      adapterFor: () => createApiFootballResults({ aliases, apiKey: "k" }),
      fetch,
      now: NOW,
    });
    expect(urls).toEqual([
      `https://v3.football.api-sports.io/fixtures?ids=${fixtureId}`,
    ]);
    expect(summary.attempts[0]).toMatchObject({
      ok: true,
      observations: 1,
      outOfWindow: 0,
    });
    expect(db.observations[0]).toMatchObject({ matchId: MATCH });
    expect(db.attempts[0].close?.details).toMatchObject({ fueraDeVentana: 0 });
  });
});

// ---------------------------------------------------------------------------
// SPEC-044 CA-5 (ADR-025 §2-§5): the tick with recovery. A pull source with a
// horizon takes, when it is its turn (every RECOVERY_POLL_MINUTES, measured
// over its attempts of the last hour that carried details.recuperacion), the
// matches in recovery along with those in window: one attempt, one capture.
// Their observations go through planRecovery and reach the hook as
// recovered; the sweep never sees them.

describe("SPEC-044 CA-5 the tick with recovery", () => {
  const FIVE = [
    "primera-division",
    "segunda-division",
    "primera-rfef-g1",
    "segunda-rfef-g1",
    "tercera-rfef-g1",
  ];
  const EXPLORER_URL = "https://explorer.test";
  const ENV = {
    API_FOOTBALL_KEY: "not-a-real-key",
    RFEF_EXPLORER_URL: EXPLORER_URL,
    RFEF_EXPLORER_TOKEN: "tok",
  };
  // The rfef of the registry with a stub adapter: the horizon is keyed by
  // the id of the source (constants.ts), so the stub wears it.
  const RFEF = config("rfef", FIVE);
  const MONDAY = "2026-11-02T10:00:00.000Z" as Instant;
  const SEEN = "2026-11-01T22:58:41.000Z" as Instant;

  const recoverable = (
    id: string,
    kickoff: Instant,
    competitionId = "segunda-division",
  ): WindowRow =>
    ({
      id,
      competitionId,
      season: "2026-27",
      kickoff,
      homeTeamId: "a",
      awayTeamId: "b",
      status: "scheduled",
      forcedFinish: null,
      lastObservationAt: null,
    }) as WindowRow;

  const final = (matchId: string, observedAt: Instant = SEEN) =>
    ParseResult.parse({
      observations: [
        {
          matchId,
          status: "finished",
          score: { home: 2, away: 1 },
          minute: null,
          observedAt,
        },
      ],
      unresolved: [],
      skipped: [],
      requestErrors: [],
    }).observations[0];

  const parsed = (observations: unknown[]): ParseResult =>
    ParseResult.parse({
      observations,
      unresolved: [],
      skipped: [],
      requestErrors: [],
    });

  const recovered = (
    sourceId: string,
    startedAt: Instant,
    db: ReturnType<typeof createMemoryIngestDb>,
  ) =>
    db.attempts.push({
      id: crypto.randomUUID(),
      sourceId,
      startedAt,
      close: {
        finishedAt: startedAt,
        ok: true,
        observations: 0,
        details: {
          recuperacion: {
            partidos: 1,
            fechas: 1,
            insertadas: 0,
            duplicadas: 0,
            descartadasLive: 0,
          },
        },
      },
    });

  it("(i) with an empty window and 60 matches in recovery over three dates: one rfef attempt with three GET, one per ?date=, and no api-football attempt", async () => {
    const { db, store } = harness();
    const dates = ["2026-10-30", "2026-10-31", "2026-11-01"];
    db.recoverable = Array.from({ length: 60 }, (_, i) =>
      recoverable(
        `rec-${i}`,
        `${dates[i % 3]}T12:00:00.000Z` as Instant,
        FIVE[i % 5],
      ),
    );
    const urls: string[] = [];
    const fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      urls.push(url);
      const date = url.slice(-10);
      return new Response(
        `{"exportedAt":"2026-11-02T10:00:00Z","date":"${date}","matches":[]}`,
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof globalThis.fetch;
    const sweep = vi.fn(async (_m: WindowRow[]) => ({}) as never);
    const summary = await runTick({
      db,
      store,
      sources: SOURCES,
      adapterFor: (c, season) => adapterFor(c, season, ENV),
      fetch,
      now: MONDAY,
      sweep,
    });
    expect(summary.inWindow).toBe(0);
    expect(summary.attempts.map((a) => a.sourceId)).toEqual(["rfef"]);
    expect(urls).toEqual(
      dates.map((d) => `${EXPLORER_URL}/api/export/matches?date=${d}`),
    );
    expect(summary.attempts[0]).toMatchObject({
      ok: true,
      matches: 60,
      requests: 3,
      observations: 0,
      recovered: {
        partidos: 60,
        fechas: 3,
        insertadas: 0,
        duplicadas: 0,
        descartadasLive: 0,
      },
    });
    expect(db.attempts).toHaveLength(1);
    expect(db.attempts[0].close?.details).toMatchObject({
      matches: 60,
      recuperacion: {
        partidos: 60,
        fechas: 3,
        insertadas: 0,
        duplicadas: 0,
        descartadasLive: 0,
      },
    });
    expect(db.log).toContain("recoveryMatches:72");
    expect(db.log).not.toContain("recoveryMatches:0");
    // The sweep is born of the window, and there is none.
    expect(sweep).not.toHaveBeenCalled();
  });

  it("(ii) the hook receives recovered = the ids in recovery, and an observation of a match neither in window nor in recovery is counted out", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    db.recoverable = [recoverable("m-rec", SEEN)];
    const result = parsed([
      { ...final("m1"), observedAt: MONDAY },
      final("m-rec"),
      final("m-other"),
    ]);
    const seen: { ids: string[]; recovered: string[] | undefined }[] = [];
    const summary = await runTick({
      db,
      store,
      sources: [RFEF],
      adapterFor: () => stubAdapter({ id: "rfef", result }),
      fetch: forbiddenFetch,
      now: MONDAY,
      afterInsert: async (_tx, observations, options) => {
        seen.push({
          ids: observations.map((o) => o.matchId),
          recovered: options?.recovered && [...options.recovered].map(String),
        });
      },
    });
    expect(seen).toEqual([{ ids: ["m1", "m-rec"], recovered: ["m-rec"] }]);
    expect(db.observations.map((o) => o.matchId)).toEqual(["m1", "m-rec"]);
    expect(summary.attempts[0]).toMatchObject({
      matches: 2,
      observations: 2,
      outOfWindow: 1,
      recovered: { partidos: 1, fechas: 1, insertadas: 1, duplicadas: 0 },
    });
    expect(db.attempts[0].close?.details).toMatchObject({
      fueraDeVentana: 1,
      recuperacion: { partidos: 1, insertadas: 1 },
    });
  });

  it("(iii) with an attempt with recovery two minutes ago the recovery set stays out and the window is asked as always; five minutes ago, it is in", async () => {
    const run = async (minutesAgo: number) => {
      const { db, store } = harness();
      db.matches = [match("m1", "primera-division")];
      db.recoverable = [recoverable("m-rec", SEEN)];
      recovered("rfef", shiftInstant(MONDAY, -minutesAgo * MINUTE_MS), db);
      let asked: string[] = [];
      const summary = await runTick({
        db,
        store,
        sources: [RFEF],
        adapterFor: () =>
          stubAdapter({
            id: "rfef",
            onFetch: (ctx) => {
              asked = ctx.matches.map((m) => m.id);
            },
          }),
        fetch: forbiddenFetch,
        now: MONDAY,
      });
      return { asked, attempt: summary.attempts[0], db };
    };
    const recent = await run(2);
    expect(recent.asked).toEqual(["m1"]);
    expect(recent.attempt).toMatchObject({ matches: 1 });
    expect(recent.attempt.recovered).toBeUndefined();
    expect(recent.db.attempts.at(-1)?.close?.details).not.toHaveProperty(
      "recuperacion",
    );

    const due = await run(5);
    expect(due.asked).toEqual(["m1", "m-rec"]);
    expect(due.attempt).toMatchObject({
      matches: 2,
      recovered: { partidos: 1 },
    });
  });

  it("(iii) an attempt with recovery older than an hour does not count: the set is in", async () => {
    const { db, store } = harness();
    db.recoverable = [recoverable("m-rec", SEEN)];
    recovered("rfef", shiftInstant(MONDAY, -61 * MINUTE_MS), db);
    const summary = await runTick({
      db,
      store,
      sources: [RFEF],
      adapterFor: () => stubAdapter({ id: "rfef" }),
      fetch: forbiddenFetch,
      now: MONDAY,
    });
    expect(summary.attempts[0]).toMatchObject({ recovered: { partidos: 1 } });
    expect(db.log).toContain(
      `lastRecoveryAttemptAt:rfef:${shiftInstant(MONDAY, -60 * MINUTE_MS)}`,
    );
  });

  it("(iv) a second tick with the same export inserts nothing: duplicadas = n (ADR-025 §5)", async () => {
    const { db, store } = harness();
    db.recoverable = [recoverable("m-a", SEEN), recoverable("m-b", SEEN)];
    const result = parsed([final("m-a"), final("m-b")]);
    const tick = (now: Instant) =>
      runTick({
        db,
        store,
        sources: [RFEF],
        adapterFor: () => stubAdapter({ id: "rfef", result }),
        fetch: forbiddenFetch,
        now,
      });
    const first = await tick(MONDAY);
    expect(first.attempts[0]).toMatchObject({
      observations: 2,
      recovered: { insertadas: 2, duplicadas: 0 },
    });
    expect(db.observations).toHaveLength(2);
    // Five minutes later, its turn again: the same lastSeenAt, status and
    // score are already there.
    const second = await tick(shiftInstant(MONDAY, 5 * MINUTE_MS));
    expect(second.attempts[0]).toMatchObject({
      ok: true,
      observations: 0,
      recovered: { partidos: 2, insertadas: 0, duplicadas: 2 },
    });
    expect(db.observations).toHaveLength(2);
    expect(db.attempts).toHaveLength(2);
  });

  it("(v) a live of a match in recovery is dropped and counted, never inserted (ADR-025 §3)", async () => {
    const { db, store } = harness();
    db.recoverable = [recoverable("m-rec", SEEN)];
    const result = parsed([
      {
        matchId: "m-rec",
        status: "live",
        score: { home: 1, away: 0 },
        minute: null,
        addedMinute: null,
        observedAt: SEEN,
      },
    ]);
    const afterInsert = vi.fn(async () => {});
    const summary = await runTick({
      db,
      store,
      sources: [RFEF],
      adapterFor: () => stubAdapter({ id: "rfef", result }),
      fetch: forbiddenFetch,
      now: MONDAY,
      afterInsert,
    });
    expect(db.observations).toEqual([]);
    expect(afterInsert).not.toHaveBeenCalled();
    expect(summary.attempts[0]).toMatchObject({
      observations: 0,
      recovered: { partidos: 1, insertadas: 0, descartadasLive: 1 },
    });
    expect(db.attempts[0].close?.details).toMatchObject({
      recuperacion: { descartadasLive: 1 },
    });
  });

  it("(vi) the sweep receives only the window", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    db.recoverable = [recoverable("m-rec", SEEN)];
    const sweep = vi.fn(async (_m: WindowRow[]) => ({
      matches: 1,
      decisions: 0,
      alerts: 0,
      resolved: 0,
    }));
    await runTick({
      db,
      store,
      sources: [RFEF],
      adapterFor: () => stubAdapter({ id: "rfef" }),
      fetch: forbiddenFetch,
      now: MONDAY,
      sweep,
    });
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(sweep.mock.calls[0][0].map((m) => m.id)).toEqual(["m1"]);
  });

  it("a source without a horizon never asks for the recovery set", async () => {
    const { db, store } = harness();
    db.matches = [match("m1", "primera-division")];
    db.recoverable = [recoverable("m-rec", SEEN, "primera-division")];
    let asked: string[] = [];
    const summary = await runTick({
      db,
      store,
      sources: [PRIMERA],
      adapterFor: () =>
        stubAdapter({
          onFetch: (ctx) => {
            asked = ctx.matches.map((m) => m.id);
          },
        }),
      fetch: forbiddenFetch,
      now: MONDAY,
    });
    expect(asked).toEqual(["m1"]);
    expect(summary.attempts[0].recovered).toBeUndefined();
    expect(db.log.filter((l) => l.startsWith("recoveryMatches"))).toEqual([]);
  });
});
