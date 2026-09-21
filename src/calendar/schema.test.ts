import { describe, expect, it } from "vitest";
import {
  AliasFile,
  CalendarFile,
  validateAliases,
  validateCalendar,
} from "./schema.ts";

const calendar = {
  competition: {
    id: "tercera-rfef-g1",
    season: "2026-27",
    name: "Tercera RFEF Grupo 1",
    tier: 5,
  },
  teams: [
    { id: "ud-ourense", name: "UD Ourense" },
    { id: "cd-arenteiro", name: "CD Arenteiro" },
    { id: "arosa-sc", name: "Arosa SC" },
    { id: "sd-compostela", name: "SD Compostela" },
  ],
  matches: [
    {
      round: 1,
      kickoff: "2026-09-06T16:00:00Z",
      home: "ud-ourense",
      away: "cd-arenteiro",
    },
    {
      round: 1,
      kickoff: "2026-09-06T17:00:00Z",
      home: "arosa-sc",
      away: "sd-compostela",
    },
    {
      round: 2,
      kickoff: "2026-09-13T16:00:00Z",
      home: "cd-arenteiro",
      away: "arosa-sc",
    },
  ],
};
const ctx = { season: "2026-27", competitionId: "tercera-rfef-g1" };

const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe("CA-1 CalendarFile", () => {
  it("parses a valid file and validateCalendar returns no issues", () => {
    expect(CalendarFile.safeParse(calendar).success).toBe(true);
    expect(validateCalendar(calendar, ctx)).toEqual([]);
  });

  it("accepts an optional shortName per team (N-11)", () => {
    const withShort = {
      ...calendar,
      teams: calendar.teams.map((t, i) =>
        i === 0 ? { ...t, shortName: "Ourense" } : t,
      ),
    };
    expect(validateCalendar(withShort, ctx)).toEqual([]);
  });

  it("rejects an empty shortName or one equal to name", () => {
    const empty = {
      ...calendar,
      teams: [
        { ...calendar.teams[0], shortName: "" },
        ...calendar.teams.slice(1),
      ],
    };
    expect(paths(validateCalendar(empty, ctx))).toContain("teams.0.shortName");
    const same = {
      ...calendar,
      teams: [
        { ...calendar.teams[0], shortName: calendar.teams[0].name },
        ...calendar.teams.slice(1),
      ],
    };
    expect(paths(validateCalendar(same, ctx))).toContain("teams.0.shortName");
  });

  it("rejects an unknown key such as providerId, with its path", () => {
    const withProvider = {
      ...calendar,
      matches: [{ ...calendar.matches[0], providerId: 12345 }],
    };
    expect(CalendarFile.safeParse(withProvider).success).toBe(false);
    const issues = validateCalendar(withProvider, ctx);
    expect(issues.length).toBeGreaterThan(0);
    expect(paths(issues)).toContain("matches.0.providerId");
  });

  it("rejects a match id in the file", () => {
    const withId = {
      ...calendar,
      matches: [{ ...calendar.matches[0], id: "x" }],
    };
    expect(paths(validateCalendar(withId, ctx))).toContain("matches.0.id");
  });

  it("requires competition.season to match the folder", () => {
    const issues = validateCalendar(calendar, { ...ctx, season: "2025-26" });
    expect(paths(issues)).toContain("competition.season");
  });

  it("requires competition.id to match the file name", () => {
    const issues = validateCalendar(calendar, {
      ...ctx,
      competitionId: "segunda-rfef-g1",
    });
    expect(paths(issues)).toContain("competition.id");
  });

  it("requires unique team ids", () => {
    const dup = {
      ...calendar,
      teams: [...calendar.teams, { id: "ud-ourense", name: "Other" }],
    };
    expect(paths(validateCalendar(dup, ctx))).toContain("teams.4.id");
  });

  it("requires home and away to be declared teams", () => {
    const unknown = {
      ...calendar,
      matches: [{ ...calendar.matches[0], away: "real-madrid" }],
    };
    expect(paths(validateCalendar(unknown, ctx))).toContain("matches.0.away");
  });

  it("requires home and away to differ", () => {
    const same = {
      ...calendar,
      matches: [{ ...calendar.matches[0], away: "ud-ourense" }],
    };
    expect(paths(validateCalendar(same, ctx))).toContain("matches.0.away");
  });

  it("rejects a team playing twice in the same round", () => {
    const twice = {
      ...calendar,
      matches: [
        ...calendar.matches,
        {
          round: 1,
          kickoff: "2026-09-07T18:00:00Z",
          home: "ud-ourense",
          away: "sd-compostela",
        },
      ],
    };
    expect(paths(validateCalendar(twice, ctx))).toContain("matches.3.home");
  });

  it("rejects duplicate derived ids", () => {
    const dup = {
      ...calendar,
      matches: [
        ...calendar.matches,
        { ...calendar.matches[2], kickoff: "2026-09-14T18:00:00Z" },
      ],
    };
    expect(paths(validateCalendar(dup, ctx))).toContain("matches.3");
  });

  it("rejects a match whose derivation does not parse as Match", () => {
    const bad = {
      ...calendar,
      matches: [{ ...calendar.matches[0], round: 0 }],
    };
    expect(paths(validateCalendar(bad, ctx))).toContain("matches.0.round");
  });

  it("rejects offsets in kickoff and fewer than two teams", () => {
    const offset = {
      ...calendar,
      matches: [
        { ...calendar.matches[0], kickoff: "2026-09-06T18:00:00+02:00" },
      ],
    };
    expect(paths(validateCalendar(offset, ctx))).toContain("matches.0.kickoff");
    const one = { ...calendar, teams: calendar.teams.slice(0, 1) };
    expect(paths(validateCalendar(one, ctx))).toContain("teams");
  });
});

const aliases = {
  source: "api-football",
  season: "2026-27",
  teams: [
    { externalId: "9591", externalName: "Ourense", teamId: "ud-ourense" },
    { externalId: "9599", externalName: "Arenteiro", teamId: "cd-arenteiro" },
  ],
};
const aliasCtx = {
  season: "2026-27",
  sourceId: "api-football",
  knownTeams: ["ud-ourense", "cd-arenteiro"],
};

describe("CA-3 AliasFile", () => {
  it("parses a valid file and validateAliases returns no issues", () => {
    expect(AliasFile.safeParse(aliases).success).toBe(true);
    expect(validateAliases(aliases, aliasCtx)).toEqual([]);
  });

  it("requires source and season to match file name and folder", () => {
    expect(
      paths(validateAliases(aliases, { ...aliasCtx, sourceId: "other" })),
    ).toContain("source");
    expect(
      paths(validateAliases(aliases, { ...aliasCtx, season: "2025-26" })),
    ).toContain("season");
  });

  it("rejects a repeated externalId", () => {
    const dup = {
      ...aliases,
      teams: [
        ...aliases.teams,
        {
          externalId: "9591",
          externalName: "Ourense B",
          teamId: "cd-arenteiro",
        },
      ],
    };
    expect(paths(validateAliases(dup, aliasCtx))).toContain(
      "teams.2.externalId",
    );
  });

  it("rejects a repeated externalName", () => {
    const dup = {
      ...aliases,
      teams: [
        ...aliases.teams,
        { externalId: "1", externalName: "Ourense", teamId: "cd-arenteiro" },
      ],
    };
    expect(paths(validateAliases(dup, aliasCtx))).toContain(
      "teams.2.externalName",
    );
  });

  it("rejects an unknown teamId", () => {
    const unknown = {
      ...aliases,
      teams: [{ externalId: "1", externalName: "X", teamId: "cd-lugo" }],
    };
    expect(paths(validateAliases(unknown, aliasCtx))).toContain(
      "teams.0.teamId",
    );
  });

  it("rejects an extra key", () => {
    const extra = { ...aliases, provider: "api-football" };
    expect(paths(validateAliases(extra, aliasCtx))).toContain("provider");
  });
});
