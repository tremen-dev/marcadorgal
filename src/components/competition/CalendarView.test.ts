import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatDay } from "../../i18n/index.ts";
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

// SPEC-089 CA-3: Europe/Madrid whatever the process clock; no badge for a
// match whose confirmation we do not know (the local calendar).
describe("SPEC-089 CA-3 CalendarView in Madrid time", () => {
  const local = {
    matches: [
      {
        externalId: "tercera-rfef-g1-2026-27-j1-alondras-antela",
        round: 1,
        kickoff: "2026-09-05T16:00:00Z",
        home: "Alondras CF",
        away: "CD Antela",
      },
    ],
  };

  it("paints 18:00 for 16:00Z with TZ=UTC, with formatDay", () => {
    const previous = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      for (const locale of ["gl", "es"] as const) {
        const html = renderToStaticMarkup(
          createElement(CalendarView, { calendarData: local, locale }),
        );
        expect(html).toContain("18:00");
        expect(html).not.toContain("16:00");
        expect(html).toContain(formatDay("2026-09-05T16:00:00Z", locale));
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it("a local match carries no confirmation badge", () => {
    const html = renderToStaticMarkup(
      createElement(CalendarView, { calendarData: local, locale: "gl" }),
    );
    expect(html).toContain("Alondras CF");
    expect(html).toContain("CD Antela");
    expect(html).not.toContain("Horario confirmado");
    expect(html).not.toContain("Horario por confirmar");
  });

  it("an explorer match keeps its badge by timeConfirmed", () => {
    const html = renderToStaticMarkup(
      createElement(CalendarView, {
        calendarData: {
          matches: [
            { ...local.matches[0], externalId: "a", timeConfirmed: true },
            {
              ...local.matches[0],
              externalId: "b",
              round: 2,
              timeConfirmed: false,
            },
          ],
        },
        locale: "gl",
      }),
    );
    expect(html).toContain("Horario confirmado");
    expect(html).toContain("Horario por confirmar");
  });
});
