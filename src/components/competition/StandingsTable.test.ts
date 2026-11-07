import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { StandingsResponse } from "../../lib/explorer-client.ts";
import { StandingsTable } from "./StandingsTable.tsx";

describe("StandingsTable Component", () => {
  const sampleStandings: StandingsResponse = {
    competition: "liga-f",
    season: "2026-27",
    updatedAt: "2026-11-08T17:00:00Z",
    isLive: true,
    standings: [
      {
        position: 1,
        teamId: "barcelona-femenino",
        teamName: "FC Barcelona Femení",
        played: 9,
        won: 9,
        drawn: 0,
        lost: 0,
        goalsFor: 40,
        goalsAgainst: 4,
        points: 27,
        form: ["W", "W", "W", "W", "W"],
      },
      {
        position: 2,
        teamId: "real-madrid-femenino",
        teamName: "Real Madrid Femenino",
        played: 9,
        won: 7,
        drawn: 1,
        lost: 1,
        goalsFor: 25,
        goalsAgainst: 8,
        points: 22,
        form: ["W", "D", "W", "W", "W"],
      },
      {
        position: 10,
        teamId: "depor-abanca",
        teamName: "Deportivo ABANCA",
        played: 9,
        won: 3,
        drawn: 2,
        lost: 4,
        goalsFor: 10,
        goalsAgainst: 14,
        points: 11,
        form: ["L", "W", "D", "L", "W"],
      },
    ],
  };

  it("renders standings table with team names, stats and highlighted Galician team", () => {
    const html = renderToStaticMarkup(
      createElement(StandingsTable, {
        standingsData: sampleStandings,
        locale: "gl",
      }),
    );

    expect(html).toContain('data-testid="standings-table"');
    expect(html).toContain("FC Barcelona Femení");
    expect(html).toContain("Real Madrid Femenino");
    expect(html).toContain("Deportivo ABANCA");
    expect(html).toContain('data-team-id="depor-abanca"');
    expect(html).toContain('data-galician="true"');
    expect(html).toContain("/escudos/depor-abanca.svg");
    expect(html).toContain("27");
    expect(html).toContain("11");
  });
});
