import { readFileSync } from "node:fs";
import path from "node:path";
import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import type { DayMatchesResponse } from "../lib/explorer-client.ts";
import { AliasFile } from "../model/index.ts";
import {
  generateDateRange,
  type MatchToSync,
  parseHistoricoArgs,
  planDaySync,
  SEASON_START,
} from "./historico.ts";
import { historicoSync } from "./historico-db.ts";

describe("SPEC-060 parseHistoricoArgs", () => {
  it("uses default range (SEASON_START to now) when no arguments provided", () => {
    const fixedNow = "2026-11-08T12:00:00Z";
    const args = parseHistoricoArgs([], fixedNow);
    expect(args).toEqual({
      desde: SEASON_START,
      hasta: "2026-11-08",
      dryRun: false,
    });
  });

  it("parses explicit --desde, --hasta and --dry-run", () => {
    const args = parseHistoricoArgs([
      "--desde",
      "2026-09-01",
      "--hasta",
      "2026-09-15",
      "--dry-run",
    ]);
    expect(args).toEqual({
      desde: "2026-09-01",
      hasta: "2026-09-15",
      dryRun: true,
    });
  });

  it("rejects invalid date format for --desde or --hasta", () => {
    expect(() => parseHistoricoArgs(["--desde", "invalid-date"])).toThrow(
      "--desde precisa dunha data válida YYYY-MM-DD",
    );
    expect(() => parseHistoricoArgs(["--hasta", "2026/09/15"])).toThrow(
      "--hasta precisa dunha data válida YYYY-MM-DD",
    );
  });

  it("rejects --desde posterior to --hasta", () => {
    expect(() =>
      parseHistoricoArgs(["--desde", "2026-10-15", "--hasta", "2026-10-01"]),
    ).toThrow("--desde non pode ser posterior a --hasta");
  });

  it("rejects unknown arguments", () => {
    expect(() => parseHistoricoArgs(["--foo"])).toThrow(
      "argumento descoñecido: --foo",
    );
  });
});

describe("SPEC-060 generateDateRange", () => {
  it("generates inclusive sequence of YYYY-MM-DD dates", () => {
    const dates = generateDateRange("2026-08-14", "2026-08-16");
    expect(dates).toEqual(["2026-08-14", "2026-08-15", "2026-08-16"]);
  });

  it("returns single day when desde equals hasta", () => {
    const dates = generateDateRange("2026-10-10", "2026-10-10");
    expect(dates).toEqual(["2026-10-10"]);
  });
});

describe("SPEC-060 planDaySync", () => {
  const localMatch: MatchToSync = {
    matchId: "primera-division:2026-27:celta-osasuna",
    competitionId: "primera-division",
    round: 1,
    kickoff: "2026-08-15T19:00:00Z",
    homeTeamId: "celta",
    awayTeamId: "osasuna",
    homeName: "Celta de Vigo",
    homeShortName: "Celta",
    awayName: "Osasuna",
    awayShortName: "Osasuna",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    version: 0,
  };

  const explorerFinishedMatch: DayMatchesResponse["matches"][number] = {
    canonicalCompetitionId: "primera-division",
    canonicalHomeTeamId: "celta",
    canonicalAwayTeamId: "osasuna",
    homeTeam: "Celta",
    awayTeam: "Osasuna",
    homeScore: 2,
    awayScore: 1,
    estado: "FINISHED",
    goals: [
      { team: "home", player: "Aspas", minute: 23, penalty: true },
      { team: "home", player: "Goleador Local", minute: 45 }, // placeholder to sanitize
      { team: "away", player: "Budimir", minute: 60 },
      { team: "home", player: "Swedberg", minute: 85 },
    ],
  };

  it("detects consolidation needs and sanitizes placeholder goals", () => {
    const plan = planDaySync(
      "2026-08-15",
      [localMatch],
      [explorerFinishedMatch],
    );

    expect(plan.matches).toHaveLength(1);
    const item = plan.matches[0];
    expect(item.needsDecision).toBe(true);
    expect(item.finalScore).toEqual({ home: 2, away: 1 });

    // "Goleador Local" must be sanitized out
    expect(item.goals).toEqual([
      { team: "home", player: "Aspas", minute: 23, penalty: true },
      { team: "away", player: "Budimir", minute: 60 },
      { team: "home", player: "Swedberg", minute: 85 },
    ]);
  });

  it("CA-4 idempotence: does not request new decision if match already finished with same score", () => {
    const alreadyFinishedMatch: MatchToSync = {
      ...localMatch,
      status: "finished",
      homeScore: 2,
      awayScore: 1,
      version: 1,
    };

    const plan = planDaySync(
      "2026-08-15",
      [alreadyFinishedMatch],
      [explorerFinishedMatch],
    );
    expect(plan.matches).toHaveLength(1);
    expect(plan.matches[0].needsDecision).toBe(false);
    expect(plan.matches[0].goals).toHaveLength(3);
  });

  it("skips matches that are still scheduled in explorer without scores", () => {
    const explorerScheduled: DayMatchesResponse["matches"][number] = {
      canonicalCompetitionId: "primera-division",
      canonicalHomeTeamId: "celta",
      canonicalAwayTeamId: "osasuna",
      homeTeam: "Celta",
      awayTeam: "Osasuna",
      homeScore: null,
      awayScore: null,
      estado: "SCHEDULED",
    };

    const plan = planDaySync("2026-08-15", [localMatch], [explorerScheduled]);
    expect(plan.matches).toHaveLength(1);
    expect(plan.matches[0].needsDecision).toBe(false);
    expect(plan.matches[0].finalScore).toBeNull();
    expect(plan.matches[0].goals).toEqual([]);
  });
});

describe("SPEC-070 CA-7 the dry-run report", () => {
  const aliases = AliasFile.parse(
    JSON.parse(
      readFileSync(
        path.resolve(__dirname, "../../data/alias/2026-27/rfef.json"),
        "utf8",
      ),
    ),
  );
  const exportBody = JSON.parse(
    readFileSync(
      path.resolve(
        __dirname,
        "../sources/rfef/fixtures/export/export-2026-11-08-emparejamiento.json",
      ),
      "utf8",
    ),
  ) as DayMatchesResponse;

  const dbRow = (
    id: string,
    competition: string,
    home: string,
    away: string,
    kickoff: string,
  ) => ({
    match_id: id,
    competition_id: competition,
    round: 13,
    kickoff: new Date(kickoff),
    madrid_date: "2026-11-08",
    home_team_id: home,
    away_team_id: away,
    home_name: home,
    home_short_name: null,
    away_name: away,
    away_short_name: null,
    status: "scheduled",
    home_score: null,
    away_score: null,
    version: 0,
  });

  // The dry-run only reads: a tagged template that answers the one select.
  const rows = [
    dbRow(
      "segunda-division-2026-27-j13-sporting-valladolid",
      "segunda-division",
      "sporting",
      "valladolid",
      "2026-11-08T17:30:00.000Z",
    ),
    dbRow(
      "segunda-division-2026-27-j13-oviedo-granada",
      "segunda-division",
      "oviedo",
      "granada",
      "2026-11-08T15:00:00.000Z",
    ),
    dbRow(
      "primera-division-2026-27-j12-celta-levante",
      "primera-division",
      "celta",
      "levante",
      "2026-11-08T17:30:00.000Z",
    ),
  ];
  const sql = (() => Promise.resolve(rows)) as unknown as Sql;

  it("adds paired/unpaired/ambiguous and one line per paired match", async () => {
    const report = await historicoSync(
      sql,
      { desde: "2026-11-08", hasta: "2026-11-08", dryRun: true },
      async () => ({
        ...exportBody,
        matches: [
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
      }),
      () => aliases,
    );
    expect(report.matchesScanned).toBe(3);
    expect(report.matchesPaired).toBe(1);
    expect(report.matchesUnpaired).toBe(1);
    expect(report.matchesAmbiguous).toBe(1);
    expect(report.pairedLines).toEqual([
      "2026-11-08 · segunda-division-2026-27-j13-sporting-valladolid · 70695047 · Real Sporting de Gijón–Real Valladolid CF · 1-2 · 3 goles",
    ]);
    expect(report.unpaired).toEqual([
      {
        date: "2026-11-08",
        matchId: "primera-division-2026-27-j12-celta-levante",
        reason: "no_competition_rows",
      },
    ]);
    expect(report.ambiguous.map((a) => a.matchId)).toEqual([
      "segunda-division-2026-27-j13-oviedo-granada",
    ]);
    expect(report.ambiguous[0]?.candidates.map((c) => c.codActa)).toEqual([
      "77",
      "78",
    ]);
  });

  it("a match whose competition has rows but none with its teams: no_identity", () => {
    const lm: MatchToSync = {
      matchId: "segunda-division-2026-27-j13-oviedo-granada",
      competitionId: "segunda-division",
      round: 13,
      kickoff: "2026-11-08T15:00:00.000Z",
      homeTeamId: "oviedo",
      awayTeamId: "granada",
      homeName: "Real Oviedo",
      homeShortName: null,
      awayName: "Granada CF",
      awayShortName: null,
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      version: 0,
    };
    const plan = planDaySync("2026-11-08", [lm], exportBody.matches, aliases);
    expect(plan.unpaired).toEqual([
      { matchId: lm.matchId, reason: "no_identity" },
    ]);
  });
});
