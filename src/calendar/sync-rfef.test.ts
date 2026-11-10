import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rfefCalendar } from "../sources/rfef/calendar.ts";
import { COMPETITIONS } from "./importers.ts";
import { matchId } from "./match-id.ts";
import {
  AliasFile,
  CalendarFile,
  validateAliases,
  validateCalendar,
} from "./schema.ts";
import { syncCalendar } from "./sync.ts";

// SPEC-074 CA-1 / SPEC-076 CA-3: the raw calendar export of segunda-rfef-g1
// that explorer served on 2026-11-10 at 14:07Z, after it fixed Rayo Cantabria
// (`rayo-cantabria` «Rayo Cantabria», no longer Racing de Ferrol's id), with
// the filiales under their new names («Alavés B», «Eibar B», «Atlético
// Astorga»). Synced against the calendar and the rfef alias of the repo, with
// no team override, it adds no team and no match.

const root = fileURLToPath(new URL("../..", import.meta.url));
const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(path.join(root, rel), "utf8"));
const SEASON = "2026-27";
const COMPETITION_ID = "segunda-rfef-g1";
const FIXTURE =
  "src/sources/rfef/fixtures/export/calendar-segunda-rfef-g1-2026-27-2026-11-10T1407Z.json";

const calendarOf = (id: string) =>
  CalendarFile.parse(readJson(`data/calendario/${SEASON}/${id}.json`));
const derivedIds = (competitionId: string, file: CalendarFile) =>
  file.matches.map((m) =>
    matchId({
      competitionId,
      season: SEASON,
      round: m.round,
      homeTeamId: m.home,
      awayTeamId: m.away,
    }),
  );

describe("SPEC-074 CA-1 the filiales under their new names resolve to the alias", () => {
  const current = calendarOf(COMPETITION_ID);
  const aliases = AliasFile.parse(readJson(`data/alias/${SEASON}/rfef.json`));
  const competition = COMPETITIONS.find((c) => c.id === COMPETITION_ID);
  if (!competition) throw new Error(`unknown competition ${COMPETITION_ID}`);
  const imported = rfefCalendar.parse(readJson(FIXTURE));
  const {
    calendar,
    aliases: out,
    diff,
  } = syncCalendar({
    current,
    aliases,
    imported,
    competition: { ...competition, season: SEASON },
    sourceId: "rfef",
  });

  it("the fixture carries the three new names", () => {
    const names = imported.teams.map((t) => t.externalName);
    expect(names).toEqual(
      expect.arrayContaining(["Alavés B", "Eibar B", "Atlético Astorga"]),
    );
  });

  it("adds no team and no match, and misses none", () => {
    expect(diff.newTeams).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.missing).toEqual([]);
    expect(diff.rematched).toEqual([]);
  });

  it("SPEC-076 CA-3 the 34 rayo-cantabria ids match the calendar of the repo", () => {
    expect(imported.teams).toContainEqual({
      externalId: "rayo-cantabria",
      externalName: "Rayo Cantabria",
    });
    expect(JSON.stringify(imported)).not.toContain("racing-ferrol");
    const rayo = (f: CalendarFile) =>
      derivedIds(COMPETITION_ID, f).filter((id) =>
        id.includes("rayo-cantabria"),
      );
    expect(rayo(calendar)).toHaveLength(34);
    expect(rayo(calendar).sort()).toEqual(rayo(current).sort());
  });

  it("no teamId ends in -<n>", () => {
    expect(calendar.teams.filter((t) => /-\d+$/.test(t.id))).toEqual([]);
  });

  it("validateCalendar and validateAliases find no problem", () => {
    expect(
      validateCalendar(calendar, {
        season: SEASON,
        competitionId: COMPETITION_ID,
      }),
    ).toEqual([]);
    const ids = readdirSync(path.join(root, "data", "calendario", SEASON))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -5));
    const files = ids.map((id) =>
      id === COMPETITION_ID ? calendar : calendarOf(id),
    );
    expect(
      validateAliases(out, {
        season: SEASON,
        sourceId: "rfef",
        knownTeams: files.flatMap((f) => f.teams.map((t) => t.id)),
        knownMatches: files.flatMap((f, i) => derivedIds(ids[i], f)),
      }),
    ).toEqual([]);
  });
});
