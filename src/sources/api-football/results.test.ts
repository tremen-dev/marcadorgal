import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AliasFile,
  type CompetitionId,
  type FetchContext,
  type Instant,
  type MatchId,
  ParseResult,
  type RawCapture,
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

// ---------------------------------------------------------------------------
// CA-6 parse: pure, state mapping, all-or-nothing identity (RN-10)

type ProviderBody = {
  errors?: unknown;
  results?: number;
  paging?: unknown;
  response: ProviderFixture[];
};
type ProviderFixture = {
  fixture: {
    id: number;
    status: { short: string; elapsed: number | null; extra: number | null };
  };
  league: { id: number };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
};
const idsFixture = readJson("./fixtures/ids-2026-09-21.json") as ProviderBody;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const capture = (...bodies: unknown[]) => ({
  sourceId: "api-football" as RawCapture["sourceId"],
  capturedAt: NOW,
  requests: bodies.map((b, i) => ({
    url: `https://v3.football.api-sports.io/fixtures?ids=${i}`,
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(b),
  })),
});
const byId = (id: number): ProviderFixture => {
  const f = idsFixture.response.find((f) => f.fixture.id === id);
  if (!f) throw new Error(`fixture ${id} not in ids-2026-09-21.json`);
  return clone(f);
};
// Albacete (722) 1-2 Córdoba (713), FT, Segunda División (141), real.
const BASE = 1569926;
const BASE_MATCH = "segunda-division-2026-27-j6-albacete-cordoba";
type Status = ProviderFixture["fixture"]["status"];
const variant = (
  status: Partial<Status>,
  goals?: ProviderFixture["goals"],
): ProviderFixture => {
  const f = byId(BASE);
  f.fixture.status = { ...f.fixture.status, ...status };
  if (goals) f.goals = goals;
  return f;
};
const body = (...fixtures: ProviderFixture[]): ProviderBody => ({
  errors: [],
  results: fixtures.length,
  paging: { current: 1, total: 1 },
  response: fixtures,
});
const parseOne = (f: ProviderFixture) => adapter.parse(capture(body(f)));

describe("CA-6 resolveTeam", () => {
  it("resolves a provider team id through the alias and ignores the competition", () => {
    expect(
      adapter.resolveTeam("538", "primera-division" as CompetitionId),
    ).toBe("celta");
    expect(adapter.resolveTeam("538", "tercera-rfef-g1" as CompetitionId)).toBe(
      "celta",
    );
    expect(
      adapter.resolveTeam("999999", "primera-division" as CompetitionId),
    ).toBeNull();
  });
});

describe("CA-6 parse is pure", () => {
  it("never touches fetch", () => {
    const original = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("npm test must not touch the network");
    }) as unknown as typeof globalThis.fetch;
    try {
      expect(() => adapter.parse(capture(idsFixture))).not.toThrow();
    } finally {
      globalThis.fetch = original;
    }
  });

  it("yields a valid ParseResult over the real ids fixture", () => {
    const result = adapter.parse(capture(idsFixture));
    expect(ParseResult.safeParse(result).success).toBe(true);
    expect(result.unresolved).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.observations).toHaveLength(idsFixture.response.length);
    for (const o of result.observations)
      expect(o).not.toHaveProperty("observedAt");
  });

  it("throws on a body with non-empty errors (provider rate limit)", () => {
    const limited = {
      ...body(byId(BASE)),
      errors: { rateLimit: "Too many requests" },
    };
    expect(() => adapter.parse(capture(limited))).toThrow(/rateLimit/);
    expect(() =>
      adapter.parse(capture({ ...body(), errors: ["something"] })),
    ).toThrow();
  });

  it("throws on a body that is not JSON or not a fixtures response", () => {
    const raw = capture(body());
    raw.requests[0].body = "<html>";
    expect(() => adapter.parse(raw)).toThrow();
    expect(() => adapter.parse(capture({ nope: true }))).toThrow();
  });

  it("counts a fixture present in several requests once, keeping the last", () => {
    const first = variant(
      { short: "1H", elapsed: 10, extra: null },
      {
        home: 0,
        away: 0,
      },
    );
    const last = variant(
      { short: "1H", elapsed: 12, extra: null },
      {
        home: 1,
        away: 0,
      },
    );
    const result = adapter.parse(capture(body(first), body(last)));
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({
      matchId: BASE_MATCH,
      status: "live",
      score: { home: 1, away: 0 },
      minute: 12,
    });
  });
});

describe("CA-6 state mapping (N-7, N-8)", () => {
  const goals = { home: 1, away: 2 };
  const score = goals;

  it.each([
    ["NS", "scheduled"],
    ["TBD", "scheduled"],
    ["PST", "postponed"],
    ["CANC", "postponed"],
  ] as const)("%s -> %s with no score and no minute", (short, status) => {
    const [o] = parseOne(
      variant({ short, elapsed: null, extra: null }),
    ).observations;
    expect(o).toEqual({
      matchId: BASE_MATCH,
      status,
      score: null,
      minute: null,
    });
  });

  it("NS with goals still yields score null", () => {
    const [o] = parseOne(
      variant({ short: "NS", elapsed: null, extra: null }, goals),
    ).observations;
    expect(o).toMatchObject({ status: "scheduled", score: null });
  });

  it.each([
    ["FT", "finished"],
    ["AET", "finished"],
    ["PEN", "finished"],
    ["AWD", "finished"],
    ["WO", "finished"],
    ["SUSP", "suspended"],
    ["INT", "suspended"],
    ["ABD", "suspended"],
  ] as const)("%s -> %s with the score and minute null", (short, status) => {
    const [o] = parseOne(
      variant({ short, elapsed: 90, extra: null }, goals),
    ).observations;
    expect(o).toEqual({ matchId: BASE_MATCH, status, score, minute: null });
  });

  it.each(["1H", "HT", "2H", "ET", "BT", "P", "LIVE"])(
    "%s -> live with score, minute and addedMinute",
    (short) => {
      const [o] = parseOne(
        variant({ short, elapsed: 45, extra: 3 }, goals),
      ).observations;
      expect(o).toEqual({
        matchId: BASE_MATCH,
        status: "live",
        score,
        minute: 45,
        addedMinute: 3,
      });
    },
  );

  it("HT with extra null and 2H with extra 0 yield addedMinute null", () => {
    expect(
      parseOne(variant({ short: "HT", elapsed: 45, extra: null }, goals))
        .observations[0],
    ).toMatchObject({ status: "live", minute: 45, addedMinute: null });
    expect(
      parseOne(variant({ short: "2H", elapsed: 90, extra: 0 }, goals))
        .observations[0],
    ).toMatchObject({ status: "live", minute: 90, addedMinute: null });
  });

  it("live without elapsed yields minute null; extra above 30 is clamped", () => {
    expect(
      parseOne(variant({ short: "LIVE", elapsed: null, extra: null }, goals))
        .observations[0],
    ).toMatchObject({ status: "live", minute: null, addedMinute: null });
    expect(
      parseOne(variant({ short: "2H", elapsed: 90, extra: 45 }, goals))
        .observations[0],
    ).toMatchObject({ status: "live", minute: 90, addedMinute: 30 });
  });

  it("FT with a real extra keeps minute null and carries no addedMinute", () => {
    // 1570753 UD Logroñés 1-1 Pontevedra, FT, elapsed 90, extra 5 (real).
    const real = byId(1570753);
    expect(real.fixture.status).toMatchObject({ short: "FT", extra: 5 });
    const [o] = parseOne(real).observations;
    expect(o).toEqual({
      matchId: "primera-rfef-g1-2026-27-j4-logrones-pontevedra",
      status: "finished",
      score: { home: 1, away: 1 },
      minute: null,
    });
    expect(o).not.toHaveProperty("addedMinute");
  });

  it("an unknown status is skipped, not an exception", () => {
    const result = parseOne(
      variant({ short: "XX", elapsed: null, extra: null }),
    );
    expect(result.observations).toEqual([]);
    expect(result.skipped).toEqual([
      {
        externalMatchId: String(BASE),
        status: "XX",
        reason: "unsupported_status",
      },
    ]);
  });

  it("a live or finished fixture without goals is skipped as missing_score", () => {
    const result = parseOne(
      variant(
        { short: "2H", elapsed: 50, extra: null },
        { home: 1, away: null },
      ),
    );
    expect(result.observations).toEqual([]);
    expect(result.skipped).toEqual([
      { externalMatchId: String(BASE), status: "2H", reason: "missing_score" },
    ]);
    expect(
      parseOne(
        variant(
          { short: "AWD", elapsed: null, extra: null },
          { home: null, away: null },
        ),
      ).skipped[0],
    ).toMatchObject({ reason: "missing_score" });
  });
});

describe("CA-6 identity is all-or-nothing (RN-10)", () => {
  const external = (f: ProviderFixture) => ({
    home: {
      externalId: String(f.teams.home.id),
      externalName: f.teams.home.name,
    },
    away: {
      externalId: String(f.teams.away.id),
      externalName: f.teams.away.name,
    },
  });

  it("a team without alias yields unresolved unknown_team with the external names", () => {
    const f = variant(
      { short: "1H", elapsed: 10, extra: null },
      { home: 0, away: 0 },
    );
    f.teams.away = { id: 424242, name: "Nobody FC" };
    const result = parseOne(f);
    expect(result.observations).toEqual([]);
    expect(result.unresolved).toEqual([
      {
        reason: "unknown_team",
        externalCompetition: "141",
        externalMatchId: String(BASE),
        ...external(f),
        status: "1H",
      },
    ]);
  });

  it("a fixture id without alias yields unknown_match", () => {
    const f = byId(BASE);
    f.fixture.id = 424242;
    const result = parseOne(f);
    expect(result.unresolved).toEqual([
      {
        reason: "unknown_match",
        externalCompetition: "141",
        externalMatchId: "424242",
        ...external(f),
        status: "FT",
      },
    ]);
  });

  it("an alias pointing at another pair of teams yields inconsistent_alias", () => {
    // 1569935 is Real Sociedad B - Mallorca; give it Albacete - Córdoba's teams.
    const f = byId(BASE);
    f.fixture.id = 1569935;
    const result = parseOne(f);
    expect(result.observations).toEqual([]);
    expect(result.unresolved[0]).toMatchObject({
      reason: "inconsistent_alias",
      externalMatchId: "1569935",
    });
  });

  it("an alias of another competition yields inconsistent_alias too", () => {
    const f = byId(BASE);
    f.league.id = 140;
    expect(parseOne(f).unresolved[0]).toMatchObject({
      reason: "inconsistent_alias",
    });
  });

  it("an unknown league yields unknown_competition with externalCompetition", () => {
    const f = byId(BASE);
    f.league.id = 39;
    const result = parseOne(f);
    expect(result.observations).toEqual([]);
    expect(result.unresolved).toEqual([
      {
        reason: "unknown_competition",
        externalCompetition: "39",
        externalMatchId: String(BASE),
        ...external(f),
        status: "FT",
      },
    ]);
  });

  it("keeps the good fixtures of a body that also has unresolved and skipped ones", () => {
    const bad = byId(BASE);
    bad.league.id = 39;
    const odd = byId(1569935);
    odd.fixture.status.short = "XX";
    const result = adapter.parse(capture(body(byId(1570753), bad, odd)));
    expect(result.observations.map((o) => o.matchId)).toEqual([
      "primera-rfef-g1-2026-27-j4-logrones-pontevedra",
    ]);
    expect(result.unresolved).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(ParseResult.safeParse(result).success).toBe(true);
  });
});
