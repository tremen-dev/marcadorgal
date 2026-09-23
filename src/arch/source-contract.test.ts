import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AliasFile,
  type CompetitionId,
  type FetchContext,
  type MatchId,
  ParseResult,
  type RawCapture,
  type SourceAdapter,
  SourceConfig,
  SourceId,
  type WindowMatch,
} from "@/model";
import { createApiFootballResults } from "../sources/api-football/results.ts";
import { SOURCES } from "../sources/registry.ts";

// SPEC-005 CA-8: two sources behind the same contract, driven by code that
// only knows SourceAdapter and SourceConfig. Nothing here is API-Football
// specific beyond constructing its adapter.

const root = new URL("../../", import.meta.url);
const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(new URL(rel, root), "utf8"));

const aliases = AliasFile.parse(
  readJson("data/alias/2026-27/api-football.json"),
);
const idsFixture = readFileSync(
  new URL("src/sources/api-football/fixtures/ids-2026-09-21.json", root),
  "utf8",
);

// A real match of the calendar, present in the ids fixture as FT 1-2.
const MATCH = "segunda-division-2026-27-j6-albacete-cordoba" as MatchId;
const calendar = readJson("data/calendario/2026-27/segunda-division.json") as {
  matches: { round: number; kickoff: string; home: string; away: string }[];
};
const real = calendar.matches.find(
  (m) => m.round === 6 && m.home === "albacete" && m.away === "cordoba",
);
if (!real) throw new Error(`${MATCH} is not in the calendar`);
const windowMatch: WindowMatch = {
  id: MATCH,
  competitionId: "segunda-division" as CompetitionId,
  season: "2026-27",
  kickoff: real.kickoff,
  homeTeamId: "albacete" as WindowMatch["homeTeamId"],
  awayTeamId: "cordoba" as WindowMatch["awayTeamId"],
};

// --- the in-memory source -------------------------------------------------

const MEMORY_URL = "https://memory.invalid/board";
const memoryBody = JSON.stringify({
  matches: [{ id: MATCH, status: "finished", home: 1, away: 2 }],
});

const memory: SourceAdapter = {
  id: SourceId.parse("memory"),
  kind: "pull",
  async fetch(ctx) {
    const res = await ctx.fetch(MEMORY_URL, {
      headers: { "User-Agent": ctx.userAgent },
    });
    return {
      sourceId: this.id,
      capturedAt: ctx.now,
      requests: [
        {
          url: MEMORY_URL,
          status: res.status,
          contentType: res.headers.get("content-type"),
          body: await res.text(),
        },
      ],
    };
  },
  parse(raw) {
    const observations = raw.requests.flatMap((r) => {
      const { matches } = JSON.parse(r.body) as {
        matches: {
          id: MatchId;
          status: "finished";
          home: number;
          away: number;
        }[];
      };
      return matches.map((m) => ({
        matchId: m.id,
        status: m.status,
        score: { home: m.home, away: m.away },
        minute: null,
      }));
    });
    return { observations, unresolved: [], skipped: [], requestErrors: [] };
  },
  resolveTeam: () => null,
};

const memoryConfig = {
  id: "memory",
  kind: "pull",
  competitions: ["segunda-division"],
  priority: { "segunda-division": 5 },
  minIntervalSeconds: 60,
  userAgent: "marcador.gal (memory)",
  legalBasis: "in-memory test source",
};

// A registered-nowhere adapter: the driver must never call its fetch.
let orphanFetches = 0;
const orphan: SourceAdapter = {
  id: SourceId.parse("orphan"),
  kind: "pull",
  async fetch(ctx): Promise<RawCapture> {
    orphanFetches++;
    return { sourceId: this.id, capturedAt: ctx.now, requests: [] };
  },
  parse: () => ({
    observations: [],
    unresolved: [],
    skipped: [],
    requestErrors: [],
  }),
  resolveTeam: () => null,
};

// --- the generic driver ---------------------------------------------------

type Ctx = Omit<FetchContext, "userAgent" | "competitions">;

// Only SourceAdapter and SourceConfig members: a pull adapter with a
// configuration gets fetch + parse over the matches of its competitions.
async function drive(
  configs: SourceConfig[],
  adapters: SourceAdapter[],
  ctx: Ctx,
): Promise<Map<string, ParseResult>> {
  const results = new Map<string, ParseResult>();
  for (const adapter of adapters) {
    const config = configs.find((c) => c.id === adapter.id);
    if (config?.kind !== "pull" || !adapter.fetch) continue;
    const covered = new Set<string>(config.competitions);
    const matches = ctx.matches.filter((m) => covered.has(m.competitionId));
    const raw = await adapter.fetch({
      ...ctx,
      matches,
      competitions: [...new Set(matches.map((m) => m.competitionId))],
      userAgent: config.userAgent,
    });
    results.set(adapter.id, adapter.parse(raw));
  }
  return results;
}

// --- the shared fetch stub ------------------------------------------------

const calls: string[] = [];
const stub = (async (input: string | URL | Request) => {
  const url = String(input);
  calls.push(url);
  const body = url.startsWith(MEMORY_URL)
    ? memoryBody
    : url.includes("live=")
      ? JSON.stringify({ response: [] })
      : idsFixture;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof globalThis.fetch;

describe("CA-8 two sources behind SourceAdapter", () => {
  const configs = SourceConfig.array().parse([...SOURCES, memoryConfig]);
  const apiFootball = createApiFootballResults({ aliases, apiKey: "k" });
  const adapters = [apiFootball, memory, orphan];
  const ctx: Ctx = {
    now: "2026-09-18T20:30:00Z",
    matches: [windowMatch],
    fetch: stub,
  };

  it("drives api-football and memory to a valid ParseResult with the same match, and never calls the unregistered one", async () => {
    const results = await drive(configs, adapters, ctx);
    expect([...results.keys()].sort()).toEqual(["api-football", "memory"]);
    for (const [id, result] of results) {
      expect(ParseResult.safeParse(result).success, id).toBe(true);
      expect(
        result.observations.map((o) => o.matchId),
        id,
      ).toContain(MATCH);
    }
    expect(results.get("api-football")?.observations).toContainEqual({
      matchId: MATCH,
      status: "finished",
      score: { home: 1, away: 2 },
      minute: null,
    });
    expect(results.get("memory")?.observations).toEqual([
      {
        matchId: MATCH,
        status: "finished",
        score: { home: 1, away: 2 },
        minute: null,
      },
    ]);
    expect(orphanFetches).toBe(0);
    // SPEC-011 CA-1: this line used to assert "live=141", the bare league id
    // the provider rejects, for the same reason results.test.ts asserted
    // "?live=439". Only one competition is in window here, so there is no
    // live= request at all and ids= carries the whole window.
    expect(calls.some((u) => u.includes("live="))).toBe(false);
    expect(calls.some((u) => u.includes("ids=1569926"))).toBe(true);
    expect(calls.filter((u) => u.startsWith(MEMORY_URL))).toHaveLength(1);
  });
});
