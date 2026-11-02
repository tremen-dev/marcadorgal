import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SPEC-044 CA-6: the shell of npm run rfef:recuperar. Arguments are checked
// before anything else, DATABASE_URL right after, and no connection is ever
// opened on the way to an exit 1.

const root = fileURLToPath(new URL("../..", import.meta.url));
// A cwd without .env, so process.loadEnvFile() finds nothing and no real
// secret enters the child.
const cleanCwd = mkdtempSync(path.join(tmpdir(), "marcadorgal-rfef-"));
const cleanEnv = { ...process.env };
for (const key of [
  "DATABASE_URL",
  "API_FOOTBALL_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RFEF_EXPLORER_URL",
  "RFEF_EXPLORER_TOKEN",
])
  delete cleanEnv[key];

const run = (...args: string[]) =>
  spawnSync(
    process.execPath,
    [path.join(root, "tools", "rfef-recuperar.mjs"), ...args],
    { cwd: cleanCwd, env: cleanEnv, encoding: "utf8" },
  );

describe("SPEC-044 CA-6 rfef:recuperar", () => {
  it("is the npm script", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    );
    expect(pkg.scripts["rfef:recuperar"]).toBe("node tools/rfef-recuperar.mjs");
  });

  it("exits 1 with the usage when the dates are missing", () => {
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--desde");
    expect(r.stderr).toContain("npm run rfef:recuperar");
    expect(r.stdout).toBe("");
  });

  it("exits 1 on an unknown flag", () => {
    const r = run("--desde", "2026-10-30", "--hasta", "2026-11-02", "--todo");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--todo");
  });

  it("exits 1 on a range longer than seven days", () => {
    const r = run("--desde", "2026-10-25", "--hasta", "2026-11-02");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("7 días");
  });

  it("with good arguments stops at DATABASE_URL and opens no connection", () => {
    const r = run(
      "--desde",
      "2026-10-30",
      "--hasta",
      "2026-11-02",
      "--dry-run",
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("DATABASE_URL is not set");
    expect(r.stdout).toBe("");
  });
});
