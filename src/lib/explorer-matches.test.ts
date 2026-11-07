import { describe, expect, it } from "vitest";
import type { DayMatchesResponse } from "./explorer-client.ts";
import {
  mapExplorerStatus,
  transformExplorerMatches,
} from "./explorer-matches.ts";

describe("explorer-matches transformer", () => {
  it("maps explorer statuses to core domain match status", () => {
    expect(mapExplorerStatus("SCHEDULED")).toBe("scheduled");
    expect(mapExplorerStatus("LIVE_PROVISIONAL")).toBe("live");
    expect(mapExplorerStatus("FINISHED")).toBe("finished");
    expect(mapExplorerStatus("POSTPONED")).toBe("postponed");
    expect(mapExplorerStatus("SUSPENDED")).toBe("suspended");
  });

  it("transforms and groups day matches including women football competitions", () => {
    const rawData: DayMatchesResponse = {
      date: "2026-11-08",
      exportedAt: "2026-11-08T18:00:00Z",
      matches: [
        {
          matchKey: "liga-f-depor-abanca-barcelona",
          canonicalCompetitionId: "liga-f",
          canonicalHomeTeamId: "depor-abanca",
          canonicalAwayTeamId: "barcelona-femenino",
          homeTeam: "Deportivo ABANCA",
          awayTeam: "FC Barcelona Femení",
          homeScore: 1,
          awayScore: 2,
          estado: "LIVE_PROVISIONAL",
          minute: 74,
          addedMinute: null,
          halfTime: false,
          goals: [
            { team: "away", player: "Alexia Putellas", minute: 14 },
            {
              team: "home",
              player: "Millene Cabral",
              minute: 38,
              penalty: true,
            },
            { team: "away", player: "Aitana Bonmatí", minute: 61 },
          ],
        },
        {
          matchKey: "liga-f-real-madrid-atletico",
          canonicalCompetitionId: "liga-f",
          canonicalHomeTeamId: "real-madrid-femenino",
          canonicalAwayTeamId: "atletico-madrid-femenino",
          homeTeam: "Real Madrid Femenino",
          awayTeam: "Atlético de Madrid Femenino",
          homeScore: 0,
          awayScore: 0,
          estado: "LIVE_PROVISIONAL",
          minute: 45,
          addedMinute: 2,
          halfTime: true,
          goals: [],
        },
        {
          matchKey: "primera-fed-fem-alaves-osasuna",
          canonicalCompetitionId: "primera-federacion-fem",
          canonicalHomeTeamId: "alaves-femenino",
          canonicalAwayTeamId: "osasuna-femenino",
          homeTeam: "Deportivo Alavés Gloriosas",
          awayTeam: "CA Osasuna Femenino",
          homeScore: 3,
          awayScore: 1,
          estado: "FINISHED",
          goals: [
            { team: "home", player: "Lice Chamorro", minute: 22 },
            { team: "away", player: "Carmen Sobrón", minute: 55 },
            { team: "home", player: "Sara Carrillo", minute: 80 },
            {
              team: "home",
              player: "Elene Errasti",
              minute: 90,
              ownGoal: true,
            },
          ],
        },
        {
          matchKey: "segunda-fed-fem-as-celtas-olimpico",
          canonicalCompetitionId: "segunda-federacion-fem-g1",
          canonicalHomeTeamId: "as-celtas",
          canonicalAwayTeamId: "olimpico-madrid",
          homeTeam: "As Celtas",
          awayTeam: "Olímpico de Madrid",
          homeScore: 2,
          awayScore: 0,
          estado: "FINISHED",
          goals: [
            { team: "home", player: "Ana Toubes", minute: 31 },
            { team: "home", player: "Paula Novo", minute: 68 },
          ],
        },
      ],
    };

    const grouped = transformExplorerMatches(rawData);
    expect(grouped).toHaveLength(3);

    // Liga F
    const ligaF = grouped.find((g) => g.competitionId === "liga-f");
    expect(ligaF).toBeDefined();
    expect(ligaF?.competitionName).toBe("Liga F Moeve");
    expect(ligaF?.category).toBe("femenino");
    expect(ligaF?.tier).toBe(1);
    expect(ligaF?.liveCount).toBe(2);
    expect(ligaF?.matches).toHaveLength(2);

    const deporMatch = ligaF?.matches.find(
      (m) => m.canonicalHomeTeamId === "depor-abanca",
    );
    expect(deporMatch).toBeDefined();
    expect(deporMatch?.homeGalician).toBe(true);
    expect(deporMatch?.awayGalician).toBe(false);
    expect(deporMatch?.homeShield).toBe("/escudos/depor-abanca.svg");
    expect(deporMatch?.homeScore).toBe(1);
    expect(deporMatch?.awayScore).toBe(2);
    expect(deporMatch?.status).toBe("live");
    expect(deporMatch?.minute).toBe(74);
    expect(deporMatch?.halfTime).toBe(false);
    expect(deporMatch?.goals).toHaveLength(3);
    expect(deporMatch?.goals[1]).toEqual({
      team: "home",
      player: "Millene Cabral",
      minute: 38,
      penalty: true,
      ownGoal: undefined,
    });

    const derbyMad = ligaF?.matches.find(
      (m) => m.canonicalHomeTeamId === "real-madrid-femenino",
    );
    expect(derbyMad?.halfTime).toBe(true);
    expect(derbyMad?.minute).toBe(45);
    expect(derbyMad?.addedMinute).toBe(2);

    // Primera Federación Femenina
    const primeraFed = grouped.find(
      (g) => g.competitionId === "primera-federacion-fem",
    );
    expect(primeraFed).toBeDefined();
    expect(primeraFed?.competitionName).toBe("Primera Federación Femenina");
    expect(primeraFed?.category).toBe("femenino");
    expect(primeraFed?.tier).toBe(2);
    expect(primeraFed?.matches[0].goals).toHaveLength(4);
    expect(primeraFed?.matches[0].goals[3].ownGoal).toBe(true);

    // Segunda Federación Femenina G1 (As Celtas)
    const segundaFed = grouped.find(
      (g) => g.competitionId === "segunda-federacion-fem-g1",
    );
    expect(segundaFed).toBeDefined();
    expect(segundaFed?.competitionName).toBe(
      "Segunda Federación Femenina - Grupo 1",
    );
    expect(segundaFed?.category).toBe("femenino");
    const asCeltasMatch = segundaFed?.matches[0];
    expect(asCeltasMatch?.canonicalHomeTeamId).toBe("as-celtas");
    expect(asCeltasMatch?.homeGalician).toBe(true);
    expect(asCeltasMatch?.homeShield).toBe("/escudos/as-celtas.svg");
  });
});
