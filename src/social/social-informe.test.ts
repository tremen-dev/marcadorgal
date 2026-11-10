import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Instant } from "../model/index.ts";
import type { Report } from "./report.ts";

// SPEC-079 CA-3: tools/social-informe.mjs, the thin shell of the report.
// Arguments are checked before anything else, DATABASE_URL right after, and
// a failing database never prints its password.
const root = fileURLToPath(new URL("../..", import.meta.url));
const SCRIPT = path.join(root, "tools", "social-informe.mjs");

type Window = { from: Instant; to: Instant };
type Args = { window: Window; json: boolean; issue: boolean };
type Modulo = {
  parseArgs: (argv: string[], now: Instant) => Args;
  githubOutput: (report: Pick<Report, "matches" | "verdict">) => string;
};
let m: Modulo;
beforeAll(async () => {
  m = (await import(pathToFileURL(SCRIPT).href)) as Modulo;
});

// A cwd without .env, so process.loadEnvFile() finds nothing and no real
// secret enters the child.
const cleanCwd = mkdtempSync(path.join(tmpdir(), "marcadorgal-redes-"));
const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
for (const key of [
  "DATABASE_URL",
  "GITHUB_OUTPUT",
  "GH_TOKEN",
  "GH_REPO",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
])
  delete cleanEnv[key];

const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: cleanCwd,
    env: { ...cleanEnv, ...env },
    encoding: "utf8",
    timeout: 60_000,
  });

const NOW = "2026-11-10T06:00:00.000Z" as Instant;

describe("SPEC-079 CA-3 parseArgs", () => {
  it("defaults to the last 4 days, ending now", () => {
    expect(m.parseArgs([], NOW)).toEqual({
      window: { from: "2026-11-06T06:00:00.000Z", to: NOW },
      json: false,
      issue: false,
    });
  });

  it("--dias N, --json and --issue", () => {
    expect(m.parseArgs(["--dias", "7", "--json", "--issue"], NOW)).toEqual({
      window: { from: "2026-11-03T06:00:00.000Z", to: NOW },
      json: true,
      issue: true,
    });
  });

  it("--desde and --hasta, normalised to UTC with Z", () => {
    expect(
      m.parseArgs(
        ["--desde", "2026-11-07T00:00:00+01:00", "--hasta", "2026-11-10"],
        NOW,
      ).window,
    ).toEqual({
      from: "2026-11-06T23:00:00.000Z",
      to: "2026-11-10T00:00:00.000Z",
    });
  });

  it.each([
    [["--dias", "0"], /--dias/],
    [["--dias", "x"], /--dias/],
    [["--dias"], /--dias/],
    [["--desde", "2026-11-07"], /--hasta/],
    [["--hasta", "2026-11-07"], /--desde/],
    [["--desde", "2026-11-10", "--hasta", "2026-11-07"], /anterior/],
    [["--desde", "ayer", "--hasta", "2026-11-07"], /ISO-8601/],
    [
      ["--dias", "2", "--desde", "2026-11-07", "--hasta", "2026-11-08"],
      /--dias/,
    ],
    [["--todo"], /--todo/],
    [["extra"], /extra/],
  ])("rejects %j", (argv, re) => {
    expect(() => m.parseArgs(argv, NOW)).toThrow(re);
  });
});

describe("SPEC-079 CA-3 GITHUB_OUTPUT", () => {
  it("partidos and veredicto, SIN_PARTIDOS for an empty window", () => {
    expect(m.githubOutput({ matches: 3, verdict: "OK" })).toBe(
      "partidos=3\nveredicto=OK\n",
    );
    expect(m.githubOutput({ matches: 2, verdict: "DESVIACIONES" })).toBe(
      "partidos=2\nveredicto=DESVIACIONES\n",
    );
    expect(m.githubOutput({ matches: 0, verdict: "OK" })).toBe(
      "partidos=0\nveredicto=SIN_PARTIDOS\n",
    );
  });
});

describe("SPEC-079 CA-3 the shell", () => {
  it("is the npm script", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    );
    expect(pkg.scripts["social:informe"]).toBe("node tools/social-informe.mjs");
  });

  it("exits 1 with the usage on bad arguments, before DATABASE_URL", () => {
    const r = run(["--dias", "0"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--dias");
    expect(r.stderr).toContain("npm run social:informe");
    expect(r.stdout).toBe("");
  });

  it("exits 1 without DATABASE_URL and says so", () => {
    const r = run([]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("DATABASE_URL");
    expect(r.stdout).toBe("");
  });

  it("exits 1 when the database fails, without printing the password", () => {
    const sentinel = "CENTINELA-s3cr3t-9f1c";
    const r = run([], {
      DATABASE_URL: `postgresql://postgres:${sentinel}@127.0.0.1:1/postgres`,
    });
    expect(r.status).toBe(1);
    expect(r.stdout).not.toContain(sentinel);
    expect(r.stderr).not.toContain(sentinel);
    expect(r.stderr.length).toBeGreaterThan(0);
  });
});
