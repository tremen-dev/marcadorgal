import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CompetitionCalendarPage,
  CompetitionOverviewPage,
  CompetitionStandingsPage,
} from "../app/competition-page.tsx";
import { t } from "../i18n/index.ts";
import {
  type CompetitionExplorer,
  loadCompetitionCalendar,
} from "./competition-data.ts";
import type {
  OfficialCalendarResponse,
  StandingsResponse,
} from "./explorer-client.ts";

// SPEC-091 CA-2, CA-7, CA-9: the G1 pages with the capture of CA-1,
// explorer injected (SPEC-089, as SPEC-085 CA-2), no network.

const G1 = "segunda-federacion-fem-g1";
const EXPORT_DIR = "src/sources/rfef/fixtures/export";
const readJson = <T>(name: string): T =>
  JSON.parse(readFileSync(`${EXPORT_DIR}/${name}`, "utf8")) as T;
const CALENDAR = readJson<OfficialCalendarResponse>(
  "calendar-segunda-federacion-fem-g1-2026-27-2026-11-17T1220Z.json",
);
const STANDINGS = readJson<StandingsResponse>(
  "standings-segunda-federacion-fem-g1-2026-27-2026-11-17T1220Z.json",
);

function explorerOf(
  calendar: OfficialCalendarResponse = CALENDAR,
  fail = false,
): CompetitionExplorer & {
  calendar: ReturnType<typeof vi.fn>;
  standings: ReturnType<typeof vi.fn>;
} {
  return {
    calendar: vi.fn(async () => {
      if (fail) throw new Error("explorer down");
      return calendar;
    }),
    standings: vi.fn(async () => {
      if (fail) throw new Error("explorer down");
      return STANDINGS;
    }),
  };
}

const render = async (node: Promise<unknown>) =>
  renderToStaticMarkup(
    (await node) as Parameters<typeof renderToStaticMarkup>[0],
  );

// The card of one match, by its id.
const card = (html: string, id: string): string => {
  const at = html.indexOf(`data-match-id="${id}"`);
  if (at < 0) throw new Error(`no card ${id}`);
  const start = html.lastIndexOf("<div", at);
  const next = html.indexOf("data-match-id=", at + 1);
  return html.slice(
    start,
    next < 0 ? undefined : html.lastIndexOf("<div", next),
  );
};

const strip = (html: string) => html.replace(/<[^>]+>/g, "|");

const G1_IDS = [
  "arratia",
  "as-celtas",
  "bizkerre-club",
  "burgos-femenino",
  "depor-abanca-b",
  "eibar-femenino-b",
  "madrid-cff-b",
  "osasuna-femenino-b",
  "racing-santander-femenino",
  "rayo-vallecano-femenino",
  "real-aviles-industrial",
  "real-oviedo-femenino",
  "sporting-gijon-femenino",
  "victoria",
];

describe("SPEC-091 CA-2 the G1 pages read explorer", () => {
  it("calendar and standings asked for G1; 1ª Fed. Fem. never", async () => {
    const explorer = explorerOf();
    await render(CompetitionOverviewPage({ id: G1, locale: "gl", explorer }));
    expect(explorer.calendar).toHaveBeenCalledWith(G1, "2026-27");
    expect(explorer.standings).toHaveBeenCalledWith(G1, "2026-27");
    const other = explorerOf();
    for (const page of [
      CompetitionOverviewPage,
      CompetitionCalendarPage,
      CompetitionStandingsPage,
    ])
      await render(
        page({ id: "primera-federacion-fem", locale: "gl", explorer: other }),
      );
    expect(other.calendar).not.toHaveBeenCalled();
    expect(other.standings).not.toHaveBeenCalled();
  });
});

describe("SPEC-091 CA-7 the calendar page", () => {
  it("182 matches in 26 rounds", async () => {
    const result = await loadCompetitionCalendar(G1, explorerOf());
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.matches).toHaveLength(182);
    expect(new Set(result.data.matches.map((m) => m.round)).size).toBe(26);
    const html = await render(
      CompetitionCalendarPage({ id: G1, locale: "gl", explorer: explorerOf() }),
    );
    expect(html.match(/data-match-id=/g)).toHaveLength(182);
    for (let n = 1; n <= 26; n++) expect(html).toContain(`xornada ${n}<`);
  });

  it.each([
    ["gl", "dom 22 nov · 12:00"],
    ["es", "dom 22 nov · 12:00"],
  ] as const)("exact (%s): «%s» and confirmedTime", async (locale, when) => {
    const html = await render(
      CompetitionCalendarPage({ id: G1, locale, explorer: explorerOf() }),
    );
    const c = card(html, "2026-27-2fed-fem-j10-depor-abanca-b-bizkerre-club");
    expect(c).toContain(when);
    expect(c).toContain(t(locale, "competitions.confirmedTime"));
  });

  it.each(["gl", "es"] as const)(
    "round (%s): no day nor time, only dateTbd, no «Xornada N» in the match",
    async (locale) => {
      const html = await render(
        CompetitionCalendarPage({ id: G1, locale, explorer: explorerOf() }),
      );
      const c = card(
        html,
        "2026-27-2fed-fem-j11-depor-abanca-b-real-oviedo-femenino",
      );
      const text = strip(c);
      expect(text).toContain(t(locale, "competitions.dateTbd"));
      expect(text).not.toMatch(/\d{2}:\d{2}/);
      expect(text).not.toMatch(
        /\b(dom|sáb|lun|mar|mér|mié|xov|jue|ven|vie) \d/,
      );
      expect(text).not.toContain(t(locale, "xornada.round", { n: 11 }));
      expect(text).not.toContain(t(locale, "competitions.tbdTime"));
      expect(text).not.toContain(t(locale, "competitions.confirmedTime"));
    },
  );

  // Derived in memory from the capture (no date-precision match in it): the
  // J10 Depor B–Bizkerre with dateConfirmed true and timeConfirmed false.
  it.each([
    ["gl", "dom 22 nov"],
    ["es", "dom 22 nov"],
  ] as const)(
    "date (%s, derived): «%s» without time and tbdTime",
    async (locale, when) => {
      const derived = {
        ...CALENDAR,
        matches: CALENDAR.matches.map((m) =>
          m.externalId === "2026-27-2fed-fem-j10-depor-abanca-b-bizkerre-club"
            ? { ...m, kickoff: "2026-11-22T00:00:00Z", timeConfirmed: false }
            : m,
        ),
      };
      const html = await render(
        CompetitionCalendarPage({
          id: G1,
          locale,
          explorer: explorerOf(derived),
        }),
      );
      const text = strip(
        card(html, "2026-27-2fed-fem-j10-depor-abanca-b-bizkerre-club"),
      );
      expect(text).toContain(when);
      expect(text).not.toContain("·");
      expect(text).not.toMatch(/\d{2}:\d{2}/);
      expect(text).toContain(t(locale, "competitions.tbdTime"));
    },
  );

  it("order inside a round by the nominal kickoff (SPEC-089 CA-8)", async () => {
    const html = await render(
      CompetitionCalendarPage({ id: G1, locale: "gl", explorer: explorerOf() }),
    );
    const j10 = CALENDAR.matches
      .filter((m) => m.round === 10)
      .sort(
        (a, b) =>
          Date.parse(a.kickoff) - Date.parse(b.kickoff) ||
          (a.externalId < b.externalId ? -1 : 1),
      )
      .map((m) => m.externalId);
    const painted = [...html.matchAll(/data-match-id="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((id) => id?.includes("-j10-"));
    expect(painted).toEqual(j10);
  });

  it("teams by name, never by id (G1 and liga-f)", async () => {
    const html = await render(
      CompetitionCalendarPage({ id: G1, locale: "gl", explorer: explorerOf() }),
    );
    const names = [
      ...html.matchAll(/<span class="[^"]*teamName[^"]*">([^<]*)</g),
    ].map((m) => m[1]);
    expect(names).toHaveLength(364);
    for (const id of G1_IDS) expect(names).not.toContain(id);
    expect(names).toContain("Victoria CF");
    expect(names).toContain("Deportivo ABANCA B");

    const ligaF: OfficialCalendarResponse = {
      competition: "liga-f",
      season: "2026-27",
      exportedAt: "2026-11-08T18:00:00Z",
      teams: [],
      ignoredRounds: {},
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
    };
    const lf = await render(
      CompetitionCalendarPage({
        id: "liga-f",
        locale: "gl",
        explorer: explorerOf(ligaF),
      }),
    );
    expect(lf).toContain("FC Barcelona");
    expect(lf).not.toContain(">barcelona-femenino<");
    expect(lf).toContain("/escudos/depor-abanca.svg");
  });

  it("the Galician sides keep shield and highlight", async () => {
    const html = await render(
      CompetitionCalendarPage({ id: G1, locale: "gl", explorer: explorerOf() }),
    );
    const c = card(html, "2026-27-2fed-fem-j10-depor-abanca-b-bizkerre-club");
    expect(c).toContain("/escudos/depor-abanca.svg");
    expect(c).toMatch(/matchCardGalician/);
    const v = card(html, "2026-27-2fed-fem-j10-victoria-real-oviedo-femenino");
    expect(v).toMatch(/matchCardGalician/);
  });
});

describe("SPEC-091 CA-9 the standings", () => {
  it.each(["gl", "es"] as const)(
    "14 rows, Depor ABANCA B first (%s)",
    async (locale) => {
      const html = await render(
        CompetitionStandingsPage({ id: G1, locale, explorer: explorerOf() }),
      );
      const rows = [...html.matchAll(/<tr[^>]*data-team-id="([^"]+)"[^>]*>/g)];
      expect(rows).toHaveLength(14);
      expect(rows[0]?.[1]).toBe("depor-abanca-b");
      expect(rows[0]?.[0]).toContain('data-galician="true"');
      const first = html.slice(
        rows[0]?.index ?? 0,
        html.indexOf("</tr>", rows[0]?.index),
      );
      expect(first).toContain("/escudos/depor-abanca.svg");
      expect(first).toContain("Deportivo ABANCA B");
      // PJ, G, E, P, GF, GC, DG, Pts.
      const nums = [
        ...first.matchAll(/<td class="[^"]*">(-?\+?\d+)<\/td>/g),
      ].map((m) => m[1]);
      expect(nums).toEqual(["1", "9", "7", "1", "1", "27", "6", "+21", "22"]);
    },
  );

  it("an explorer failure is xornada.unavailable (SPEC-089 CA-6)", async () => {
    for (const page of [CompetitionStandingsPage, CompetitionCalendarPage]) {
      const html = await render(
        page({ id: G1, locale: "gl", explorer: explorerOf(CALENDAR, true) }),
      );
      expect(html).toContain(t("gl", "xornada.unavailable"));
    }
  });
});
