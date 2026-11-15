import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { seasonOf } from "../board/current.ts";
import { type IndexReader, readHome } from "../board/week-read.ts";
import type {
  CompetitionId,
  Instant,
  MatchId,
  PublicMatch,
} from "../model/index.ts";
import type {
  DayMatchesResponse,
  OfficialCalendarResponse,
} from "./explorer-client.ts";
import * as client from "./explorer-client.ts";
import {
  EXPLORER_ENRICHMENT_TIMEOUT_MS,
  enrichMatchesWithGoals,
} from "./explorer-enrichment.ts";
import { fetchWomenXornadaMatches } from "./explorer-xornada.ts";
import {
  type BoardExplorer,
  readXornadaBoard,
  renderExplorer,
} from "./xornada-board.ts";

// SPEC-085: one read of the board for /, /es and /api/board, with its
// dependencies injected (reader, Explorer, clock). No network: doubles only.

const NOW = "2026-11-08T12:00:00.000Z" as Instant;

const MEN: PublicMatch = {
  matchId: "primera-division-2026-27-j12-valencia-real-madrid" as MatchId,
  competitionId: "primera-division" as CompetitionId,
  competitionName: "Primeira División",
  tier: 1,
  round: 12,
  kickoff: "2026-11-08T11:00:00.000Z" as Instant,
  home: { name: "Valencia CF", shortName: "Valencia" },
  away: { name: "Real Madrid CF", shortName: "Real Madrid" },
  status: "live",
  halfTime: false,
  score: { home: 0, away: 1 },
  minute: 50,
  addedMinute: null,
  qualifier: "confirmado",
  version: 1,
  observedAt: "2026-11-08T11:50:00.000Z" as Instant,
  decidedAt: "2026-11-08T11:50:00.000Z" as Instant,
  homeScoredAt: null,
  awayScoredAt: "2026-11-08T11:30:00.000Z" as Instant,
} as PublicMatch;

const CALENDAR: OfficialCalendarResponse = {
  competition: "liga-f",
  season: "2026-27",
  exportedAt: "2026-11-07T00:00:00Z",
  teams: [],
  ignoredRounds: {},
  matches: [
    {
      externalId: "liga-f-2026-27-j10-depor-abanca-valencia-cf",
      round: 10,
      kickoff: "2026-11-08T11:00:00Z",
      home: "depor-abanca",
      away: "valencia-cf",
      timeConfirmed: true,
    },
  ],
};

const DAY: DayMatchesResponse = {
  date: "2026-11-08",
  exportedAt: "2026-11-08T11:55:00Z",
  matches: [
    {
      canonicalCompetitionId: "primera-division",
      canonicalHomeTeamId: "valencia",
      canonicalAwayTeamId: "real-madrid",
      estado: "LIVE_PROVISIONAL",
      goals: [{ team: "away", player: "Mbappé", minute: 30 }],
    },
    {
      codActa: "f-1",
      canonicalCompetitionId: "liga-f",
      canonicalHomeTeamId: "depor-abanca",
      canonicalAwayTeamId: "valencia-cf",
      estado: "LIVE_PROVISIONAL",
      homeScore: 1,
      awayScore: 0,
      minute: 40,
      goals: [{ team: "home", player: "Athenea", minute: 12 }],
    },
  ],
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const after = async <T>(ms: number, value: () => T): Promise<T> => {
  if (ms > 0) await sleep(ms);
  return value();
};

type Doubles = {
  reader: IndexReader;
  explorer: BoardExplorer;
};

function doubles({
  base = 0,
  day = 0,
  calendar = 0,
  baseFails = false,
  dayFails = false,
  calendarFails = false,
}: {
  base?: number;
  day?: number;
  calendar?: number;
  baseFails?: boolean;
  dayFails?: boolean;
  calendarFails?: boolean;
} = {}): Doubles {
  return {
    reader: {
      index: (season) =>
        after(base, () => {
          if (baseFails) throw new Error("db down");
          return [
            {
              matchId: MEN.matchId,
              competitionId: MEN.competitionId,
              season,
              round: MEN.round,
              kickoff: MEN.kickoff,
              status: MEN.status,
            },
          ];
        }),
      matches: async (ids) => (ids.includes(MEN.matchId) ? [MEN] : []),
    },
    explorer: {
      dayMatches: (date) =>
        after(day, () => {
          if (dayFails) throw new Error("explorer down");
          return { ...DAY, date };
        }),
      calendar: (competition) =>
        after(calendar, () => {
          if (calendarFails) throw new Error("explorer down");
          return competition === "liga-f"
            ? CALENDAR
            : { ...CALENDAR, competition, matches: [] };
        }),
    },
  };
}

// The composition of / before SPEC-085: base, then scorers, then women.
async function serialToday({ reader, explorer }: Doubles) {
  let read: Awaited<ReturnType<typeof readHome>>;
  try {
    read = await readHome(reader, NOW, "gl");
  } catch {
    return null;
  }
  let matches = read.matches;
  try {
    matches = await enrichMatchesWithGoals(matches, explorer.dayMatches, null);
  } catch {}
  try {
    const women = await fetchWomenXornadaMatches(NOW, seasonOf(NOW), explorer);
    if (women.length > 0) matches = [...matches, ...women];
  } catch {}
  return { matches, arrows: read.arrows };
}

const quiet = () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
};

describe("SPEC-085 CA-2 one read of the board, in parallel", () => {
  it("the women do not wait for the base nor the scorers (< 250 ms)", async () => {
    const d = doubles({ base: 100, day: 100, calendar: 100 });
    const start = performance.now();
    const read = await readXornadaBoard(
      { ...d, now: NOW, aliases: null },
      "gl",
    );
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(250);
    expect(read?.matches.map((m) => m.matchId)).toEqual([
      MEN.matchId,
      "liga-f-2026-27-j10-depor-abanca-valencia-cf",
    ]);
  });

  it.each([
    ["everything answers", {}],
    ["Explorer's day fails: rows without scorers", { dayFails: true }],
    ["the women fail: only the men", { calendarFails: true }],
    ["the base fails: null", { baseFails: true }],
  ])("%s: the same result as the serial composition", async (_name, opts) => {
    quiet();
    const expected = await serialToday(doubles(opts));
    const read = await readXornadaBoard(
      { ...doubles(opts), now: NOW, aliases: null },
      "gl",
    );
    expect(read).toEqual(expected);
    vi.restoreAllMocks();
  });

  it("the scorers and the women are really there when all answers", async () => {
    const read = await readXornadaBoard(
      { ...doubles(), now: NOW, aliases: null },
      "gl",
    );
    expect(read?.matches[0]?.goals).toEqual([
      { team: "away", player: "Mbappé", minute: 30 },
    ]);
    expect(read?.matches[1]?.status).toBe("live");
  });

  it("no reader: null, and nothing is asked to Explorer", async () => {
    const d = doubles();
    const dayMatches = vi.fn(d.explorer.dayMatches);
    const read = await readXornadaBoard(
      { reader: null, explorer: { ...d.explorer, dayMatches }, now: NOW },
      "gl",
    );
    expect(read).toBeNull();
    expect(dayMatches).not.toHaveBeenCalled();
  });
});

describe("SPEC-085 CA-2 /, /es and /api/board share the read", () => {
  const source = (file: string) =>
    readFileSync(path.resolve(__dirname, "../..", file), "utf8");

  it.each(["src/app/xornada-home.tsx", "src/app/api/board/route.ts"])(
    "%s reads through readXornadaBoard and composes nothing else",
    (file) => {
      const src = source(file);
      expect(src).toMatch(/readXornadaBoard\(/);
      expect(src).not.toMatch(
        /enrichMatchesWithGoals|fetchWomenXornadaMatches|explorer-client/,
      );
    },
  );
});

describe("SPEC-085 CA-3 Explorer with a deadline in the render", () => {
  const never = <T>() => new Promise<T>(() => {});

  it("an Explorer that never answers: the read resolves within the deadline + 200 ms, without women", async () => {
    quiet();
    const d = doubles();
    const timeoutMs = 300;
    const start = performance.now();
    const read = await readXornadaBoard(
      {
        reader: d.reader,
        explorer: { calendar: never, dayMatches: never },
        now: NOW,
        aliases: null,
        timeoutMs,
      },
      "gl",
    );
    expect(performance.now() - start).toBeLessThanOrEqual(timeoutMs + 200);
    expect(read?.matches).toEqual([MEN]);
    vi.restoreAllMocks();
  });

  it("the calendar answers, the days never: still within the deadline + 200 ms", async () => {
    quiet();
    const d = doubles({ calendar: 200 });
    const timeoutMs = 300;
    const start = performance.now();
    const read = await readXornadaBoard(
      {
        reader: d.reader,
        explorer: { calendar: d.explorer.calendar, dayMatches: never },
        now: NOW,
        aliases: null,
        timeoutMs,
      },
      "gl",
    );
    expect(performance.now() - start).toBeLessThanOrEqual(timeoutMs + 200);
    expect(read?.matches[0]).toEqual(MEN);
    vi.restoreAllMocks();
  });

  it("the explorer of the render asks every request with EXPLORER_ENRICHMENT_TIMEOUT_MS", async () => {
    const calendar = vi
      .spyOn(client, "getOfficialCalendar")
      .mockResolvedValue(CALENDAR);
    const day = vi.spyOn(client, "getDayMatches").mockResolvedValue(DAY);
    const explorer = renderExplorer();
    await explorer.calendar("liga-f", "2026-27");
    await explorer.dayMatches("2026-11-08");
    expect(calendar).toHaveBeenCalledWith("liga-f", "2026-27", undefined, {
      timeoutMs: EXPLORER_ENRICHMENT_TIMEOUT_MS,
    });
    expect(day).toHaveBeenCalledWith("2026-11-08", undefined, {
      timeoutMs: EXPLORER_ENRICHMENT_TIMEOUT_MS,
    });
    vi.restoreAllMocks();
  });
});
