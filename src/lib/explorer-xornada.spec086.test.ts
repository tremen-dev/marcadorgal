import { describe, expect, it, vi } from "vitest";
import { boardEtag } from "../board/http.ts";
import type { PublicMatch } from "../model/public.ts";
import { rowAge } from "../xornada/freshness.ts";
import type {
  DayMatchesResponse,
  OfficialCalendarResponse,
} from "./explorer-client.ts";
import {
  fetchWomenXornadaMatches,
  type WomenExplorer,
} from "./explorer-xornada.ts";

// SPEC-086: the women xornada never degrades nor invents on a failure or a
// gap of explorer. Injected WomenExplorer (SPEC-085 CA-2), no network; the
// clock is the nowIso of the call.

type Fixture = OfficialCalendarResponse["matches"][number];
type Row = DayMatchesResponse["matches"][number];

const D1 = "2026-11-08";
const D2 = "2026-11-09";
const KO1 = "2026-11-08T11:00:00Z"; // 12:00 in Madrid
const KO2 = "2026-11-09T11:00:00Z";
const NOW = "2026-11-08T12:00:00Z";
const MIN = 60_000;
const at = (instant: string, minutes: number) =>
  new Date(Date.parse(instant) + minutes * MIN)
    .toISOString()
    .replace(".000Z", "Z");

const fixture = (
  home: string,
  away: string,
  kickoff = KO1,
  externalId = `liga-f-2026-27-j10-${home}-${away}`,
): Fixture => ({
  externalId,
  round: 10,
  kickoff,
  home,
  away,
  timeConfirmed: true,
});

const row = (home: string, away: string, extra: Partial<Row> = {}): Row => ({
  codActa: `${home}-${away}`,
  canonicalCompetitionId: "liga-f",
  canonicalHomeTeamId: home,
  canonicalAwayTeamId: away,
  estado: "FINISHED",
  homeScore: 2,
  awayScore: 1,
  lastSeenAt: at(KO1, 50),
  ...extra,
});

// Liga F only: the other two competitions answer an empty calendar.
function explorerOf(
  fixtures: Fixture[],
  days: Record<string, () => Promise<DayMatchesResponse>>,
): WomenExplorer {
  return {
    calendar: async (competition, season) => ({
      competition,
      season,
      exportedAt: "2026-11-07T00:00:00Z",
      teams: [],
      ignoredRounds: {},
      matches: competition === "liga-f" ? fixtures : [],
    }),
    dayMatches: (date) =>
      (
        days[date] ??
        (async () => ({ date, exportedAt: `${date}T00:00:00Z`, matches: [] }))
      )(),
  };
}

const day = (date: string, matches: Row[]) => async () => ({
  date,
  exportedAt: `${date}T13:00:00Z`,
  matches,
});

const quiet = () => ({
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
});

const byId = (matches: PublicMatch[]) =>
  new Map(matches.map((m) => [m.matchId as string, m]));

const one = (extra: Partial<Row>) =>
  explorerOf([fixture("depor-abanca", "valencia-cf")], {
    [D1]: day(D1, [row("depor-abanca", "valencia-cf", extra)]),
  });

describe("SPEC-086 CA-1 an unreadable day is never scheduled", () => {
  const fixtures = [
    fixture("depor-abanca", "valencia-cf", KO1, "d1-depor"),
    fixture("eibar-femenino", "granada-femenino", KO1, "d1-eibar"),
    fixture("madrid-cff", "alaves", KO2, "d2-madrid"),
    fixture("sevilla-fc", "athletic-femenino", KO2, "d2-sevilla"),
    fixture("fc-barcelona", "real-madrid-femenino", KO2, "d2-barca"),
  ];
  const d2 = day(D2, [
    row("madrid-cff", "alaves", { lastSeenAt: at(KO2, 110) }),
    // d2-sevilla has no row: scheduled. d2-barca has two: ambiguous.
    row("fc-barcelona", "real-madrid-femenino", { codActa: "a" }),
    row("fc-barcelona", "real-madrid-femenino", { codActa: "b" }),
  ]);
  const NOW2 = "2026-11-09T14:00:00Z";

  it.each([
    [
      "rejects",
      async (): Promise<DayMatchesResponse> => {
        throw new Error("explorer down");
      },
    ],
    [
      "answers without matches",
      async () => ({ date: D1 }) as unknown as DayMatchesResponse,
    ],
  ])(
    "D1 %s: nothing of D1, D2 with its states, an error with D1",
    async (_, d1) => {
      const { warn, error } = quiet();
      const matches = await fetchWomenXornadaMatches(
        NOW2,
        "2026-27",
        explorerOf(fixtures, { [D1]: d1, [D2]: d2 }),
      );
      const ids = byId(matches);
      expect(ids.has("d1-depor")).toBe(false);
      expect(ids.has("d1-eibar")).toBe(false);
      expect(ids.get("d2-madrid")?.status).toBe("finished");
      expect(ids.get("d2-madrid")?.score).toEqual({ home: 2, away: 1 });
      expect(ids.get("d2-sevilla")?.status).toBe("scheduled");
      // Ambiguous (refines SPEC-070 CA-6): the match does not come out.
      expect(ids.has("d2-barca")).toBe(false);
      const warned = warn.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(warned).toContain("d2-barca");
      expect(warned).toContain("a ?–?; b ?–?"); // the candidates, by codActa
      const errors = error.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(errors).toContain(D1);
      expect(errors).not.toContain(D2);
      vi.restoreAllMocks();
    },
  );
});

describe("SPEC-086 CA-2 without a score nothing is invented", () => {
  const live = {
    estado: "LIVE_PROVISIONAL" as const,
    lastSeenAt: at(KO1, 30),
  };
  const finished = { estado: "FINISHED" as const };
  const suspended = { estado: "SUSPENDED" as const };
  const noHome = { homeScore: undefined, awayScore: undefined };

  it.each<[string, Partial<Row>]>([
    ["finished, both null", { ...finished, homeScore: null, awayScore: null }],
    ["finished, home missing", { ...finished, homeScore: undefined }],
    [
      "finished, golesVisitante null",
      { ...finished, ...noHome, golesLocal: 1, golesVisitante: null },
    ],
    ["live, both null", { ...live, homeScore: null, awayScore: null }],
    ["live, away null", { ...live, awayScore: null }],
    [
      "live, goles* both null",
      { ...live, ...noHome, golesLocal: null, golesVisitante: null },
    ],
    [
      "suspended, both null",
      { ...suspended, homeScore: null, awayScore: null },
    ],
    ["suspended, home null", { ...suspended, homeScore: null, awayScore: 0 }],
    [
      "suspended, golesLocal null",
      { ...suspended, ...noHome, golesLocal: null, golesVisitante: 2 },
    ],
  ])("%s: the match does not come out", async (_, extra) => {
    const matches = await fetchWomenXornadaMatches(NOW, "2026-27", one(extra));
    expect(matches).toEqual([]);
  });

  it.each<[string, Partial<Row>, string]>([
    ["finished", finished, "finished"],
    ["live", live, "live"],
    ["suspended", suspended, "suspended"],
  ])("%s with a full score: that score", async (_, extra, status) => {
    const matches = await fetchWomenXornadaMatches(
      NOW,
      "2026-27",
      one({ ...extra, ...noHome, golesLocal: 3, golesVisitante: 0 }),
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.status).toBe(status);
    expect(matches[0]?.score).toEqual({ home: 3, away: 0 });
  });
});

describe("SPEC-086 CA-3 the live window of the ingest", () => {
  it.each<[number, Partial<Row>, boolean]>([
    [-11, {}, false],
    [-10, {}, true],
    [129, {}, true],
    [130, {}, false],
    [139, { minute: 95 }, true],
    [139, { halfTime: true }, true],
    [140, { minute: 95 }, false],
  ])("lastSeenAt kickoff %d min %o: live %s", async (offset, extra, isLive) => {
    const matches = await fetchWomenXornadaMatches(
      NOW,
      "2026-27",
      one({
        estado: "LIVE_PROVISIONAL",
        lastSeenAt: at(KO1, offset),
        ...extra,
      }),
    );
    if (isLive) {
      expect(matches).toHaveLength(1);
      expect(matches[0]?.status).toBe("live");
    } else {
      expect(matches).toEqual([]);
    }
  });

  it("minute and added minute bounded as in the ingest", async () => {
    const [m] = await fetchWomenXornadaMatches(
      NOW,
      "2026-27",
      one({
        estado: "LIVE_PROVISIONAL",
        lastSeenAt: at(KO1, 135),
        minute: 200,
        addedMinute: 45,
      }),
    );
    expect(m?.status).toBe("live");
    if (m?.status === "live") {
      expect(m.minute).toBe(130);
      expect(m.addedMinute).toBe(30);
      expect(m.halfTime).toBe(false);
    }
  });
});

describe("SPEC-086 CA-4 sanitized goals", () => {
  const goalsOf = async (goals: unknown[]) => {
    const [m] = await fetchWomenXornadaMatches(
      NOW,
      "2026-27",
      one({ goals: goals as Row["goals"] }),
    );
    return m;
  };

  it("only the valid goal comes out", async () => {
    const m = await goalsOf([
      { team: "home", player: "Goleador Local", minute: 10 },
      { team: "home", minute: 20 },
      { team: "away", player: "Athenea", minute: "x" },
      { team: "home", player: "Millene", minute: 33 },
    ]);
    expect(m?.goals).toEqual([{ team: "home", player: "Millene", minute: 33 }]);
  });

  it("no valid goal: goals absent", async () => {
    const m = await goalsOf([
      { team: "home", player: "Goleador Visitante", minute: 10 },
    ]);
    expect(m?.status).toBe("finished");
    expect(m).not.toHaveProperty("goals");
  });
});

describe("SPEC-086 CA-5 a bad match does not take the rest down", () => {
  it("a kickoff that is not ISO: the two valid ones come out, a warn with its id", async () => {
    const { warn } = quiet();
    const matches = await fetchWomenXornadaMatches(
      NOW,
      "2026-27",
      explorerOf(
        [
          fixture("depor-abanca", "valencia-cf"),
          fixture(
            "eibar-femenino",
            "granada-femenino",
            "2026-11-08 11:00",
            "bad-one",
          ),
          fixture("madrid-cff", "alaves"),
        ],
        { [D1]: day(D1, [row("depor-abanca", "valencia-cf")]) },
      ),
    );
    expect(matches.map((m) => m.matchId).sort()).toEqual([
      "liga-f-2026-27-j10-depor-abanca-valencia-cf",
      "liga-f-2026-27-j10-madrid-cff-alaves",
    ]);
    const warned = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(warned).toContain("bad-one");
    vi.restoreAllMocks();
  });
});

describe("SPEC-086 CA-6 the clocks of the row", () => {
  it("not scheduled: observedAt = decidedAt = lastSeenAt, version 1; scheduled: version 0 and nulls", async () => {
    const seen = at(KO1, 50);
    const ids = byId(
      await fetchWomenXornadaMatches(
        NOW,
        "2026-27",
        explorerOf(
          [
            fixture("depor-abanca", "valencia-cf"),
            fixture("madrid-cff", "alaves"),
            fixture("eibar-femenino", "granada-femenino"),
          ],
          {
            [D1]: day(D1, [
              row("depor-abanca", "valencia-cf", { lastSeenAt: seen }),
              row("eibar-femenino", "granada-femenino", {
                estado: "SCHEDULED",
                homeScore: null,
                awayScore: null,
              }),
            ]),
          },
        ),
      ),
    );
    expect(
      ids.get("liga-f-2026-27-j10-depor-abanca-valencia-cf"),
    ).toMatchObject({ observedAt: seen, decidedAt: seen, version: 1 });
    for (const id of [
      "liga-f-2026-27-j10-madrid-cff-alaves",
      "liga-f-2026-27-j10-eibar-femenino-granada-femenino",
    ]) {
      expect(ids.get(id)).toMatchObject({
        status: "scheduled",
        version: 0,
        observedAt: null,
        decidedAt: null,
      });
    }
  });

  it.each<[string, string | undefined, Row["estado"]]>([
    ["missing", undefined, "FINISHED"],
    ["not ISO", "ayer", "FINISHED"],
    ["without Z", "2026-11-08T11:50:00", "FINISHED"],
    ["missing", undefined, "POSTPONED"],
  ])(
    "a row with lastSeenAt %s (%s) does not come out",
    async (_, lastSeenAt, estado) => {
      const matches = await fetchWomenXornadaMatches(
        NOW,
        "2026-27",
        one({ estado, lastSeenAt }),
      );
      expect(matches).toEqual([]);
    },
  );
});

describe("SPEC-086 CA-7 stable ETag", () => {
  it("the same answers and two nowIso 30 s apart: equal lists and equal boardEtag", async () => {
    const explorer = explorerOf(
      [
        fixture("depor-abanca", "valencia-cf"),
        fixture("madrid-cff", "alaves"),
        fixture("eibar-femenino", "granada-femenino"),
      ],
      {
        [D1]: day(D1, [
          row("depor-abanca", "valencia-cf", {
            estado: "LIVE_PROVISIONAL",
            lastSeenAt: at(KO1, 55),
            minute: 55,
          }),
          row("madrid-cff", "alaves", { estado: "POSTPONED" }),
        ]),
      },
    );
    const first = await fetchWomenXornadaMatches(NOW, "2026-27", explorer);
    const second = await fetchWomenXornadaMatches(
      at(NOW, 0.5),
      "2026-27",
      explorer,
    );
    expect(first).toHaveLength(3);
    expect(second).toEqual(first);
    expect(boardEtag(second)).toBe(boardEtag(first));
  });
});

describe("SPEC-086 CA-8 real freshness", () => {
  it("a live match whose row was seen 5 min before now: rowAge 5", async () => {
    const now = at(KO1, 60);
    const [m] = await fetchWomenXornadaMatches(
      now,
      "2026-27",
      one({
        estado: "LIVE_PROVISIONAL",
        lastSeenAt: at(KO1, 55),
        minute: 55,
      }),
    );
    expect(m?.status).toBe("live");
    expect(rowAge(m as PublicMatch, Date.parse(now))).toBe(5);
  });
});
