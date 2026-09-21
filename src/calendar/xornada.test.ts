import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
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

describe("CA-11 calendario:load without a database", () => {
  it("validates data/ first and exits 1 on the missing DATABASE_URL, not on the data", () => {
    const r = run("calendario-load.mjs", "2026-27");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/DATABASE_URL/);
    expect(r.stderr).not.toMatch(/problema/);
  });

  it("exits 1 on an unknown season before touching the database", () => {
    const r = run("calendario-load.mjs", "1999-00");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/1999-00/);
    expect(r.stderr).not.toMatch(/DATABASE_URL/);
  });
});

describe("CA-12 calendario:xornada without a database", () => {
  it("exits 1 on the missing DATABASE_URL", () => {
    const r = run("calendario-xornada.mjs", "2026-27");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/DATABASE_URL/);
  });
});
