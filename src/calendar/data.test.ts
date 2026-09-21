import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMPETITIONS } from "./importers.ts";
import {
  AliasFile,
  CalendarFile,
  validateAliases,
  validateCalendar,
} from "./schema.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));
const calendarRoot = path.join(root, "data", "calendario");
const aliasRoot = path.join(root, "data", "alias");

const seasons = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).filter((s) => /^\d{4}-\d{2}$/.test(s))
    : [];
const jsonFiles = (dir: string): string[] =>
  readdirSync(dir).filter((f) => f.endsWith(".json"));
const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(file, "utf8"));

type Loaded = { season: string; id: string; file: string; data: CalendarFile };
const calendars: Loaded[] = seasons(calendarRoot).flatMap((season) =>
  jsonFiles(path.join(calendarRoot, season)).map((name) => {
    const file = path.join(calendarRoot, season, name);
    return {
      season,
      id: name.slice(0, -5),
      file,
      data: CalendarFile.parse(readJson(file)),
    };
  }),
);
const aliasFiles = seasons(aliasRoot).flatMap((season) =>
  jsonFiles(path.join(aliasRoot, season)).map((name) => {
    const file = path.join(aliasRoot, season, name);
    return {
      season,
      sourceId: name.slice(0, -5),
      file,
      data: AliasFile.parse(readJson(file)),
    };
  }),
);

describe("CA-8 data/calendario/2026-27", () => {
  it("has the five competitions with tiers 1..5", () => {
    const current = calendars.filter((c) => c.season === "2026-27");
    expect(current.map((c) => [c.id, c.data.competition.tier]).sort()).toEqual(
      COMPETITIONS.map((c) => [c.id, c.tier]).sort(),
    );
  });

  it("has the api-football alias file", () => {
    expect(
      aliasFiles.some(
        (a) => a.season === "2026-27" && a.sourceId === "api-football",
      ),
    ).toBe(true);
  });
});

describe.each(calendars.map((c) => [`${c.season}/${c.id}`, c] as const))(
  "CA-8 calendar %s",
  (_name, { season, id, data }) => {
    it("passes validateCalendar without issues", () => {
      expect(validateCalendar(data, { season, competitionId: id })).toEqual([]);
    });

    it("is a full double round robin (N-8)", () => {
      const n = data.teams.length;
      const rounds = n % 2 === 0 ? 2 * (n - 1) : 2 * n;
      const perRound = Math.floor(n / 2);
      const byRound = new Map<number, typeof data.matches>();
      for (const m of data.matches) {
        byRound.set(m.round, [...(byRound.get(m.round) ?? []), m]);
      }
      expect([...byRound.keys()].sort((a, b) => a - b)).toEqual(
        Array.from({ length: rounds }, (_, i) => i + 1),
      );
      for (const [round, matches] of byRound) {
        expect(matches, `round ${round}`).toHaveLength(perRound);
        const played = matches.flatMap((m) => [m.home, m.away]);
        expect(new Set(played).size, `round ${round}`).toBe(played.length);
      }
    });

    it("has non-empty team names different from their ids", () => {
      for (const t of data.teams) {
        expect(t.name.trim()).not.toBe("");
        expect(t.name).not.toBe(t.id);
      }
    });
  },
);

describe.each(aliasFiles.map((a) => [`${a.season}/${a.sourceId}`, a] as const))(
  "CA-8 alias %s",
  (_name, { season, sourceId, data }) => {
    const teamIds = new Set(
      calendars
        .filter((c) => c.season === season)
        .flatMap((c) => c.data.teams.map((t) => t.id)),
    );

    it("passes validateAliases against the union of the season's calendars", () => {
      expect(
        validateAliases(data, { season, sourceId, knownTeams: teamIds }),
      ).toEqual([]);
    });

    it("maps every team of the season exactly once and nothing else", () => {
      const aliased = new Set(data.teams.map((t) => t.teamId));
      expect(aliased.size).toBe(data.teams.length);
      expect([...teamIds].filter((id) => !aliased.has(id))).toEqual([]);
      expect([...aliased].filter((id) => !teamIds.has(id))).toEqual([]);
    });
  },
);
