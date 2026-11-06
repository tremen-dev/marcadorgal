import { describe, expect, it } from "vitest";
import { ImportedCalendar } from "../../model/index.ts";
import { createRfefCalendar, rfefCalendar } from "./calendar.ts";

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
