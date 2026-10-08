import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

// SPEC-022 CA-3: vitest.db.config.mts refuses a remote Storage URL, even when
// vitest is launched by hand. The config is imported in a subprocess, no
// network.
const root = fileURLToPath(new URL("../..", import.meta.url));
const config = pathToFileURL(path.join(root, "vitest.db.config.mts")).href;
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function importConfig(env: Record<string, string>, dotenv?: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "marcadorgal-db-config-"));
  if (dotenv) writeFileSync(path.join(dir, ".env"), dotenv);
  const base = { ...process.env };
  delete base.DATABASE_URL;
  delete base.NEXT_PUBLIC_SUPABASE_URL;
  const r = spawnSync(
    process.execPath,
    [
      "--no-warnings",
      "--input-type=module",
      "-e",
      `await import(${JSON.stringify(config)})`,
    ],
    { cwd: dir, env: { ...base, ...env }, encoding: "utf8" },
  );
  return { status: r.status, out: r.stderr + r.stdout };
}

describe("SPEC-022 CA-3 vitest.db.config.mts Storage guard", () => {
  it("throws when NEXT_PUBLIC_SUPABASE_URL is remote", () => {
    const r = importConfig({
      DATABASE_URL: LOCAL_DB,
      NEXT_PUBLIC_SUPABASE_URL: "https://prodref.supabase.co",
    });
    expect(r.status).not.toBe(0);
    expect(r.out).toContain("NEXT_PUBLIC_SUPABASE_URL is not loopback");
  });

  it("throws with the production .env in the cwd", () => {
    const r = importConfig(
      { DATABASE_URL: LOCAL_DB },
      "NEXT_PUBLIC_SUPABASE_URL=https://prodref.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=prod\n",
    );
    expect(r.status).not.toBe(0);
    expect(r.out).toContain("NEXT_PUBLIC_SUPABASE_URL is not loopback");
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    const r = importConfig({ DATABASE_URL: LOCAL_DB });
    expect(r.status).not.toBe(0);
    expect(r.out).toContain("NEXT_PUBLIC_SUPABASE_URL is not loopback");
  });

  it("loads with both URLs on loopback", () => {
    const r = importConfig({
      DATABASE_URL: LOCAL_DB,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    });
    expect(r.out).toBe("");
    expect(r.status).toBe(0);
  });
});
