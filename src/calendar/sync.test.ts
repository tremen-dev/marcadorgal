import { describe, expect, it } from "vitest";
import { Competition, type ImportedCalendar } from "../model/index.ts";
import { AliasFile, CalendarFile } from "./schema.ts";
import { slugify, syncCalendar } from "./sync.ts";

const competition = Competition.parse({
  id: "tercera-rfef-g1",
  season: "2026-27",
  name: "Tercera RFEF Grupo 1",
  tier: 5,
});

const imported: ImportedCalendar = {
  teams: [
    { externalId: "1", externalName: "Ourense" },
    { externalId: "2", externalName: "Arenteiro" },
    { externalId: "3", externalName: "Arosa" },
    { externalId: "4", externalName: "Compostela" },
  ],
  matches: [
    {
      externalId: "1001",
      round: 1,
      kickoff: "2026-09-06T16:00:00Z",
      home: "1",
      away: "2",
      timeConfirmed: true,
    },
    {
      externalId: "1002",
      round: 1,
      kickoff: "2026-09-06T17:00:00Z",
      home: "3",
      away: "4",
      timeConfirmed: true,
    },
    {
      externalId: "1003",
      round: 2,
      kickoff: "2026-09-13T16:00:00Z",
      home: "2",
      away: "3",
      timeConfirmed: false,
    },
  ],
  ignoredRounds: { "Promotion Play-offs - final": 2 },
};

const emptyAliases = AliasFile.parse({
  source: "api-football",
  season: "2026-27",
  teams: [],
});

const sourceId = "api-football";
const initial = () =>
  syncCalendar({
    current: null,
    aliases: emptyAliases,
    imported,
    competition,
    sourceId,
  });

describe("CA-6 syncCalendar", () => {
  it("builds the initial draft: every team new, every match added, aliases created", () => {
    const { calendar, aliases, diff } = initial();
    expect(calendar.competition).toEqual(competition);
    expect(calendar.teams).toEqual([
      { id: "arenteiro", name: "Arenteiro" },
      { id: "arosa", name: "Arosa" },
      { id: "compostela", name: "Compostela" },
      { id: "ourense", name: "Ourense" },
    ]);
    // Ordered by round, home and away — never by kickoff (O-6), so the 17:00
    // match comes first inside round 1 because "arosa" < "ourense".
    expect(calendar.matches).toEqual([
      {
        round: 1,
        kickoff: "2026-09-06T17:00:00Z",
        home: "arosa",
        away: "compostela",
      },
      {
        round: 1,
        kickoff: "2026-09-06T16:00:00Z",
        home: "ourense",
        away: "arenteiro",
      },
      {
        round: 2,
        kickoff: "2026-09-13T16:00:00Z",
        home: "arenteiro",
        away: "arosa",
      },
    ]);
    expect(aliases.teams).toEqual([
      { externalId: "1", externalName: "Ourense", teamId: "ourense" },
      { externalId: "2", externalName: "Arenteiro", teamId: "arenteiro" },
      { externalId: "3", externalName: "Arosa", teamId: "arosa" },
      { externalId: "4", externalName: "Compostela", teamId: "compostela" },
    ]);
    expect(diff.newTeams).toHaveLength(4);
    expect(diff.added).toHaveLength(3);
    expect(diff.rescheduled).toEqual([]);
    expect(diff.missing).toEqual([]);
    expect(diff.renamedAtProvider).toEqual([]);
    expect(diff.unconfirmed).toEqual([
      "tercera-rfef-g1-2026-27-j2-arenteiro-arosa",
    ]);
    expect(diff.ignoredRounds).toEqual(imported.ignoredRounds);
  });

  it("(a) uses the alias when present and slugifies new teams with a -2 suffix on collision", () => {
    const aliases = AliasFile.parse({
      ...emptyAliases,
      teams: [
        { externalId: "1", externalName: "Ourense", teamId: "ud-ourense" },
      ],
    });
    const current = CalendarFile.parse({
      competition,
      teams: [
        { id: "ud-ourense", name: "UD Ourense" },
        { id: "arosa", name: "Arosa SC" },
      ],
      matches: [
        {
          round: 3,
          kickoff: "2026-09-20T16:00:00Z",
          home: "ud-ourense",
          away: "arosa",
        },
      ],
    });
    const withCollision: ImportedCalendar = {
      ...imported,
      teams: [
        { externalId: "1", externalName: "Ourense" },
        { externalId: "2", externalName: "Arenteiro" },
        { externalId: "9", externalName: "Arosa" },
        { externalId: "4", externalName: "Compostela" },
      ],
      matches: imported.matches.map((m) =>
        m.home === "3"
          ? { ...m, home: "9" }
          : m.away === "3"
            ? { ...m, away: "9" }
            : m,
      ),
    };
    const {
      calendar,
      aliases: out,
      diff,
    } = syncCalendar({
      current,
      aliases,
      imported: withCollision,
      competition,
      sourceId,
    });
    expect(calendar.teams.find((t) => t.id === "ud-ourense")?.name).toBe(
      "UD Ourense",
    );
    expect(calendar.teams.map((t) => t.id)).toEqual([
      "arenteiro",
      "arosa",
      "arosa-2",
      "compostela",
      "ud-ourense",
    ]);
    expect(out.teams).toContainEqual({
      externalId: "9",
      externalName: "Arosa",
      teamId: "arosa-2",
    });
    expect(diff.newTeams.map((t) => t.teamId)).toEqual([
      "arenteiro",
      "arosa-2",
      "compostela",
    ]);
    // Looked up and not indexed: what this case is about is the alias, not
    // the position.
    expect(
      calendar.matches.find((m) => m.home === "ud-ourense" && m.round === 1),
    ).toEqual({
      round: 1,
      kickoff: "2026-09-06T16:00:00Z",
      home: "ud-ourense",
      away: "arenteiro",
    });
  });

  it("(b) reports added and rescheduled matches and updates the kickoff", () => {
    const { calendar: current, aliases } = initial();
    const moved: ImportedCalendar = {
      ...imported,
      matches: [
        { ...imported.matches[0], kickoff: "2026-09-07T18:30:00Z" },
        imported.matches[1],
        imported.matches[2],
        {
          externalId: "1004",
          round: 3,
          kickoff: "2026-09-20T16:00:00Z",
          home: "4",
          away: "1",
          timeConfirmed: true,
        },
      ],
    };
    const { calendar, diff } = syncCalendar({
      current,
      aliases,
      imported: moved,
      competition,
      sourceId,
    });
    expect(diff.rescheduled).toEqual([
      {
        id: "tercera-rfef-g1-2026-27-j1-ourense-arenteiro",
        from: "2026-09-06T16:00:00Z",
        to: "2026-09-07T18:30:00Z",
      },
    ]);
    expect(diff.added).toEqual([
      "tercera-rfef-g1-2026-27-j3-compostela-ourense",
    ]);
    expect(
      calendar.matches.find((m) => m.home === "ourense" && m.round === 1)
        ?.kickoff,
    ).toBe("2026-09-07T18:30:00Z");
    expect(calendar.matches).toHaveLength(4);
  });

  // O-6: CA-8 exists so a human sees the postponements (D-3), and that only
  // works if the postponement is the whole diff.
  it("(O-6) a reschedule rewrites the kickoff in place and moves nothing", () => {
    const { calendar: current, aliases } = initial();
    const before = syncCalendar({
      current,
      aliases,
      imported,
      competition,
      sourceId,
    }).calendar;

    // The very postponement of the real dispatch: a match pushed five weeks
    // later, which under an order by kickoff jumped to the end of its round.
    const moved: ImportedCalendar = {
      ...imported,
      matches: [
        { ...imported.matches[0], kickoff: "2026-10-21T18:00:00Z" },
        imported.matches[1],
        imported.matches[2],
      ],
    };
    const after = syncCalendar({
      current,
      aliases,
      imported: moved,
      competition,
      sourceId,
    }).calendar;

    // Same matches, same positions: only one field of one match differs.
    expect(after.matches.map((m) => [m.round, m.home, m.away])).toEqual(
      before.matches.map((m) => [m.round, m.home, m.away]),
    );
    const changed = after.matches.filter(
      (m, i) => m.kickoff !== before.matches[i].kickoff,
    );
    expect(changed).toHaveLength(1);
    expect(changed[0].kickoff).toBe("2026-10-21T18:00:00Z");
    expect(after.teams).toEqual(before.teams);
  });

  it("(c) keeps matches missing from the provider and reports them", () => {
    const { calendar: current, aliases } = initial();
    const fewer: ImportedCalendar = {
      ...imported,
      matches: imported.matches.slice(1),
    };
    const { calendar, diff } = syncCalendar({
      current,
      aliases,
      imported: fewer,
      competition,
      sourceId,
    });
    expect(diff.missing).toEqual([
      "tercera-rfef-g1-2026-27-j1-ourense-arenteiro",
    ]);
    expect(calendar.matches).toHaveLength(3);
  });

  it("(d) never changes competition, existing team names/ids or existing aliases; reports provider renames", () => {
    const { calendar: first, aliases } = initial();
    const current = CalendarFile.parse({
      ...first,
      competition: { ...competition, name: "Tercera RFEF G1 (revisado)" },
      teams: first.teams.map((t) =>
        t.id === "ourense" ? { ...t, name: "UD Ourense" } : t,
      ),
    });
    const renamed: ImportedCalendar = {
      ...imported,
      teams: imported.teams.map((t) =>
        t.externalId === "1" ? { ...t, externalName: "Ourense CF" } : t,
      ),
    };
    const {
      calendar,
      aliases: out,
      diff,
    } = syncCalendar({
      current,
      aliases,
      imported: renamed,
      competition,
      sourceId,
    });
    expect(calendar.competition.name).toBe("Tercera RFEF G1 (revisado)");
    expect(calendar.teams.find((t) => t.id === "ourense")?.name).toBe(
      "UD Ourense",
    );
    expect(out.teams.find((t) => t.externalId === "1")).toEqual({
      externalId: "1",
      externalName: "Ourense",
      teamId: "ourense",
    });
    expect(diff.renamedAtProvider).toEqual([
      { externalId: "1", from: "Ourense", to: "Ourense CF", teamId: "ourense" },
    ]);
    expect(diff.newTeams).toEqual([]);
  });

  it("(d) keeps shortName of existing teams and never gives one to new teams", () => {
    const { calendar: first, aliases } = initial();
    const current = CalendarFile.parse({
      ...first,
      teams: first.teams
        .filter((t) => t.id !== "compostela")
        .map((t) => (t.id === "ourense" ? { ...t, shortName: "Ou" } : t)),
      matches: first.matches.filter(
        (m) => m.home !== "compostela" && m.away !== "compostela",
      ),
    });
    const { calendar } = syncCalendar({
      current,
      aliases,
      imported,
      competition,
      sourceId,
    });
    expect(calendar.teams.find((t) => t.id === "ourense")).toEqual({
      id: "ourense",
      name: "Ourense",
      shortName: "Ou",
    });
    for (const t of calendar.teams.filter((t) => t.id !== "ourense"))
      expect(t).not.toHaveProperty("shortName");
  });

  it("(e) copies ignoredRounds and lists unconfirmed matches", () => {
    const { diff } = initial();
    expect(diff.ignoredRounds).toEqual({ "Promotion Play-offs - final": 2 });
    expect(diff.unconfirmed).toEqual([
      "tercera-rfef-g1-2026-27-j2-arenteiro-arosa",
    ]);
  });

  it("(f) sorts teams by id and matches by round, kickoff, home regardless of input order", () => {
    const shuffled: ImportedCalendar = {
      ...imported,
      teams: [...imported.teams].reverse(),
      matches: [...imported.matches].reverse(),
    };
    const { calendar } = syncCalendar({
      current: null,
      aliases: emptyAliases,
      imported: shuffled,
      competition,
      sourceId,
    });
    expect(calendar).toEqual(initial().calendar);
  });

  it("is idempotent: a second run over its own output yields an empty diff", () => {
    const first = initial();
    const second = syncCalendar({
      current: first.calendar,
      aliases: first.aliases,
      imported,
      competition,
      sourceId,
    });
    expect(second.calendar).toEqual(first.calendar);
    expect(second.aliases).toEqual(first.aliases);
    expect(second.diff).toEqual({
      newTeams: [],
      added: [],
      rescheduled: [],
      missing: [],
      renamedAtProvider: [],
      rematched: [],
      unconfirmed: ["tercera-rfef-g1-2026-27-j2-arenteiro-arosa"],
      ignoredRounds: imported.ignoredRounds,
    });
  });

  it("(g) maps every imported match by its external id to the derived id, sorted by key (SPEC-005 CA-3)", () => {
    const { aliases } = initial();
    expect(aliases.matches).toEqual({
      "1001": "tercera-rfef-g1-2026-27-j1-ourense-arenteiro",
      "1002": "tercera-rfef-g1-2026-27-j1-arosa-compostela",
      "1003": "tercera-rfef-g1-2026-27-j2-arenteiro-arosa",
    });
    expect(Object.keys(aliases.matches ?? {})).toEqual([
      "1001",
      "1002",
      "1003",
    ]);
    expect(initial().diff.rematched).toEqual([]);
  });

  it("(g) keeps match aliases absent from the import and sorts new keys in", () => {
    const first = initial();
    const aliases = AliasFile.parse({
      ...first.aliases,
      matches: { ...first.aliases.matches, "999": "other-2026-27-j1-a-b" },
    });
    const { aliases: out } = syncCalendar({
      current: first.calendar,
      aliases,
      imported,
      competition,
      sourceId,
    });
    expect(Object.keys(out.matches ?? {})).toEqual([
      "999",
      "1001",
      "1002",
      "1003",
    ]);
    expect(out.matches?.["999"]).toBe("other-2026-27-j1-a-b");
  });

  it("(g) overwrites a match alias that moved to another match and reports it as rematched", () => {
    const first = initial();
    const moved: ImportedCalendar = {
      ...imported,
      matches: imported.matches.map((m) =>
        m.externalId === "1003" ? { ...m, home: "3", away: "2" } : m,
      ),
    };
    const { aliases, diff } = syncCalendar({
      current: first.calendar,
      aliases: first.aliases,
      imported: moved,
      competition,
      sourceId,
    });
    expect(diff.rematched).toEqual([
      {
        externalId: "1003",
        from: "tercera-rfef-g1-2026-27-j2-arenteiro-arosa",
        to: "tercera-rfef-g1-2026-27-j2-arosa-arenteiro",
      },
    ]);
    expect(aliases.matches?.["1003"]).toBe(
      "tercera-rfef-g1-2026-27-j2-arosa-arenteiro",
    );
  });

  it("slugify strips diacritics, lowercases and hyphenates", () => {
    expect(slugify("Celta de Vigo III")).toBe("celta-de-vigo-iii");
    expect(slugify("Coruña B")).toBe("coruna-b");
    expect(slugify("  Racing  Villalbés ")).toBe("racing-villalbes");
    expect(slugify("Ourense C.F.")).toBe("ourense-c-f");
  });
});
