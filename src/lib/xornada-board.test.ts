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
  cachedCalendar,
  readXornadaBoard,
  renderExplorer,
  WOMEN_CALENDAR_TTL_S,
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
      lastSeenAt: "2026-11-08T11:40:00Z",
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

// Virtual time (F-SPEC-085-8): the clock only moves when the test advances
// it, so a cold start or a loaded machine cannot change the result.
function track<T>(work: Promise<T>) {
  const state: { done: boolean; value?: T } = { done: false };
  void work.then((value) => {
    state.done = true;
    state.value = value;
  });
  return state;
}

const quiet = () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
};

describe("SPEC-085 CA-2 one read of the board, in parallel", () => {
  it("the women do not wait for the base nor the scorers (200 virtual ms < 250; in series, 400)", async () => {
    vi.useFakeTimers();
    try {
      const slow = { base: 100, day: 100, calendar: 100 };
      const read = track(
        readXornadaBoard({ ...doubles(slow), now: NOW, aliases: null }, "gl"),
      );
      // The old serial composition, on the same clock: it must still be
      // waiting when the parallel read is done, or this test discriminates
      // nothing.
      const serial = track(serialToday(doubles(slow)));

      await vi.advanceTimersByTimeAsync(200);
      expect(read.done).toBe(true);
      expect(serial.done).toBe(false);
      expect(read.value?.matches.map((m) => m.matchId)).toEqual([
        MEN.matchId,
        "liga-f-2026-27-j10-depor-abanca-valencia-cf",
      ]);

      await vi.advanceTimersByTimeAsync(200);
      expect(serial.done).toBe(true);
      expect(read.value).toEqual(serial.value);
    } finally {
      vi.useRealTimers();
    }
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

  it("an Explorer that never answers: the read resolves at the deadline (virtual time), without women", async () => {
    quiet();
    vi.useFakeTimers();
    try {
      const d = doubles();
      const timeoutMs = 300;
      const read = track(
        readXornadaBoard(
          {
            reader: d.reader,
            explorer: { calendar: never, dayMatches: never },
            now: NOW,
            aliases: null,
            timeoutMs,
          },
          "gl",
        ),
      );
      await vi.advanceTimersByTimeAsync(timeoutMs - 1);
      expect(read.done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(read.done).toBe(true);
      expect(read.value?.matches).toEqual([MEN]);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("the calendar answers, the days never: still done at the deadline (virtual time)", async () => {
    quiet();
    vi.useFakeTimers();
    try {
      const d = doubles({ calendar: 200 });
      const timeoutMs = 300;
      const read = track(
        readXornadaBoard(
          {
            reader: d.reader,
            explorer: { calendar: d.explorer.calendar, dayMatches: never },
            now: NOW,
            aliases: null,
            timeoutMs,
          },
          "gl",
        ),
      );
      await vi.advanceTimersByTimeAsync(timeoutMs);
      expect(read.done).toBe(true);
      expect(read.value?.matches[0]).toEqual(MEN);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
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

describe("SPEC-085 CA-4 the women calendar is cached", () => {
  const plus = (seconds: number) =>
    new Date(Date.parse(NOW) + seconds * 1000).toISOString() as Instant;

  function counted(fails = 0) {
    const d = doubles();
    const calls = new Map<string, number>();
    let failures = fails;
    const calendar = async (competition: string, season: string) => {
      calls.set(competition, (calls.get(competition) ?? 0) + 1);
      if (failures > 0) {
        failures -= 1;
        throw new Error("explorer down");
      }
      return d.explorer.calendar(competition, season);
    };
    return { d, calls, calendar };
  }

  it("H-2: one hour", () => {
    expect(WOMEN_CALENDAR_TTL_S).toBe(3600);
  });

  it("two reads within the TTL: one call per competition; past it, another", async () => {
    const { d, calls, calendar } = counted();
    let now = NOW;
    const explorer = {
      calendar: cachedCalendar(calendar, () => now),
      dayMatches: d.explorer.dayMatches,
    };
    const read = () =>
      readXornadaBoard(
        { reader: d.reader, explorer, now, aliases: null },
        "gl",
      );

    await read();
    now = plus(WOMEN_CALENDAR_TTL_S - 1);
    const second = await read();
    // SPEC-091 CA-2: liga-f and G1 are the women competitions.
    expect(Object.fromEntries(calls)).toEqual({
      "liga-f": 1,
      "segunda-federacion-fem-g1": 1,
    });
    expect(second?.matches).toHaveLength(2);

    now = plus(WOMEN_CALENDAR_TTL_S + 1);
    await read();
    expect(Object.fromEntries(calls)).toEqual({
      "liga-f": 2,
      "segunda-federacion-fem-g1": 2,
    });
  });

  it("a failure of Explorer is not cached", async () => {
    quiet();
    // The first women calendar asked (liga-f) fails on the first read.
    const { d, calls, calendar } = counted(1);
    const explorer = {
      calendar: cachedCalendar(calendar, () => NOW),
      dayMatches: d.explorer.dayMatches,
    };
    const read = () =>
      readXornadaBoard(
        { reader: d.reader, explorer, now: NOW, aliases: null },
        "gl",
      );
    expect((await read())?.matches).toEqual([
      expect.objectContaining({ matchId: MEN.matchId }),
    ]);
    expect((await read())?.matches).toHaveLength(2);
    expect(calls.get("liga-f")).toBe(2);
    vi.restoreAllMocks();
  });

  it("the season is part of the key", async () => {
    const { calls, calendar } = counted();
    const cached = cachedCalendar(calendar, () => NOW);
    await cached("liga-f", "2026-27");
    await cached("liga-f", "2027-28");
    await cached("liga-f", "2026-27");
    expect(calls.get("liga-f")).toBe(2);
  });
});

describe("SPEC-085 CA-5 one request per day", () => {
  it("each date reaches /api/export/matches once between scorers and women", async () => {
    const d = doubles({ base: 20, day: 30 });
    const perDate = new Map<string, number>();
    const dayMatches = (date: string) => {
      perDate.set(date, (perDate.get(date) ?? 0) + 1);
      return d.explorer.dayMatches(date);
    };
    const read = await readXornadaBoard(
      {
        reader: d.reader,
        explorer: { calendar: d.explorer.calendar, dayMatches },
        now: NOW,
        aliases: null,
      },
      "gl",
    );
    expect(Object.fromEntries(perDate)).toEqual({ "2026-11-08": 1 });
    expect(read?.matches[0]?.goals).toHaveLength(1);
    expect(read?.matches[1]?.status).toBe("live");
  });

  it("the women ask first and the scorers later: still once", async () => {
    const d = doubles({ base: 80, day: 200 });
    let calls = 0;
    const dayMatches = (date: string) => {
      calls += 1;
      return d.explorer.dayMatches(date);
    };
    await readXornadaBoard(
      {
        reader: d.reader,
        explorer: { calendar: d.explorer.calendar, dayMatches },
        now: NOW,
        aliases: null,
      },
      "gl",
    );
    expect(calls).toBe(1);
  });

  it("two reads do not share their days", async () => {
    const d = doubles();
    let calls = 0;
    const explorer = {
      calendar: d.explorer.calendar,
      dayMatches: (date: string) => {
        calls += 1;
        return d.explorer.dayMatches(date);
      },
    };
    const deps = { reader: d.reader, explorer, now: NOW, aliases: null };
    await readXornadaBoard(deps, "gl");
    await readXornadaBoard(deps, "gl");
    expect(calls).toBe(2);
  });
});
