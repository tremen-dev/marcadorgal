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
    // The fake CLI answers status and exits 3 on db push, so the run stops
    // before vitest.
    const f = fakes({ pushExit: 3 });
    const r = runIn(f, { DATABASE_URL: url });
    expect(readFileSync(f.calls, "utf8").trim().split("\n")).toEqual([
      "status -o env",
      `db push --db-url ${url}`,
    ]);
    expect(r.status).toBe(3);
    expect(existsSync(f.npxEnv)).toBe(false);
  });
});

// SPEC-022: Storage is local too. A fake `supabase` answers `status -o env`
// and a fake `npx` writes the environment vitest would get.
const LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_STATUS = [
  'ANON_KEY="anon-local"',
  'API_URL="http://127.0.0.1:54321"',
  `DB_URL="${LOCAL_URL}"`,
  'SERVICE_ROLE_KEY="service-local"',
].join("\n");

type Fakes = { dir: string; calls: string; npxEnv: string };

function fakes(opts: {
  status?: string;
  statusExit?: number;
  pushExit?: number;
}): Fakes {
  const dir = mkdtempSync(path.join(tmpdir(), "marcadorgal-test-db-"));
  const calls = path.join(dir, "calls");
  const npxEnv = path.join(dir, "npx-env");
  const statusFile = path.join(dir, "status.txt");
  writeFileSync(statusFile, `${opts.status ?? LOCAL_STATUS}\n`);
  writeFileSync(
    path.join(dir, "supabase"),
    `#!/bin/sh
echo "$@" >> "${calls}"
if [ "$1" = "status" ]; then
  echo "A new version of Supabase CLI is available" >&2
  cat "${statusFile}"
  exit ${opts.statusExit ?? 0}
fi
exit ${opts.pushExit ?? 0}
`,
  );
  writeFileSync(
    path.join(dir, "npx"),
    `#!/bin/sh
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify(process.env))' "${npxEnv}"
exit 0
`,
  );
  chmodSync(path.join(dir, "supabase"), 0o755);
  chmodSync(path.join(dir, "npx"), 0o755);
  return { dir, calls, npxEnv };
}

function runIn(f: Fakes, env: Record<string, string | undefined>) {
  const base = { ...process.env };
  delete base.DATABASE_URL;
  return spawnSync(process.execPath, [script], {
    cwd: f.dir,
    env: { ...base, PATH: `${f.dir}:${process.env.PATH}`, ...env },
    encoding: "utf8",
  });
}

// What the .env of the titular carries: production (ADR-014 §1).
const PROD_ENV = {
  DATABASE_URL: LOCAL_URL,
  NEXT_PUBLIC_SUPABASE_URL: "https://prodref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "prod-service-role",
  API_FOOTBALL_KEY: "prod-api-football",
  INGEST_TICK_URL: "https://marcador.gal/api/ingest/tick",
  INGEST_TICK_TOKEN: "prod-tick-token",
  CRON_SECRET: "prod-cron",
  SUPABASE_ACCESS_TOKEN: "prod-access",
  DATABASE_PASSWORD: "prod-db-pass",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "prod-anon",
};

describe("SPEC-022 CA-1 local Storage forced over the .env", () => {
  it("passes API_URL and SERVICE_ROLE_KEY of supabase status to vitest", () => {
    const f = fakes({});
    const r = runIn(f, PROD_ENV);
    expect(r.status).toBe(0);
    const env = JSON.parse(readFileSync(f.npxEnv, "utf8"));
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-local");
    expect(env.DATABASE_URL).toBe(LOCAL_URL);
  });

  it("wins over a .env file in the cwd too", () => {
    const f = fakes({});
    writeFileSync(
      path.join(f.dir, ".env"),
      Object.entries(PROD_ENV)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n"),
    );
    const base = { ...process.env };
    for (const k of Object.keys(PROD_ENV)) delete base[k];
    const r = spawnSync(process.execPath, [script], {
      cwd: f.dir,
      env: { ...base, PATH: `${f.dir}:${process.env.PATH}` },
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    const env = JSON.parse(readFileSync(f.npxEnv, "utf8"));
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-local");
    expect(env.INGEST_TICK_TOKEN).toBe("");
  });

  it("blanks the remote secrets for vitest (CA-4)", () => {
    const f = fakes({});
    runIn(f, PROD_ENV);
    const env = JSON.parse(readFileSync(f.npxEnv, "utf8"));
    for (const k of [
      "API_FOOTBALL_KEY",
      "INGEST_TICK_URL",
      "INGEST_TICK_TOKEN",
      "CRON_SECRET",
      "SUPABASE_ACCESS_TOKEN",
      "DATABASE_PASSWORD",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]) {
      expect(env[k] ?? "").toBe("");
    }
  });
});

describe("SPEC-022 CA-2 refuses without a local Storage", () => {
  it.each([
    ["supabase status fails", { status: "", statusExit: 1 }],
    [
      "API_URL is remote",
      {
        status: LOCAL_STATUS.replace(
          "http://127.0.0.1:54321",
          "https://x.supabase.co",
        ),
      },
    ],
  ])("%s: exit 1 before db push and vitest, nothing leaked", (_, opts) => {
    const f = fakes(opts);
    const r = runIn(f, PROD_ENV);
    expect(r.status).toBe(1);
    expect(readFileSync(f.calls, "utf8").trim()).toBe("status -o env");
    expect(existsSync(f.npxEnv)).toBe(false);
    expect(r.stderr).toContain("supabase start");
    const out = r.stderr + r.stdout;
    for (const secret of [
      "x.supabase.co",
      "service-local",
      "prodref.supabase.co",
      "prod-service-role",
    ]) {
      expect(out).not.toContain(secret);
    }
  });
});
