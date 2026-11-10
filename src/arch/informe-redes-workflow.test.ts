import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SPEC-079 CA-5: the workflow that computes the report of the social queue
// after every matchday and carries it to a GitHub issue (ADR-032). Read as
// text, like migraciones-workflow.test.ts: the project has no YAML
// dependency. Comments are dropped so that a comment can never satisfy an
// assertion.
const root = fileURLToPath(new URL("../..", import.meta.url));
const WORKFLOW = ".github/workflows/informe-redes.yml";
const file = path.join(root, WORKFLOW);
const yml = existsSync(file)
  ? readFileSync(file, "utf8").replace(/\r\n/g, "\n")
  : "";
const code = yml
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("#"))
  .join("\n");

// The steps of the only job, in order, as raw text blocks.
const steps = code.split(/\n {6}- /).slice(1);
const indexOf = (re: RegExp) => steps.findIndex((s) => re.test(s));
const runsOf = (text: string) =>
  text
    .split(/\n\s+(?:- )?run: /)
    .slice(1)
    .map((r) => r.split(/\n\s+- |\n {8}[a-z-]+:/)[0]);

describe("SPEC-079 CA-5 informe-redes.yml: triggers", () => {
  it("exists, with one job", () => {
    expect(yml).not.toBe("");
    const afterJobs = code.split("\njobs:\n")[1] ?? "";
    expect(afterJobs.split("\n").filter((l) => /^ {2}\S/.test(l))).toEqual([
      "  informe:",
    ]);
  });

  it("runs Tuesdays and Fridays at 06:00Z (H-1) and on dispatch", () => {
    expect(code).toMatch(/\n {2}schedule:\n {4}- cron: '0 6 \* \* 2,5'\n/);
    expect(code).toMatch(/\n {2}workflow_dispatch:\n/);
  });

  it("offers dias (4 by default) and optional desde/hasta", () => {
    expect(code).toMatch(/ {6}dias:\n(?: {8}.*\n)*? {8}default: '4'\n/);
    expect(code).toMatch(/ {6}desde:\n(?: {8}.*\n)*? {8}default: ''\n/);
    expect(code).toMatch(/ {6}hasta:\n(?: {8}.*\n)*? {8}default: ''\n/);
  });

  it("serialises runs in the group informe-redes without cancelling", () => {
    expect(code).toMatch(
      /\nconcurrency:\n {2}group: informe-redes\n {2}cancel-in-progress: false\n/,
    );
  });

  it("can only read the repository and write issues", () => {
    expect(code).toMatch(
      /\npermissions:\n {2}contents: read\n {2}issues: write\n(?! {2}\S)/,
    );
  });

  it("stays within 10 minutes", () => {
    const timeouts = [...code.matchAll(/timeout-minutes: (\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(timeouts.length).toBeGreaterThan(0);
    for (const t of timeouts) expect(t).toBeLessThanOrEqual(10);
  });
});

describe("SPEC-079 CA-5 secrets and masking", () => {
  it("uses DATABASE_URL and GITHUB_TOKEN, no other secret", () => {
    const secrets = new Set(
      [...code.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]),
    );
    expect([...secrets].sort()).toEqual(["DATABASE_URL", "GITHUB_TOKEN"]);
    for (const m of code.matchAll(/^(\s*)(\S.*secrets\.DATABASE_URL.*)$/gm))
      expect(m[2]).toMatch(/^DATABASE_URL: \$\{\{ secrets\.DATABASE_URL \}\}$/);
    expect(code).toMatch(/GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
    expect(code).toMatch(/GH_REPO: \$\{\{ github\.repository \}\}/);
  });

  it("masks the URL's parts before the first step that sees DATABASE_URL", () => {
    const mask = indexOf(/tools\/mascara-db-url\.mjs/);
    expect(mask).toBeGreaterThanOrEqual(0);
    const seesUrl = steps
      .map((s, i) => (/secrets\.DATABASE_URL/.test(s) ? i : -1))
      .filter((i) => i >= 0);
    expect(seesUrl.length).toBeGreaterThan(0);
    for (const i of seesUrl) expect(i).toBeGreaterThanOrEqual(mask);
    // The mask step itself only masks.
    expect(steps[mask]).toMatch(/run: node tools\/mascara-db-url\.mjs\n?$/);
  });

  it("never interpolates an expression inside a run: script", () => {
    const runs = runsOf(code);
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) expect(run).not.toMatch(/\$\{\{/);
  });

  it("runs every script in bash with pipefail", () => {
    expect(code).toMatch(/\n {4}defaults:\n {6}run:\n {8}shell: bash\n/);
  });
});

describe("SPEC-079 CA-5 what it runs", () => {
  it("runs the tool of CA-3 and then --issue", () => {
    const report = indexOf(/tools\/social-informe\.mjs(?![^\n]*--issue)/);
    const issue = indexOf(/tools\/social-informe\.mjs[^\n]*--issue/);
    expect(report).toBeGreaterThanOrEqual(0);
    expect(issue).toBeGreaterThan(report);
  });

  it("hands dias, desde and hasta to the tool through the environment", () => {
    expect(code).toMatch(/DIAS: \$\{\{ inputs\.dias \|\| '4' \}\}/);
    expect(code).toMatch(/DESDE: \$\{\{ inputs\.desde \}\}/);
    expect(code).toMatch(/HASTA: \$\{\{ inputs\.hasta \}\}/);
    const run = steps[indexOf(/tools\/social-informe\.mjs/)] ?? "";
    expect(run).toMatch(/--dias "\$DIAS"/);
    expect(run).toMatch(/--desde "\$DESDE" --hasta "\$HASTA"/);
  });

  it("passes SOCIAL_WATCHED_TEAMS from the repository variables (H-3)", () => {
    expect(code).toMatch(
      /SOCIAL_WATCHED_TEAMS: \$\{\{ vars\.SOCIAL_WATCHED_TEAMS \}\}/,
    );
  });

  it("no supabase, db:push, vercel, nor a write to data/ or git", () => {
    expect(code).not.toMatch(/supabase/i);
    expect(code).not.toMatch(/db:push/);
    expect(code).not.toMatch(/vercel/i);
    expect(code).not.toMatch(/git (add|commit|push)/);
    expect(code).not.toMatch(/data\//);
    expect(code).not.toMatch(/continue-on-error/);
  });

  it("checks out without persisting credentials and installs with npm ci", () => {
    expect(code).toMatch(
      /uses: actions\/checkout@v4\n {8}with:\n {10}persist-credentials: false\n/,
    );
    expect(code).toMatch(/node-version-file: \.nvmrc\n/);
    expect(code).toMatch(/run: npm ci\n/);
  });
});
