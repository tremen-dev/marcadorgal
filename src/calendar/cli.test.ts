import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
    const text = formatSyncDiff(
      "tercera-rfef-g1",
      {
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
        rematched: [
          {
            externalId: "1003",
            from: j2,
            to: MatchId.parse("tercera-rfef-g1-2026-27-j2-arosa-arenteiro"),
          },
        ],
        unconfirmed: [j2],
        ignoredRounds: { "Promotion Play-offs - final": 2 },
        kickoffs: {
          "tercera-rfef-g1-2026-27-j1-ourense-arenteiro":
            "2026-09-06T16:00:00Z",
        },
      },
      "2026-09-01T00:00:00Z",
    );
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
    expect(text).toMatch(/rematched: 1/);
    expect(text).toContain("tercera-rfef-g1-2026-27-j2-arosa-arenteiro");
  });
});

// The whole tool against a fake provider built from the repo (RN-08: no
// request leaves the machine), with --dry-run so data/ is never written.
describe("SPEC-015 calendario:sync against the fake provider", () => {
  const fake = path.join(root, "src/calendar/cli.fake-provider.mjs");
  const sync = (env: Record<string, string> = {}) => {
    const output = path.join(cleanCwd, `github-output-${Math.random()}`);
    writeFileSync(output, "");
    const r = spawnSync(
      process.execPath,
      [
        "--import",
        fake,
        path.join(root, "tools", "calendario-sync.mjs"),
        "2026-27",
        "--dry-run",
      ],
      {
        cwd: cleanCwd,
        env: {
          ...cleanEnv,
          API_FOOTBALL_KEY: "fake",
          GITHUB_OUTPUT: output,
          ...env,
        },
        encoding: "utf8",
      },
    );
    return { ...r, githubOutput: readFileSync(output, "utf8") };
  };
  // The tool puts the clock: a kickoff two days from the real now is urgent.
  const soon = new Date(Date.now() + 2 * 86_400_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  const moved = "primera-division-2026-27-j21-alaves-barcelona";

  it("a clean run says so: no urgent lines, nothing to merge", () => {
    const r = sync();
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/rescheduled: 0 .*urgentes: 0/);
    expect(r.githubOutput).toContain("urgentes=0\n");
    expect(r.githubOutput).toContain("auto=no\n");
  });

  it("CA-3 the tool puts the clock and sums the urgent lines", () => {
    const r = sync({
      FAKE_PROVIDER_KICKOFFS: JSON.stringify({ [moved]: soon }),
    });
    expect(r.status, r.stderr).toBe(0);
    const line = r.stdout.split("\n").find((l) => l.includes(moved)) ?? "";
    expect(line).toMatch(/^ {3}~ .*URGENTE$/);
    expect(r.stdout).toMatch(/^urgentes: 1$/m);
    expect(r.githubOutput).toContain("urgentes=1\n");
  });

  it("CA-4 only reschedules: auto=si", () => {
    const r = sync({
      FAKE_PROVIDER_KICKOFFS: JSON.stringify({ [moved]: soon }),
    });
    expect(r.stdout).toMatch(/^auto-aplicable: si$/m);
    expect(r.githubOutput).toContain("auto=si\n");
  });

  it("CA-4 a reschedule plus a rename at the provider: auto=no", () => {
    const r = sync({
      FAKE_PROVIDER_KICKOFFS: JSON.stringify({ [moved]: soon }),
      FAKE_PROVIDER_RENAMES: JSON.stringify({ "529": "FC Barcelona" }),
    });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/renamedAtProvider: 1/);
    expect(r.stdout).toMatch(/^auto-aplicable: no$/m);
    expect(r.githubOutput).toContain("auto=no\n");
  });
});
