import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rfefAliasesOrNull } from "../ingest/aliases.ts";
import { type MatchToSync, planDaySync } from "../ingest/historico.ts";
import type {
  AliasFile,
  CompetitionId,
  Instant,
  MatchId,
  PublicMatch,
} from "../model/index.ts";
import type { DayMatchesResponse } from "./explorer-client.ts";
import { enrichMatchesWithGoals, isMatchEqual } from "./explorer-enrichment.ts";

// SPEC-070: a row of the export and a local match are the same only by
// identity (competition by codGrupo or canonicalCompetitionId, each side by
// alias or by a canonical*TeamId equal to the id), never by similar names.

const root = path.resolve(__dirname, "../..");
const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(path.join(root, rel), "utf8"));

// The alias the way the web routes and historico:sync get it (CA-11): the
// traced file data/alias/2026-27/rfef.json.
const aliases = rfefAliasesOrNull("2026-27") as AliasFile;
type Row = DayMatchesResponse["matches"][number];
const export1108 = readJson(
  "src/sources/rfef/fixtures/export/export-2026-11-08-emparejamiento.json",
) as DayMatchesResponse;
const rowByActa = (acta: string): Row => {
  const row = export1108.matches.find((m) => m.codActa === acta);
  if (!row) throw new Error(`no row ${acta} in the fixture`);
  return row;
};
const juvenil = rowByActa("70692248");
const sportingValladolid = rowByActa("70695047");

const SEGUNDA = "33836087";

function publicMatch(
  competitionId: string,
  round: number,
  home: string,
  away: string,
  kickoff: string,
  names: [string, string],
  score: { home: number; away: number } = { home: 1, away: 0 },
): PublicMatch {
  return {
    matchId: `${competitionId}-2026-27-j${round}-${home}-${away}` as MatchId,
    competitionId: competitionId as CompetitionId,
    competitionName: competitionId,
    tier: 2,
    round,
    kickoff: kickoff as Instant,
    home: { name: names[0], shortName: null },
    away: { name: names[1], shortName: null },
    status: "finished",
    score,
    minute: null,
    qualifier: "confirmado",
    version: 1,
    observedAt: kickoff as Instant,
    decidedAt: kickoff as Instant,
    homeScoredAt: null,
    awayScoredAt: null,
  } as PublicMatch;
}

function localMatch(pm: PublicMatch, home: string, away: string): MatchToSync {
  return {
    matchId: pm.matchId,
    competitionId: pm.competitionId,
    round: pm.round,
    kickoff: pm.kickoff,
    homeTeamId: home,
    awayTeamId: away,
    homeName: pm.home.name,
    homeShortName: null,
    awayName: pm.away.name,
    awayShortName: null,
    status: "scheduled",
    score: null,
    goals: [],
  };
}

const fetcherOf = (rows: Row[]) =>
  vi.fn(async (date: string) => ({
    date,
    exportedAt: `${date}T23:00:00.000Z`,
    matches: rows,
  }));

const goal = (team: "home" | "away", player: string, minute: number) => ({
  team,
  player,
  minute,
});

const sportingPm = publicMatch(
  "segunda-division",
  13,
  "sporting",
  "valladolid",
  "2026-11-08T17:30:00.000Z",
  ["Real Sporting de Gijón", "Real Valladolid CF"],
  { home: 1, away: 2 },
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SPEC-070 CA-1 the real case of 2026-11-08", () => {
  it("the juvenil 0-0 is not Sporting–Valladolid; acta 70695047 is", () => {
    expect(isMatchEqual(sportingPm, juvenil, aliases)).toBe(false);
    expect(isMatchEqual(sportingPm, sportingValladolid, aliases)).toBe(true);
  });

  it("planDaySync plans 1-2 with 3 goals, whatever the order of the rows", () => {
    const lm = localMatch(sportingPm, "sporting", "valladolid");
    for (const rows of [
      [juvenil, sportingValladolid],
      [sportingValladolid, juvenil],
    ]) {
      const [plan] = planDaySync("2026-11-08", [lm], rows, aliases);
      if (plan?.kind !== "finished") throw new Error(`plan ${plan?.kind}`);
      expect(plan.row.codActa).toBe("70695047");
      expect(plan.score).toEqual({ home: 1, away: 2 });
      expect(plan.goals).toHaveLength(3);
    }
  });

  it("the enrichment gives Sporting–Valladolid the 3 goals of acta 70695047", async () => {
    const [enriched] = await enrichMatchesWithGoals(
      [sportingPm],
      fetcherOf([juvenil, sportingValladolid]),
      aliases,
    );
    expect(enriched?.goals).toEqual([
      goal("away", "Julien Ponceau", 4),
      goal("away", "Tai Abed", 39),
      goal("home", "Guillermo Rosas", 83),
    ]);
  });
});

describe("SPEC-070 CA-2 two «Real» of Segunda the same day", () => {
  const oviedoPm = publicMatch(
    "segunda-division",
    13,
    "oviedo",
    "granada",
    "2026-11-08T15:00:00.000Z",
    ["Real Oviedo", "Granada CF"],
    { home: 2, away: 1 },
  );
  const realSocPm = publicMatch(
    "segunda-division",
    13,
    "real-sociedad-b",
    "castellon",
    "2026-11-08T15:00:00.000Z",
    ["Real Sociedad B", "CD Castellón"],
    { home: 0, away: 1 },
  );
  const oviedoRow: Row = {
    codActa: "1",
    codGrupo: SEGUNDA,
    horaTexto: "16:00",
    equipoLocal: "Real Oviedo",
    equipoVisitante: "Granada CF",
    golesLocal: 2,
    golesVisitante: 1,
    estado: "FINISHED",
    goals: [
      goal("home", "Oviedo A", 10),
      goal("away", "Granada A", 20),
      goal("home", "Oviedo B", 30),
    ],
  };
  const realSocRow: Row = {
    codActa: "2",
    codGrupo: SEGUNDA,
    horaTexto: "16:00",
    equipoLocal: "Real Sociedad B",
    equipoVisitante: "CD Castellón",
    golesLocal: 0,
    golesVisitante: 1,
    estado: "FINISHED",
    goals: [goal("away", "Castellón A", 50)],
  };

  it("isMatchEqual pairs each match with its row and never with the other", () => {
    expect(isMatchEqual(oviedoPm, oviedoRow, aliases)).toBe(true);
    expect(isMatchEqual(oviedoPm, realSocRow, aliases)).toBe(false);
    expect(isMatchEqual(realSocPm, realSocRow, aliases)).toBe(true);
    expect(isMatchEqual(realSocPm, oviedoRow, aliases)).toBe(false);
  });

  it("planDaySync pairs each with its own row", () => {
    const plan = planDaySync(
      "2026-11-08",
      [
        localMatch(oviedoPm, "oviedo", "granada"),
        localMatch(realSocPm, "real-sociedad-b", "castellon"),
      ],
      [realSocRow, oviedoRow],
      aliases,
    );
    expect(
      plan.map((p) => [
        p.match.matchId,
        p.kind === "finished" || p.kind === "not-finished"
          ? p.row.codActa
          : p.kind,
      ]),
    ).toEqual([
      [oviedoPm.matchId, "1"],
      [realSocPm.matchId, "2"],
    ]);
  });

  it("enrichMatchesWithGoals gives each its own goals", async () => {
    const [oviedo, realSoc] = await enrichMatchesWithGoals(
      [oviedoPm, realSocPm],
      fetcherOf([realSocRow, oviedoRow]),
      aliases,
    );
    expect(oviedo?.goals?.map((g) => g.player)).toEqual([
      "Oviedo A",
      "Granada A",
      "Oviedo B",
    ]);
    expect(realSoc?.goals?.map((g) => g.player)).toEqual(["Castellón A"]);
  });
});

describe("SPEC-070 CA-3 canonical ids of another match", () => {
  it("names alike, alias resolving to other ids: not the same match", () => {
    // The day has Real Sociedad–Rayo (Primera) and Real Sociedad B–Castellón
    // (Segunda). The row is of Primera and its canonical ids are those of
    // the other match; its names look like the evaluated one, but the alias
    // says Real Sociedad B and Castellón.
    const evaluated = publicMatch(
      "primera-division",
      12,
      "real-sociedad",
      "rayo-vallecano",
      "2026-11-08T15:15:00.000Z",
      ["Real Sociedad de Fútbol", "Rayo Vallecano de Madrid"],
    );
    const row: Row = {
      codActa: "3",
      codGrupo: "33836085",
      horaTexto: "16:15",
      equipoLocal: "Real Sociedad B",
      equipoVisitante: "CD Castellón",
      canonicalCompetitionId: "primera-division",
      canonicalHomeTeamId: "real-sociedad-b",
      canonicalAwayTeamId: "castellon",
      golesLocal: 1,
      golesVisitante: 0,
      estado: "FINISHED",
    };
    expect(isMatchEqual(evaluated, row, aliases)).toBe(false);
  });

  it("an alias resolving to another id discards even with equal canonical ids", () => {
    const row: Row = {
      ...sportingValladolid,
      equipoLocal: "Real Oviedo",
      canonicalHomeTeamId: "sporting",
    };
    expect(isMatchEqual(sportingPm, row, aliases)).toBe(false);
  });

  it("a canonical id that differs does not discard when the alias resolves", () => {
    // sporting-gijon is not an id of public.teams: the alias decides.
    expect(sportingValladolid.canonicalHomeTeamId).toBe("sporting-gijon");
    expect(isMatchEqual(sportingPm, sportingValladolid, aliases)).toBe(true);
  });

  it("an exact canonical id pairs a side the alias does not know", () => {
    const row: Row = {
      ...sportingValladolid,
      equipoLocal: "Nombre que ningún alias tiene",
      canonicalHomeTeamId: "sporting",
    };
    expect(isMatchEqual(sportingPm, row, aliases)).toBe(true);
    // never a substring of the match id
    expect(
      isMatchEqual(
        sportingPm,
        { ...row, canonicalHomeTeamId: "sport" },
        aliases,
      ),
    ).toBe(false);
  });
});

describe("SPEC-070 CA-4 a row without competition", () => {
  it("no canonicalCompetitionId and a codGrupo out of the map: false", () => {
    const row: Row = {
      ...sportingValladolid,
      codGrupo: "33836117",
      canonicalCompetitionId: undefined,
    };
    expect(row.equipoLocal).toBe("Real Sporting de Gijón");
    expect(isMatchEqual(sportingPm, row, aliases)).toBe(false);
  });

  it("without alias file: canonicalCompetitionId is the only way in", () => {
    // The web fallback (CA-11): no codGrupo map, competition only from
    // canonicalCompetitionId, teams only by canonical ids equal to the ids.
    const row: Row = {
      ...sportingValladolid,
      canonicalCompetitionId: undefined,
      canonicalHomeTeamId: "sporting",
    };
    expect(isMatchEqual(sportingPm, row, null)).toBe(false);
    expect(
      isMatchEqual(
        sportingPm,
        { ...row, canonicalCompetitionId: "segunda-division" },
        null,
      ),
    ).toBe(true);
  });
});

describe("SPEC-070 CA-5 ambiguity", () => {
  const twin: Row = {
    ...sportingValladolid,
    codActa: "99999999",
    golesLocal: 0,
    golesVisitante: 0,
    goals: [goal("home", "Otro", 1)],
  };

  it("planDaySync does not pair and reports both candidates", () => {
    const lm = localMatch(sportingPm, "sporting", "valladolid");
    const plan = planDaySync(
      "2026-11-08",
      [lm],
      [sportingValladolid, twin],
      aliases,
    );
    expect(plan).toEqual([
      {
        kind: "ambiguous",
        match: lm,
        candidates: [
          {
            codActa: "70695047",
            home: "Real Sporting de Gijón",
            away: "Real Valladolid CF",
          },
          {
            codActa: "99999999",
            home: "Real Sporting de Gijón",
            away: "Real Valladolid CF",
          },
        ],
      },
    ]);
  });

  it("enrichMatchesWithGoals adds no goals and warns with the candidates", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [enriched] = await enrichMatchesWithGoals(
      [sportingPm],
      fetcherOf([sportingValladolid, twin]),
      aliases,
    );
    expect(enriched?.goals).toBeUndefined();
    const text = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(text).toContain(sportingPm.matchId);
    expect(text).toContain("70695047");
    expect(text).toContain("99999999");
  });

  it("the tie-break: exactly one candidate at the Madrid kickoff hour", async () => {
    const early: Row = { ...twin, horaTexto: "12:00" };
    const lm = localMatch(sportingPm, "sporting", "valladolid");
    const plan = planDaySync(
      "2026-11-08",
      [lm],
      [early, sportingValladolid],
      aliases,
    );
    expect(plan.map((p) => p.kind)).toEqual(["finished"]);
    const [paired] = plan;
    if (paired?.kind !== "finished") throw new Error("unreachable");
    expect(paired.row.codActa).toBe("70695047");

    const [enriched] = await enrichMatchesWithGoals(
      [sportingPm],
      fetcherOf([early, sportingValladolid]),
      aliases,
    );
    expect(enriched?.goals).toHaveLength(3);
  });
});

describe("SPEC-070 CA-10 no approximate names", () => {
  it("names almost letter for letter, not in the alias, no equal ids: false", () => {
    const home = "Real Sporting de Gijon"; // without the accent
    const away = "Real Valladolid C.F.";
    const known = new Set(aliases.teams.map((t) => t.externalId));
    expect(known.has(home.toLowerCase())).toBe(false);
    expect(known.has(away.toLowerCase())).toBe(false);
    const row: Row = {
      ...sportingValladolid,
      equipoLocal: home,
      equipoVisitante: away,
    };
    expect(isMatchEqual(sportingPm, row, aliases)).toBe(false);
  });
});
