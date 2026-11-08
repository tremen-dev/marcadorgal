import { describe, expect, it, vi } from "vitest";
import { decide, type EngineMatch } from "../decide/index.ts";
import {
  type CompetitionId,
  type Decision,
  type DecisionId,
  type Instant,
  type MatchId,
  type MatchState,
  MINUTE_MS,
  type Observation,
  type ObservationId,
  type SourceId,
  shiftInstant,
} from "../model/index.ts";
import { createMemoryRawStore } from "../raw/memory.ts";
import { SOURCES, sourceConfig } from "../sources/registry.ts";
import { USER_AGENT } from "../sources/rfef/adapter.ts";
import { ADAPTERS, adapterFor } from "./adapters.ts";
import type { WindowRow } from "./db.ts";
import { priorityLookup } from "./engine.ts";
import { createMemoryIngestDb } from "./memory.ts";
import { tickSalud } from "./salud.ts";
import { runTick } from "./tick.ts";

// SPEC-038 CA-7 (registry, ADAPTERS, the engine with the priorities of the
// registry) and CA-8 (a failure of explorer is visible and isolated).

const FIVE = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];
const EXPLORER_URL = "https://explorer.test";
const TOKEN = "tok-s3cret-of-explorer";
const ENV = {
  API_FOOTBALL_KEY: "not-a-real-key",
  RFEF_EXPLORER_URL: EXPLORER_URL,
  RFEF_EXPLORER_TOKEN: TOKEN,
};

describe("CA-7 registry", () => {
  const rfef = sourceConfig("rfef");

  it("rfef is registered: pull, the five competitions at priority 50 (ADR-026), 30 s, the UA of adapter.ts and the legalBasis of the titular", () => {
    expect(rfef).toBeDefined();
    expect(rfef).toMatchObject({
      id: "rfef",
      kind: "pull",
      minIntervalSeconds: 30,
      userAgent: USER_AGENT,
      legalBasis:
        "Datos de rfef.es y proveedores multi-fuente vía explorer (ADR-026)",
    });
    expect([...(rfef?.competitions ?? [])].sort()).toEqual([...FIVE].sort());
    expect(rfef?.priority).toEqual(
      Object.fromEntries(FIVE.map((c) => [c, 50])),
    );
  });

  it("rfef has priority 50 (ADR-026)", () => {
    for (const c of FIVE) {
      const priority = priorityLookup(SOURCES, c);
      expect(priority("rfef")).toBe(50);
    }
  });
});

describe("CA-7 ADAPTERS['rfef'] builds the explorer adapter", () => {
  it("with the alias, the calendar of the season and the two env variables", async () => {
    const config = sourceConfig("rfef");
    if (config === undefined) throw new Error("rfef not registered");
    const adapter = adapterFor(config, "2026-27", ENV);
    expect(adapter.id).toBe("rfef");
    expect(adapter.kind).toBe("pull");
    // The real alias of the season is in.
    expect(
      adapter.resolveTeam("Zamora CF", "primera-rfef-g1" as CompetitionId),
    ).toBe("zamora");
    expect(
      adapter.resolveTeam("c.d. barco", "tercera-rfef-g1" as CompetitionId),
    ).toBe("barco");
    // It is the adapter of the export, not the direct one: one GET to
    // explorer with the Bearer, never the portada of the RFEF.
    const calls: { url: string; auth: string | null }[] = [];
    const fetch = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({
        url: String(input),
        auth: new Headers(init?.headers).get("authorization"),
      });
      return new Response(
        '{"exportedAt":"2026-11-01T22:00:00Z","date":"2026-11-01","matches":[]}',
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as unknown as typeof globalThis.fetch;
    const capture = await adapter.fetch?.({
      now: "2026-11-01T16:00:00Z",
      competitions: ["primera-rfef-g1" as CompetitionId],
      matches: [
        {
          id: "primera-rfef-g1-2026-27-j10-zamora-deportivo-fabril",
          competitionId: "primera-rfef-g1",
          season: "2026-27",
          kickoff: "2026-11-01T17:45:00Z",
          homeTeamId: "zamora",
          awayTeamId: "deportivo-fabril",
        } as never,
      ],
      fetch,
      userAgent: config.userAgent,
    });
    expect(calls).toEqual([
      {
        url: `${EXPLORER_URL}/api/export/matches?date=2026-11-01`,
        auth: `Bearer ${TOKEN}`,
      },
    ]);
    expect(JSON.stringify(capture)).not.toContain(TOKEN);
    expect(Object.keys(ADAPTERS).sort()).toEqual(["rfef"]);
  });

  it.each(["RFEF_EXPLORER_URL", "RFEF_EXPLORER_TOKEN"])(
    "names %s when it is not set",
    (name) => {
      const config = sourceConfig("rfef");
      if (config === undefined) throw new Error("rfef not registered");
      expect(() =>
        adapterFor(config, "2026-27", { ...ENV, [name]: "" }),
      ).toThrow(`${name} is not set`);
    },
  );
});

// --- CA-7: three cases over decide with the priorities of the registry ----

const KICKOFF = "2026-11-01T17:45:00.000Z" as Instant;
const MATCH: EngineMatch = {
  id: "primera-rfef-g1-2026-27-j10-zamora-deportivo-fabril" as MatchId,
  competitionId: "primera-rfef-g1" as CompetitionId,
  kickoff: KICKOFF,
};
const at = (minutes: number): Instant =>
  shiftInstant(KICKOFF, minutes * MINUTE_MS);
let seq = 0;
const nextId = (): ObservationId =>
  `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}` as ObservationId;
const live = (home: number, away: number): MatchState => ({
  status: "live",
  score: { home, away },
  minute: null,
  addedMinute: null,
});
const obs = (
  sourceId: string,
  minutes: number,
  state: MatchState,
): Observation =>
  ({
    ...state,
    id: nextId(),
    matchId: MATCH.id,
    sourceId: sourceId as SourceId,
    observedAt: at(minutes),
    receivedAt: at(minutes),
    rawRef: `raw/${sourceId}/2026-11-01/x.json.gz`,
  }) as Observation;
const current = (state: MatchState, by: SourceId): Decision =>
  ({
    ...state,
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as DecisionId,
    matchId: MATCH.id,
    version: 1,
    qualifier: "provisional",
    rule: "RN-01",
    observationIds: ["ffffffff-ffff-4fff-8fff-ffffffffffff" as ObservationId],
    decidedAt: at(10),
    scoredBy: { home: by, away: by },
    forcedFinish: false,
  }) as Decision;
// Historical ADR-023 §1 simulation: api-football at 10, rfef at 5
const priority10vs5 = (id: string) =>
  id === "api-football" ? 10 : id === "rfef" ? 5 : undefined;

describe("CA-7 the engine with api-football at 10 and rfef at 5 (ADR-023 §1)", () => {
  const priority = priority10vs5;
  it("when they agree: confirmado, citing both observations", () => {
    const api = obs("api-football", 30, live(1, 0));
    const rfef = obs("rfef", 29, live(1, 0));
    const { decision, open } = decide({
      match: MATCH,
      current: null,
      observations: [rfef, api],
      priority,
      now: at(31),
    });
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 1, away: 0 },
      qualifier: "confirmado",
      rule: "RN-01",
    });
    expect(decision?.observationIds).toEqual([api.id, rfef.id]);
    expect(open).toEqual([]);
  });

  it("when they disagree and api-football is fresh: api-football wins, provisional", () => {
    const api = obs("api-football", 30, live(1, 0));
    const rfef = obs("rfef", 30, live(2, 0));
    const { decision, open } = decide({
      match: MATCH,
      current: null,
      observations: [rfef, api],
      priority,
      now: at(31),
    });
    expect(decision).toMatchObject({
      score: { home: 1, away: 0 },
      qualifier: "provisional",
      rule: "RN-01",
    });
    expect(decision?.observationIds).toEqual([api.id]);
    expect(open).toEqual([]);
  });

  it("a disagreement held more than 3 min between the adjacent 10 and 5 opens conflict and holds (RN-04, ADR-023 §1)", () => {
    const held = current(live(1, 0), "api-football" as SourceId);
    const { decision, open } = decide({
      match: MATCH,
      current: held,
      observations: [
        obs("api-football", 26, live(1, 0)),
        obs("rfef", 26, live(2, 0)),
        obs("api-football", 30, live(1, 0)),
        obs("rfef", 30, live(2, 0)),
      ],
      priority,
      now: at(31),
    });
    expect(decision).toBeNull();
    expect(open.map((a) => a.kind)).toEqual(["conflict"]);
  });

  it("when api-football has been silent for 5 min: the rfef wins, provisional", () => {
    const held = current(live(1, 0), "api-football" as SourceId);
    const stale = obs("api-football", 24, live(1, 0)); // 7 min old at now
    const rfef = obs("rfef", 30, live(2, 0));
    const { decision, open } = decide({
      match: MATCH,
      current: held,
      observations: [stale, rfef],
      priority,
      now: at(31),
    });
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 2, away: 0 },
      qualifier: "provisional",
      rule: "RN-01",
      scoredBy: { home: "rfef", away: "api-football" },
    });
    expect(decision?.observationIds).toEqual([rfef.id]);
    expect(open).toEqual([]);
  });

  it("the rfef never lowers a score api-football published while it is in play (RN-03, ADR-011)", () => {
    const held = current(live(2, 0), "api-football" as SourceId);
    const { decision, open } = decide({
      match: MATCH,
      current: held,
      observations: [obs("rfef", 30, live(1, 0))],
      priority,
      now: at(31),
    });
    // The held score is what would be published: the same tuple as the
    // current Decision, so nothing is written, and the retreat is alerted.
    expect(decision).toBeNull();
    expect(open.map((a) => a.kind)).toEqual(["regression"]);
  });
});

describe("the engine with rfef at priority 50 (ADR-026)", () => {
  const priority = priorityLookup(SOURCES, MATCH.competitionId);

  it("rfef wins alone with confirmado as official federation source (ADR-017 §5, ADR-026)", () => {
    const rfef = obs("rfef", 30, live(2, 0));
    const { decision, open } = decide({
      match: MATCH,
      current: null,
      observations: [rfef],
      priority,
      now: at(31),
    });
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 2, away: 0 },
      qualifier: "confirmado",
      rule: "RN-01",
    });
    expect(decision?.observationIds).toEqual([rfef.id]);
    expect(open).toEqual([]);
  });

  it("rfef at 50 beats api-football at 10", () => {
    const api = obs("api-football", 30, live(1, 0));
    const rfef = obs("rfef", 30, live(2, 0));
    const { decision, open } = decide({
      match: MATCH,
      current: null,
      observations: [rfef, api],
      priority,
      now: at(31),
    });
    expect(decision).toMatchObject({
      score: { home: 2, away: 0 },
      qualifier: "confirmado",
      rule: "RN-01",
    });
    expect(decision?.observationIds).toEqual([rfef.id]);
    expect(open).toEqual([]);
  });
});

// --- CA-8: a failure of explorer, visible and isolated -------------------

describe("CA-8 a tick with explorer that fails", () => {
  const NOW = "2026-09-18T20:30:00.000Z" as Instant;
  const MATCH_ID = "segunda-division-2026-27-j6-albacete-cordoba";

  const windowRow: WindowRow = {
    id: MATCH_ID,
    competitionId: "segunda-division",
    season: "2026-27",
    kickoff: NOW,
    homeTeamId: "albacete",
    awayTeamId: "cordoba",
    status: "live",
    forcedFinish: null,
    lastObservationAt: null,
  } as WindowRow;

  const fetchDouble = (explorer: () => Response) => {
    const urls: string[] = [];
    const fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      urls.push(url);
      if (url.startsWith(EXPLORER_URL)) return explorer();
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof globalThis.fetch;
    return { urls, fetch };
  };

  const run = async (explorer: () => Response) => {
    const db = createMemoryIngestDb();
    const store = createMemoryRawStore();
    db.matches = [windowRow];
    const { urls, fetch } = fetchDouble(explorer);
    const engineSaw: string[] = [];
    const summary = await runTick({
      db,
      store,
      sources: SOURCES,
      adapterFor: (config, season) => adapterFor(config, season, ENV),
      fetch,
      now: NOW,
      afterInsert: async (_tx, observations) => {
        engineSaw.push(...observations.map((o) => o.sourceId));
      },
    });
    const salud = tickSalud({
      now: NOW,
      secrets: [TOKEN],
      jobs: [],
      runs: [],
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
    return { db, urls, summary, engineSaw, salud };
  };

  const json = (body: string, status: number) =>
    new Response(body, {
      status,
      headers: { "content-type": "application/json" },
    });

  it.each([
    [
      "401",
      () => json('{"error":"Unauthorized"}', 401),
      /rfef explorer responded 401/,
    ],
    ["500", () => json('{"error":"boom"}', 500), /rfef explorer responded 500/],
    [
      "an empty 200",
      () => new Response(new Uint8Array(0), { status: 200 }),
      /empty body/,
    ],
    ["a 200 with invalid JSON", () => json("<html>", 200), /not JSON/],
  ])(
    "explorer answers %s: the rfef attempt fails with the reason",
    async (_, explorer, reason) => {
      const { db, urls, summary, engineSaw, salud } = await run(explorer);
      expect(urls.filter((u) => u.startsWith(EXPLORER_URL))).toEqual([
        `${EXPLORER_URL}/api/export/matches?date=2026-09-18`,
      ]);
      const byId = new Map(summary.attempts.map((a) => [a.sourceId, a]));
      expect(byId.get("rfef")?.ok).toBe(false);
      expect(byId.get("rfef")?.error).toMatch(reason);
      expect(db.observations).toHaveLength(0);
      expect(engineSaw).toHaveLength(0);
      // tick:salud shows the rfef in FALLO without the token.
      expect(salud.ok).toBe(false);
      expect(salud.text).toMatch(/rfef\s+FALLO/);
      expect(salud.text).not.toContain(TOKEN);
      // Attempt closed in ingest_attempts.
      expect(db.attempts.map((a) => [a.sourceId, a.close?.ok])).toEqual([
        ["rfef", false],
      ]);
    },
  );

  it("with explorer healthy attempt ends ok and the rfef asks once per tick", async () => {
    const { summary, urls } = await run(() =>
      json(
        '{"exportedAt":"2026-09-18T20:30:00Z","date":"2026-09-18","matches":[]}',
        200,
      ),
    );
    expect(summary.attempts.map((a) => [a.sourceId, a.ok])).toEqual([
      ["rfef", true],
    ]);
    expect(urls.filter((u) => u.startsWith(EXPLORER_URL))).toHaveLength(1);
    expect(vi.isMockFunction(fetch)).toBe(false);
  });
});
