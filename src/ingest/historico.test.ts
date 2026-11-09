import { describe, expect, it } from "vitest";
import type { DayMatchesResponse } from "../lib/explorer-client.ts";
import {
  generateDateRange,
  type MatchToSync,
  parseHistoricoArgs,
  planDaySync,
  SEASON_START,
} from "./historico.ts";

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
