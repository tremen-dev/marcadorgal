import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ImportedCalendar } from "../../model/index.ts";
import {
  COMPETITION_TEAM_OVERRIDES,
  createRfefCalendar,
  rfefCalendar,
} from "./calendar.ts";

// A ctx.fetch spy: records every request and answers what it is told to.
const spyFetch = (status = 200, body: unknown = {}) => {
  const calls: string[] = [];
  const fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
  return {
    calls,
    ctx: { apiKey: "t", fetch, userAgent: "marcador.gal (test)" },
  };
};

const samplePayload = {
  competition: "segunda-division",
  season: "2026-27",
  exportedAt: "2026-11-06T22:50:00Z",
  teams: [
    {
      externalId: "rc-deportivo",
      externalName: "RC Deportivo de La Coruña",
    },
    {
      externalId: "racing-ferrol",
      externalName: "Racing Club de Ferrol",
    },
  ],
  matches: [
    {
      externalId: "2026-27-segunda-j13-depor-ferrol",
      round: 13,
      kickoff: "2026-11-08T17:30:00Z",
      home: "rc-deportivo",
      away: "racing-ferrol",
      timeConfirmed: true,
    },
  ],
  ignoredRounds: {},
};

describe("CA-1 rfefCalendar", () => {
  it("is registered under rfef and covers the five competitions of 2026-27", () => {
    expect(rfefCalendar.id).toBe("rfef");
    for (const id of [
      "primera-division",
      "segunda-division",
      "primera-rfef-g1",
      "segunda-rfef-g1",
      "tercera-rfef-g1",
    ]) {
      expect(rfefCalendar.covers(id, "2026-27")).toBe(true);
    }
    expect(rfefCalendar.covers("tercera-rfef-g2", "2026-27")).toBe(false);
  });

  it("fetch makes a GET to /api/export/calendar with Bearer token and user agent", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const stub = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(samplePayload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const calendar = createRfefCalendar("https://test-explorer.vercel.app");
    const raw = await calendar.fetch("segunda-division", "2026-27", {
      apiKey: "test-token",
      fetch: stub,
      userAgent: "marcador.gal (test)",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://test-explorer.vercel.app/api/export/calendar?competition=segunda-division&season=2026-27",
    );
    expect(
      (calls[0].init?.headers as Record<string, string>)?.Authorization,
    ).toBe("Bearer test-token");

    const parsed = calendar.parse(raw);
    expect(ImportedCalendar.safeParse(parsed).success).toBe(true);
    expect(parsed.teams).toHaveLength(2);
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.matches[0]).toMatchObject({
      externalId: "2026-27-segunda-j13-depor-ferrol",
      round: 13,
      kickoff: "2026-11-08T17:30:00Z",
      home: "rc-deportivo",
      away: "racing-ferrol",
      timeConfirmed: true,
    });
  });

  it("SPEC-076 CA-1 COMPETITION_TEAM_OVERRIDES is empty: no segunda-rfef-g1, no racing-ferrol", () => {
    expect(COMPETITION_TEAM_OVERRIDES).toEqual({});
    expect(Object.keys(COMPETITION_TEAM_OVERRIDES)).not.toContain(
      "segunda-rfef-g1",
    );
    expect(JSON.stringify(COMPETITION_TEAM_OVERRIDES)).not.toContain(
      "racing-ferrol",
    );
  });

  describe("SPEC-076 CA-2 parse rewrites no team", () => {
    const calendar = createRfefCalendar("https://test-explorer.vercel.app");
    const raw = (
      competition: string,
      team: { externalId: string; externalName: string },
    ) => ({
      ...samplePayload,
      competition,
      teams: [team],
      matches: [
        {
          externalId: "m1",
          round: 1,
          kickoff: "2026-08-30T10:00:00Z",
          home: team.externalId,
          away: "sestao",
          timeConfirmed: true,
        },
      ],
    });
    const rayo = {
      externalId: "rayo-cantabria",
      externalName: "Rayo Cantabria",
    };
    const ferrol = {
      externalId: "racing-ferrol",
      externalName: "Racing Club de Ferrol",
    };

    it("segunda-rfef-g1 fixture of the repo: rayo-cantabria team and matches stay rayo-cantabria", () => {
      const fixture = JSON.parse(
        readFileSync(
          new URL(
            "./fixtures/export/calendar-segunda-rfef-g1-2026-27-2026-11-10T1407Z.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const parsed = calendar.parse(fixture);
      expect(parsed.teams).toContainEqual(rayo);
      const rayoMatches = parsed.matches.filter(
        (m) => m.home === "rayo-cantabria" || m.away === "rayo-cantabria",
      );
      expect(rayoMatches).toHaveLength(34);
      expect(JSON.stringify(parsed)).not.toContain("racing-ferrol");

      const fromRaw = calendar.parse(raw("segunda-rfef-g1", rayo));
      expect(fromRaw.teams).toEqual([rayo]);
      expect(fromRaw.matches[0].home).toBe("rayo-cantabria");
    });

    it("primera-rfef-g1 with racing-ferrol stays racing-ferrol «Racing Club de Ferrol»", () => {
      const parsed = calendar.parse(raw("primera-rfef-g1", ferrol));
      expect(parsed.teams).toEqual([ferrol]);
      expect(parsed.matches[0].home).toBe("racing-ferrol");
      expect(parsed.matches[0].away).toBe("sestao");
    });

    it("segunda-rfef-g1 with racing-ferrol stays racing-ferrol: no rewrite any more", () => {
      const parsed = calendar.parse(raw("segunda-rfef-g1", ferrol));
      expect(parsed.teams).toEqual([ferrol]);
      expect(parsed.matches[0].home).toBe("racing-ferrol");
      expect(parsed.matches[0].away).toBe("sestao");
    });
  });

  it("keeps the filial ids explorer exports today", () => {
    const calendar = createRfefCalendar("https://test-explorer.vercel.app");
    const parsed = calendar.parse({
      ...samplePayload,
      competition: "segunda-division",
      teams: [
        { externalId: "real-sociedad-b", externalName: "Real Sociedad B" },
      ],
      matches: [],
    });
    expect(parsed.teams[0]).toEqual({
      externalId: "real-sociedad-b",
      externalName: "Real Sociedad B",
    });
  });

  it("throws when response is not ok", async () => {
    const stub = (async () => {
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const calendar = createRfefCalendar("https://test-explorer.vercel.app");
    await expect(
      calendar.fetch("segunda-division", "2026-27", {
        apiKey: "test-token",
        fetch: stub,
        userAgent: "marcador.gal (test)",
      }),
    ).rejects.toThrow(/responded 404/);
  });
});

describe("SPEC-090 CA-1 tercera-rfef-g1 comes from the declared file, never from explorer", () => {
  const calendar = createRfefCalendar("https://test-explorer.vercel.app");
  const declared = JSON.parse(
    readFileSync(
      new URL(
        "../../../data/calendario/2026-27/tercera-rfef-g1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    teams: { id: string; name: string }[];
    matches: { round: number; kickoff: string; home: string; away: string }[];
  };

  it("fetch + parse calls ctx.fetch 0 times and yields the 306 declared matches and teams", async () => {
    const { calls, ctx } = spyFetch(503);
    const parsed = calendar.parse(
      await calendar.fetch("tercera-rfef-g1", "2026-27", ctx),
    );
    expect(calls).toEqual([]);
    expect(ImportedCalendar.safeParse(parsed).success).toBe(true);
    expect(parsed.matches).toHaveLength(306);
    expect(parsed.teams).toEqual(
      declared.teams.map((t) => ({ externalId: t.id, externalName: t.name })),
    );
    expect(parsed.matches).toEqual(
      declared.matches.map((m) => ({
        externalId: `2026-27-3rfef-j${m.round}-${m.home}-${m.away}`,
        round: m.round,
        kickoff: m.kickoff,
        home: m.home,
        away: m.away,
        timeConfirmed: true,
      })),
    );
    expect(parsed.ignoredRounds).toEqual({});
  });

  it("parse refuses an explorer response for tercera-rfef-g1", () => {
    expect(() =>
      calendar.parse({
        competition: "tercera-rfef-g1",
        season: "2026-27",
        exportedAt: "2026-11-06T22:50:00Z",
        teams: [
          { externalId: "synthetic-team", externalName: "Synthetic Team" },
        ],
        matches: [],
        ignoredRounds: {},
      }),
    ).toThrow(/tercera-rfef-g1/);
  });
});

describe("SPEC-090 CA-2 tercera without a declared file is not invented", () => {
  it("fetch throws naming competition and season, without calling ctx.fetch", async () => {
    const calendar = createRfefCalendar("https://test-explorer.vercel.app");
    const { calls, ctx } = spyFetch(200, {
      competition: "tercera-rfef-g1",
      season: "2099-00",
      exportedAt: "2099-01-01T00:00:00Z",
      teams: [],
      matches: [],
    });
    const err = await calendar.fetch("tercera-rfef-g1", "2099-00", ctx).then(
      () => null,
      (e: Error) => e,
    );
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toContain("tercera-rfef-g1");
    expect(err?.message).toContain("2099-00");
    expect(calls).toEqual([]);
  });
});

describe("SPEC-090 CA-3 covers is the five of D-3", () => {
  const FIVE = [
    "primera-division",
    "segunda-division",
    "primera-rfef-g1",
    "segunda-rfef-g1",
    "tercera-rfef-g1",
  ];
  const WOMEN = [
    "liga-f",
    "primera-federacion-fem",
    "segunda-federacion-fem-g1",
  ];

  it("true for the five, false for the women's three", () => {
    for (const id of FIVE)
      expect(rfefCalendar.covers(id, "2026-27")).toBe(true);
    for (const id of WOMEN)
      expect(rfefCalendar.covers(id, "2026-27")).toBe(false);
  });

  it("fetch of any women's competition throws does not cover without calling ctx.fetch", async () => {
    const calendar = createRfefCalendar("https://test-explorer.vercel.app");
    for (const id of WOMEN) {
      const { calls, ctx } = spyFetch();
      await expect(calendar.fetch(id, "2026-27", ctx)).rejects.toThrow(
        /does not cover/,
      );
      expect(calls).toEqual([]);
    }
  });
});
