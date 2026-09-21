import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AliasFile,
  type CompetitionId,
  type FetchContext,
  type Instant,
  type MatchId,
  type WindowMatch,
} from "../../model/index.ts";
import { createApiFootballResults } from "./results.ts";

const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));

// Real alias (CA-4) and real calendars, so the window matches carry real
// fixture ids and derived ids.
const aliases = AliasFile.parse(
  readJson("../../../data/alias/2026-27/api-football.json"),
);
const COMPETITIONS = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
] as CompetitionId[];
const calendar = new Map<MatchId, WindowMatch>();
for (const competitionId of COMPETITIONS) {
  const file = readJson(
    `../../../data/calendario/2026-27/${competitionId}.json`,
  ) as {
    matches: { round: number; kickoff: string; home: string; away: string }[];
  };
  for (const m of file.matches) {
    const id =
      `${competitionId}-2026-27-j${m.round}-${m.home}-${m.away}` as MatchId;
    calendar.set(id, {
      id,
      competitionId,
      season: "2026-27",
      kickoff: m.kickoff,
      homeTeamId: m.home as WindowMatch["homeTeamId"],
      awayTeamId: m.away as WindowMatch["awayTeamId"],
    });
  }
}
const fixtureIdOf = new Map(
  Object.entries(aliases.matches ?? {}).map(([ext, id]) => [id, ext]),
);
const windowMatch = (id: string, kickoff?: Instant): WindowMatch => {
  const m = calendar.get(id as MatchId);
  if (!m) throw new Error(`not in calendar: ${id}`);
  return kickoff ? { ...m, kickoff } : m;
};
const byCompetition = (competitionId: string, n: number): WindowMatch[] =>
  [...calendar.values()]
    .filter((m) => m.competitionId === competitionId)
    .slice(0, n);

type Call = { url: string; headers: Headers };
type Route = (url: URL) => { status?: number; body: unknown };

// Never the network: a stub that records calls and serves a body per URL.
type Fetch = typeof globalThis.fetch;
function stubFetch(route: Route): { fetch: Fetch; calls: Call[] } {
  const calls: Call[] = [];
  const stub = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), headers: new Headers(init?.headers) });
    const { status = 200, body } = route(url);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as Fetch;
  return { fetch: stub, calls };
}

const NOW = "2026-09-26T16:30:00Z";
const liveBody = (ids: string[]) => ({
  response: ids.map((id) => ({ fixture: { id: Number(id) } })),
});
const query = (call: Call) => new URL(call.url).search;
const ctxWith = (
  matches: WindowMatch[],
  fetch: Fetch,
  now: Instant = NOW,
): FetchContext => ({
  now,
  competitions: [...new Set(matches.map((m) => m.competitionId))],
  matches,
  fetch,
  userAgent: "marcador.gal (test)",
});

const adapter = createApiFootballResults({ aliases, apiKey: "secret-key" });

describe("CA-5 createApiFootballResults", () => {
  it("is the api-football pull adapter", () => {
    expect(adapter.id).toBe("api-football");
    expect(adapter.kind).toBe("pull");
    expect(typeof adapter.fetch).toBe("function");
  });

  it("makes no request with an empty window (RN-08)", async () => {
    const { fetch, calls } = stubFetch(() => ({ body: {} }));
    const raw = await adapter.fetch?.(ctxWith([], fetch));
    expect(calls).toEqual([]);
    expect(raw).toEqual({
      sourceId: "api-football",
      capturedAt: NOW,
      requests: [],
    });
  });

  it("asks live= for the leagues in window and ids= for the matches missing from it", async () => {
    const past = "2026-09-26T15:00:00Z";
    const matches = [
      windowMatch("tercera-rfef-g1-2026-27-j4-atletico-arteixo-alondras", past),
      windowMatch("segunda-division-2026-27-j7-girona-albacete", past),
      windowMatch("segunda-division-2026-27-j6-albacete-cordoba", past),
    ];
    const ids = matches.map((m) => fixtureIdOf.get(m.id) as string);
    const { fetch, calls } = stubFetch((url) =>
      url.searchParams.has("live")
        ? { body: liveBody([ids[1]]) }
        : { body: { response: [] } },
    );
    const raw = await adapter.fetch?.(ctxWith(matches, fetch));
    const others = [ids[0], ids[2]].sort((a, b) => Number(a) - Number(b));
    expect(calls.map(query)).toEqual([
      "?live=141-439",
      `?ids=${others.join("-")}`,
    ]);
    expect(raw?.requests.map((r) => r.url)).toEqual(calls.map((c) => c.url));
    expect(raw?.requests[0]).toMatchObject({
      status: 200,
      contentType: "application/json",
    });
    expect(typeof raw?.requests[0].body).toBe("string");
    expect(JSON.parse(raw?.requests[0].body ?? "")).toEqual(liveBody([ids[1]]));
  });

  it("chunks ids= by 20 when nothing is live", async () => {
    const past = "2026-09-26T15:00:00Z";
    const matches = [
      ...byCompetition("primera-division", 13),
      ...byCompetition("segunda-division", 12),
    ].map((m) => ({ ...m, kickoff: past }));
    expect(matches).toHaveLength(25);
    const { fetch, calls } = stubFetch(() => ({ body: { response: [] } }));
    await adapter.fetch?.(ctxWith(matches, fetch));
    const ids = matches
      .map((m) => Number(fixtureIdOf.get(m.id)))
      .sort((a, b) => a - b);
    expect(calls.map(query)).toEqual([
      "?live=140-141",
      `?ids=${ids.slice(0, 20).join("-")}`,
      `?ids=${ids.slice(20).join("-")}`,
    ]);
  });

  it("skips live= when no match has kicked off yet (N-10)", async () => {
    const future = "2026-09-26T18:30:00Z";
    const matches = byCompetition("tercera-rfef-g1", 3).map((m) => ({
      ...m,
      kickoff: future,
    }));
    const { fetch, calls } = stubFetch(() => ({ body: { response: [] } }));
    await adapter.fetch?.(ctxWith(matches, fetch));
    expect(calls).toHaveLength(1);
    expect(query(calls[0])).toMatch(/^\?ids=\d+-\d+-\d+$/);
  });

  it("omits window matches without a match alias", async () => {
    const past = "2026-09-26T15:00:00Z";
    const known = windowMatch(
      "tercera-rfef-g1-2026-27-j4-atletico-arteixo-alondras",
      past,
    );
    const unknown: WindowMatch = {
      ...known,
      id: "tercera-rfef-g1-2026-27-j99-nobody-anybody" as MatchId,
    };
    const { fetch, calls } = stubFetch(() => ({ body: { response: [] } }));
    await adapter.fetch?.(ctxWith([known, unknown], fetch));
    expect(calls.map(query)).toEqual([
      "?live=439",
      `?ids=${fixtureIdOf.get(known.id)}`,
    ]);
  });

  it("sends the key and the user agent on every request and keeps the key out of the capture", async () => {
    const past = "2026-09-26T15:00:00Z";
    const matches = byCompetition("segunda-rfef-g1", 2).map((m) => ({
      ...m,
      kickoff: past,
    }));
    const { fetch, calls } = stubFetch(() => ({ body: { response: [] } }));
    const raw = await adapter.fetch?.(ctxWith(matches, fetch));
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.headers.get("x-apisports-key")).toBe("secret-key");
      expect(c.headers.get("user-agent")).toBe("marcador.gal (test)");
      expect(
        c.url.startsWith("https://v3.football.api-sports.io/fixtures?"),
      ).toBe(true);
    }
    expect(JSON.stringify(raw)).not.toContain("secret-key");
  });

  it("rejects on a non-2xx response such as 429 (D-9: transport is an error)", async () => {
    const past = "2026-09-26T15:00:00Z";
    const matches = byCompetition("primera-division", 1).map((m) => ({
      ...m,
      kickoff: past,
    }));
    const { fetch } = stubFetch(() => ({ status: 429, body: {} }));
    await expect(adapter.fetch?.(ctxWith(matches, fetch))).rejects.toThrow(
      "api-football responded 429",
    );
  });
});
