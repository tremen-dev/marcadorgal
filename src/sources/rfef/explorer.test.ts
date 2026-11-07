import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AliasFile,
  type CompetitionId,
  type FetchContext,
  type Instant,
  ParseResult,
  type RawCapture,
  type Unresolved,
  type WindowMatch,
} from "../../model/index.ts";
import { createRfef } from "./adapter.ts";
import {
  createRfefExplorer,
  type DeclaredFixture,
  ExplorerExport,
  type ExplorerMatch,
  madridDateOf,
} from "./explorer.ts";
import { fixtureText } from "./fixture-files.ts";
import { readPanel } from "./panel.ts";

// SPEC-038 CA-1..CA-4 (ADR-023 §4-§5): the adapter of the export of explorer,
// over the real captures of fixtures/export/ and the real alias of the
// season. No clock: every instant is the row's lastSeenAt or the test's.

const root = new URL("../../../", import.meta.url);
const readText = (rel: string): string =>
  readFileSync(new URL(rel, root), "utf8");
const readJson = (rel: string): unknown => JSON.parse(readText(rel));

const FIVE = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];
// The declared calendar of 2026-27, as the core injects it (ADR-008 §8).
const calendar: DeclaredFixture[] = FIVE.flatMap((competition) => {
  const file = readJson(`data/calendario/2026-27/${competition}.json`) as {
    matches: { round: number; kickoff: string; home: string; away: string }[];
  };
  return file.matches.map(
    (m) =>
      ({
        id: `${competition}-2026-27-j${m.round}-${m.home}-${m.away}`,
        competitionId: competition,
        round: m.round,
        kickoff: m.kickoff,
        homeTeamId: m.home,
        awayTeamId: m.away,
      }) as DeclaredFixture,
  );
});

const aliases = AliasFile.parse(readJson("data/alias/2026-27/rfef.json"));
const testAliases = AliasFile.parse(
  readJson("src/sources/rfef/fixtures/alias-test.json"),
);

const BASE_URL = "https://explorer.test";
const TOKEN = "tok-s3cret-never-in-the-raw";
const UA = "marcador.gal (ingesta; https://marcador.gal)";
const NOW = "2026-11-01T22:07:51Z" as Instant;

const adapter = createRfefExplorer({
  aliases,
  calendar,
  baseUrl: BASE_URL,
  token: TOKEN,
});

// Two sets of real captures of the same three days (README of the folder):
// export-<date>.json is the response of the endpoint deployed in Vercel
// (2026-11-01 23:15Z, after the last match: FINISHED, POSTPONED, SCHEDULED);
// export-local-<date>.json is the response of the same code running in local
// at 22:07Z, the only one with real LIVE_PROVISIONAL rows.
const EXPORT_DIR = "src/sources/rfef/fixtures/export";
const FIXTURES = ["2026-10-31", "2026-11-01", "2026-11-02"] as const;
const fixture = (date: string): string =>
  readText(`${EXPORT_DIR}/export-${date}.json`);
const fixtureLocal = (date: string): string =>
  readText(`${EXPORT_DIR}/export-local-${date}.json`);
const rowsIn = (body: string): ExplorerMatch[] =>
  (JSON.parse(body) as { matches: ExplorerMatch[] }).matches;
const rowsOf = (date: string): ExplorerMatch[] => rowsIn(fixture(date));
const rowsOfLocal = (date: string): ExplorerMatch[] =>
  rowsIn(fixtureLocal(date));
const find = (
  rows: ExplorerMatch[],
  home: string,
  estado?: string,
): ExplorerMatch => {
  const found = rows.find(
    (m) =>
      m.equipoLocal === home && (estado === undefined || m.estado === estado),
  );
  if (found === undefined) throw new Error(`no row ${home} ${estado ?? ""}`);
  return found;
};
const row = (date: string, home: string, estado?: string): ExplorerMatch =>
  find(rowsOf(date), home, estado);
const rowLocal = (date: string, home: string, estado?: string): ExplorerMatch =>
  find(rowsOfLocal(date), home, estado);

const url = (date: string) => `${BASE_URL}/api/export/matches?date=${date}`;
const capture = (bodies: string[], capturedAt: Instant = NOW): RawCapture =>
  ({
    sourceId: "rfef",
    capturedAt,
    requests: bodies.map((body, i) => ({
      url: url(FIXTURES[i] ?? "2026-11-01"),
      method: "GET",
      status: 200,
      contentType: "application/json; charset=utf-8",
      body,
    })),
  }) as RawCapture;
const parseBodies = (bodies: string[]) =>
  ParseResult.parse(adapter.parse(capture(bodies)));
const exportOf = (matches: unknown[], date = "2026-11-01"): string =>
  JSON.stringify({ exportedAt: NOW, date, matches });
const parseRows = (matches: unknown[]) => parseBodies([exportOf(matches)]);

const empty = {
  observations: [],
  unresolved: [],
  skipped: [],
  requestErrors: [],
};

// Real rows of the five competitions used below. LIVE_PROVISIONAL and
// SCHEDULED-with-a-score only exist in the local captures (taken during the
// day); FINISHED and the real POSTPONED come from the deployed ones.
const AMOREBIETA = rowLocal("2026-11-01", "SD Amorebieta", "LIVE_PROVISIONAL");
const AMOREBIETA_KICKOFF = "2026-11-01T17:00:00Z"; // declared, j9
const ZAMORA = row("2026-11-01", "Zamora CF", "FINISHED");
const TENERIFE = row("2026-11-01", "CD Tenerife", "POSTPONED");
const ARENTEIRO = rowLocal("2026-11-01", "c.d. arenteiro", "LIVE_PROVISIONAL");
const PORTUGALETE_SCHEDULED = rowLocal(
  "2026-11-01",
  "Club Portugalete",
  "SCHEDULED",
);

describe("CA-1 contract and real fixtures", () => {
  it.each(FIXTURES)(
    "export-%s.json, response of the deployed endpoint, validates ExplorerExport as captured",
    (date) => {
      const body = ExplorerExport.parse(JSON.parse(fixture(date)));
      expect(body.date).toBe(date);
      expect(body.exportedAt).toMatch(/^2026-11-01T23:15:0[2-4]\.\d{3}Z$/);
      expect(body.matches.length).toBeGreaterThan(0);
    },
  );

  it.each(FIXTURES)(
    "export-%s.json is unabridged: its bytes are the Content-Length the deployed endpoint declared",
    (date) => {
      const headers = readText(`${EXPORT_DIR}/export-${date}.headers`);
      expect(headers).toMatch(/^HTTP\/1\.1 200 OK/);
      expect(headers).toMatch(/^Cache-Control: no-store$/m);
      expect(headers).toMatch(
        /^Content-Type: application\/json; charset=utf-8$/m,
      );
      expect(headers).toMatch(/^Server: Vercel$/m);
      expect(headers).not.toMatch(/authorization|bearer/i);
      const declared = Number(/^Content-Length: (\d+)$/m.exec(headers)?.[1]);
      expect(new TextEncoder().encode(fixture(date)).byteLength).toBe(declared);
    },
  );

  it.each(FIXTURES)(
    "export-local-%s.json, response of the same code in local, validates ExplorerExport as captured",
    (date) => {
      const body = ExplorerExport.parse(JSON.parse(fixtureLocal(date)));
      expect(body.date).toBe(date);
      expect(body.exportedAt).toMatch(/^2026-11-01T22:07:51\.\d{3}Z$/);
      expect(body.matches.length).toBeGreaterThan(0);
    },
  );

  it.each([
    ["deployed", fixture],
    ["local", fixtureLocal],
  ])(
    "parses the three %s captures without requestErrors nor unresolved, as one capture",
    (_, read) => {
      const result = parseBodies(FIXTURES.map(read));
      expect(result.requestErrors).toEqual([]);
      expect(result.unresolved).toEqual([]);
      expect(result.observations.length).toBeGreaterThan(0);
    },
  );

  it("deployed export-2026-11-01 (23:15Z): finished of the five competitions, the real POSTPONED, no duplicate rows, nothing of juvenil", () => {
    const result = parseBodies([fixture("2026-11-01")]);
    expect(result.skipped).toEqual([]);
    expect(result.unresolved).toEqual([]);
    // 36 rows: 35 FINISHED + 1 POSTPONED; 8 of juvenil (ignored), 28 of the
    // five competitions, Tercera included (7 finished): 27 finished + 1
    // postponed. The deployed explorer dedupes rows (F-SPEC-038-6).
    expect(result.observations).toHaveLength(28);
    expect(
      result.observations.filter((o) => o.status === "finished"),
    ).toHaveLength(27);
    expect(
      result.observations
        .filter((o) => o.status === "postponed")
        .map((o) => o.matchId),
    ).toEqual(["segunda-division-2026-27-j12-tenerife-andorra"]);
    const competitions = new Set(
      result.observations.map((o) => o.matchId.replace(/-2026-27-.*$/, "")),
    );
    expect([...competitions].sort()).toEqual([...FIVE].sort());
    expect(
      result.observations.filter((o) => o.matchId.startsWith("tercera-")),
    ).toHaveLength(7);
    const rows = rowsOf("2026-11-01");
    expect(rows).toHaveLength(36);
    expect(
      new Set(
        rows.map((m) => `${m.codGrupo}|${m.equipoLocal}|${m.equipoVisitante}`),
      ).size,
    ).toBe(36);
    const all = JSON.stringify(result);
    for (const other of ["Club Bansander", 'r.c. celta "B"', "auriense c.a."])
      expect(all).not.toContain(other);
  });

  it("deployed export-2026-10-31: 25 FINISHED rows, 16 of the five competitions (Tercera included), nothing skipped", () => {
    const result = parseBodies([fixture("2026-10-31")]);
    expect(result.observations).toHaveLength(16);
    expect(result.observations.every((o) => o.status === "finished")).toBe(
      true,
    );
    expect(result.skipped).toEqual([]);
    expect(result.unresolved).toEqual([]);
    expect(result.observations.map((o) => o.matchId)).toContain(
      "tercera-rfef-g1-2026-27-j9-barco-montaneros",
    );
    expect(JSON.stringify(result)).not.toContain("conxo");
  });

  it("local export-2026-11-01 (22:07Z, during the day) brings live and finished of the five competitions, and nothing of juvenil or femenino", () => {
    const result = parseBodies([fixtureLocal("2026-11-01")]);
    const competitions = new Set(
      result.observations.map((o) => o.matchId.replace(/-2026-27-.*$/, "")),
    );
    // Tercera gives no observation that day: its rows are SCHEDULED or
    // LIVE_PROVISIONAL seen hours after kickoff (ambiguous_state, below).
    expect([...competitions].sort()).toEqual(
      FIVE.filter((c) => c !== "tercera-rfef-g1").sort(),
    );
    expect(result.observations.some((o) => o.status === "live")).toBe(true);
    expect(result.observations.some((o) => o.status === "finished")).toBe(true);
    const all = JSON.stringify(result);
    for (const other of [
      "Alba Femenino",
      "orzan s.d.",
      "Tsk Roces",
      "Sevilla FC",
    ])
      expect(all).not.toContain(other);
    // Exact counts of the capture, as regression evidence: 78 rows, 37
    // SCHEDULED (nothing), 12 of other groups; of the five competitions 13
    // finished, 7 LIVE_PROVISIONAL of which 2 inside the window of their
    // declared kickoff (live) and 5 outside it (Arenteiro–Céltiga among them).
    expect(
      result.observations.filter((o) => o.status === "finished"),
    ).toHaveLength(13);
    expect(
      result.observations
        .filter((o) => o.status === "live")
        .map((o) => o.matchId),
    ).toEqual([
      "segunda-rfef-g1-2026-27-j9-amorebieta-gimnastica",
      "primera-rfef-g1-2026-27-j10-extremadura-unionistas",
    ]);
    expect(result.skipped).toHaveLength(5);
    expect(result.skipped.every((s) => s.reason === "ambiguous_state")).toBe(
      true,
    );
    expect(result.skipped).toContainEqual({
      externalMatchId: null,
      status: "LIVE_PROVISIONAL",
      reason: "ambiguous_state",
    });
  });

  it("local export-2026-10-31: 33 FINISHED rows, 14 of the five competitions; the Tercera rows with a score are SCHEDULED and say nothing", () => {
    const result = parseBodies([fixtureLocal("2026-10-31")]);
    expect(result.observations).toHaveLength(14);
    expect(result.observations.every((o) => o.status === "finished")).toBe(
      true,
    );
    expect(result.skipped).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("silva");
  });

  it("export-2026-11-02, deployed and local: only SCHEDULED, so nothing at all", () => {
    expect(parseBodies([fixture("2026-11-02")])).toEqual(empty);
    expect(parseBodies([fixtureLocal("2026-11-02")])).toEqual(empty);
  });

  it("tolerates unknown fields in the body and in a row", () => {
    const result = parseBodies([
      JSON.stringify({
        exportedAt: NOW,
        date: "2026-11-01",
        version: 2,
        matches: [{ ...ZAMORA, extra: { nested: true } }],
      }),
    ]);
    expect(result.requestErrors).toEqual([]);
    expect(result.observations).toHaveLength(1);
  });

  it.each([
    ["estado outside the enum", { ...ZAMORA, estado: "PLAYING" }, /estado/],
    ["lastSeenAt not ISO", { ...ZAMORA, lastSeenAt: "ayer" }, /lastSeenAt/],
    ["golesLocal not an integer", { ...ZAMORA, golesLocal: "1" }, /golesLocal/],
  ])(
    "%s: the request goes to requestErrors with the reason and gives zero observations; the other request is still read",
    (_, bad, reason) => {
      const result = parseBodies([
        exportOf([bad, AMOREBIETA]),
        exportOf([ZAMORA]),
      ]);
      expect(result.requestErrors).toHaveLength(1);
      expect(result.requestErrors[0].url).toBe(url("2026-10-31"));
      expect(result.requestErrors[0].error).toMatch(reason);
      expect(result.observations).toHaveLength(1);
      expect(result.observations[0].matchId).toBe(
        "primera-rfef-g1-2026-27-j10-zamora-deportivo-fabril",
      );
    },
  );

  it.each([
    [
      "matches absent",
      JSON.stringify({ exportedAt: NOW, date: "2026-11-01" }),
      /matches/,
    ],
    ["an empty body", "", /^empty body$/],
    ["a body that is not JSON", "<html>Unauthorized</html>", /JSON/],
    ["a JSON that is not an object", "[]", /./],
  ])("%s → requestErrors and nothing else", (_, body, reason) => {
    const result = parseBodies([body]);
    expect(result.observations).toEqual([]);
    expect(result.unresolved).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.requestErrors).toHaveLength(1);
    expect(result.requestErrors[0].error).toMatch(reason);
  });

  it("the only real POSTPONED is Tenerife–Andorra (deployed 11-01); SUSPENDED and discardedReadings > 0 come from real rows mutated in memory (none in the captures)", () => {
    const rows = FIXTURES.flatMap((date) => [
      ...rowsOf(date),
      ...rowsOfLocal(date),
    ]);
    for (const r of rows) {
      expect([
        "SCHEDULED",
        "LIVE_PROVISIONAL",
        "FINISHED",
        "POSTPONED",
      ]).toContain(r.estado);
      expect(r.discardedReadings).toBe(0);
    }
    expect(rows.filter((r) => r.estado === "POSTPONED")).toEqual([TENERIFE]);
    expect(TENERIFE).toMatchObject({
      codGrupo: "33836087",
      jornada: "12",
      equipoVisitante: "FC Andorra",
      golesLocal: null,
      golesVisitante: null,
      strategy: "none:scheduled",
    });
    const discarded = { ...ZAMORA, discardedReadings: 2 };
    expect(
      ExplorerExport.parse(JSON.parse(exportOf([discarded]))).matches[0]
        .discardedReadings,
    ).toBe(2);
    expect(parseRows([discarded]).observations).toHaveLength(1);
  });

  it("the README names every fixture with its date, exportedAt, the server Date and its origin (deployed in Vercel or local), and no token", () => {
    const readme = readText(`${EXPORT_DIR}/README.md`);
    for (const date of FIXTURES) {
      expect(readme).toContain(`export-${date}.json`);
      expect(readme).toContain(`export-local-${date}.json`);
      expect(readme).toContain(`?date=${date}`);
      for (const read of [fixture, fixtureLocal]) {
        const { exportedAt } = JSON.parse(read(date)) as {
          exportedAt: string;
        };
        expect(readme).toContain(exportedAt);
      }
      const serverDate = /^Date: (.+)$/m.exec(
        readText(`${EXPORT_DIR}/export-${date}.headers`),
      )?.[1];
      expect(serverDate).toMatch(/^Sun, 01 Nov 2026 23:15:0[2-4] GMT$/);
      expect(readme).toContain(serverDate as string);
    }
    expect(readme).toMatch(/desplegado/i);
    expect(readme).toContain("https://marcadorgal-explorer.vercel.app");
    expect(readme).toMatch(/local/i);
    expect(readme).not.toMatch(/Bearer\s+[A-Za-z0-9_-]{8,}/);
    expect(readme).not.toMatch(/X-API-Key:\s*\S/i);
  });
});

describe("CA-2 fetch", () => {
  type Call = { url: string; init: RequestInit | undefined };
  const fake = (responses: Response[]) => {
    const calls: Call[] = [];
    const fetch = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({ url: String(input), init });
      const next = responses.shift();
      if (next === undefined) throw new Error("unexpected call");
      return next;
    }) as typeof globalThis.fetch;
    return { calls, fetch };
  };
  const match = (id: string, kickoff: string): WindowMatch =>
    ({
      id,
      competitionId: "tercera-rfef-g1",
      season: "2026-27",
      kickoff,
      homeTeamId: "a",
      awayTeamId: "b",
    }) as WindowMatch;
  const ctx = (
    fetch: typeof globalThis.fetch,
    matches: WindowMatch[],
  ): FetchContext => ({
    now: NOW,
    competitions: ["tercera-rfef-g1" as CompetitionId],
    matches,
    fetch,
    userAgent: UA,
  });
  const json = (body: string, status = 200) =>
    new Response(body, {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });

  it("(i) an empty window makes no call", async () => {
    const { calls, fetch } = fake([]);
    const result = await adapter.fetch?.(ctx(fetch, []));
    expect(calls).toHaveLength(0);
    expect(result).toEqual({ sourceId: "rfef", capturedAt: NOW, requests: [] });
  });

  it("(ii) one GET per Europe/Madrid date of the kickoffs, with the Bearer and the UA; the token never reaches the capture", async () => {
    const body = fixture("2026-11-01");
    const { calls, fetch } = fake([json(body)]);
    const result = await adapter.fetch?.(
      ctx(fetch, [
        match("m1", "2026-11-01T15:15:00Z"),
        match("m2", "2026-11-01T20:00:00Z"),
      ]),
    );
    expect(calls.map((c) => c.url)).toEqual([url("2026-11-01")]);
    expect(calls[0].init?.method).toBe("GET");
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headers.get("user-agent")).toBe(UA);
    expect(result?.requests).toEqual([
      {
        url: url("2026-11-01"),
        method: "GET",
        status: 200,
        contentType: "application/json; charset=utf-8",
        body,
      },
    ]);
    expect(result?.capturedAt).toBe(NOW);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(JSON.stringify(result)).not.toContain("Bearer");
  });

  it("(ii) two dates make two GETs, in order of date", async () => {
    const { calls, fetch } = fake([json("{}"), json("{}")]);
    const result = await adapter.fetch?.(
      ctx(fetch, [
        match("m2", "2026-11-01T11:00:00Z"),
        match("m1", "2026-10-31T20:00:00Z"),
        match("m3", "2026-11-01T17:00:00Z"),
      ]),
    );
    expect(calls.map((c) => c.url)).toEqual([
      url("2026-10-31"),
      url("2026-11-01"),
    ]);
    expect(result?.requests.map((r) => r.url)).toEqual([
      url("2026-10-31"),
      url("2026-11-01"),
    ]);
  });

  it("(ii) the date is the Europe/Madrid day of the kickoff, winter and summer", () => {
    expect(madridDateOf("2026-10-31T22:30:00Z")).toBe("2026-10-31"); // 23:30 CET
    expect(madridDateOf("2026-10-31T23:30:00Z")).toBe("2026-11-01"); // 00:30 CET
    expect(madridDateOf("2026-10-24T22:30:00Z")).toBe("2026-10-25"); // 00:30 CEST
    expect(madridDateOf("2026-10-24T21:30:00Z")).toBe("2026-10-24"); // 23:30 CEST
  });

  it.each([401, 400, 500, 503])(
    "(iii) a %i throws: the attempt fails (ADR-003)",
    async (status) => {
      const { fetch } = fake([json('{"error":"x"}', status)]);
      await expect(
        adapter.fetch?.(ctx(fetch, [match("m1", "2026-11-01T15:15:00Z")])),
      ).rejects.toThrow(new RegExp(String(status)));
    },
  );

  it.each([
    ["empty", "", /^empty body$/],
    ["not JSON", "<html>", /JSON/],
  ])(
    "(iii) a 200 with a body that is %s does not throw: it goes to the raw capture and parse reports it",
    async (_, body, reason) => {
      // Bytes, not a string: a string body makes Response declare text/plain,
      // and the real empty 200 of a block carries no Content-Type.
      const { fetch } = fake([
        new Response(new TextEncoder().encode(body), { status: 200 }),
      ]);
      const raw = await adapter.fetch?.(
        ctx(fetch, [match("m1", "2026-11-01T15:15:00Z")]),
      );
      if (raw === undefined) throw new Error("no fetch");
      expect(raw.requests).toHaveLength(1);
      expect(raw.requests[0]).toMatchObject({
        url: url("2026-11-01"),
        method: "GET",
        status: 200,
        contentType: null,
        body,
      });
      const result = ParseResult.parse(adapter.parse(raw));
      expect(result.observations).toEqual([]);
      expect(result.requestErrors).toHaveLength(1);
      expect(result.requestErrors[0]).toMatchObject({ url: url("2026-11-01") });
      expect(result.requestErrors[0].error).toMatch(reason);
    },
  );
});

describe("CA-3 mapping and clocks (ADR-023 §5), one case per row over real rows", () => {
  const at = (iso: string) => iso as Instant;
  const seenAt = (r: ExplorerMatch, lastSeenAt: string) => ({
    ...r,
    lastSeenAt,
  });

  it("SCHEDULED gives nothing: no observation, no skipped, no unresolved", () => {
    expect(parseRows([PORTUGALETE_SCHEDULED])).toEqual(empty);
    // A SCHEDULED row that carries a score (Tercera, 2026-10-31) says nothing either.
    const barco = rowLocal("2026-10-31", "c.d. barco", "SCHEDULED");
    expect(barco.golesLocal).toBe(4);
    expect(parseRows([barco])).toEqual(empty);
  });

  it("LIVE_PROVISIONAL inside the window is live with minute null, addedMinute null and no halfTime; observedAt is lastSeenAt", () => {
    expect(AMOREBIETA.lastSeenAt).toBe("2026-11-01T18:12:37.720Z"); // kickoff + 72
    const result = parseRows([AMOREBIETA]);
    expect(result.observations).toEqual([
      {
        matchId: "segunda-rfef-g1-2026-27-j9-amorebieta-gimnastica",
        status: "live",
        score: { home: 0, away: 0 },
        minute: null,
        addedMinute: null,
        observedAt: "2026-11-01T18:12:37.720Z",
      },
    ]);
    expect(result.observations[0]).not.toHaveProperty("halfTime");
    expect(result.skipped).toEqual([]);
  });

  it("LIVE_PROVISIONAL with minute, addedMinute and halfTime propagates them (SPEC-052)", () => {
    const withMinute = {
      ...AMOREBIETA,
      minute: 37,
      addedMinute: null,
      halfTime: false,
    };
    const resMinute = parseRows([withMinute]);
    expect(resMinute.observations[0]).toMatchObject({
      status: "live",
      minute: 37,
      addedMinute: null,
      halfTime: false,
    });

    const withStoppage = {
      ...AMOREBIETA,
      minute: 45,
      addedMinute: 3,
      halfTime: false,
    };
    const resStoppage = parseRows([withStoppage]);
    expect(resStoppage.observations[0]).toMatchObject({
      status: "live",
      minute: 45,
      addedMinute: 3,
      halfTime: false,
    });

    const atHalfTime = {
      ...AMOREBIETA,
      minute: 45,
      addedMinute: null,
      halfTime: true,
    };
    const resHalfTime = parseRows([atHalfTime]);
    expect(resHalfTime.observations[0]).toMatchObject({
      status: "live",
      minute: 45,
      addedMinute: null,
      halfTime: true,
    });

    const clampStoppage = {
      ...AMOREBIETA,
      minute: 90,
      addedMinute: 45, // clamped to 30
      halfTime: false,
    };
    const resClamp = parseRows([clampStoppage]);
    expect(resClamp.observations[0]).toMatchObject({
      status: "live",
      minute: 90,
      addedMinute: 30,
      halfTime: false,
    });

    const zeroStoppage = {
      ...AMOREBIETA,
      minute: 90,
      addedMinute: 0, // 0 -> null
      halfTime: false,
    };
    const resZero = parseRows([zeroStoppage]);
    expect(resZero.observations[0]).toMatchObject({
      status: "live",
      minute: 90,
      addedMinute: null,
      halfTime: false,
    });
  });

  it.each([
    ["kickoff − 11", "2026-11-01T16:49:00Z", "ambiguous_state"],
    ["kickoff − 10", "2026-11-01T16:50:00Z", "live"],
    ["kickoff + 109", "2026-11-01T18:49:00Z", "live"],
    ["kickoff + 110", "2026-11-01T18:50:00Z", "ambiguous_state"],
  ])(
    "LIVE_PROVISIONAL with lastSeenAt at %s of the declared kickoff → %s",
    (_, lastSeenAt, expected) => {
      expect(AMOREBIETA_KICKOFF).toBe("2026-11-01T17:00:00Z");
      const result = parseRows([seenAt(AMOREBIETA, lastSeenAt)]);
      if (expected === "live") {
        expect(result.observations).toHaveLength(1);
        expect(result.observations[0]).toMatchObject({
          status: "live",
          observedAt: lastSeenAt,
        });
        expect(result.skipped).toEqual([]);
      } else {
        expect(result.observations).toEqual([]);
        expect(result.skipped).toEqual([
          {
            externalMatchId: "70700138",
            status: "LIVE_PROVISIONAL",
            reason: "ambiguous_state",
          },
        ]);
      }
    },
  );

  it("a real LIVE_PROVISIONAL seen hours after its kickoff (Arenteiro–Céltiga, 12:00, seen 20:50) is ambiguous_state", () => {
    const result = parseRows([ARENTEIRO]);
    expect(result.observations).toEqual([]);
    expect(result.skipped).toEqual([
      {
        externalMatchId: null,
        status: "LIVE_PROVISIONAL",
        reason: "ambiguous_state",
      },
    ]);
  });

  it("the clock is lastSeenAt, never exportedAt nor capturedAt", () => {
    // Seen inside the window but exported and captured long after: still live.
    const body = JSON.stringify({
      exportedAt: "2026-11-02T09:00:00Z",
      date: "2026-11-01",
      matches: [seenAt(AMOREBIETA, "2026-11-01T17:30:00Z")],
    });
    const result = ParseResult.parse(
      adapter.parse(capture([body], at("2026-11-02T09:00:05Z"))),
    );
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({
      status: "live",
      observedAt: "2026-11-01T17:30:00Z",
    });
  });

  it("FINISHED is finished with the score, whatever the clock", () => {
    for (const lastSeenAt of ["2026-11-01T18:00:00Z", "2026-11-02T09:00:00Z"]) {
      const result = parseRows([seenAt(ZAMORA, lastSeenAt)]);
      expect(result.observations).toEqual([
        {
          matchId: "primera-rfef-g1-2026-27-j10-zamora-deportivo-fabril",
          status: "finished",
          score: { home: 1, away: 3 },
          minute: null,
          observedAt: lastSeenAt,
        },
      ]);
    }
  });

  it("POSTPONED is postponed without score (real row of the deployed capture: Tenerife–Andorra, Segunda j12)", () => {
    expect(TENERIFE.lastSeenAt).toBe("2026-11-01T22:58:41.619Z");
    const result = parseRows([TENERIFE]);
    expect(result.observations).toEqual([
      {
        matchId: "segunda-division-2026-27-j12-tenerife-andorra",
        status: "postponed",
        score: null,
        minute: null,
        observedAt: "2026-11-01T22:58:41.619Z",
      },
    ]);
    expect(result.skipped).toEqual([]);
    // A FINISHED row mutated to POSTPONED keeps the mapping, score or not.
    const postponed = { ...ZAMORA, estado: "POSTPONED" };
    expect(parseRows([postponed]).observations[0]).toMatchObject({
      matchId: "primera-rfef-g1-2026-27-j10-zamora-deportivo-fabril",
      status: "postponed",
      observedAt: ZAMORA.lastSeenAt,
    });
  });

  it("SUSPENDED with a score is suspended; without it, skipped suspended_without_score (real row mutated)", () => {
    const withScore = { ...ZAMORA, estado: "SUSPENDED" };
    expect(parseRows([withScore]).observations).toEqual([
      {
        matchId: "primera-rfef-g1-2026-27-j10-zamora-deportivo-fabril",
        status: "suspended",
        score: { home: 1, away: 3 },
        minute: null,
        observedAt: ZAMORA.lastSeenAt,
      },
    ]);
    const noScore = { ...withScore, golesLocal: null, golesVisitante: null };
    const result = parseRows([noScore]);
    expect(result.observations).toEqual([]);
    expect(result.skipped).toEqual([
      {
        externalMatchId: "70695466",
        status: "SUSPENDED",
        reason: "suspended_without_score",
      },
    ]);
  });

  it.each([
    ["FINISHED", ZAMORA],
    ["LIVE_PROVISIONAL", AMOREBIETA],
  ])("%s with one goal missing is skipped missing_score", (_, r) => {
    for (const side of ["golesLocal", "golesVisitante"] as const) {
      const result = parseRows([{ ...r, [side]: null }]);
      expect(result.observations).toEqual([]);
      expect(result.skipped).toEqual([
        {
          externalMatchId: r.codActa,
          status: r.estado,
          reason: "missing_score",
        },
      ]);
    }
  });

  it("groups outside the competitions map are ignored without a trace", () => {
    const femenino = rowLocal("2026-11-01", "CD Alba Femenino");
    const juvenil = rowLocal("2026-11-01", "tomiño f.c.");
    const juvenilDeployed = row("2026-11-01", "Club Bansander");
    expect(femenino.estado).toBe("FINISHED");
    expect(juvenil.estado).toBe("LIVE_PROVISIONAL");
    expect(juvenilDeployed.estado).toBe("FINISHED");
    expect(parseRows([femenino, juvenil, juvenilDeployed])).toEqual(empty);
  });
});

describe("CA-4 identity (ADR-017 §2): the same as adapter.ts", () => {
  const FED3 = "paneles-masculino-fed3-2026-10-10T21-25-36Z";
  const CAPTURED = "2026-10-10T21:25:36Z" as Instant;
  const direct = createRfef({ aliases: testAliases, calendar });
  const viaExplorer = createRfefExplorer({
    aliases: testAliases,
    calendar,
    baseUrl: BASE_URL,
    token: TOKEN,
  });

  // The rows of the real panel, as the export of explorer would carry them:
  // every scored row FINISHED, so the identity is what differs, never the
  // clock. The export of 2026-10-31/11-01 cannot be used here because the
  // deliberate errors of alias-test.json are tuned to «Jornada 7».
  const panel = readPanel(fixtureText(FED3));
  const asExport: ExplorerMatch[] = panel.rows.map((r) => ({
    codActa: r.acta?.acta ?? null,
    codGrupo: r.codgrupo,
    codCompeticion: "0",
    jornada: String(r.round),
    fechaIso: null,
    horaTexto: `${String(r.hour).padStart(2, "0")}:${String(r.minute).padStart(2, "0")}`,
    codEquipoLocal: null,
    equipoLocal: r.home,
    codEquipoVisitante: null,
    equipoVisitante: r.away,
    golesLocal: r.cell.score?.home ?? null,
    golesVisitante: r.cell.score?.away ?? null,
    estado:
      r.cell.status === "Suspendido"
        ? "SUSPENDED"
        : r.cell.status === "Aplazado"
          ? "POSTPONED"
          : r.cell.score === null
            ? "SCHEDULED"
            : "FINISHED",
    lastSeenAt: CAPTURED,
    lastChangedAt: CAPTURED,
    strategy: "test:panel",
    discardedReadings: 0,
  }));

  const panelCapture: RawCapture = {
    sourceId: "rfef",
    capturedAt: CAPTURED,
    requests: [
      {
        url: "https://marcadores.rfef.es/pnfg/NPcd/NFG_CMP_Paneles",
        status: 200,
        contentType: "text/html;charset=ISO-8859-15",
        body: fixtureText(FED3),
      },
    ],
  } as RawCapture;
  const fromPanel = ParseResult.parse(direct.parse(panelCapture));
  const fromExport = ParseResult.parse(
    viaExplorer.parse(capture([exportOf(asExport, "2026-10-10")], CAPTURED)),
  );
  const identity = (u: Unresolved) =>
    `${u.reason}|${u.externalCompetition}|${u.externalMatchId}|${u.home.externalId}|${u.home.externalName}|${u.away.externalId}|${u.away.externalName}`;

  it("the six cases of SPEC-031 CA-6 give the same unresolved in both adapters", () => {
    expect(fromPanel.requestErrors).toEqual([]);
    expect(fromExport.requestErrors).toEqual([]);
    expect(fromExport.unresolved.map(identity).sort()).toEqual(
      fromPanel.unresolved.map(identity).sort(),
    );
    expect(fromExport.unresolved.length).toBeGreaterThanOrEqual(3);
  });

  it("every match the panel resolves, the export resolves to the same MatchId, and the rows that resolve are the same", () => {
    const panelIds = new Set(fromPanel.observations.map((o) => o.matchId));
    const exportIds = new Set(fromExport.observations.map((o) => o.matchId));
    for (const id of panelIds) expect(exportIds.has(id), id).toBe(true);
    expect(fromExport.observations.length + fromExport.skipped.length).toBe(
      fromPanel.observations.length + fromPanel.skipped.length,
    );
  });

  it("(1) Fabril - Racing Ferrol resolves to the declared MatchId, finished 0-1", () => {
    expect(fromExport.observations).toContainEqual({
      matchId: "primera-rfef-g1-2026-27-j7-deportivo-fabril-racing-ferrol",
      status: "finished",
      score: { home: 0, away: 1 },
      minute: null,
      observedAt: CAPTURED,
    });
  });

  it("(2) Copa and juveniles produce nothing", () => {
    const all = JSON.stringify(fromExport);
    for (const copa of ["Atlético Unión Güimar", "SD Compostela", "c.d. choco"])
      expect(all).not.toContain(copa);
  });

  it("(3) a team without alias is unknown_team with externalName = the name of the export", () => {
    expect(fromExport.unresolved).toContainEqual({
      reason: "unknown_team",
      externalCompetition: "33836089",
      externalMatchId: "70695429",
      home: { externalId: "cp cacereño", externalName: "CP Cacereño" },
      away: {
        externalId: "unionistas de salamanca cf",
        externalName: "Unionistas de Salamanca CF",
      },
      status: "FINISHED",
    });
  });

  it("(4) a pair with no match in the calendar is unknown_match", () => {
    expect(fromExport.unresolved).toContainEqual(
      expect.objectContaining({
        reason: "unknown_match",
        home: { externalId: "ud ourense", externalName: "UD Ourense" },
      }),
    );
  });

  it("(5) Number(jornada) different from round is inconsistent_alias", () => {
    expect(fromExport.unresolved).toContainEqual(
      expect.objectContaining({
        reason: "inconsistent_alias",
        home: { externalId: "cd coria", externalName: "CD Coria" },
      }),
    );
    // Over the real export too: the real alias, the round changed.
    const result = parseRows([{ ...ZAMORA, jornada: "11" }]);
    expect(result.observations).toEqual([]);
    expect(result.unresolved).toEqual([
      {
        reason: "inconsistent_alias",
        externalCompetition: "33836089",
        externalMatchId: "70695466",
        home: { externalId: "zamora cf", externalName: "Zamora CF" },
        away: {
          externalId: "rc deportivo fabril",
          externalName: "RC Deportivo Fabril",
        },
        status: "FINISHED",
      },
    ]);
  });

  it('(6) pontevedra c.f. "B" and Pontevedra C.F. "B" resolve the same', () => {
    const tercera = "tercera-rfef-g1" as CompetitionId;
    for (const a of [viaExplorer, direct]) {
      expect(a.resolveTeam('pontevedra c.f. "B"', tercera)).toBe(
        "pontevedra-b",
      );
      expect(a.resolveTeam('Pontevedra C.F. "B"', tercera)).toBe(
        "pontevedra-b",
      );
      expect(a.resolveTeam('  Pontevedra   C.F. "B" ', tercera)).toBe(
        "pontevedra-b",
      );
      expect(a.resolveTeam("Nadie FC", tercera)).toBeNull();
    }
  });

  it("codEquipo* and codActa do not take part in the identity", () => {
    const expected = parseRows([ZAMORA]).observations;
    expect(expected).toHaveLength(1);
    for (const mutated of [
      { ...ZAMORA, codEquipoLocal: "999999", codEquipoVisitante: "1" },
      { ...ZAMORA, codEquipoLocal: null, codEquipoVisitante: null },
      { ...ZAMORA, codActa: null },
      { ...ZAMORA, codActa: "1" },
    ])
      expect(parseRows([mutated]).observations).toEqual(expected);
    // A team of another competition resolves by name but makes no pair in
    // Primera RFEF; a pair of the same competition always exists some round
    // (then it is inconsistent_alias, case 5).
    const unknown = parseRows([{ ...ZAMORA, equipoVisitante: "Arosa SC" }]);
    expect(unknown.observations).toEqual([]);
    expect(unknown.unresolved[0]).toMatchObject({ reason: "unknown_match" });
    const otherRound = parseRows([
      { ...ZAMORA, equipoVisitante: "CD Mirandés" },
    ]);
    expect(otherRound.unresolved[0]).toMatchObject({
      reason: "inconsistent_alias",
    });
  });

  describe("SPEC-049 canonical field resolution", () => {
    it("resolves competition from canonicalCompetitionId when codGrupo is not in aliases.competitions", () => {
      const withoutCanonical = parseRows([
        { ...ZAMORA, codGrupo: "desconocido" },
      ]);
      expect(withoutCanonical).toEqual(empty);

      const withCanonical = parseRows([
        {
          ...ZAMORA,
          codGrupo: "desconocido",
          canonicalCompetitionId: "primera-rfef-g1",
        },
      ]);
      expect(withCanonical.observations).toEqual([
        expect.objectContaining({
          matchId: "primera-rfef-g1-2026-27-j10-zamora-deportivo-fabril",
          status: "finished",
        }),
      ]);
    });

    it("resolves teams directly from canonicalHomeTeamId and canonicalAwayTeamId", () => {
      const withoutCanonical = parseRows([
        {
          ...ZAMORA,
          equipoLocal: "Equipo Desconocido 1",
          equipoVisitante: "Equipo Desconocido 2",
        },
      ]);
      expect(withoutCanonical.observations).toEqual([]);
      expect(withoutCanonical.unresolved[0]).toMatchObject({
        reason: "unknown_team",
      });

      const withCanonical = parseRows([
        {
          ...ZAMORA,
          equipoLocal: "Equipo Desconocido 1",
          equipoVisitante: "Equipo Desconocido 2",
          canonicalHomeTeamId: "zamora",
          canonicalAwayTeamId: "deportivo-fabril",
        },
      ]);
      expect(withCanonical.observations).toEqual([
        expect.objectContaining({
          matchId: "primera-rfef-g1-2026-27-j10-zamora-deportivo-fabril",
          status: "finished",
        }),
      ]);
    });

    it("falls back to alias map when canonical team IDs are absent", () => {
      const withPartialCanonical = parseRows([
        {
          ...ZAMORA,
          equipoLocal: "Equipo Desconocido 1",
          canonicalHomeTeamId: "zamora",
          // canonicalAwayTeamId missing, falls back to equipoVisitante alias
        },
      ]);
      expect(withPartialCanonical.observations).toEqual([
        expect.objectContaining({
          matchId: "primera-rfef-g1-2026-27-j10-zamora-deportivo-fabril",
          status: "finished",
        }),
      ]);
    });
  });
});
