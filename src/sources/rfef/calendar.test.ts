import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ImportedCalendar } from "../../model/index.ts";
import {
  COMPETITION_TEAM_OVERRIDES,
  createRfefCalendar,
  rfefCalendar,
} from "./calendar.ts";

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

  it("preserves declared benchmark calendar for tercera-rfef-g1", () => {
    const calendar = createRfefCalendar("https://test-explorer.vercel.app");
    const rawTercera = {
      competition: "tercera-rfef-g1",
      season: "2026-27",
      exportedAt: "2026-11-06T22:50:00Z",
      teams: [{ externalId: "synthetic-team", externalName: "Synthetic Team" }],
      matches: [],
      ignoredRounds: {},
    };
    const parsed = calendar.parse(rawTercera);
    expect(parsed.teams).toHaveLength(18);
    expect(parsed.matches).toHaveLength(306);
    expect(parsed.teams.some((t) => t.externalId === "alondras")).toBe(true);
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
