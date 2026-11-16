import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import tercera from "../../data/calendario/2026-27/tercera-rfef-g1.json" with {
  type: "json",
};
import {
  CompetitionCalendarPage,
  CompetitionOverviewPage,
  CompetitionStandingsPage,
} from "../app/competition-page.tsx";
import { BUNDLED_CALENDARS } from "../calendar/bundled.ts";
import { t } from "../i18n/index.ts";
import { ALLOWED_COMPETITIONS } from "../model/index.ts";
import {
  type CompetitionExplorer,
  loadCompetitionCalendar,
  loadCompetitionStandings,
} from "./competition-data.ts";
import { COMPETITION_SOURCES } from "./competition-sources.ts";
import type {
  OfficialCalendarResponse,
  StandingsResponse,
} from "./explorer-client.ts";

// SPEC-089: explorer injected (as SPEC-085 CA-2), fixtures of the repo, no
// network.
const explorerCalendar: OfficialCalendarResponse = {
  competition: "liga-f",
  season: "2026-27",
  exportedAt: "2026-11-08T18:00:00Z",
  teams: [],
  matches: [
    {
      externalId: "lf-1",
      round: 10,
      kickoff: "2026-11-15T16:00:00Z",
      home: "depor-abanca",
      away: "barcelona-femenino",
      timeConfirmed: true,
    },
  ],
  ignoredRounds: {},
};

const explorerStandings: StandingsResponse = {
  competition: "liga-f",
  season: "2026-27",
  updatedAt: "2026-11-08T18:00:00Z",
  standings: [
    {
      position: 1,
      teamId: "x",
      teamName: "Equipo Explorer",
      played: 10,
      won: 8,
      drawn: 1,
      lost: 1,
      goalsFor: 20,
      goalsAgainst: 5,
      points: 25,
    },
  ],
};

function fakeExplorer(fail = false): CompetitionExplorer & {
  calendar: ReturnType<typeof vi.fn>;
  standings: ReturnType<typeof vi.fn>;
} {
  return {
    calendar: vi.fn(async () => {
      if (fail) throw new Error("explorer down");
      return explorerCalendar;
    }),
    standings: vi.fn(async () => {
      if (fail) throw new Error("explorer down");
      return explorerStandings;
    }),
  };
}

const LOCAL = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
] as const;
const NO_CALENDAR = ["primera-federacion-fem", "segunda-federacion-fem-g1"];
// CA-7: primera-rfef-g1 could not be shown to be the Group 1 (ledger).
const STANDINGS_EXPLORER = ["primera-division", "segunda-division", "liga-f"];
const NO_STANDINGS = ALLOWED_COMPETITIONS.filter(
  (id) => !STANDINGS_EXPLORER.includes(id),
);

const render = async (node: Promise<unknown>) =>
  renderToStaticMarkup(
    (await node) as Parameters<typeof renderToStaticMarkup>[0],
  );

describe("SPEC-089 CA-1 explicit source map", () => {
  it("is exactly the declared map", () => {
    expect(COMPETITION_SOURCES).toEqual({
      "liga-f": { calendar: "explorer", standings: "explorer" },
      "primera-federacion-fem": { calendar: "none", standings: "none" },
      "segunda-federacion-fem-g1": { calendar: "none", standings: "none" },
      "primera-division": { calendar: "local", standings: "explorer" },
      "segunda-division": { calendar: "local", standings: "explorer" },
      "primera-rfef-g1": { calendar: "local", standings: "none" },
      "segunda-rfef-g1": { calendar: "local", standings: "none" },
      "tercera-rfef-g1": { calendar: "local", standings: "none" },
    });
    expect(Object.keys(COMPETITION_SOURCES).sort()).toEqual(
      [...ALLOWED_COMPETITIONS].sort(),
    );
  });

  it("every local calendar has its file in the bundle", () => {
    for (const [id, source] of Object.entries(COMPETITION_SOURCES))
      if (source.calendar === "local")
        expect(BUNDLED_CALENDARS["2026-27"]?.[id], id).toBeDefined();
  });
});

describe("SPEC-089 CA-2 local calendar", () => {
  it("tercera-rfef-g1: the 306 matches of the file, by name, no explorer", async () => {
    const explorer = fakeExplorer();
    const result = await loadCompetitionCalendar("tercera-rfef-g1", explorer);
    expect(explorer.calendar).not.toHaveBeenCalled();
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.matches).toHaveLength(306);
    expect(result.data.matches).toHaveLength(tercera.matches.length);
    const names = new Set(result.data.matches.flatMap((m) => [m.home, m.away]));
    expect(names.has("Alondras CF")).toBe(true);
    expect(names.has("alondras")).toBe(false);
    const first = result.data.matches[0];
    expect(first?.timeConfirmed).toBeUndefined();
    expect(first?.externalId).toMatch(/^tercera-rfef-g1-2026-27-j\d+-/);
  });

  it.each(LOCAL)("%s comes from its file, never explorer", async (id) => {
    const explorer = fakeExplorer();
    const result = await loadCompetitionCalendar(id, explorer);
    expect(explorer.calendar).not.toHaveBeenCalled();
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const file = BUNDLED_CALENDARS["2026-27"]?.[id] as { matches: unknown[] };
    expect(result.data.matches).toHaveLength(file.matches.length);
  });

  it("an invalid file is unavailable, never explorer", async () => {
    const explorer = fakeExplorer();
    const result = await loadCompetitionCalendar("tercera-rfef-g1", explorer, {
      "tercera-rfef-g1": { competition: {}, teams: [], matches: [] },
    });
    expect(result).toEqual({ kind: "unavailable" });
    expect(explorer.calendar).not.toHaveBeenCalled();
  });

  it("the calendar page and the overview paint the local matches", async () => {
    for (const page of [CompetitionCalendarPage, CompetitionOverviewPage]) {
      const explorer = fakeExplorer();
      const html = await render(
        page({ id: "tercera-rfef-g1", locale: "gl", explorer }),
      );
      expect(explorer.calendar).not.toHaveBeenCalled();
      expect(html).toContain("Alondras CF");
      expect(html).not.toContain(t("gl", "competitions.tbdTime"));
    }
  });
});

describe("SPEC-089 CA-4 no official calendar", () => {
  for (const id of NO_CALENDAR)
    for (const locale of ["gl", "es"] as const)
      it(`${id} (${locale}) says so, explorer not called`, async () => {
        expect(await loadCompetitionCalendar(id, fakeExplorer())).toEqual({
          kind: "notOffered",
        });
        for (const page of [CompetitionCalendarPage, CompetitionOverviewPage]) {
          const explorer = fakeExplorer();
          const html = await render(page({ id, locale, explorer }));
          expect(explorer.calendar).not.toHaveBeenCalled();
          expect(html).toContain(t(locale, "competitions.calendarNotOffered"));
          expect(html).not.toContain('data-testid="calendar-view"');
        }
      });

  it("the texts are the decided ones and differ from unavailable", () => {
    expect(t("gl", "competitions.calendarNotOffered")).toBe(
      "O calendario oficial desta competición aínda non está en marcador.gal.",
    );
    expect(t("es", "competitions.calendarNotOffered")).toBe(
      "El calendario oficial de esta competición aún no está en marcador.gal.",
    );
    for (const locale of ["gl", "es"] as const)
      expect(t(locale, "competitions.calendarNotOffered")).not.toBe(
        t(locale, "xornada.unavailable"),
      );
  });
});

describe("SPEC-089 CA-5 no real standings", () => {
  it("lists the four none", () => {
    expect([...NO_STANDINGS].sort()).toEqual(
      [
        "primera-federacion-fem",
        "primera-rfef-g1",
        "segunda-federacion-fem-g1",
        "segunda-rfef-g1",
        "tercera-rfef-g1",
      ].sort(),
    );
  });

  for (const id of NO_STANDINGS)
    for (const locale of ["gl", "es"] as const)
      it(`${id} (${locale}) says so, explorer not called`, async () => {
        expect(await loadCompetitionStandings(id, fakeExplorer())).toEqual({
          kind: "notOffered",
        });
        for (const page of [
          CompetitionStandingsPage,
          CompetitionOverviewPage,
        ]) {
          const explorer = fakeExplorer();
          const html = await render(page({ id, locale, explorer }));
          expect(explorer.standings).not.toHaveBeenCalled();
          expect(html).toContain(t(locale, "competitions.standingsNotOffered"));
          expect(html).not.toContain("Equipo Explorer");
        }
      });

  it("the texts are the decided ones and differ from unavailable", () => {
    expect(t("gl", "competitions.standingsNotOffered")).toBe(
      "A clasificación oficial desta competición aínda non está en marcador.gal.",
    );
    expect(t("es", "competitions.standingsNotOffered")).toBe(
      "La clasificación oficial de esta competición aún no está en marcador.gal.",
    );
    for (const locale of ["gl", "es"] as const)
      expect(t(locale, "competitions.standingsNotOffered")).not.toBe(
        t(locale, "xornada.unavailable"),
      );
  });
});

describe("SPEC-089 CA-6 no regression", () => {
  it("liga-f keeps calendar and standings from explorer", async () => {
    const explorer = fakeExplorer();
    const calendar = await loadCompetitionCalendar("liga-f", explorer);
    const standings = await loadCompetitionStandings("liga-f", explorer);
    expect(explorer.calendar).toHaveBeenCalledWith("liga-f", "2026-27");
    expect(explorer.standings).toHaveBeenCalledWith("liga-f", "2026-27");
    expect(calendar).toEqual({ kind: "ok", data: explorerCalendar });
    expect(standings).toEqual({ kind: "ok", data: explorerStandings });
    const html = await render(
      CompetitionOverviewPage({ id: "liga-f", locale: "gl", explorer }),
    );
    expect(html).toContain("Horario confirmado");
    expect(html).toContain("Equipo Explorer");
  });

  it.each(STANDINGS_EXPLORER)("%s standings from explorer", async (id) => {
    const explorer = fakeExplorer();
    const html = await render(
      CompetitionStandingsPage({ id, locale: "es", explorer }),
    );
    expect(explorer.standings).toHaveBeenCalledWith(id, "2026-27");
    expect(html).toContain("Equipo Explorer");
  });

  it("an explorer failure is still unavailable", async () => {
    const explorer = fakeExplorer(true);
    expect(await loadCompetitionCalendar("liga-f", explorer)).toEqual({
      kind: "unavailable",
    });
    expect(
      await loadCompetitionStandings("primera-division", explorer),
    ).toEqual({ kind: "unavailable" });
    const html = await render(
      CompetitionOverviewPage({ id: "liga-f", locale: "gl", explorer }),
    );
    expect(html).toContain(t("gl", "xornada.unavailable"));
  });

  it("an empty explorer answer is unavailable", async () => {
    const explorer: CompetitionExplorer = {
      calendar: async () => ({ ...explorerCalendar, matches: [] }),
      standings: async () => ({ ...explorerStandings, standings: [] }),
    };
    expect(await loadCompetitionCalendar("liga-f", explorer)).toEqual({
      kind: "unavailable",
    });
    expect(await loadCompetitionStandings("liga-f", explorer)).toEqual({
      kind: "unavailable",
    });
  });

  it.each([...ALLOWED_COMPETITIONS])(
    "%s answers the three pages",
    async (id) => {
      for (const page of [
        CompetitionOverviewPage,
        CompetitionCalendarPage,
        CompetitionStandingsPage,
      ]) {
        const html = await render(
          page({ id, locale: "gl", explorer: fakeExplorer() }),
        );
        expect(html).toContain("competition-");
      }
    },
  );
});
