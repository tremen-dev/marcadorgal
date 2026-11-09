import { readFileSync } from "node:fs";
import path from "node:path";
import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import type { DayMatchesResponse } from "../lib/explorer-client.ts";
import { AliasFile, type Instant } from "../model/index.ts";
import type { IngestDb } from "./db.ts";
import {
  completeGoals,
  formatHistoricoReport,
  type HistoricoReport,
  historicoFailed,
  isAuthFailure,
  type MatchPlan,
  type MatchToSync,
  parseExplorerDay,
  parseHistoricoArgs,
  planDaySync,
  SEASON_START,
} from "./historico.ts";
import { historicoSync } from "./historico-db.ts";

// 2026-11-09 at 00:30 in Europe/Madrid is still 2026-11-08 in UTC: "today"
// is the Madrid date (ADR-031 §1), so yesterday is 2026-11-08.
const NOW = "2026-11-08T23:30:00.000Z" as Instant;

describe("SPEC-060 CA-2 parseHistoricoArgs", () => {
  it("defaults to SEASON_START .. yesterday in Europe/Madrid", () => {
    expect(parseHistoricoArgs([], NOW)).toEqual({
      desde: SEASON_START,
      hasta: "2026-11-08",
      dryRun: false,
    });
    expect(SEASON_START).toBe("2026-08-14");
  });

  it("parses explicit --desde, --hasta and --dry-run", () => {
    expect(
      parseHistoricoArgs(
        ["--desde", "2026-09-01", "--hasta", "2026-09-15", "--dry-run"],
        NOW,
      ),
    ).toEqual({ desde: "2026-09-01", hasta: "2026-09-15", dryRun: true });
  });

  it("rejects a --hasta of today or later (Europe/Madrid)", () => {
    expect(() => parseHistoricoArgs(["--hasta", "2026-11-09"], NOW)).toThrow(
      /--hasta/,
    );
    expect(() => parseHistoricoArgs(["--hasta", "2026-12-01"], NOW)).toThrow(
      /--hasta/,
    );
  });

  it("rejects invalid dates, a reversed range and unknown arguments", () => {
    expect(() => parseHistoricoArgs(["--desde", "x"], NOW)).toThrow(/--desde/);
    expect(() =>
      parseHistoricoArgs(
        ["--desde", "2026-10-02", "--hasta", "2026-10-01"],
        NOW,
      ),
    ).toThrow(/--desde/);
    expect(() => parseHistoricoArgs(["--force"], NOW)).toThrow(/--force/);
  });
});

describe("SPEC-060 CA-5 parseExplorerDay and isAuthFailure", () => {
  it("accepts a 200 with a matches array", () => {
    const day = parseExplorerDay({
      status: 200,
      body: JSON.stringify({
        date: "2026-08-15",
        exportedAt: "x",
        matches: [],
      }),
    });
    expect(day.matches).toEqual([]);
  });

  it("throws on a non-2xx status, unreadable JSON or no matches array", () => {
    expect(() => parseExplorerDay({ status: 500, body: "{}" })).toThrow(/500/);
    expect(() => parseExplorerDay({ status: 200, body: "<html>" })).toThrow(
      /inválida/,
    );
    expect(() =>
      parseExplorerDay({ status: 200, body: JSON.stringify({ date: "x" }) }),
    ).toThrow(/inválida/);
  });

  it("401 and 403 abort the run, the rest do not", () => {
    expect(isAuthFailure(401)).toBe(true);
    expect(isAuthFailure(403)).toBe(true);
    expect(isAuthFailure(500)).toBe(false);
    expect(isAuthFailure(200)).toBe(false);
  });
});

const local = (overrides: Partial<MatchToSync> = {}): MatchToSync => ({
  matchId: "primera-division-2026-27-j1-celta-osasuna",
  competitionId: "primera-division",
  round: 1,
  kickoff: "2026-08-15T19:00:00.000Z",
  homeTeamId: "celta",
  awayTeamId: "osasuna",
  homeName: "Celta de Vigo",
  homeShortName: "Celta",
  awayName: "Osasuna",
  awayShortName: null,
  status: "finished",
  score: { home: 1, away: 1 },
  goals: [],
  ...overrides,
});

type ExplorerMatch = DayMatchesResponse["matches"][number];
const explorer = (overrides: Partial<ExplorerMatch> = {}): ExplorerMatch => ({
  canonicalCompetitionId: "primera-division",
  canonicalHomeTeamId: "celta",
  canonicalAwayTeamId: "osasuna",
  homeTeam: "Celta de Vigo",
  awayTeam: "Osasuna",
  homeScore: 2,
  awayScore: 1,
  estado: "FINISHED",
  goals: [
    { team: "home", player: "Aspas", minute: 23 },
    { team: "away", player: "Budimir", minute: 60 },
    { team: "home", player: "Swedberg", minute: 85 },
  ],
  ...overrides,
});

// The plan of the export of 2026-08-15 alone (no alias: the competition and
// the teams come from the canonical ids).
const plan15 = (
  locals: readonly MatchToSync[],
  rows: readonly ExplorerMatch[],
) => planDaySync("2026-08-15", locals, rows);

describe("SPEC-060 CA-3 completeGoals", () => {
  it("is complete only when the valid goals of each team add up to its score", () => {
    const goals = [
      { team: "home" as const, player: "A", minute: 1 },
      { team: "away" as const, player: "B", minute: 2 },
    ];
    expect(completeGoals(goals, { home: 1, away: 1 })).toBe(true);
    expect(completeGoals(goals, { home: 2, away: 1 })).toBe(false);
    expect(completeGoals([], { home: 0, away: 0 })).toBe(true);
    expect(completeGoals([], { home: 1, away: 0 })).toBe(false);
  });
});

describe("SPEC-060 CA-2 CA-3 planDaySync", () => {
  it("corrects a finished 1-1 that Explorer gives FINISHED 2-1 and replaces the goals", () => {
    const [plan] = plan15([local()], [explorer()]);
    expect(plan).toMatchObject({
      kind: "finished",
      score: { home: 2, away: 1 },
      correct: true,
      goalsComplete: true,
      replaceGoals: true,
    });
    if (plan.kind !== "finished") throw new Error("unreachable");
    expect(plan.goals.map((g) => g.player)).toEqual([
      "Aspas",
      "Budimir",
      "Swedberg",
    ]);
  });

  it("corrects a match with no Decision (scheduled, no score)", () => {
    const [plan] = plan15(
      [local({ status: "scheduled", score: null })],
      [explorer()],
    );
    expect(plan).toMatchObject({ kind: "finished", correct: true });
  });

  it("writes nothing when the current is finished with the same score and the same goals", () => {
    const same = plan15(
      [
        local({
          score: { home: 2, away: 1 },
          goals: [
            { team: "home", player: "Aspas", minute: 23 },
            { team: "away", player: "Budimir", minute: 60 },
            { team: "home", player: "Swedberg", minute: 85 },
          ],
        }),
      ],
      [explorer()],
    );
    expect(same[0]).toMatchObject({
      kind: "finished",
      correct: false,
      replaceGoals: false,
    });
  });

  it("does not touch the goals when Explorer is not FINISHED (LIVE_PROVISIONAL, goals: [])", () => {
    const stored = [{ team: "home" as const, player: "Aspas", minute: 23 }];
    const [plan] = plan15(
      [local({ goals: stored })],
      [explorer({ estado: "LIVE_PROVISIONAL", goals: [] })],
    );
    expect(plan).toMatchObject({
      kind: "not-finished",
      estado: "LIVE_PROVISIONAL",
    });
  });

  it("FINISHED 1-0 without goals: corrects the score, leaves the goals, reports them incomplete", () => {
    const stored = [{ team: "home" as const, player: "Aspas", minute: 23 }];
    const [plan] = plan15(
      [local({ score: { home: 0, away: 0 }, goals: stored })],
      [explorer({ homeScore: 1, awayScore: 0, goals: [] })],
    );
    expect(plan).toMatchObject({
      kind: "finished",
      correct: true,
      goalsComplete: false,
      replaceGoals: false,
    });
  });

  it("drops the placeholders of SPEC-059 before counting", () => {
    const [plan] = plan15(
      [local()],
      [
        explorer({
          homeScore: 1,
          awayScore: 0,
          goals: [
            { team: "home", player: "Goleador Local", minute: 10 },
            { team: "away", player: "  ", minute: 20 },
          ],
        }),
      ],
    );
    expect(plan).toMatchObject({ kind: "finished", goalsComplete: false });
  });

  it("reports a declared match Explorer does not bring as unpaired, no_identity", () => {
    const [plan] = plan15(
      [local()],
      [
        explorer({
          canonicalHomeTeamId: "betis",
          canonicalAwayTeamId: "girona",
          homeTeam: "Real Betis",
          awayTeam: "Girona",
        }),
      ],
    );
    expect(plan).toMatchObject({ kind: "unpaired", reason: "no_identity" });
  });
});

describe("SPEC-060 CA-4 CA-5 formatHistoricoReport", () => {
  const report: HistoricoReport = {
    desde: "2026-08-14",
    hasta: "2026-08-16",
    dryRun: true,
    datesProcessed: 2,
    entries: [
      { date: "2026-08-15", plan: plan15([local()], [explorer()])[0] },
      {
        date: "2026-08-15",
        plan: plan15(
          [
            local({
              matchId: "primera-division-2026-27-j1-betis-girona",
              homeTeamId: "betis",
              awayTeamId: "girona",
              homeName: "Real Betis",
              homeShortName: null,
              awayName: "Girona",
              status: "scheduled",
              score: null,
            }),
          ],
          [
            explorer({
              canonicalHomeTeamId: "betis",
              canonicalAwayTeamId: "girona",
              homeTeam: "Real Betis",
              awayTeam: "Girona",
              estado: "POSTPONED",
              homeScore: null,
              awayScore: null,
            }),
          ],
        )[0],
      },
      {
        date: "2026-08-16",
        plan: planDaySync(
          "2026-08-16",
          [
            local({
              matchId: "segunda-division-2026-27-j1-deportivo-leganes",
              kickoff: "2026-08-16T17:00:00.000Z",
              competitionId: "segunda-division",
              homeTeamId: "deportivo",
              awayTeamId: "leganes",
              homeName: "Deportivo",
              homeShortName: null,
              awayName: "Leganés",
              status: "live",
              score: { home: 0, away: 0 },
            }),
          ],
          [
            explorer({
              canonicalCompetitionId: "segunda-division",
              canonicalHomeTeamId: "deportivo",
              canonicalAwayTeamId: "leganes",
              homeTeam: "Deportivo",
              awayTeam: "Leganés",
              homeScore: 1,
              awayScore: 0,
              goals: [],
            }),
          ],
        )[0],
      },
      {
        date: "2026-08-16",
        plan: {
          kind: "unpaired",
          reason: "no_competition_rows",
          match: local({
            matchId: "primera-division-2026-27-j1-sevilla-cadiz",
            homeTeamId: "sevilla",
            awayTeamId: "cadiz",
            homeName: "Sevilla",
            homeShortName: null,
            awayName: "Cádiz",
          }),
        },
      },
    ],
    failed: [{ date: "2026-08-14", error: "[explorer] respuesta 500" }],
    aborted: null,
  };

  it("prints one line per match with a change, then the lists and the totals", () => {
    const lines = formatHistoricoReport(report);
    expect(lines).toContain(
      "2026-08-15 · primera-division · J1 · Celta de Vigo–Osasuna · finished 1-1 → 2-1 · goles 0 → 3",
    );
    expect(lines).toContain(
      "2026-08-16 · segunda-division · J1 · Deportivo–Leganés · live 0-0 → 1-0 · goles 0 → 0 (incompletos)",
    );
    // no line of change for the postponed nor for the unmatched one
    expect(lines.filter((l) => l.includes("Betis–Girona ·  "))).toEqual([]);
    expect(lines.filter((l) => l.includes("→") && l.includes("Betis"))).toEqual(
      [],
    );

    const at = (title: string) => lines.indexOf(title);
    expect(lines[at("Sin FINISHED en Explorer (1):") + 1]).toBe(
      "  2026-08-15 · primera-division · J1 · Real Betis–Girona · POSTPONED",
    );
    expect(lines[at("Sin emparejar (1):") + 1]).toBe(
      "  2026-08-16 · primera-division · J1 · Sevilla–Cádiz · no_competition_rows",
    );
    expect(lines[at("Ambiguos (0):") + 1]).toBe("");
    expect(
      lines.slice(
        at("Emparejados (3, 0 en otro día de la ventana ±3):") + 1,
        at("Emparejados (3, 0 en otro día de la ventana ±3):") + 4,
      ),
    ).toEqual([
      "  2026-08-15 · primera-division-2026-27-j1-celta-osasuna · sen acta · Celta de Vigo–Osasuna · 2-1 · 3 goles",
      "  2026-08-15 · primera-division-2026-27-j1-betis-girona · sen acta · Real Betis–Girona · — · 3 goles",
      "  2026-08-16 · segunda-division-2026-27-j1-deportivo-leganes · sen acta · Deportivo–Leganés · 1-0 · 0 goles",
    ]);
    expect(lines[at("Goles incompletos (1):") + 1]).toBe(
      "  2026-08-16 · segunda-division · J1 · Deportivo–Leganés · 1-0 · goles válidos 0",
    );
    expect(lines[at("Por jornada:") + 1]).toBe(
      "  primera-division J1: 1 marcadores · 1 goleadores",
    );
    expect(lines[at("Por jornada:") + 2]).toBe(
      "  segunda-division J1: 1 marcadores · 0 goleadores",
    );
    expect(lines[at("Por competición:") + 1]).toBe(
      "  primera-division: 1 marcadores · 1 goleadores",
    );
    expect(lines[at("Fechas fallidas (1):") + 1]).toBe(
      "  2026-08-14 · [explorer] respuesta 500",
    );
  });

  it("says when the run was aborted", () => {
    const lines = formatHistoricoReport({
      ...report,
      aborted: "2026-08-14: [explorer] respuesta 401",
    });
    expect(lines).toContain(
      "Ejecución abortada: 2026-08-14: [explorer] respuesta 401",
    );
  });
});

describe("SPEC-060 CA-5 historicoFailed (the exit code of the tool)", () => {
  const base: HistoricoReport = {
    desde: "2026-08-14",
    hasta: "2026-08-14",
    dryRun: false,
    datesProcessed: 1,
    entries: [],
    failed: [],
    aborted: null,
  };
  it("is false with no failed date and true with one, or with an abort", () => {
    expect(historicoFailed(base)).toBe(false);
    expect(
      historicoFailed({
        ...base,
        failed: [{ date: "2026-08-14", error: "x" }],
      }),
    ).toBe(true);
    expect(historicoFailed({ ...base, aborted: "2026-08-14: 401" })).toBe(true);
  });
});

// ADR-031 §2: the tool never writes a Decision; the engine does.
describe("SPEC-060 CA-2 no INSERT into decisions from the tool", () => {
  it("historico-db.ts and the shell have no statement on decisions but reads", () => {
    for (const file of [
      "src/ingest/historico-db.ts",
      "tools/historico-sync.mjs",
    ]) {
      const source = readFileSync(
        new URL(`../../${file}`, import.meta.url),
        "utf8",
      );
      expect(source).not.toMatch(/insert\s+into\s+(public\.)?decisions/i);
      expect(source).not.toMatch(/update\s+(public\.)?decisions/i);
    }
  });
});

// ---------------------------------------------------------------------------
// SPEC-070 (identity) and SPEC-071 (window ±3), carried over from main onto
// the plan of SPEC-060: one MatchPlan per declared match.

const aliases = AliasFile.parse(
  JSON.parse(
    readFileSync(
      path.resolve(__dirname, "../../data/alias/2026-27/rfef.json"),
      "utf8",
    ),
  ),
);
const exportFixture = (name: string) =>
  JSON.parse(
    readFileSync(
      path.resolve(__dirname, `../sources/rfef/fixtures/export/${name}`),
      "utf8",
    ),
  ) as DayMatchesResponse;

type DbMatch = MatchToSync & { madridDate: string };

// The dry run only reads: a tagged template that answers the dates select
// and the matches of one date (its only parameter).
function fakeSql(matches: readonly DbMatch[]): Sql {
  return ((strings: TemplateStringsArray, ...values: unknown[]) => {
    if (strings.join("?").includes("select distinct"))
      return Promise.resolve(
        [...new Set(matches.map((m) => m.madridDate))]
          .sort()
          .map((day) => ({ day })),
      );
    return Promise.resolve(
      matches
        .filter((m) => m.madridDate === values[0])
        .map((m) => ({
          match_id: m.matchId,
          competition_id: m.competitionId,
          round: m.round,
          kickoff: new Date(m.kickoff),
          home_team_id: m.homeTeamId,
          away_team_id: m.awayTeamId,
          home_name: m.homeName,
          home_short_name: m.homeShortName,
          away_name: m.awayName,
          away_short_name: m.awayShortName,
          status: m.status,
          home_score: m.score?.home ?? null,
          away_score: m.score?.away ?? null,
          goals: [],
        })),
    );
  }) as unknown as Sql;
}

const rawOf = (date: string, body: DayMatchesResponse) => ({
  url: `https://explorer.test/api/export/matches?date=${date}`,
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const dryRun = (
  matches: readonly DbMatch[],
  desde: string,
  hasta: string,
  rowsOf: (date: string) => DayMatchesResponse["matches"],
  asked: string[] = [],
) =>
  historicoSync({
    sql: fakeSql(matches),
    db: {} as IngestDb,
    store: null,
    fetchDay: async (date) => {
      asked.push(date);
      return rawOf(date, {
        date,
        exportedAt: "2026-11-09T00:00:00Z",
        matches: rowsOf(date),
      });
    },
    clock: () => NOW,
    sources: [],
    args: { desde, hasta, dryRun: true },
    aliasesFor: () => aliases,
  });

const paired = (plans: readonly MatchPlan[]) =>
  plans.filter(
    (p): p is Extract<MatchPlan, { kind: "finished" | "not-finished" }> =>
      p.kind === "finished" || p.kind === "not-finished",
  );

describe("SPEC-070 CA-7 the dry-run report", () => {
  const exportBody = exportFixture("export-2026-11-08-emparejamiento.json");
  const segunda = (id: string, home: string, away: string, kickoff: string) =>
    local({
      matchId: id,
      competitionId: "segunda-division",
      round: 13,
      kickoff,
      homeTeamId: home,
      awayTeamId: away,
      homeName: home,
      homeShortName: null,
      awayName: away,
      status: "scheduled",
      score: null,
    });
  const matches: DbMatch[] = [
    {
      ...segunda(
        "segunda-division-2026-27-j13-sporting-valladolid",
        "sporting",
        "valladolid",
        "2026-11-08T17:30:00.000Z",
      ),
      madridDate: "2026-11-08",
    },
    {
      ...segunda(
        "segunda-division-2026-27-j13-oviedo-granada",
        "oviedo",
        "granada",
        "2026-11-08T15:00:00.000Z",
      ),
      madridDate: "2026-11-08",
    },
    {
      ...local({
        matchId: "primera-division-2026-27-j12-celta-levante",
        round: 12,
        kickoff: "2026-11-08T17:30:00.000Z",
        awayTeamId: "levante",
        status: "scheduled",
        score: null,
      }),
      madridDate: "2026-11-08",
    },
  ];

  it("paired, unpaired and ambiguous, with one line per paired match", async () => {
    const report = await dryRun(matches, "2026-11-08", "2026-11-08", (date) =>
      date !== "2026-11-08"
        ? []
        : [
            ...exportBody.matches,
            {
              ...exportBody.matches[1],
              codActa: "77",
              equipoLocal: "Real Oviedo",
              equipoVisitante: "Granada CF",
              horaTexto: "12:00",
            },
            {
              ...exportBody.matches[1],
              codActa: "78",
              equipoLocal: "Real Oviedo",
              equipoVisitante: "Granada CF",
              horaTexto: "13:00",
            },
          ],
    );
    const plans = report.entries.map((e) => e.plan);
    expect(plans.map((p) => p.kind)).toEqual([
      "finished",
      "ambiguous",
      "unpaired",
    ]);
    const lines = formatHistoricoReport(report);
    expect(lines).toContain(
      "  2026-11-08 · segunda-division-2026-27-j13-sporting-valladolid · 70695047 · Real Sporting de Gijón–Real Valladolid CF · 1-2 · 3 goles",
    );
    expect(lines).toContain(
      "  2026-11-08 · primera-division · J12 · Celta de Vigo–Osasuna · no_competition_rows",
    );
    const ambiguous = plans.find((p) => p.kind === "ambiguous");
    if (ambiguous?.kind !== "ambiguous") throw new Error("unreachable");
    expect(ambiguous.match.matchId).toBe(
      "segunda-division-2026-27-j13-oviedo-granada",
    );
    expect(ambiguous.candidates.map((c) => c.codActa)).toEqual(["77", "78"]);
  });

  it("a match whose competition has rows but none with its teams: no_identity", () => {
    const [plan] = planDaySync(
      "2026-11-08",
      [matches[1] as MatchToSync],
      exportBody.matches,
      aliases,
    );
    expect(plan).toMatchObject({ kind: "unpaired", reason: "no_identity" });
  });
});

// SPEC-071: a match declared on one day may have been played another: the
// candidates are the rows of the Madrid days [kickoff day − 3, + 3] that
// pass the identity of SPEC-070.
describe("SPEC-071 historico with the window", () => {
  // Raw capture of explorer (?date=2026-10-31), provenance in its README.
  const export1031 = exportFixture(
    "export-2026-10-31-celta-fortuna-cordoba.json",
  );
  const celtaRow = export1031.matches.find((r) => r.codActa === "70695028");
  if (!celtaRow) throw new Error("fixture without 70695028");

  const celtaCordoba = local({
    matchId: "segunda-division-2026-27-j12-celta-fortuna-cordoba",
    competitionId: "segunda-division",
    round: 12,
    kickoff: "2026-11-01T16:00:00.000Z",
    homeTeamId: "celta-fortuna",
    awayTeamId: "cordoba",
    homeName: "Celta Fortuna",
    homeShortName: null,
    awayName: "Córdoba CF",
    status: "scheduled",
    score: null,
  });
  const byDay = (entries: [string, DayMatchesResponse["matches"]][]) =>
    new Map(entries);
  const postponed = {
    ...celtaRow,
    codActa: null,
    estado: "POSTPONED" as const,
    golesLocal: null,
    golesVisitante: null,
    goals: [],
  };
  const planOf = (rows: Map<string, DayMatchesResponse["matches"]>) =>
    planDaySync("2026-11-01", [celtaCordoba], rows, aliases);

  it("CA-1 the match declared on 11-01 pairs with acta 70695028 of 10-31: 2-2 and its goals", () => {
    const [plan] = planOf(
      byDay([
        ["2026-10-31", export1031.matches],
        ["2026-11-01", []],
      ]),
    );
    expect(plan).toMatchObject({
      kind: "finished",
      rowDate: "2026-10-31",
      score: { home: 2, away: 2 },
      correct: true,
      goalsComplete: true,
    });
    if (plan?.kind !== "finished") throw new Error("unreachable");
    expect(plan.row.codActa).toBe("70695028");
    expect(plan.goals).toEqual([
      { team: "home", player: "Aldrine Kibet", minute: 24 },
      { team: "away", player: "Diego Bri", minute: 27 },
      { team: "home", player: "Alvaro Marin", minute: 56 },
      { team: "away", player: "Victor Sánchez", minute: 72 },
    ]);
  });

  it("CA-2 a POSTPONED and a FINISHED of the same identity: the FINISHED", () => {
    const [plan] = planOf(
      byDay([
        ["2026-11-01", [postponed]],
        ["2026-10-31", [celtaRow]],
      ]),
    );
    expect(plan).toMatchObject({
      kind: "finished",
      score: { home: 2, away: 2 },
    });
  });

  it("CA-2 two FINISHED: ambiguous, no plan", () => {
    const [plan] = planOf(
      byDay([
        ["2026-10-31", [celtaRow]],
        ["2026-11-02", [{ ...celtaRow, codActa: "99" }]],
      ]),
    );
    expect(plan).toEqual({
      kind: "ambiguous",
      match: celtaCordoba,
      candidates: [
        { codActa: "70695028", home: "RC Celta Fortuna", away: "Córdoba CF" },
        { codActa: "99", home: "RC Celta Fortuna", away: "Córdoba CF" },
      ],
    });
  });

  it("CA-2 only the POSTPONED: paired, nothing to correct", () => {
    const [plan] = planOf(byDay([["2026-11-01", [postponed]]]));
    expect(plan).toMatchObject({ kind: "not-finished", estado: "POSTPONED" });
  });

  it("CA-3 a row with another team on a neighbour day does not pair: no_identity", () => {
    const [plan] = planOf(
      byDay([
        [
          "2026-10-31",
          [{ ...celtaRow, equipoVisitante: "Real Valladolid CF" }],
        ],
      ]),
    );
    expect(plan).toMatchObject({ kind: "unpaired", reason: "no_identity" });
  });

  it("CA-3 the right row at day +4 or −4 does not pair; the reason looks at the whole window", () => {
    for (const day of ["2026-10-28", "2026-11-05"]) {
      const [plan] = planOf(byDay([[day, [celtaRow]]]));
      expect(plan).toMatchObject({
        kind: "unpaired",
        reason: "no_competition_rows",
      });
    }
    // A row of Segunda on day −3 only: its competition has rows in the window.
    const [plan] = planOf(
      byDay([
        ["2026-10-29", [{ ...celtaRow, equipoLocal: "Real Oviedo" }]],
        ["2026-11-05", [celtaRow]],
      ]),
    );
    expect(plan).toMatchObject({ kind: "unpaired", reason: "no_identity" });
  });

  it("CA-4 the line says the day of the row, the report counts it, and each day is asked once", async () => {
    const sameDay: DbMatch = {
      ...celtaCordoba,
      matchId: "segunda-division-2026-27-j12-eibar-almeria",
      kickoff: "2026-10-31T15:15:00.000Z",
      homeTeamId: "eibar",
      awayTeamId: "almeria",
      madridDate: "2026-10-31",
    };
    const asked: string[] = [];
    const report = await dryRun(
      [sameDay, { ...celtaCordoba, madridDate: "2026-11-01" }],
      "2026-10-31",
      "2026-11-01",
      (date) => (date === "2026-10-31" ? export1031.matches : []),
      asked,
    );
    expect(asked.toSorted()).toEqual([
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
    expect(paired(report.entries.map((e) => e.plan))).toHaveLength(2);
    const lines = formatHistoricoReport(report);
    const at = lines.indexOf("Emparejados (2, 1 en otro día de la ventana ±3):");
    expect(lines.slice(at + 1, at + 3)).toEqual([
      "  2026-10-31 · segunda-division-2026-27-j12-eibar-almeria · 70695030 · SD Eibar–UD Almería · 1-1 · 2 goles",
      "  2026-11-01 → 2026-10-31 · segunda-division-2026-27-j12-celta-fortuna-cordoba · 70695028 · RC Celta Fortuna–Córdoba CF · 2-2 · 4 goles",
    ]);
  });

  it("CA-5 an empty own day with nothing paired fails the date; one whose matches paired on a neighbour does not", async () => {
    const one: DbMatch[] = [{ ...celtaCordoba, madridDate: "2026-11-01" }];
    const report = await dryRun(one, "2026-11-01", "2026-11-01", () => []);
    expect(report.failed).toEqual([
      {
        date: "2026-11-01",
        error: "[explorer] 0 partidos para 2026-11-01 con 1 declarados",
      },
    ]);
    const ok = await dryRun(one, "2026-11-01", "2026-11-01", (date) =>
      date === "2026-10-31" ? export1031.matches : [],
    );
    expect(ok.failed).toEqual([]);
    expect(ok.entries[0]?.plan.kind).toBe("finished");
  });

  it("CA-5 a 401 on any day of the window aborts the run", async () => {
    const report = await historicoSync({
      sql: fakeSql([{ ...celtaCordoba, madridDate: "2026-11-01" }]),
      db: {} as IngestDb,
      store: null,
      fetchDay: async (date) => ({
        ...rawOf(date, { date, exportedAt: "x", matches: [] }),
        status: date === "2026-11-03" ? 401 : 200,
      }),
      clock: () => NOW,
      sources: [],
      args: { desde: "2026-11-01", hasta: "2026-11-01", dryRun: true },
      aliasesFor: () => aliases,
    });
    expect(report.aborted).toBe(
      "2026-11-01: [explorer] respuesta 401 (2026-11-03)",
    );
  });
});
