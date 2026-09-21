import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readSeasons } from "./files.ts";

const calendar = {
  competition: { id: "test-cal", season: "2024-25", name: "Test", tier: 5 },
  teams: [
    { id: "test-a", name: "A" },
    { id: "test-b", name: "B" },
  ],
  matches: [
    {
      round: 1,
      kickoff: "2024-09-01T16:00:00Z",
      home: "test-a",
      away: "test-b",
    },
    {
      round: 2,
      kickoff: "2024-09-08T16:00:00Z",
      home: "test-b",
      away: "test-a",
    },
  ],
};
const aliases = {
  source: "test-source",
  season: "2024-25",
  teams: [{ externalId: "1", externalName: "Team A", teamId: "test-a" }],
};

function dataDir(files: Record<string, unknown>): string {
  const root = mkdtempSync(path.join(tmpdir(), "marcadorgal-data-"));
  for (const [rel, value] of Object.entries(files)) {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  }
  return root;
}

describe("CA-11 readSeasons", () => {
  it("reads and validates every season, or only the requested one", () => {
    const root = dataDir({
      "calendario/2024-25/test-cal.json": calendar,
      "alias/2024-25/test-source.json": aliases,
      "calendario/2025-26/test-cal.json": {
        ...calendar,
        competition: { ...calendar.competition, season: "2025-26" },
      },
      "calendario/2024-25/REVISAR.md": "not json",
    });
    const all = readSeasons(root);
    expect(all.map((s) => s.season)).toEqual(["2024-25", "2025-26"]);
    expect(all[0].calendars.map((c) => c.competition.id)).toEqual(["test-cal"]);
    expect(all[0].aliases.map((a) => a.source)).toEqual(["test-source"]);
    expect(all[1].aliases).toEqual([]);
    expect(all.flatMap((s) => s.issues)).toEqual([]);
    expect(readSeasons(root, "2025-26").map((s) => s.season)).toEqual([
      "2025-26",
    ]);
  });

  it("reports issues with the offending file and never throws on bad data", () => {
    const root = dataDir({
      "calendario/2024-25/test-cal.json": {
        ...calendar,
        matches: [{ ...calendar.matches[0], providerId: 1 }],
      },
      "calendario/2024-25/other.json": calendar,
      "alias/2024-25/test-source.json": {
        ...aliases,
        teams: [{ externalId: "1", externalName: "X", teamId: "test-zzz" }],
      },
    });
    const [season] = readSeasons(root, "2024-25");
    expect(season.issues.map((i) => [path.basename(i.file), i.path])).toEqual([
      ["other.json", "competition.id"],
      ["test-cal.json", "matches.0.providerId"],
      ["test-source.json", "teams.0.teamId"],
    ]);
  });

  it("validates match aliases against the ids derived from the season's calendars (SPEC-005 CA-3)", () => {
    const j1 = "test-cal-2024-25-j1-test-a-test-b";
    const good = dataDir({
      "calendario/2024-25/test-cal.json": calendar,
      "alias/2024-25/test-source.json": { ...aliases, matches: { "7": j1 } },
    });
    expect(readSeasons(good, "2024-25")[0].issues).toEqual([]);
    const bad = dataDir({
      "calendario/2024-25/test-cal.json": calendar,
      "alias/2024-25/test-source.json": {
        ...aliases,
        matches: { "7": "test-cal-2024-25-j9-test-a-test-b" },
      },
    });
    expect(readSeasons(bad, "2024-25")[0].issues.map((i) => i.path)).toEqual([
      "matches.7",
    ]);
  });

  it("reports a missing season", () => {
    const root = dataDir({});
    const seasons = readSeasons(root, "2024-25");
    expect(seasons).toHaveLength(1);
    expect(seasons[0].issues).toHaveLength(1);
    expect(seasons[0].issues[0].file).toContain("2024-25");
  });
});
