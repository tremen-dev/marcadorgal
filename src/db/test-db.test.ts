import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SPEC-020 CA-1: npm run test:db refuses a non-loopback DATABASE_URL before
// anything connects. A fake `supabase` first on PATH records any call, so
// "sin conectar" is checked, not assumed. The cwd has no .env.
const root = fileURLToPath(new URL("../..", import.meta.url));
const script = path.join(root, "tools", "test-db.mjs");

function sandbox() {
  const dir = mkdtempSync(path.join(tmpdir(), "marcadorgal-test-db-"));
  const marker = path.join(dir, "called");
  const fake = path.join(dir, "supabase");
  writeFileSync(fake, `#!/bin/sh\necho "$@" > "${marker}"\nexit 0\n`);
  chmodSync(fake, 0o755);
  return { dir, marker };
}

const run = (env: Record<string, string | undefined>) => {
  const { dir, marker } = sandbox();
  const base = { ...process.env };
  delete base.DATABASE_URL;
  const r = spawnSync(process.execPath, [script], {
    cwd: dir,
    env: { ...base, PATH: `${dir}:${process.env.PATH}`, ...env },
    encoding: "utf8",
  });
  return { ...r, called: existsSync(marker), marker };
};

describe("SPEC-020 CA-1 npm run test:db guard", () => {
  it("is what npm run test:db runs", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    );
    expect(pkg.scripts["test:db"]).toBe("node tools/test-db.mjs");
  });

  it("refuses a remote host: exit 1, nothing called, the URL never printed", () => {
    const url =
      "postgresql://postgres.ref:s3cr3t@aws-0-eu-west-3.pooler.supabase.com:6543/postgres";
    const r = run({ DATABASE_URL: url });
    expect(r.status).toBe(1);
    expect(r.called).toBe(false);
    expect(r.stderr).toContain("loopback");
    expect(r.stderr + r.stdout).not.toContain("s3cr3t");
    expect(r.stderr + r.stdout).not.toContain("pooler.supabase.com");
  });

  it.each(["host", "hostaddr"])(
    "refuses a loopback URL whose query carries %s (V-3)",
    (key) => {
      const url = `postgresql://postgres:s3cr3t@127.0.0.1:54322/postgres?${key}=db.invalid`;
      const r = run({ DATABASE_URL: url });
      expect(r.status).toBe(1);
      expect(r.called).toBe(false);
      expect(r.stderr).toContain("host or hostaddr");
      expect(r.stderr + r.stdout).not.toContain("s3cr3t");
      expect(r.stderr + r.stdout).not.toContain("db.invalid");
    },
  );

  it("refuses without DATABASE_URL", () => {
    const r = run({});
    expect(r.status).toBe(1);
    expect(r.called).toBe(false);
    expect(r.stderr).toContain("DATABASE_URL is not set");
  });

  it("on loopback applies the migrations with the Supabase CLI first", () => {
    const url = "postgresql://postgres:postgres@127.0.0.1:1/postgres";
    // The fake CLI exits 1 here so the run stops before vitest.
    const { dir, marker } = sandbox();
    writeFileSync(
      path.join(dir, "supabase"),
      `#!/bin/sh\necho "$@" > "${marker}"\nexit 3\n`,
    );
    const base = { ...process.env };
    delete base.DATABASE_URL;
    const r = spawnSync(process.execPath, [script], {
      cwd: dir,
      env: { ...base, PATH: `${dir}:${process.env.PATH}`, DATABASE_URL: url },
      encoding: "utf8",
    });
    expect(readFileSync(marker, "utf8").trim()).toBe(`db push --db-url ${url}`);
    expect(r.status).toBe(3);
  });
});
