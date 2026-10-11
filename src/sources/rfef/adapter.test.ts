import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AliasFile,
  type CompetitionId,
  type FetchContext,
  type Instant,
  ParseResult,
  type RawCapture,
  type WindowMatch,
} from "../../model/index.ts";
import {
  createRfef,
  type DeclaredMatch,
  PANEL_QUERY,
  PANEL_URL,
} from "./adapter.ts";
import {
  EMPTY_BODY_FILE,
  FIXTURES,
  fixtureBytes,
  fixtureText,
} from "./fixture-files.ts";

const root = new URL("../../../", import.meta.url);
const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(new URL(rel, root), "utf8"));

const aliases = AliasFile.parse(
  readJson("src/sources/rfef/fixtures/alias-test.json"),
);

// The declared calendar of 2026-27, as the core injects it (ADR-008 §8). The
// MatchId format is SPEC-004 N-2: <competition>-<season>-j<round>-<home>-<away>.
const FIVE = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];
const calendar: DeclaredMatch[] = FIVE.flatMap((competition) => {
  const file = readJson(`data/calendario/2026-27/${competition}.json`) as {
    matches: { round: number; home: string; away: string }[];
  };
  return file.matches.map(
    (m) =>
      ({
        id: `${competition}-2026-27-j${m.round}-${m.home}-${m.away}`,
        competitionId: competition,
        round: m.round,
        homeTeamId: m.home,
        awayTeamId: m.away,
      }) as DeclaredMatch,
  );
});

const adapter = createRfef({ aliases, calendar });

const FED3 = "paneles-masculino-fed3-2026-10-10T21-25-36Z";
const capture = (
  body: string,
  capturedAt = "2026-10-10T21:25:36Z",
): RawCapture =>
  ({
    sourceId: "rfef",
    capturedAt,
    requests: [
      {
        url: PANEL_URL,
        status: 200,
        contentType: "text/html;charset=ISO-8859-15",
        body,
      },
    ],
  }) as RawCapture;
const parseBody = (body: string, capturedAt?: string) =>
  ParseResult.parse(adapter.parse(capture(body, capturedAt)));

const REAL = fixtureText(FED3);

describe("CA-6 identity (ADR-017 §2)", () => {
  const result = parseBody(REAL);

  it("Fabril - Racing Ferrol, with acta, is finished 0-1 with the declared MatchId", () => {
    expect(result.observations).toContainEqual({
      matchId: "primera-rfef-g1-2026-27-j7-deportivo-fabril-racing-ferrol",
      status: "finished",
      score: { home: 0, away: 1 },
      minute: null,
    });
  });

  it("Copa and juveniles produce nothing", () => {
    const names = [
      ...result.unresolved.map((u) => u.home.externalName),
      ...result.skipped.map((s) => s.status),
    ];
    for (const copa of ["Atlético Unión Güimar", "SD Compostela", "c.d. choco"])
      expect(names).not.toContain(copa);
    expect(
      result.unresolved.every((u) =>
        ["33836085", "33836087", "33836089", "33836092", "26991073"].includes(
          u.externalCompetition ?? "",
        ),
      ),
    ).toBe(true);
  });

  it("a team without alias is unknown_team, with the external names", () => {
    expect(result.unresolved).toContainEqual({
      reason: "unknown_team",
      externalCompetition: "33836089",
      externalMatchId: "70695429",
      home: { externalId: "cp cacereño", externalName: "CP Cacereño" },
      away: {
        externalId: "unionistas de salamanca cf",
        externalName: "Unionistas de Salamanca CF",
      },
      status: "1-1",
    });
  });

  it("a pair with no match in the calendar is unknown_match", () => {
    expect(result.unresolved).toContainEqual(
      expect.objectContaining({
        reason: "unknown_match",
        home: { externalId: "ud ourense", externalName: "UD Ourense" },
      }),
    );
  });

  it("«Jornada N» different from the round is inconsistent_alias", () => {
    // The test alias swaps Coria and Extremadura: the declared pair exists,
    // but in round 26, not in «Jornada 7».
    expect(result.unresolved).toContainEqual(
      expect.objectContaining({
        reason: "inconsistent_alias",
        home: { externalId: "cd coria", externalName: "CD Coria" },
      }),
    );
    expect(
      result.observations.some((o) => o.matchId.includes("extremadura-coria")),
    ).toBe(false);
  });

  it('pontevedra c.f. "B" and Pontevedra C.F. "B" resolve the same', () => {
    const tercera = "tercera-rfef-g1" as CompetitionId;
    expect(adapter.resolveTeam('pontevedra c.f. "B"', tercera)).toBe(
      "pontevedra-b",
    );
    expect(adapter.resolveTeam('Pontevedra C.F. "B"', tercera)).toBe(
      "pontevedra-b",
    );
    expect(adapter.resolveTeam('  Pontevedra   C.F. "B" ', tercera)).toBe(
      "pontevedra-b",
    );
  });

  it("a '-' row appears nowhere, and no observation carries observedAt", () => {
    const all = JSON.stringify(result);
    expect(all).not.toContain("Elche");
    expect(all).not.toContain("elche");
    for (const o of result.observations)
      expect(o).not.toHaveProperty("observedAt");
    expect(result.skipped).toContainEqual({
      externalMatchId: "70694602",
      status: "Suspendido",
      reason: "suspended_without_score",
    });
  });

  it("parses every real panel of the five competitions without errors", () => {
    for (const f of FIXTURES.filter((x) => x.name !== "paneles-femenino-fed3"))
      expect(
        parseBody(fixtureText(f.name), f.capturedAt).requestErrors,
      ).toEqual([]);
  });

  it("the live rows of the sondeo are live, without a minute", () => {
    // paneles-masculino, 20:49Z: kickoff 19:00Z + 109 min, inside the window.
    const live = parseBody(
      fixtureText("paneles-masculino"),
      "2026-10-10T20:49:00Z",
    ).observations.filter((o) => o.status === "live");
    expect(live).toContainEqual({
      matchId: "primera-division-2026-27-j8-real-madrid-villarreal",
      status: "live",
      score: { home: 0, away: 0 },
      minute: null,
      addedMinute: null,
    });
  });
});

// CA-4: every mutation of a real fixture fails the request, with the reason,
// and leaves zero observations of it.
describe("CA-4 visible failure, never a digit", () => {
  const TABLE =
    "2,5,9,4,1,0,8,6,3,7,1,3,5,7,9,0,2,4,6,8,0,2,4,6,8,1,3,5,7,9,7,5,2,0,9,6,3,8,4,1";
  const mutate = (from: string | RegExp, to: string) => {
    const body = REAL.replace(from, to);
    expect(body).not.toBe(REAL);
    return body;
  };
  const failsWith = (body: string, reason: RegExp) => {
    const result = parseBody(body);
    expect(result.observations).toEqual([]);
    expect(result.unresolved).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.requestErrors).toHaveLength(1);
    expect(result.requestErrors[0].url).toBe(PANEL_URL);
    expect(result.requestErrors[0].error).toMatch(reason);
  };

  it("control: the real fixture gives observations", () => {
    expect(parseBody(REAL).observations.length).toBeGreaterThan(0);
  });

  it("(i) a table of 39 values", () => {
    failsWith(mutate(TABLE, TABLE.slice(2)), /table of 39 values/);
  });

  it("(i) a table with a 10", () => {
    failsWith(mutate(TABLE, `10${TABLE.slice(1)}`), /not 40 digits/);
  });

  it("(ii) an unpacked function with another body", () => {
    failsWith(mutate("d[(i*h)+n]", "d[(i*h)+n+1]"), /another body/);
  });

  it("(iii) ntype called without being defined", () => {
    failsWith(
      mutate(/<script>eval\(function\(p,a,c,k,e,d\).*?<\/script>/, ""),
      /called before it is defined/,
    );
  });

  it.each([
    [
      "<b>",
      "<i class=fa-solid>1</i> - <i class=fa-solid>1</i>",
      "<b>1</b> - <i class=fa-solid>1</i>",
    ],
    [
      "<img>",
      "<i class=fa-solid>1</i> - <i class=fa-solid>1</i>",
      "<i class=fa-solid><img src=x>1</i> - <i class=fa-solid>1</i>",
    ],
    [
      "content:attr()",
      '#idh1395216:after{content:"1"}',
      "#idh1395216:after{content:attr(data-x)}",
    ],
    [
      "font-family",
      '#idh1395216:after{content:"1"}',
      '#idh1395216:after{content:"1";font-family:x}',
    ],
    [
      "a rule on an absent id",
      '#idh1395216:after{content:"1"}',
      '#idh9999999:after{content:"1"}',
    ],
  ])("(iv) unknown form in a cell: %s", (_, from, to) => {
    failsWith(mutate(from, to), /unknown|absent id/);
  });

  it.each([
    ["three digits", "<i class=fa-solid>123</i>"],
    ["a letter", "<i class=fa-solid>x</i>"],
    ["empty", "<i class=fa-solid></i>"],
  ])("(v) a side that is not ^\\d{1,2}$: %s", (_, side) => {
    failsWith(
      mutate(
        "<i class=fa-solid>1</i> - <i class=fa-solid>1</i>",
        `${side} - <i class=fa-solid>1</i>`,
      ),
      /not \^\\d\{1,2\}\$/,
    );
  });

  it("(vi) the body of the cookie page (NLogin) is not a panel", () => {
    const login = readFileSync(
      new URL("fixtures/sin-cookie-aceptada.html", import.meta.url),
      "utf8",
    );
    failsWith(login, /not a panel/);
  });

  it("(vi) an empty body has its own reason, empty body (E-1)", () => {
    // The real 0-byte 200 of the POST series (the IP block).
    const empty = new TextDecoder("iso-8859-15").decode(
      fixtureBytes(EMPTY_BODY_FILE),
    );
    expect(empty).toBe("");
    failsWith(empty, /^empty body$/);
  });

  it("(vii) a panel with no codgrupo of the map", () => {
    failsWith(fixtureText("paneles-femenino-fed3"), /no codgrupo of the map/);
  });

  it("control: changing the digit of a content changes the output", () => {
    const fabril = (body: string) =>
      parseBody(body).observations.find((o) =>
        o.matchId.endsWith("deportivo-fabril-racing-ferrol"),
      );
    expect(fabril(REAL)?.score).toEqual({ home: 0, away: 1 });
    expect(
      fabril(
        mutate(
          '#idh1395216:after{content:"1"}',
          '#idh1395216:after{content:"2"}',
        ),
      )?.score,
    ).toEqual({ home: 0, away: 2 });
  });
});

// CA-7: fetch with a double of fetch.
describe("CA-7 fetch", () => {
  const PORTADA = "https://marcadores.rfef.es/pnfg/";
  const UA = "marcador.gal (ingesta; https://marcador.gal)";
  const NOW = "2026-10-11T15:00:00Z" as Instant;
  const MATCH = {
    id: "tercera-rfef-g1-2026-27-j6-antela-barco",
    competitionId: "tercera-rfef-g1",
    season: "2026-27",
    kickoff: "2026-10-11T15:30:00Z",
    homeTeamId: "antela",
    awayTeamId: "barco",
  } as WindowMatch;

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
  const ctx = (
    fetch: typeof globalThis.fetch,
    matches = [MATCH],
  ): FetchContext => ({
    now: NOW,
    competitions: ["tercera-rfef-g1" as CompetitionId],
    matches,
    fetch,
    userAgent: UA,
  });
  const portada = (cookie: string | null, status = 302) =>
    new Response(null, {
      status,
      headers: cookie ? { "set-cookie": cookie, location: "/pnfg/x" } : {},
    });
  // Málaga, SÁB. in ISO-8859-15 bytes.
  const LATIN9 = Uint8Array.from([
    0x4d, 0xe1, 0x6c, 0x61, 0x67, 0x61, 0x20, 0x53, 0xc1, 0x42, 0x2e,
  ]);
  const panel = (status = 200) =>
    new Response(LATIN9, {
      status,
      headers: { "content-type": "text/html;charset=ISO-8859-15" },
    });

  it("(i) an empty window makes no call", async () => {
    const { calls, fetch } = fake([]);
    const result = await adapter.fetch?.(ctx(fetch, []));
    expect(calls).toHaveLength(0);
    expect(result?.requests).toEqual([]);
  });

  it("(ii) portada without redirects, then one POST with the query in the body (E-1)", async () => {
    const { calls, fetch } = fake([
      portada("JSESSIONID=96339C96; Path=/pnfg; HttpOnly"),
      panel(),
    ]);
    const result = await adapter.fetch?.(ctx(fetch));
    expect(calls.map((c) => c.url)).toEqual([PORTADA, PANEL_URL]);
    expect(calls[0].init?.method ?? "GET").toBe("GET");
    expect(calls[0].init?.redirect).toBe("manual");
    expect(new Headers(calls[0].init?.headers).get("user-agent")).toBe(UA);
    expect(calls[1].init?.method).toBe("POST");
    expect(calls[1].init?.redirect).toBe("manual");
    expect(calls[1].init?.body).toBe(PANEL_QUERY);
    const data = new Headers(calls[1].init?.headers);
    expect(data.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(data.get("cookie")).toBe("JSESSIONID=96339C96");
    expect(data.get("user-agent")).toBe(UA);
    expect(PANEL_URL).toBe(
      "https://marcadores.rfef.es/pnfg/NPcd/NFG_CMP_Paneles",
    );
    expect(PANEL_QUERY).toBe(
      "cod_primaria=3001668&grupo_categoria=900163685,900163686&resultados=1&columna=1&extendido=1&no_paginacion=1&tipo_peticion=1&federacion=3",
    );
    expect(result?.requests).toHaveLength(1);
    expect(result?.requests[0]).toMatchObject({
      url: PANEL_URL,
      method: "POST",
      requestBody: PANEL_QUERY,
    });
    expect(result?.requests[0].url).not.toContain("?");
    expect(result?.capturedAt).toBe(NOW);
    expect(JSON.stringify(result)).not.toContain("96339C96");
    expect(JSON.stringify(result)).not.toContain("JSESSIONID");
  });

  it("(iii) decodes ISO-8859-15 bytes by the charset", async () => {
    const { fetch } = fake([portada("JSESSIONID=abc; Path=/pnfg"), panel()]);
    const result = await adapter.fetch?.(ctx(fetch));
    expect(result?.requests[0].body).toBe("Málaga SÁB.");
    expect(result?.requests[0].contentType).toBe(
      "text/html;charset=ISO-8859-15",
    );
  });

  it("(iv) throws without a cookie", async () => {
    const { fetch } = fake([portada(null, 200)]);
    await expect(adapter.fetch?.(ctx(fetch))).rejects.toThrow(/JSESSIONID/);
  });

  it.each([302, 500, 404])(
    "(iv) throws when the data request answers %i",
    async (status) => {
      const { fetch } = fake([
        portada("JSESSIONID=abc; Path=/pnfg"),
        panel(status),
      ]);
      await expect(adapter.fetch?.(ctx(fetch))).rejects.toThrow(
        new RegExp(String(status)),
      );
    },
  );

  it("(iv) a 200 with an empty body does not throw: it goes to the raw capture, and parse says empty body", async () => {
    const { fetch } = fake([
      portada("JSESSIONID=abc; Path=/pnfg"),
      // As the real block answers: 200, Content-Length: 0, no Content-Type.
      new Response(Buffer.from(fixtureBytes(EMPTY_BODY_FILE)), {
        status: 200,
        headers: { "content-length": "0" },
      }),
    ]);
    const capture = await adapter.fetch?.(ctx(fetch));
    expect(capture?.requests).toHaveLength(1);
    expect(capture?.requests[0]).toMatchObject({
      url: PANEL_URL,
      method: "POST",
      status: 200,
      body: "",
    });
    if (capture === undefined) throw new Error("no fetch");
    const result = ParseResult.parse(adapter.parse(capture));
    expect(result.observations).toEqual([]);
    expect(result.requestErrors).toEqual([
      { url: PANEL_URL, error: "empty body" },
    ]);
  });
});
