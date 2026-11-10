import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SPEC-075 CA-3 and CA-4 (ADR-032): the alert of the calendar bot wired into
// the workflows. Read as text, like migraciones-workflow.test.ts: the project
// has no YAML dependency. Comments are dropped so that a comment can never
// satisfy an assertion.
const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (rel: string) => {
  const p = path.join(root, rel);
  return existsSync(p) ? readFileSync(p, "utf8").replace(/\r\n/g, "\n") : "";
};
const codeOf = (yml: string) =>
  yml
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");

/** The block of a top-level job, up to the next job or the end. */
const jobOf = (code: string, name: string) => {
  const afterJobs = code.split("\njobs:\n")[1] ?? "";
  const start = afterJobs.indexOf(`  ${name}:\n`);
  if (start < 0) return "";
  const rest = afterJobs.slice(start + name.length + 3);
  const end = rest.search(/\n {2}\S/);
  return end < 0 ? rest : rest.slice(0, end + 1);
};
const jobsOf = (code: string) =>
  (code.split("\njobs:\n")[1] ?? "")
    .split("\n")
    .filter((l) => /^ {2}\S/.test(l))
    .map((l) => l.trim());

const CONCURRENCY =
  / {4}concurrency:\n {6}group: aviso-bot-calendario\n {6}cancel-in-progress: false\n/;
const onlyGithubToken = (block: string) => {
  const secrets = [...block.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
  expect(secrets.length).toBeGreaterThan(0);
  for (const s of secrets) expect(s).toBe("GITHUB_TOKEN");
};

describe("SPEC-075 CA-3 job `aviso` in calendario-semanal.yml", () => {
  const code = codeOf(read(".github/workflows/calendario-semanal.yml"));
  const aviso = jobOf(code, "aviso");

  it("adds `aviso` after the untouched sync and load jobs", () => {
    expect(jobsOf(code)).toEqual(["sync:", "load:", "aviso:"]);
    expect(aviso).not.toBe("");
  });

  it("needs sync and load and always runs, for every event", () => {
    expect(aviso).toMatch(/\n {4}needs: \[sync, load\]\n/);
    expect(aviso).toMatch(/\n {4}if: (?:\$\{\{ )?always\(\)(?: \}\})?\n/);
    expect(aviso).not.toMatch(/event_name/);
  });

  it("can only write issues and read the repository", () => {
    expect(aviso).toMatch(
      /\n {4}permissions:\n {6}issues: write\n {6}contents: read\n(?! {6}\S)/,
    );
  });

  it("serialises with the watchman without cancelling", () => {
    expect(aviso).toMatch(CONCURRENCY);
  });

  it("uses no secret but GITHUB_TOKEN", () => {
    onlyGithubToken(aviso);
  });

  it("hands the results of sync and load to the executor", () => {
    expect(aviso).toMatch(/SYNC_RESULT: \$\{\{ needs\.sync\.result \}\}/);
    expect(aviso).toMatch(/LOAD_RESULT: \$\{\{ needs\.load\.result \}\}/);
    expect(aviso).toMatch(/GH_REPO: \$\{\{ github\.repository \}\}/);
    expect(aviso).toMatch(
      /run: node tools\/aviso-bot-calendario\.mjs --jobs\n/,
    );
  });

  it("keeps the events of the workflow (schedule, dispatch, push)", () => {
    const on = `\n${code.split("\non:\n")[1]?.split("\njobs:\n")[0] ?? ""}`;
    expect(on).toMatch(/\n {2}schedule:\n/);
    expect(on).toMatch(/\n {2}workflow_dispatch:\n/);
    expect(on).toMatch(/\n {2}push:\n/);
  });
});

describe("SPEC-075 CA-4/CA-5 vigia-calendario.yml", () => {
  const code = codeOf(read(".github/workflows/vigia-calendario.yml"));
  const vigia = jobOf(code, "vigia");

  it("has a single job `vigia`", () => {
    expect(code).not.toBe("");
    expect(jobsOf(code)).toEqual(["vigia:"]);
  });

  it("runs daily at 13:00Z and on dispatch", () => {
    expect(code).toMatch(/\n {2}schedule:\n {4}- cron: '0 13 \* \* \*'\n/);
    expect(code).toMatch(/\n {2}workflow_dispatch:\n/);
  });

  it("accepts simular ∈ {no, fallo}, no by default (CA-5)", () => {
    expect(code).toMatch(
      / {6}simular:\n(?: {8}.*\n)*? {8}type: choice\n(?: {8}.*\n)*? {8}default: 'no'\n/,
    );
    expect(code).toMatch(/options:\n {10}- 'no'\n {10}- fallo\n/);
    expect(vigia).toMatch(/SIMULAR: \$\{\{ inputs\.simular \|\| 'no' \}\}/);
  });

  it("can write issues, read the repository and read Actions runs", () => {
    expect(vigia).toMatch(
      /\n {4}permissions:\n {6}issues: write\n {6}contents: read\n {6}actions: read\n(?! {6}\S)/,
    );
  });

  it("shares the concurrency group of the `aviso` job", () => {
    expect(vigia).toMatch(CONCURRENCY);
  });

  it("uses no secret but GITHUB_TOKEN and runs the watchman", () => {
    onlyGithubToken(vigia);
    expect(vigia).toMatch(/GH_REPO: \$\{\{ github\.repository \}\}/);
    expect(vigia).toMatch(
      /run: node tools\/aviso-bot-calendario\.mjs --vigia\n/,
    );
  });

  it("never touches explorer or the database (CA-5)", () => {
    expect(code).not.toMatch(/DATABASE_URL|RFEF_EXPLORER|npm ci/);
  });
});
