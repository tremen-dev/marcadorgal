import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.ts";

// The second trigger of the tick (ADR-002 §1): Vercel Cron every minute as a
// backup of pg_cron. It invokes by GET with Authorization: Bearer
// $CRON_SECRET, which is the same value as INGEST_TICK_TOKEN (H-2).
const root = fileURLToPath(new URL("../..", import.meta.url));
const TICK_PATH = "/api/ingest/tick";

type VercelJson = {
  crons?: { path: string; schedule: string }[];
};

const vercelJson = (): VercelJson =>
  JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8"));

describe("SPEC-008 CA-5 vercel.json", () => {
  it("declares exactly one cron, on the tick, every minute", () => {
    const config = vercelJson();
    expect(config.crons).toHaveLength(1);
    expect(config.crons?.[0]).toEqual({
      path: TICK_PATH,
      schedule: "* * * * *",
    });
  });

  it("declares nothing else", () => {
    expect(Object.keys(vercelJson())).toEqual(["crons"]);
  });
});

describe("SPEC-008 CA-5 the cron path carries the alias", () => {
  it("has its own entry in outputFileTracingIncludes (ADR-008 §8)", () => {
    // outputFileTracingIncludes is indexed by route: a route without its own
    // entry deploys with no alias file and every attempt dies with
    // "no alias for api-football <season>" (H-2).
    const tracing = nextConfig.outputFileTracingIncludes ?? {};
    const cronPath = vercelJson().crons?.[0].path as string;
    expect(Object.keys(tracing)).toContain(cronPath);
    expect(tracing[cronPath]).toContain("./data/alias/**/*.json");
  });

  it("points at a route handler that exists", () => {
    const cronPath = vercelJson().crons?.[0].path as string;
    const file = path.join(root, "src/app", cronPath, "route.ts");
    expect(existsSync(file)).toBe(true);
  });
});

// CA-8: the weekly sync runs in GitHub Actions and not in a serverless
// function, because calendario:sync rewrites data/calendario/** and
// data/alias/** and the declared calendar is the source of truth (D-3, H-5).
const workflow = readFileSync(
  path.join(root, ".github/workflows/calendario-semanal.yml"),
  "utf8",
);

describe("SPEC-008 CA-8 calendario-semanal.yml", () => {
  it("runs weekly on Tuesday and can be launched by hand", () => {
    expect(workflow).toContain("cron: '0 5 * * 2'");
    expect(workflow).toContain("workflow_dispatch:");
  });

  it("syncs against the provider and opens a PR only when there is a diff", () => {
    expect(workflow).toContain("npm run calendario:sync --");
    expect(workflow).toContain(
      "git status --porcelain data/calendario data/alias",
    );
    expect(workflow).toContain("if: steps.diff.outputs.cambios == 'si'");
    expect(workflow).toContain('rama="chore/calendario-$fecha"');
  });

  it("loads into the database on a push to main that touched the data", () => {
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("- 'data/calendario/**'");
    expect(workflow).toContain("- 'data/alias/**'");
    expect(workflow).toContain("npm run calendario:load --");
    expect(workflow).toContain("secrets.DATABASE_URL");
  });

  it("takes the provider key from secrets and never from the repo", () => {
    expect(workflow).toContain("secrets.API_FOOTBALL_KEY");
  });
});
