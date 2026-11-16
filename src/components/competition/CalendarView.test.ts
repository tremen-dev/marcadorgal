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

// SPEC-089 CA-3 (amended 2026-11-16): «<day> <month> · <time>» in Madrid.
describe("SPEC-089 CA-3 CalendarView date with month", () => {
  const cases = [
    {
      kickoff: "2026-09-05T16:00:00Z",
      gl: "sáb 5 set · 18:00",
      es: "sáb 5 sept · 18:00",
    },
    {
      kickoff: "2026-11-15T17:00:00Z",
      gl: "dom 15 nov · 18:00",
      es: "dom 15 nov · 18:00",
    },
    {
      kickoff: "2026-11-21T23:30:00Z",
      gl: "dom 22 nov · 00:30",
      es: "dom 22 nov · 00:30",
    },
  ] as const;

  it("paints the spec cases with TZ=UTC in gl and es", () => {
    const previous = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      for (const c of cases) {
        for (const locale of ["gl", "es"] as const) {
          const html = renderToStaticMarkup(
            createElement(CalendarView, {
              calendarData: {
                matches: [
                  {
                    externalId: "x",
                    round: 1,
                    kickoff: c.kickoff,
                    home: "Alondras CF",
                    away: "CD Antela",
                  },
                ],
              },
              locale,
            }),
          );
          expect(html).toContain(`>${c[locale]}<`);
        }
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});

// SPEC-089 CA-8: rounds ascending; inside a round by kickoff, then by key
// in code order; an unparsable kickoff goes last with the same tie-break.
describe("SPEC-089 CA-8 CalendarView order inside the round", () => {
  const m = (externalId: string, round: number, kickoff: string) => ({
    externalId,
    round,
    kickoff,
    home: `H-${externalId}`,
    away: `A-${externalId}`,
  });
  const ids = (html: string) =>
    [...html.matchAll(/data-match-id="([^"]+)"/g)].map((x) => x[1]);
  const render = (matches: ReturnType<typeof m>[]) =>
    renderToStaticMarkup(
      createElement(CalendarView, { calendarData: { matches }, locale: "gl" }),
    );

  const b = m("b", 1, "2026-09-05T16:00:00Z");
  const c = m("c", 1, "2026-09-05T14:00:00Z");
  const a = m("a", 1, "2026-09-05T14:00:00Z");

  it("18:00 b, 16:00 c, 16:00 a → 16:00 a, 16:00 c, 18:00 b", () => {
    expect(ids(render([b, c, a]))).toEqual(["a", "c", "b"]);
  });

  it("two permutations give the same DOM", () => {
    expect(render([b, c, a])).toBe(render([a, b, c]));
    expect(render([c, a, b])).toBe(render([b, a, c]));
  });

  it("rounds ascending, unparsable kickoff last, code-order tie-break", () => {
    const html = render([
      m("z", 2, "2026-09-12T10:00:00Z"),
      m("B", 1, "pendiente"),
      m("a", 1, "pendiente"),
      m("y", 1, "2026-09-05T20:00:00Z"),
      m("x", 0, "2026-08-30T10:00:00Z"),
    ]);
    // "B" < "a" in code order (localeCompare would put "a" first).
    expect(ids(html)).toEqual(["x", "y", "B", "a", "z"]);
  });
});
