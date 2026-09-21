import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ImportedCalendar, Instant } from "../../model/index.ts";
import { apiFootballCalendar } from "./calendar.ts";

const fixture = (league: number) =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/fixtures-${league}-2024.json`, import.meta.url),
      "utf8",
    ),
  );

const byRound = (matches: { round: number }[]) =>
  Object.entries(
    Object.groupBy(matches, (m) => m.round) as Record<string, unknown[]>,
  ).map(([round, ms]) => [Number(round), ms.length]);

describe("CA-4 apiFootballCalendar", () => {
  it("is registered under api-football and covers the five competitions of 2026-27", () => {
    expect(apiFootballCalendar.id).toBe("api-football");
    for (const id of [
      "primera-division",
      "segunda-division",
      "primera-rfef-g1",
      "segunda-rfef-g1",
      "tercera-rfef-g1",
    ])
      expect(apiFootballCalendar.covers(id, "2026-27")).toBe(true);
    expect(apiFootballCalendar.covers("tercera-rfef-g2", "2026-27")).toBe(
      false,
    );
  });

  it("fetch makes exactly one GET to /fixtures with the key and user agent", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const stub = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ response: [] }), {
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const raw = await apiFootballCalendar.fetch("tercera-rfef-g1", "2026-27", {
      apiKey: "secret-key",
      fetch: stub,
      userAgent: "marcador.gal (test)",
    });
    expect(raw).toEqual({ response: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://v3.football.api-sports.io/fixtures?league=439&season=2026",
    );
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("x-apisports-key")).toBe("secret-key");
    expect(headers.get("user-agent")).toBe("marcador.gal (test)");
    expect(calls[0].init?.method ?? "GET").toBe("GET");
  });

  it("fetch rejects a competition it does not cover", async () => {
    const stub = (() => {
      throw new Error("network must not be used");
    }) as unknown as typeof fetch;
    await expect(
      apiFootballCalendar.fetch("tercera-rfef-g2", "2026-27", {
        apiKey: "k",
        fetch: stub,
        userAgent: "ua",
      }),
    ).rejects.toThrow();
  });
});

describe("CA-5 parse on real fixtures", () => {
  const throwingFetch = (() => {
    throw new Error("npm test must not touch the network");
  }) as unknown as typeof fetch;

  it("never calls fetch when parsing", () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = throwingFetch;
    try {
      expect(() => apiFootballCalendar.parse(fixture(439))).not.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("439 (Group 1 - N): whole rounds, 18 teams, Z kickoffs, no ignored rounds", () => {
    const imported = apiFootballCalendar.parse(fixture(439));
    expect(ImportedCalendar.safeParse(imported).success).toBe(true);
    expect(byRound(imported.matches)).toEqual([
      [1, 9],
      [2, 9],
      [3, 9],
    ]);
    expect(imported.teams).toHaveLength(18);
    for (const m of imported.matches) {
      expect(m.kickoff.endsWith("Z")).toBe(true);
      expect(Instant.safeParse(m.kickoff).success).toBe(true);
      expect(m.timeConfirmed).toBe(true);
    }
    expect(imported.ignoredRounds).toEqual({});
    const first = imported.matches.find(
      (m) => m.round === 1 && m.home === "9616",
    );
    expect(first).toMatchObject({
      kickoff: "2024-09-08T10:00:00Z",
      away: "20255",
    });
    expect(imported.teams).toContainEqual({
      externalId: "9616",
      externalName: "Somozas",
    });
  });

  it("141 (Regular Season - N): 22 teams, 11 matches per round, play-off ignored", () => {
    const imported = apiFootballCalendar.parse(fixture(141));
    expect(imported.teams).toHaveLength(22);
    expect(byRound(imported.matches)).toEqual([
      [1, 11],
      [2, 11],
    ]);
    expect(imported.ignoredRounds).toEqual({
      "Promotion Play-offs - final": 2,
    });
    expect(imported.matches.some((m) => m.round > 2)).toBe(false);
  });

  it("marks PST/TBD as timeConfirmed=false", () => {
    const raw = fixture(439);
    raw.response[0].fixture.status.short = "PST";
    raw.response[1].fixture.status.short = "TBD";
    const imported = apiFootballCalendar.parse(raw);
    expect(imported.matches.filter((m) => !m.timeConfirmed)).toHaveLength(2);
  });

  it("rejects a body that is not a fixtures response", () => {
    expect(() => apiFootballCalendar.parse({ nope: true })).toThrow();
  });
});
