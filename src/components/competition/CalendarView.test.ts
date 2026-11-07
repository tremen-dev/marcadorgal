import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OfficialCalendarResponse } from "../../lib/explorer-client.ts";
import { CalendarView } from "./CalendarView.tsx";

describe("CalendarView Component", () => {
  const sampleCalendar: OfficialCalendarResponse = {
    competition: "liga-f",
    season: "2026-27",
    exportedAt: "2026-11-08T18:00:00Z",
    teams: [
      { externalId: "depor-abanca", externalName: "Deportivo ABANCA" },
      { externalId: "barcelona-femenino", externalName: "FC Barcelona Femení" },
    ],
    matches: [
      {
        externalId: "match-1",
        round: 10,
        kickoff: "2026-11-15T16:00:00Z",
        home: "depor-abanca",
        away: "barcelona-femenino",
        timeConfirmed: true,
      },
      {
        externalId: "match-2",
        round: 10,
        kickoff: "2026-11-15T18:30:00Z",
        home: "real-madrid-femenino",
        away: "atletico-madrid-femenino",
        timeConfirmed: false,
      },
    ],
    ignoredRounds: {},
  };

  it("renders calendar rounds with matches and confirmed time tags", () => {
    const html = renderToStaticMarkup(
      createElement(CalendarView, {
        calendarData: sampleCalendar,
        locale: "gl",
      }),
    );

    expect(html).toContain('data-testid="calendar-view"');
    expect(html).toContain("xornada 10");
    expect(html).toContain("Deportivo ABANCA");
    expect(html).toContain("barcelona-femenino");
    expect(html).toContain("/escudos/depor-abanca.svg");
    expect(html).toContain("Horario confirmado");
    expect(html).toContain("Horario por confirmar");
  });
});
