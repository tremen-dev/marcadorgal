import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
// A cwd without .env, so process.loadEnvFile() finds nothing and no real
// secret enters the child.
const cleanCwd = mkdtempSync(path.join(tmpdir(), "marcadorgal-tick-"));
const cleanEnv = { ...process.env };
for (const key of [
  "DATABASE_URL",
  "API_FOOTBALL_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "INGEST_TICK_TOKEN",
])
  delete cleanEnv[key];

const run = (...args: string[]) =>
  spawnSync(
    process.execPath,
    [path.join(root, "tools", "ingest-tick.mjs"), ...args],
    {
      cwd: cleanCwd,
      env: cleanEnv,
      encoding: "utf8",
    },
  );

describe("CA-10 ingest:tick", () => {
  it("exits 1 without DATABASE_URL and opens no connection", () => {
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("DATABASE_URL is not set");
    expect(r.stdout).toBe("");
  });

  it("exits 1 on an unknown flag", () => {
    const r = run("--todo");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--dry-run");
  });

  it("accepts --dry-run as the only flag", () => {
    // Without DATABASE_URL it still stops at the same guard, which proves the
    // flag itself was accepted.
    const r = run("--dry-run");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("DATABASE_URL is not set");
  });
});
