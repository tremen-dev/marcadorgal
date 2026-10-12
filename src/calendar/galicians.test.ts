import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GalicianTeamsFile } from "@/model";
import { DEMO_MATCHES, DEMO_SEASON } from "@/xornada/demo";
import { buildXornada } from "@/xornada/view";
import { readSeasons } from "./files.ts";
import { GALICIAN_SEASONS, galicianNames } from "./galicians.ts";

// SPEC-033 CA-7: the demonstration has the cases of the Equipo galego mark.
describe("SPEC-033 CA-7 Equipo galego in the demonstration", () => {
  const marked = buildXornada(DEMO_MATCHES, galicianNames(DEMO_SEASON));
  const byTier = (tier: number) =>
    marked.find((c) => c.tier === tier)?.rows ?? [];

  it("Primeira: a galician that loses to a non-galician", () => {
    const losing = byTier(1).filter(
      (r) =>
        r.status === "finished" &&
        ((r.homeGalician && !r.awayGalician && r.winner === "away") ||
          (r.awayGalician && !r.homeGalician && r.winner === "home")),
    );
    expect(losing.length).toBeGreaterThan(0);
  });

  it("a galician in a postponed match", () => {
    const rows = marked.flatMap((c) => c.rows);
    expect(
      rows.some(
        (r) => r.status === "postponed" && (r.homeGalician || r.awayGalician),
      ),
    ).toBe(true);
  });

  it("every row of Terceira marks both sides (H-4)", () => {
    const rows = byTier(5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.homeGalician && r.awayGalician)).toBe(true);
  });

  it("every demo name is a team of the declared calendar", () => {
    const [calendar] = readSeasons(path.join(root, "data"), DEMO_SEASON);
    const names = new Set(
      calendar.calendars.flatMap((c) => c.teams.map((t) => t.name)),
    );
    const missing = DEMO_MATCHES.flatMap((m) => [
      m.home.name,
      m.away.name,
    ]).filter((n) => !names.has(n));
    expect(missing).toEqual([]);
  });

  it("some competition has more than one day", () => {
    expect(marked.some((c) => c.dayGroups.length > 1)).toBe(true);
  });
});

// SPEC-033 CA-4 (H-3, H-4): the Equipo galego of each season, declared in
// data/galegos/<season>.json and checked against the declared calendar.
const root = fileURLToPath(new URL("../..", import.meta.url));
const galegosRoot = path.join(root, "data", "galegos");
const files = existsSync(galegosRoot)
  ? readdirSync(galegosRoot).filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
  : [];

const readIds = (file: string): unknown =>
  JSON.parse(readFileSync(path.join(galegosRoot, file), "utf8"));

describe("SPEC-033 CA-4 data/galegos/<season>.json", () => {
  it("there is a file for 2026-27", () => {
    expect(files).toContain("2026-27.json");
  });

  it("the schema rejects a duplicate and a non-slug", () => {
    expect(GalicianTeamsFile.safeParse(["celta", "celta"]).success).toBe(false);
    expect(GalicianTeamsFile.safeParse(["RC Celta"]).success).toBe(false);
    expect(GalicianTeamsFile.safeParse(["celta", "lugo"]).success).toBe(true);
  });

  for (const file of files) {
    const season = file.slice(0, -5);
    describe(season, () => {
      const [calendar] = readSeasons(path.join(root, "data"), season);
      const teams = calendar.calendars.flatMap((c) =>
        c.teams.map((t) => ({ ...t, competition: c.competition.id })),
      );

      it("validates: a list of TeamId without duplicates", () => {
        expect(
          GalicianTeamsFile.safeParse(readIds(file)).error,
        ).toBeUndefined();
      });

      it("every id is a team of some calendar of the season", () => {
        expect(calendar.issues).toEqual([]);
        const known = new Set(teams.map((t) => t.id));
        const ids = GalicianTeamsFile.parse(readIds(file));
        expect(ids.filter((id) => !known.has(id))).toEqual([]);
      });

      it("the names of the season are unique across its calendars", () => {
        const names = teams.map((t) => t.name);
        expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
      });

      it("is registered for the server, resolved to every name", () => {
        expect(Object.keys(GALICIAN_SEASONS)).toContain(season);
        const ids = new Set(GalicianTeamsFile.parse(readIds(file)));
        expect([...galicianNames(season)].sort()).toEqual(
          teams
            .filter((t) => ids.has(t.id))
            .map((t) => t.name)
            .sort(),
        );
      });
    });
  }

  it("2026-27 declares 31: 2, 1, 5, 5 and all 18 of Terceira (H-4)", () => {
    const [calendar] = readSeasons(path.join(root, "data"), "2026-27");
    const ids = new Set(GalicianTeamsFile.parse(readIds("2026-27.json")));
    expect(ids.size).toBe(31);
    const perCompetition = Object.fromEntries(
      calendar.calendars.map((c) => [
        c.competition.id,
        c.teams.filter((t) => ids.has(t.id)).length,
      ]),
    );
    expect(perCompetition).toEqual({
      "primera-division": 2,
      "segunda-division": 1,
      "primera-rfef-g1": 5,
      "segunda-rfef-g1": 5,
      "tercera-rfef-g1": 18,
    });
    const tercera = calendar.calendars.find(
      (c) => c.competition.id === "tercera-rfef-g1",
    );
    expect(tercera?.teams).toHaveLength(18);
    const names = galicianNames("2026-27");
    expect(names.has("RC Celta")).toBe(true);
    expect(names.has("RC Deportivo")).toBe(true);
    expect(names.has("Celta Fortuna")).toBe(true);
    expect(names.has("Real Madrid")).toBe(false);
  });

  it("a season with no file has no Equipo galego", () => {
    expect(galicianNames("1999-00").size).toBe(0);
  });
});
