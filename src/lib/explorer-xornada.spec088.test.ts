import { describe, expect, it } from "vitest";
import type {
  DayMatchesResponse,
  OfficialCalendarResponse,
} from "./explorer-client.ts";
import {
  fetchWomenXornadaMatches,
  WOMEN_COMPETITIONS,
  type WomenExplorer,
} from "./explorer-xornada.ts";

// SPEC-088: the women xornada publishes no generated calendar and no match
// already past as scheduled. Injected WomenExplorer, no network; the clock
// is the nowIso of the call.

type Fixture = OfficialCalendarResponse["matches"][number];
type Row = DayMatchesResponse["matches"][number];

const MIN = 60_000;
const at = (instant: string, minutes: number) =>
  new Date(Date.parse(instant) + minutes * MIN)
    .toISOString()
    .replace(".000Z", "Z");

const K = "2026-11-22T11:00:00Z"; // 12:00 in Madrid
const D = "2026-11-22";

const fixture = (
  competition: string,
  kickoff = K,
  timeConfirmed = true,
): Fixture => ({
  externalId: `${competition}-j10`,
  round: 10,
  kickoff,
  home: "depor-abanca",
  away: "valencia-cf",
  timeConfirmed,
});

function explorerOf(
  byCompetition: Record<string, Fixture[]>,
  rows: Row[] = [],
  calls: string[] = [],
): WomenExplorer {
  return {
    calendar: async (competition, season) => {
      calls.push(competition);
      return {
        competition,
        season,
        exportedAt: "2026-11-01T00:00:00Z",
        teams: [],
        ignoredRounds: {},
        matches: byCompetition[competition] ?? [],
      };
    },
    dayMatches: async (date) => ({
      date,
      exportedAt: `${date}T00:00:00Z`,
      matches: date === D ? rows : [],
    }),
  };
}

const scheduledRow: Row = {
  codActa: "a1",
  canonicalCompetitionId: "liga-f",
  canonicalHomeTeamId: "depor-abanca",
  canonicalAwayTeamId: "valencia-cf",
  estado: "SCHEDULED",
  homeScore: null,
  awayScore: null,
  lastSeenAt: at(K, -60),
};

describe("SPEC-088 CA-1 only official calendars", () => {
  it("WOMEN_COMPETITIONS is exactly liga-f", () => {
    expect(WOMEN_COMPETITIONS).toEqual(["liga-f"]);
  });

  it("with the three answering, only liga-f comes out and only liga-f is asked", async () => {
    const calls: string[] = [];
    const explorer = explorerOf(
      {
        "liga-f": [fixture("liga-f")],
        "primera-federacion-fem": [fixture("primera-federacion-fem")],
        "segunda-federacion-fem-g1": [fixture("segunda-federacion-fem-g1")],
      },
      [],
      calls,
    );
    const matches = await fetchWomenXornadaMatches(
      at(K, -60),
      "2026-27",
      explorer,
    );
    expect(matches.map((m) => m.competitionId)).toEqual(["liga-f"]);
    expect(calls).toEqual(["liga-f"]);
  });
});

const run = async (now: string, f: Fixture, rows: Row[] = []) =>
  fetchWomenXornadaMatches(now, "2026-27", explorerOf({ "liga-f": [f] }, rows));

describe("SPEC-088 CA-2 no row, confirmed time: until kickoff + 10 min", () => {
  it.each<[string, boolean, number]>([
    ["K-1h", true, -60],
    ["K+9min", true, 9],
    ["K+10min", false, 10],
    ["K+3d", false, 3 * 24 * 60],
  ])("%s: comes out = %s", async (_, out, minutes) => {
    const matches = await run(at(K, minutes), fixture("liga-f"));
    expect(matches.map((m) => m.status)).toEqual(out ? ["scheduled"] : []);
  });
});

describe("SPEC-088 CA-3 no row, unconfirmed time: the whole Madrid day", () => {
  const KU = "2026-11-22T00:00:00Z";
  it.each<[string, boolean]>([
    ["2026-11-21T10:00:00Z", true],
    ["2026-11-22T20:00:00Z", true],
    ["2026-11-22T23:30:00Z", false], // 00:30 of the 23rd in Madrid
    ["2026-11-24T10:00:00Z", false],
  ])("now %s: comes out = %s", async (now, out) => {
    const matches = await run(now, fixture("liga-f", KU, false));
    expect(matches.map((m) => m.status)).toEqual(out ? ["scheduled"] : []);
  });
});

describe("SPEC-088 CA-4 a SCHEDULED row past its term follows the same rule", () => {
  it.each<[string, boolean, string, boolean]>([
    ["confirmed, K+9min", true, at(K, 9), true],
    ["confirmed, K+10min", false, at(K, 10), true],
    ["unconfirmed, same Madrid day", true, "2026-11-22T20:00:00Z", false],
    ["unconfirmed, next Madrid day", false, "2026-11-22T23:30:00Z", false],
  ])("%s: comes out = %s", async (_, out, now, confirmed) => {
    const kickoff = confirmed ? K : "2026-11-22T00:00:00Z";
    const matches = await run(now, fixture("liga-f", kickoff, confirmed), [
      { ...scheduledRow },
    ]);
    expect(matches.map((m) => m.status)).toEqual(out ? ["scheduled"] : []);
  });
});

describe("SPEC-088 CA-5 a row not scheduled is as in SPEC-086", () => {
  it("a finished row three days later is still finished with its score", async () => {
    const matches = await run(at(K, 3 * 24 * 60), fixture("liga-f"), [
      {
        ...scheduledRow,
        estado: "FINISHED",
        homeScore: 2,
        awayScore: 1,
        lastSeenAt: at(K, 110),
      },
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.status).toBe("finished");
    expect(matches[0]?.score).toEqual({ home: 2, away: 1 });
  });

  it("a live row past kickoff + 10 min is live", async () => {
    const matches = await run(at(K, 30), fixture("liga-f"), [
      {
        ...scheduledRow,
        estado: "LIVE_PROVISIONAL",
        homeScore: 0,
        awayScore: 0,
        lastSeenAt: at(K, 29),
      },
    ]);
    expect(matches.map((m) => m.status)).toEqual(["live"]);
  });
});
