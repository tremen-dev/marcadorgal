import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { boardEtag } from "../board/http.ts";
import { getGalicianClub, isGalicianClub } from "../model/clubs.ts";
import { PublicMatch } from "../model/public.ts";
import { COMPETITION_SOURCES } from "./competition-sources.ts";
import type {
  DayMatchesResponse,
  OfficialCalendarResponse,
  StandingsResponse,
} from "./explorer-client.ts";
import { isSameMatch } from "./explorer-identity.ts";
import {
  fetchWomenXornadaMatches,
  resolveTeamNames,
  WOMEN_COMPETITIONS,
  type WomenExplorer,
} from "./explorer-xornada.ts";
import { kickoffPrecision } from "./kickoff-precision.ts";

// SPEC-091: 2ª Federación Femenina G1 back in the xornada with the official
// calendar of explorer. Fixtures of the repo (CA-1), explorer injected
// (SPEC-085 CA-2), no network; the clock is the nowIso of the call.

const G1 = "segunda-federacion-fem-g1";
const EXPORT_DIR = "src/sources/rfef/fixtures/export";
const readJson = <T>(name: string): T =>
  JSON.parse(readFileSync(`${EXPORT_DIR}/${name}`, "utf8")) as T;

const CALENDAR = readJson<OfficialCalendarResponse>(
  "calendar-segunda-federacion-fem-g1-2026-27-2026-11-17T1220Z.json",
);
const STANDINGS = readJson<StandingsResponse>(
  "standings-segunda-federacion-fem-g1-2026-27-2026-11-17T1220Z.json",
);

const G1_IDS = [
  "arratia",
  "as-celtas",
  "bizkerre-club",
  "burgos-femenino",
  "depor-abanca-b",
  "eibar-femenino-b",
  "madrid-cff-b",
  "osasuna-femenino-b",
  "racing-santander-femenino",
  "rayo-vallecano-femenino",
  "real-aviles-industrial",
  "real-oviedo-femenino",
  "sporting-gijon-femenino",
  "victoria",
];

type Fixture = OfficialCalendarResponse["matches"][number];
type Row = DayMatchesResponse["matches"][number];

const MIN = 60_000;
const at = (instant: string, minutes: number) =>
  new Date(Date.parse(instant) + minutes * MIN)
    .toISOString()
    .replace(".000Z", "Z");

const quiet = () => ({
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
});

describe("SPEC-091 CA-1 raw and identity of the capture", () => {
  it("the calendar: 182 matches, 26 rounds, the 14 ids; the standings: the same 14", () => {
    expect(CALENDAR.competition).toBe(G1);
    expect(CALENDAR.matches).toHaveLength(182);
    expect(new Set(CALENDAR.matches.map((m) => m.round)).size).toBe(26);
    const teams = CALENDAR.teams.map((t) => t.externalId).sort();
    const inMatches = [
      ...new Set(CALENDAR.matches.flatMap((m) => [m.home, m.away])),
    ].sort();
    const inStandings = STANDINGS.standings.map((s) => s.teamId).sort();
    expect(teams).toEqual(G1_IDS);
    expect(inMatches).toEqual(G1_IDS);
    expect(inStandings).toEqual(G1_IDS);
  });

  it("each pair home-away is one match of the calendar (the identity has one target)", () => {
    const pairs = CALENDAR.matches.map((m) => `${m.home}|${m.away}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  // Every export capture of the folder: a G1 row pairs with exactly one
  // match of the calendar by the identity of SPEC-070, no alias. The
  // captures of 2026-11-14/15/17 have no G1 row (ledger: pending with a
  // capture of 2026-11-21/22); a new capture in the folder enters here.
  it("every G1 row of the export captures pairs with exactly one calendar match", () => {
    const exports = readdirSync(EXPORT_DIR).filter(
      (f) => f.startsWith("export-") && f.endsWith(".json"),
    );
    const unpaired: string[] = [];
    let g1Rows = 0;
    for (const file of exports) {
      const body = readJson<{ matches?: Row[] }>(file);
      for (const row of body.matches ?? []) {
        if (row.canonicalCompetitionId !== G1) continue;
        g1Rows++;
        const hits = CALENDAR.matches.filter((m) =>
          isSameMatch(
            { competitionId: G1, homeTeamId: m.home, awayTeamId: m.away },
            row,
            null,
          ),
        );
        if (hits.length !== 1)
          unpaired.push(
            `${file} ${row.codActa ?? "sen acta"} ${row.canonicalHomeTeamId}–${row.canonicalAwayTeamId} (${hits.length})`,
          );
      }
    }
    expect(unpaired).toEqual([]);
    expect(g1Rows).toBeGreaterThanOrEqual(0);
  });
});

describe("SPEC-091 CA-2 sources", () => {
  it("WOMEN_COMPETITIONS is exactly liga-f and G1", () => {
    expect(WOMEN_COMPETITIONS).toEqual(["liga-f", G1]);
  });

  it("G1 calendar and standings from explorer; 1ª Fed. Fem. stays none/none", () => {
    expect(COMPETITION_SOURCES[G1]).toEqual({
      calendar: "explorer",
      standings: "explorer",
    });
    expect(COMPETITION_SOURCES["primera-federacion-fem"]).toEqual({
      calendar: "none",
      standings: "none",
    });
  });

  it("the xornada never asks explorer for primera-federacion-fem", async () => {
    const calls: string[] = [];
    await fetchWomenXornadaMatches("2026-11-17T12:00:00Z", "2026-27", {
      calendar: async (competition, season) => {
        calls.push(competition);
        return {
          competition,
          season,
          exportedAt: "2026-11-17T00:00:00Z",
          teams: [],
          ignoredRounds: {},
          matches: [],
        };
      },
      dayMatches: async (date) => ({ date, exportedAt: date, matches: [] }),
    });
    expect(calls.sort()).toEqual(["liga-f", G1]);
  });
});

describe("SPEC-091 CA-3 the dateConfirmed contract", () => {
  it.each<[boolean | undefined, boolean, string]>([
    [undefined, true, "exact"],
    [undefined, false, "date"],
    [false, true, "round"],
    [false, false, "round"],
    [true, true, "exact"],
    [true, false, "date"],
  ])(
    "dateConfirmed %s, timeConfirmed %s: %s",
    (dateConfirmed, timeConfirmed, out) => {
      const m: Fixture = {
        externalId: "x",
        round: 1,
        kickoff: "2026-11-29T00:00:00Z",
        home: "a",
        away: "b",
        timeConfirmed,
        ...(dateConfirmed === undefined ? {} : { dateConfirmed }),
      };
      expect(kickoffPrecision(m)).toBe(out);
    },
  );

  it("the capture says it: 175 round, 7 exact", () => {
    const counts = new Map<string, number>();
    for (const m of CALENDAR.matches) {
      const p = kickoffPrecision(m);
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({ round: 175, exact: 7 });
  });
});

// ---- the xornada with the real calendar --------------------------------

const SAT = "2026-11-21";
const SUN = "2026-11-22";
const NOW_SAT = "2026-11-21T15:30:00Z"; // 16:30 in Madrid
const J10 = (home: string) => {
  const m = CALENDAR.matches.find((x) => x.round === 10 && x.home === home);
  if (!m) throw new Error(home);
  return m;
};

// Synthetic rows (no real G1 row exists yet, ledger): the contract of
// ADR-023 §4 with the canonical ids of the calendar.
const g1Row = (fx: Fixture, extra: Partial<Row> = {}): Row => ({
  codActa: `acta-${fx.home}`,
  canonicalCompetitionId: G1,
  canonicalHomeTeamId: fx.home,
  canonicalAwayTeamId: fx.away,
  estado: "FINISHED",
  homeScore: 2,
  awayScore: 0,
  lastSeenAt: at(fx.kickoff, 110),
  ...extra,
});

function explorerOf(
  days: Record<string, () => Promise<DayMatchesResponse>>,
  calendars: Record<string, Fixture[]> = { [G1]: CALENDAR.matches },
): WomenExplorer {
  return {
    calendar: async (competition, season) => ({
      ...(competition === G1 ? CALENDAR : {}),
      competition,
      season,
      exportedAt: "2026-11-17T12:20:34Z",
      teams: competition === G1 ? CALENDAR.teams : [],
      ignoredRounds: {},
      matches: calendars[competition] ?? [],
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
  exportedAt: `${date}T15:00:00Z`,
  matches,
});

const byId = (matches: PublicMatch[]) =>
  new Map(matches.map((m) => [m.matchId as string, m]));

const EIBAR = J10("eibar-femenino-b"); // 11:00Z sat
const VICTORIA = J10("victoria"); // 15:00Z sat
const MADRID = J10("madrid-cff-b"); // 15:00Z sat
const SPORTING = J10("sporting-gijon-femenino"); // 15:00Z sat
const AVILES = J10("real-aviles-industrial"); // 16:15Z sat
const DEPOR_B = J10("depor-abanca-b"); // 11:00Z sun
const RACING = J10("racing-santander-femenino"); // 11:00Z sun

const SAT_ROWS = [
  g1Row(EIBAR, { lastSeenAt: at(EIBAR.kickoff, 110) }),
  g1Row(VICTORIA, {
    estado: "LIVE_PROVISIONAL",
    homeScore: 1,
    awayScore: 1,
    minute: 28,
    lastSeenAt: at(VICTORIA.kickoff, 29),
  }),
  g1Row(SPORTING, { estado: "SCHEDULED", homeScore: null, awayScore: null }),
];

describe("SPEC-091 CA-4 the G1 xornada with the guarantees", () => {
  it("the active round J10: names of CA-8 and the state of each row", async () => {
    const matches = await fetchWomenXornadaMatches(
      NOW_SAT,
      "2026-27",
      explorerOf({ [SAT]: day(SAT, SAT_ROWS), [SUN]: day(SUN, []) }),
    );
    const ids = byId(matches);
    expect(matches.every((m) => m.competitionId === G1)).toBe(true);
    expect(matches.every((m) => m.round === 10)).toBe(true);
    expect(ids.get(EIBAR.externalId)).toMatchObject({
      status: "finished",
      score: { home: 2, away: 0 },
      home: { name: "SD Eibar B", shortName: "Eibar B" },
    });
    expect(ids.get(VICTORIA.externalId)).toMatchObject({
      status: "live",
      score: { home: 1, away: 1 },
      minute: 28,
      home: { name: "Victoria CF", shortName: "Victoria" },
      away: { name: "Real Oviedo Femenino", shortName: "Oviedo" },
    });
    // No row past kickoff + 10 min, and a SCHEDULED row past it: out.
    expect(ids.has(MADRID.externalId)).toBe(false);
    expect(ids.has(SPORTING.externalId)).toBe(false);
    for (const fx of [AVILES, DEPOR_B, RACING])
      expect(ids.get(fx.externalId)?.status).toBe("scheduled");
    expect(ids.get(DEPOR_B.externalId)?.home).toEqual({
      name: "Deportivo ABANCA B",
      shortName: "Depor ABANCA B",
    });
    for (const m of matches) {
      for (const side of [m.home, m.away]) {
        expect(G1_IDS).not.toContain(side.name);
        expect(G1_IDS).not.toContain(side.shortName);
      }
      expect(PublicMatch.safeParse(m).success).toBe(true);
      // J10 is dated: exact, no precision field.
      expect(m).not.toHaveProperty("kickoffPrecision");
    }
  });

  it("SPEC-086 CA-1: an unreadable saturday, nothing of saturday; sunday scheduled", async () => {
    const { error } = quiet();
    const matches = await fetchWomenXornadaMatches(
      NOW_SAT,
      "2026-27",
      explorerOf({
        [SAT]: async () => {
          throw new Error("explorer down");
        },
        [SUN]: day(SUN, []),
      }),
    );
    expect(matches.map((m) => m.matchId).sort()).toEqual(
      [DEPOR_B.externalId, RACING.externalId].sort(),
    );
    expect(matches.every((m) => m.status === "scheduled")).toBe(true);
    expect(error.mock.calls.map((c) => c.join(" ")).join("\n")).toContain(SAT);
    vi.restoreAllMocks();
  });

  it("SPEC-086 CA-2: a finished G1 row without score does not come out", async () => {
    const matches = await fetchWomenXornadaMatches(
      NOW_SAT,
      "2026-27",
      explorerOf({
        [SAT]: day(SAT, [g1Row(EIBAR, { homeScore: null, awayScore: null })]),
      }),
    );
    expect(byId(matches).has(EIBAR.externalId)).toBe(false);
  });

  it("SPEC-086 CA-5: one bad G1 match does not take the rest down", async () => {
    const { warn } = quiet();
    const bad = { ...AVILES, kickoff: "2026-11-21 17:15", externalId: "bad" };
    const j10 = CALENDAR.matches.filter((m) => m.round === 10);
    const matches = await fetchWomenXornadaMatches(
      NOW_SAT,
      "2026-27",
      explorerOf(
        { [SAT]: day(SAT, SAT_ROWS) },
        { [G1]: [...j10.filter((m) => m !== AVILES), bad] },
      ),
    );
    const ids = byId(matches);
    expect(ids.has("bad")).toBe(false);
    expect(ids.get(EIBAR.externalId)?.status).toBe("finished");
    expect(ids.get(DEPOR_B.externalId)?.status).toBe("scheduled");
    expect(warn.mock.calls.map((c) => c.join(" ")).join("\n")).toContain("bad");
    vi.restoreAllMocks();
  });

  it.each<[string, string, boolean]>([
    ["SPEC-088 CA-2 K+9min", at(AVILES.kickoff, 9), true],
    ["SPEC-088 CA-2 K+10min", at(AVILES.kickoff, 10), false],
  ])("%s without a row: comes out = %s", async (_, now, out) => {
    const matches = await fetchWomenXornadaMatches(
      now,
      "2026-27",
      explorerOf({}),
    );
    expect(byId(matches).has(AVILES.externalId)).toBe(out);
  });

  it.each<[string, boolean]>([
    ["2026-11-21T10:00:00Z", true],
    ["2026-11-22T22:30:00Z", true], // 23:30 in Madrid
    ["2026-11-22T23:30:00Z", false], // 00:30 of the 23rd in Madrid
  ])(
    "SPEC-088 CA-3 a G1 match with an unconfirmed time, now %s: comes out = %s",
    async (now, out) => {
      const tbd = {
        ...DEPOR_B,
        kickoff: "2026-11-22T00:00:00Z",
        timeConfirmed: false,
      };
      const matches = await fetchWomenXornadaMatches(
        now,
        "2026-27",
        explorerOf({}, { [G1]: [tbd] }),
      );
      expect(matches.map((m) => m.status)).toEqual(out ? ["scheduled"] : []);
    },
  );
});

describe("SPEC-091 CA-5 round precision in the xornada", () => {
  const NOMINAL = "2026-11-29T00:00:00Z";
  const ROUND: Fixture = {
    externalId: "2026-27-2fed-fem-j11-depor-abanca-b-victoria",
    round: 11,
    kickoff: NOMINAL,
    home: "depor-abanca-b",
    away: "victoria",
    timeConfirmed: false,
    dateConfirmed: false,
  };
  const run = (
    now: string,
    days: Record<string, () => Promise<DayMatchesResponse>> = {},
  ) =>
    fetchWomenXornadaMatches(
      now,
      "2026-27",
      explorerOf(days, { [G1]: [ROUND] }),
    );

  it("no row, before the nominal day: scheduled with kickoffPrecision round", async () => {
    const [m, ...rest] = await run("2026-11-27T10:00:00Z");
    expect(rest).toEqual([]);
    expect(m).toMatchObject({
      status: "scheduled",
      kickoffPrecision: "round",
      round: 11,
    });
  });

  it("a LIVE row of today (saturday) while the nominal is sunday: live", async () => {
    const now = "2026-11-28T11:30:00Z";
    const asked: string[] = [];
    const rows = [
      g1Row(ROUND, {
        estado: "LIVE_PROVISIONAL",
        homeScore: 1,
        awayScore: 0,
        minute: 20,
        horaTexto: "12:00",
        lastSeenAt: "2026-11-28T11:21:00Z",
      }),
    ];
    const matches = await fetchWomenXornadaMatches(now, "2026-27", {
      ...explorerOf({}, { [G1]: [ROUND] }),
      dayMatches: async (date) => {
        asked.push(date);
        return {
          date,
          exportedAt: now,
          matches: date === "2026-11-28" ? rows : [],
        };
      },
    });
    expect(asked).toContain("2026-11-28");
    expect(asked).toContain("2026-11-29");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      status: "live",
      score: { home: 1, away: 0 },
      kickoffPrecision: "round",
    });
  });

  it("no row, past the nominal Madrid day: does not come out", async () => {
    expect(await run("2026-11-29T23:30:00Z")).toEqual([]);
  });

  it("an unreadable today: the round match does not come out", async () => {
    const { error } = quiet();
    const matches = await run("2026-11-28T11:30:00Z", {
      "2026-11-28": async () => {
        throw new Error("down");
      },
    });
    expect(matches).toEqual([]);
    expect(error).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("SPEC-091 CA-6 date precision in the xornada", () => {
  it.each([G1, "liga-f"])(
    "%s: a scheduled match with an unconfirmed time carries kickoffPrecision date",
    async (comp) => {
      const fx: Fixture = {
        externalId: `${comp}-tbd`,
        round: 10,
        kickoff: "2026-11-22T00:00:00Z",
        home: comp === G1 ? "depor-abanca-b" : "depor-abanca",
        away: comp === G1 ? "victoria" : "valencia-cf",
        timeConfirmed: false,
      };
      const [m] = await fetchWomenXornadaMatches(
        "2026-11-21T10:00:00Z",
        "2026-27",
        explorerOf({}, { [comp]: [fx] }),
      );
      expect(m).toMatchObject({
        status: "scheduled",
        kickoffPrecision: "date",
      });
    },
  );
});

describe("SPEC-091 CA-8 visible identity", () => {
  it("the 14 ids resolve to a name and a shortName other than the id", () => {
    for (const id of G1_IDS) {
      const names = resolveTeamNames(id);
      expect(names.name, id).not.toBe(id);
      expect(names.shortName, id).not.toBe(id);
    }
  });

  it("filiales do not collapse: depor-abanca-b is not depor-abanca", () => {
    expect(resolveTeamNames("depor-abanca-b").name).not.toBe(
      resolveTeamNames("depor-abanca").name,
    );
    expect(resolveTeamNames("depor-abanca-b").shortName).not.toBe(
      resolveTeamNames("depor-abanca").shortName,
    );
  });

  it("as-celtas, depor-abanca-b and victoria are Galician clubs of G1", () => {
    for (const id of ["as-celtas", "depor-abanca-b", "victoria"]) {
      expect(isGalicianClub(id), id).toBe(true);
      expect(getGalicianClub(id)?.competitionId, id).toBe(G1);
      expect(getGalicianClub(id)?.gender, id).toBe("femenino");
    }
    expect(getGalicianClub("victoria")).toMatchObject({
      name: "Victoria CF",
      city: "A Coruña",
    });
    expect(isGalicianClub("arratia")).toBe(false);
  });

  it("a G1 row of depor-abanca-b never pairs with a liga-f match of depor-abanca, nor the reverse", async () => {
    const NOW = "2026-11-22T11:30:00Z";
    const ligaF: Fixture = {
      externalId: "liga-f-2026-27-j10-depor-abanca-bizkerre-club",
      round: 10,
      kickoff: DEPOR_B.kickoff,
      home: "depor-abanca",
      away: "bizkerre-club",
      timeConfirmed: true,
    };
    const g1Only = { ...DEPOR_B };
    const ligaFRow: Row = {
      ...g1Row(g1Only),
      codActa: "lf",
      canonicalCompetitionId: "liga-f",
      canonicalHomeTeamId: "depor-abanca",
      estado: "LIVE_PROVISIONAL",
      homeScore: 3,
      awayScore: 0,
      minute: 25,
      lastSeenAt: at(DEPOR_B.kickoff, 25),
    };
    const g1LiveRow: Row = {
      ...g1Row(g1Only),
      estado: "LIVE_PROVISIONAL",
      homeScore: 0,
      awayScore: 1,
      minute: 25,
      lastSeenAt: at(DEPOR_B.kickoff, 25),
    };
    const ids = byId(
      await fetchWomenXornadaMatches(
        NOW,
        "2026-27",
        explorerOf(
          { [SUN]: day(SUN, [ligaFRow, g1LiveRow]) },
          { [G1]: [g1Only], "liga-f": [ligaF] },
        ),
      ),
    );
    expect(ids.get(DEPOR_B.externalId)?.score).toEqual({ home: 0, away: 1 });
    expect(ids.get(ligaF.externalId)?.score).toEqual({ home: 3, away: 0 });
  });
});

describe("SPEC-091 CA-10 no regression", () => {
  it("a liga-f match without dateConfirmed and a confirmed time: no precision field", async () => {
    const fx: Fixture = {
      externalId: "lf",
      round: 10,
      kickoff: "2026-11-22T11:00:00Z",
      home: "depor-abanca",
      away: "valencia-cf",
      timeConfirmed: true,
    };
    const [m] = await fetchWomenXornadaMatches(
      "2026-11-21T10:00:00Z",
      "2026-27",
      explorerOf({}, { "liga-f": [fx] }),
    );
    expect(m).toEqual({
      status: "scheduled",
      score: null,
      minute: null,
      matchId: "lf",
      competitionId: "liga-f",
      competitionName: expect.any(String),
      tier: expect.any(Number),
      round: 10,
      kickoff: "2026-11-22T11:00:00Z",
      home: { name: "Deportivo ABANCA", shortName: "Depor ABANCA" },
      away: { name: "Valencia CF", shortName: "Valencia" },
      qualifier: "confirmado",
      version: 0,
      observedAt: null,
      decidedAt: null,
      homeScoredAt: null,
      awayScoredAt: null,
    });
  });

  it("SPEC-086 CA-7: with G1 inside, the same answers 30 s apart give the same boardEtag", async () => {
    const explorer = explorerOf({ [SAT]: day(SAT, SAT_ROWS) });
    const first = await fetchWomenXornadaMatches(NOW_SAT, "2026-27", explorer);
    const second = await fetchWomenXornadaMatches(
      at(NOW_SAT, 0.5),
      "2026-27",
      explorer,
    );
    expect(first.some((m) => m.competitionId === G1)).toBe(true);
    expect(second).toEqual(first);
    expect(boardEtag(second)).toBe(boardEtag(first));
  });
});
