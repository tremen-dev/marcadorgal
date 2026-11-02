import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SPEC-043 (ADR-024): the workflow that applies supabase/migrations to
// production on every push to main. Read as text, like sonda-workflow.test.ts:
// the project has no YAML dependency. Comments are dropped so that a comment
// can never satisfy an assertion.
const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const codeOf = (yml: string) =>
  yml
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");

const WORKFLOW = ".github/workflows/migraciones.yml";
const yml = existsSync(path.join(root, WORKFLOW)) ? read(WORKFLOW) : "";
const code = codeOf(yml);
const lines = code.split("\n");

// The steps of the only job, in order, as raw text blocks.
const steps = code.split(/\n {6}- /).slice(1);
const indexOf = (re: RegExp) => steps.findIndex((s) => re.test(s));
// The `run:` scripts of the workflow, each up to its next key or step.
const runsOf = (text: string) =>
  text
    .split(/\n\s+(?:- )?run: /)
    .slice(1)
    .map((r) => r.split(/\n\s+- |\n {8}[a-z-]+:/)[0]);

describe("SPEC-043 CA-2 triggers, order and guard", () => {
  it("has one job, `migraciones`, the name Vercel's Deployment Check uses", () => {
    expect(yml).not.toBe("");
    const afterJobs = code.split("\njobs:\n")[1] ?? "";
    expect(afterJobs.split("\n").filter((l) => /^ {2}\S/.test(l))).toEqual([
      "  migraciones:",
    ]);
  });

  it("runs on every push to main, without a path filter", () => {
    const on = code.split("\non:\n")[1]?.split(/\n\S/)[0] ?? "";
    expect(on).toMatch(/\n?\s{2}push:\n\s{4}branches: \[main\]/);
    expect(on).not.toMatch(/paths/);
  });

  it("offers workflow_dispatch with modo ∈ {dry-run, aplicar}, dry-run by default", () => {
    expect(lines).toContain("  workflow_dispatch:");
    expect(code).toMatch(
      / {6}modo:\n(?: {8}.*\n)*? {8}type: choice\n(?: {8}.*\n)*? {8}default: dry-run/,
    );
    expect(code).toMatch(/options:\n {10}- dry-run\n {10}- aplicar\n/);
  });

  it("serialises runs in a fixed group without cancelling the one in flight", () => {
    expect(code).toMatch(
      /\nconcurrency:\n {2}group: migraciones-prod\n {2}cancel-in-progress: false\n/,
    );
  });

  it("only reads the repository", () => {
    expect(code).toMatch(/\npermissions:\n {2}contents: read\n(?! {2}\S)/);
  });

  it("stays within 10 minutes", () => {
    const timeouts = [...code.matchAll(/timeout-minutes: (\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(timeouts.length).toBeGreaterThan(0);
    for (const t of timeouts) expect(t).toBeLessThanOrEqual(10);
  });

  it("pins the Supabase CLI", () => {
    expect(code).toMatch(
      /uses: supabase\/setup-cli@v1\n\s+with:\n\s+version: \d+\.\d+\.\d+\n/,
    );
  });

  it("refuses modo=aplicar outside main before any step that connects", () => {
    const guard = indexOf(/\[ "\$REF" != refs\/heads\/main \]/);
    const firstSecret = indexOf(/secrets\.DATABASE_URL/);
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(firstSecret).toBeGreaterThan(guard);
    expect(steps[guard]).toMatch(/\[ "\$MODO" = aplicar \] &&/);
    expect(steps[guard]).toMatch(/exit 1/);
  });

  it("applies on push and only does what modo says on dispatch", () => {
    expect(code).toMatch(
      /MODO: \$\{\{ github\.event_name == 'push' && 'aplicar' \|\| inputs\.modo \}\}/,
    );
    const push = steps[indexOf(/db push/)] ?? "";
    expect(push).toMatch(/--dry-run/);
    expect(push).toMatch(/"\$MODO"/);
  });
});

describe("SPEC-043 CA-3 one secret, never printed", () => {
  it("uses DATABASE_URL and no other secret", () => {
    const secrets = new Set(
      [...code.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]),
    );
    expect([...secrets]).toEqual(["DATABASE_URL"]);
    for (const m of code.matchAll(/^(\s*)(\S.*secrets\.DATABASE_URL.*)$/gm)) {
      expect(m[2]).toMatch(/^DATABASE_URL: \$\{\{ secrets\.DATABASE_URL \}\}$/);
    }
  });

  it("never interpolates an expression inside a run: script", () => {
    const runs = runsOf(code);
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) expect(run).not.toMatch(/\$\{\{/);
  });

  it("masks the URL's parts before the first call to the CLI", () => {
    const mask = indexOf(/tools\/mascara-db-url\.mjs/);
    const cli = indexOf(/supabase (db|migration) /);
    expect(mask).toBeGreaterThanOrEqual(0);
    expect(cli).toBeGreaterThan(mask);
  });
});

describe("SPEC-043 CA-3 tools/mascara-db-url.mjs", () => {
  const script = path.join(root, "tools/mascara-db-url.mjs");
  const run = (env: Record<string, string | undefined>) =>
    spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, ...env },
    });

  const user = "postgres.abcdefghijklmnop";
  const password = "p@ss:w/rd%x";
  const host = "aws-0-eu-west-1.pooler.supabase.com";
  const url = `postgresql://${user}:${encodeURIComponent(password)}@${host}:6543/postgres`;

  it("prints only ::add-mask:: commands for host, user and password", () => {
    const r = run({ DATABASE_URL: url });
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    const out = r.stdout.trim().split("\n");
    for (const line of out) expect(line).toMatch(/^::add-mask::./);
    const masked = out.map((l) => l.slice("::add-mask::".length));
    for (const part of [
      url,
      host,
      user,
      password,
      encodeURIComponent(password),
    ]) {
      expect(masked).toContain(part);
    }
  });

  it("fails without printing anything when DATABASE_URL is missing or unparsable", () => {
    for (const env of [{}, { DATABASE_URL: "not a url" }]) {
      const r = run(env);
      expect(r.status).toBe(1);
      expect(r.stdout).toBe("");
      expect(r.stderr).not.toMatch(/not a url/);
    }
  });
});

describe("SPEC-043 CA-6 a failure never lets the deploy through", () => {
  it("has no continue-on-error and no `|| true`", () => {
    expect(code).not.toMatch(/continue-on-error/);
    expect(code).not.toMatch(/\|\|\s*true/);
  });

  it("runs every script in bash with pipefail", () => {
    expect(code).toMatch(/\n {4}defaults:\n {6}run:\n {8}shell: bash\n/);
  });
});

describe("SPEC-043 CA-7 the calendar's automatic merge gets its check", () => {
  const cal = codeOf(read(".github/workflows/calendario-semanal.yml"));

  it("dispatches migraciones on main with modo=aplicar after merging", () => {
    const merge = cal.split("- name: Fusionar y cargar")[1] ?? "";
    const run = merge.split(/\n {2}[a-z]+:\n/)[0];
    const merged = run.indexOf("gh pr merge");
    const dispatch = run.indexOf(
      "gh workflow run migraciones.yml --ref main -f modo=aplicar",
    );
    expect(merged).toBeGreaterThan(0);
    expect(dispatch).toBeGreaterThan(merged);
  });
});

describe("SPEC-043 CA-5 the harmless migration", () => {
  it("only comments on schema web, and sorts after every other migration", () => {
    const dir = path.join(root, "supabase/migrations");
    const files = readdirSync(dir).sort();
    const own = files.filter((f) => /_spec043_/.test(f));
    expect(own).toHaveLength(1);
    expect(files.at(-1)).toBe(own[0]);
    const sql = codeOf(readFileSync(path.join(dir, own[0] ?? ""), "utf8"))
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("--") && l.trim() !== "")
      .join("\n");
    expect(sql).toMatch(/^comment on schema web is '[^']+';$/);
  });
});

describe("SPEC-043 CA-8 the manual path stays", () => {
  it("keeps npm run db:push", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["db:push"]).toBe("node tools/db-push.mjs");
  });

  it("documents in contexto.md that migrations apply on merge and db:push is the emergency path", () => {
    const ctx = read("docs/fundacion/contexto.md");
    expect(ctx).toMatch(/migraciones se aplican al fusionar/i);
    expect(ctx).toMatch(/`npm run db:push`[^\n]*emergencia/);
  });
});
