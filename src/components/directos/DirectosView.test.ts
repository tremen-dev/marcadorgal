import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GroupedCompetitionMatches } from "../../lib/explorer-matches.ts";
import { DirectosView } from "./DirectosView.tsx";

describe("DirectosView Component", () => {
  const sampleData: GroupedCompetitionMatches[] = [
    {
      competitionId: "liga-f",
      competitionName: "Liga F Moeve",
      category: "femenino",
      tier: 1,
      liveCount: 1,
      matches: [
        {
          id: "m1",
          codActa: null,
          competitionId: "liga-f",
          competitionName: "Liga F Moeve",
          homeTeam: "Deportivo ABANCA",
          awayTeam: "FC Barcelona Femení",
          canonicalHomeTeamId: "depor-abanca",
          canonicalAwayTeamId: "barcelona-femenino",
          homeGalician: true,
          awayGalician: false,
          homeShield: "/escudos/depor-abanca.svg",
          homeScore: 1,
          awayScore: 2,
          status: "live",
          originalStatus: "LIVE_PROVISIONAL",
          minute: 68,
          addedMinute: null,
          halfTime: false,
          goals: [
            { team: "home", player: "Millene", minute: 23, penalty: true },
            { team: "away", player: "Alexia", minute: 45 },
          ],
        },
      ],
    },
    {
      competitionId: "primera-federacion-fem",
      competitionName: "Primera Federación Femenina",
      category: "femenino",
      tier: 2,
      liveCount: 0,
      matches: [
        {
          id: "m2",
          codActa: null,
          competitionId: "primera-federacion-fem",
          competitionName: "Primera Federación Femenina",
          homeTeam: "Alavés Gloriosas",
          awayTeam: "Osasuna Femenino",
          homeGalician: false,
          awayGalician: false,
          homeScore: 0,
          awayScore: 0,
          status: "live",
          originalStatus: "LIVE_PROVISIONAL",
          minute: 45,
          addedMinute: 2,
          halfTime: true,
          goals: [],
        },
      ],
    },
  ];

  it("renders day matches grouped by women football competitions with live goals and halftime", () => {
    const html = renderToStaticMarkup(
      createElement(DirectosView, {
        date: "2026-11-08",
        groupedCompetitions: sampleData,
        locale: "gl",
      }),
    );

    expect(html).toContain('data-testid="directos-view"');
    // Group headers
    expect(html).toContain("Liga F Moeve");
    expect(html).toContain("Primera Federación Femenina");
    expect(html).toContain("Fútbol Feminino");

    // Match 1
    expect(html).toContain("Deportivo ABANCA");
    expect(html).toContain("/escudos/depor-abanca.svg");
    expect(html).toContain("68&#x27;");
    expect(html).toContain("Millene");
    expect(html).toContain("23&#x27;");
    expect(html).toContain("(p.)");
    expect(html).toContain("Alexia");
    expect(html).toContain("45&#x27;");

    // Match 2 (HalfTime)
    expect(html).toContain("Alavés Gloriosas");
    expect(html).toContain("Descanso");
  });
});
