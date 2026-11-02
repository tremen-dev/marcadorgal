import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type AliasEntry,
  AliasFile,
  type CompetitionId,
  type TeamId,
} from "../../model/index.ts";
import { normalizeName } from "./adapter.ts";
import {
  buildRfefAlias,
  type CalendarTeams,
  unresolvedExportNames,
} from "./alias.ts";

// SPEC-038 CA-5: data/alias/2026-27/rfef.json covers every TeamId of the five
// competitions, carries the five codgrupo of alias-test.json, and is what
// npm run alias:rfef (tools/alias-rfef.mjs) generates from the federative
// names of the declared calendar plus the validated entries of
// alias-test.json. The pure half lives in alias.ts and is tested here.

const root = new URL("../../../", import.meta.url);
const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(new URL(rel, root), "utf8"));

const FIVE = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
] as CompetitionId[];

const calendars: CalendarTeams[] = FIVE.map((competitionId) => {
  const file = readJson(`data/calendario/2026-27/${competitionId}.json`) as {
    teams: { id: string; name: string }[];
  };
  return {
    competitionId,
    teams: file.teams.map((t) => ({ id: t.id as TeamId, name: t.name })),
  };
});
const allTeamIds = new Set(
  calendars.flatMap((c) => c.teams.map((t) => t.id as string)),
);

const testAlias = AliasFile.parse(
  readJson("src/sources/rfef/fixtures/alias-test.json"),
);
const real = AliasFile.parse(readJson("data/alias/2026-27/rfef.json"));

const exports = readdirSync(new URL("src/sources/rfef/fixtures/export/", root))
  .filter((f) => f.endsWith(".json"))
  .map((f) => readJson(`src/sources/rfef/fixtures/export/${f}`));

describe("CA-5 buildRfefAlias (pure)", () => {
  const CALENDARS: CalendarTeams[] = [
    {
      competitionId: "tercera-rfef-g1" as CompetitionId,
      teams: [
        { id: "barco" as TeamId, name: "CD Barco" },
        { id: "lalin" as TeamId, name: "CD  Lalín " },
      ],
    },
  ];
  const competitions = { "26991073": "tercera-rfef-g1" as CompetitionId };

  it("maps every calendar name, normalized, to its TeamId", () => {
    const file = buildRfefAlias({
      season: "2026-27",
      competitions,
      calendars: CALENDARS,
      validated: [],
      existing: [],
    });
    expect(AliasFile.parse(file)).toEqual(file);
    expect(file.source).toBe("rfef");
    expect(file.competitions).toEqual(competitions);
    expect(file.teams).toEqual([
      { externalId: "cd barco", externalName: "CD Barco", teamId: "barco" },
      { externalId: "cd lalín", externalName: "CD  Lalín ", teamId: "lalin" },
    ]);
  });

  it("adds the validated and the existing entries, the calendar winning a conflict", () => {
    const validated: AliasEntry[] = [
      {
        externalId: "c.d. barco",
        externalName: "c.d. barco",
        teamId: "barco" as TeamId,
      },
      // A conflict with the calendar: the calendar is the authority.
      {
        externalId: "cd lalín",
        externalName: "CD Lalín",
        teamId: "barco" as TeamId,
      },
      // A team of another competition: dropped, never silently kept.
      {
        externalId: "cd mirandés",
        externalName: "CD Mirandés",
        teamId: "mirandes" as TeamId,
      },
    ];
    const existing: AliasEntry[] = [
      {
        externalId: "c.d. lalin",
        externalName: "c.d. lalin",
        teamId: "lalin" as TeamId,
      },
    ];
    const file = buildRfefAlias({
      season: "2026-27",
      competitions,
      calendars: CALENDARS,
      validated,
      existing,
    });
    const byId = new Map(file.teams.map((t) => [t.externalId, t.teamId]));
    expect(byId.get("cd lalín")).toBe("lalin");
    expect(byId.get("c.d. barco")).toBe("barco");
    expect(byId.get("c.d. lalin")).toBe("lalin");
    expect(byId.has("cd mirandés")).toBe(false);
    // Unique externalId and externalName (validateAliases demands both).
    expect(new Set(file.teams.map((t) => t.externalId)).size).toBe(
      file.teams.length,
    );
    expect(new Set(file.teams.map((t) => t.externalName)).size).toBe(
      file.teams.length,
    );
    // Stable order: by teamId, then by externalId.
    const order = file.teams.map((t) => `${t.teamId}|${t.externalId}`);
    expect(order).toEqual([...order].sort());
  });

  it("unresolvedExportNames lists the names of the mapped groups that do not resolve, once each", () => {
    const file = buildRfefAlias({
      season: "2026-27",
      competitions,
      calendars: CALENDARS,
      validated: [],
      existing: [],
    });
    const body = {
      matches: [
        {
          codGrupo: "26991073",
          equipoLocal: "CD Barco",
          equipoVisitante: "c.d. lalin",
        },
        {
          codGrupo: "26991073",
          equipoLocal: "c.d. lalin",
          equipoVisitante: "viveiro c.f.",
        },
        { codGrupo: "99", equipoLocal: "ignored", equipoVisitante: "too" },
      ],
    };
    expect(unresolvedExportNames(file, body)).toEqual([
      {
        codGrupo: "26991073",
        competitionId: "tercera-rfef-g1",
        name: "c.d. lalin",
      },
      {
        codGrupo: "26991073",
        competitionId: "tercera-rfef-g1",
        name: "viveiro c.f.",
      },
    ]);
    expect(unresolvedExportNames(file, { matches: "nope" })).toEqual([]);
  });
});

describe("CA-5 data/alias/2026-27/rfef.json", () => {
  it("validates AliasFile for the rfef and the season", () => {
    expect(real.source).toBe("rfef");
    expect(real.season).toBe("2026-27");
  });

  it("carries the five codgrupo of alias-test.json", () => {
    expect(real.competitions).toEqual(testAlias.competitions);
    expect(Object.keys(real.competitions ?? {})).toHaveLength(5);
  });

  it("covers every TeamId of the five competitions of the declared calendar", () => {
    const covered = new Set(real.teams.map((t) => t.teamId as string));
    const missing = [...allTeamIds].filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
    for (const t of real.teams) expect(allTeamIds.has(t.teamId)).toBe(true);
  });

  it("every externalId is the normalized externalName (what the adapters look up)", () => {
    for (const t of real.teams)
      expect(t.externalId).toBe(normalizeName(t.externalName));
  });

  it("keeps the deliberate errors of alias-test.json out", () => {
    const byId = new Map(real.teams.map((t) => [t.externalId, t.teamId]));
    expect(byId.get("barakaldo cf")).toBe("barakaldo");
    expect(byId.get("cd coria")).toBe("coria");
    expect(byId.get("cd extremadura")).toBe("extremadura");
    expect(byId.get("cp cacereño")).toBe("cacereno");
  });

  it("is what buildRfefAlias gives for the calendar, the validated test entries and itself (idempotent)", () => {
    const TEST_ONLY_ERRORS = new Set([
      "barakaldo cf",
      "cd coria",
      "cd extremadura",
    ]);
    const regenerated = buildRfefAlias({
      season: "2026-27",
      competitions: testAlias.competitions ?? {},
      calendars,
      validated: testAlias.teams.filter(
        (t) => !TEST_ONLY_ERRORS.has(t.externalId),
      ),
      existing: real.teams,
    });
    expect(regenerated).toEqual(real);
  });

  it("resolves every name of the five competitions in the export fixtures (CA-1)", () => {
    for (const body of exports)
      expect(unresolvedExportNames(real, body)).toEqual([]);
  });
});
