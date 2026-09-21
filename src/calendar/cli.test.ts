import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MatchId, TeamId } from "../model/index.ts";
import { COMPETITIONS } from "./importers.ts";
import { formatSyncDiff } from "./sync.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));
// A cwd without .env, so process.loadEnvFile() finds nothing and the real key
// never enters the child; DATABASE_URL and API_FOOTBALL_KEY are stripped too.
const cleanCwd = mkdtempSync(path.join(tmpdir(), "marcadorgal-cli-"));
const cleanEnv = { ...process.env };
delete cleanEnv.API_FOOTBALL_KEY;
delete cleanEnv.DATABASE_URL;

const run = (tool: string, ...args: string[]) =>
  spawnSync(process.execPath, [path.join(root, "tools", tool), ...args], {
    cwd: cleanCwd,
    env: cleanEnv,
    encoding: "utf8",
  });

describe("CA-4 COMPETITIONS", () => {
  it("lists the five competitions of D-3 with tiers 1..5", () => {
    expect(COMPETITIONS.map((c) => [c.id, c.tier])).toEqual([
      ["primera-division", 1],
      ["segunda-division", 2],
      ["primera-rfef-g1", 3],
      ["segunda-rfef-g1", 4],
      ["tercera-rfef-g1", 5],
    ]);
  });
});

describe("CA-7 calendario:sync", () => {
  it("exits 1 without API_FOOTBALL_KEY and never touches data/", () => {
    const r = run("calendario-sync.mjs", "2026-27", "--dry-run");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/API_FOOTBALL_KEY/);
  });

  it("exits 1 without a season", () => {
    const r = run("calendario-sync.mjs");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/temporada|season/i);
  });

  it("formats the diff with counters, lists and REVISAR marks", () => {
    const j2 = MatchId.parse("tercera-rfef-g1-2026-27-j2-arenteiro-arosa");
    const text = formatSyncDiff("tercera-rfef-g1", {
      newTeams: [
        {
          externalId: "1",
          externalName: "Ourense",
          teamId: TeamId.parse("ourense"),
        },
      ],
      added: [MatchId.parse("tercera-rfef-g1-2026-27-j1-ourense-arenteiro")],
      rescheduled: [
        { id: j2, from: "2026-09-13T16:00:00Z", to: "2026-09-14T18:00:00Z" },
      ],
      missing: [],
      renamedAtProvider: [
        {
          externalId: "2",
          from: "Arenteiro",
          to: "CD Arenteiro",
          teamId: "arenteiro",
        },
      ],
      unconfirmed: [j2],
      ignoredRounds: { "Promotion Play-offs - final": 2 },
    });
    expect(text).toContain("tercera-rfef-g1");
    expect(text).toMatch(/newTeams: 1/);
    expect(text).toMatch(/added: 1/);
    expect(text).toMatch(/rescheduled: 1/);
    expect(text).toMatch(/missing: 0/);
    expect(text).toContain("REVISAR");
    expect(text).toContain("ourense");
    expect(text).toContain("2026-09-14T18:00:00Z");
    expect(text).toContain("CD Arenteiro");
    expect(text).toContain("Promotion Play-offs - final");
  });
});
