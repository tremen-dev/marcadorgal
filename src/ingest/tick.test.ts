import { describe, expect, it, vi } from "vitest";
import {
  type CompetitionId,
  type FetchContext,
  type Instant,
  ParseResult,
  type RawCapture,
  type SourceAdapter,
  SourceConfig,
  SourceId,
  type WindowMatch,
} from "@/model";
import { createMemoryRawStore } from "../raw/memory.ts";
import type { WindowRow } from "./db.ts";
import { createMemoryIngestDb } from "./memory.ts";
import { runTick } from "./tick.ts";

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
