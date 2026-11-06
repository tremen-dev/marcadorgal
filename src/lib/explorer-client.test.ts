import { describe, expect, it } from "vitest";
import {
  getDayMatches,
  getGoalkeepers,
  getOfficialCalendar,
  getScorers,
  getStandings,
} from "./explorer-client.ts";

describe("CA-5 explorer-client", () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const stub = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true, data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  it("getOfficialCalendar requests /api/export/calendar with query params", async () => {
    calls.length = 0;
    await getOfficialCalendar("segunda-division", "2026-27", stub);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(
      "/api/export/calendar?competition=segunda-division&season=2026-27",
    );
  });

  it("getDayMatches requests /api/export/matches with date", async () => {
    calls.length = 0;
    await getDayMatches("2026-11-08", stub);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/export/matches?date=2026-11-08");
  });

  it("getStandings requests /api/export/standings", async () => {
    calls.length = 0;
    await getStandings("primera-division", "2026-27", stub);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(
      "/api/export/standings?competition=primera-division&season=2026-27",
    );
  });

  it("getScorers requests /api/export/stats/scorers", async () => {
    calls.length = 0;
    await getScorers("primera-division", "2026-27", stub);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(
      "/api/export/stats/scorers?competition=primera-division&season=2026-27",
    );
  });

  it("getGoalkeepers requests /api/export/stats/goalkeepers with minMatches", async () => {
    calls.length = 0;
    await getGoalkeepers("segunda-division", 12, "2026-27", stub);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(
      "/api/export/stats/goalkeepers?competition=segunda-division&season=2026-27&minMatches=12",
    );
  });

  it("throws descriptive error when response is not ok", async () => {
    const errorStub = (async () => {
      return new Response("Unauthorized", { status: 401 });
    }) as typeof fetch;

    await expect(getDayMatches("2026-11-08", errorStub)).rejects.toThrow(
      "[explorer] Error 401",
    );
  });
});
