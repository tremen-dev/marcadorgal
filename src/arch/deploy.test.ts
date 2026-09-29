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
//
// The assertions below run over the parsed tree and not over the text (O-1 of
// the verification): "branches: [main]" in a string does not prove it hangs
// from on.push, and "workflow_dispatch:" would match inside a comment. There
// is no YAML dependency in this project and CA-10 forbids adding one, so this
// reads the subset the workflows use: block mappings and sequences, flow
// sequences, quoted scalars and | block scalars.
type Yaml = string | Yaml[] | { [key: string]: Yaml };

const indentOf = (line: string) => line.length - line.trimStart().length;

// The first ": " (or a trailing ":") is the separator, so a quoted value may
// carry colons of its own.
function keySeparator(text: string): number {
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== ":") continue;
    if (i + 1 === text.length || text[i + 1] === " ") return i;
  }
  return -1;
}

function parseYaml(source: string): Yaml {
  const lines = source.split("\n");
  let at = 0;

  const skip = () => {
    while (at < lines.length) {
      const text = lines[at].trim();
      if (text === "" || text.startsWith("#")) at += 1;
      else break;
    }
  };

  // Everything indented deeper, verbatim: nothing in here is parsed.
  const blockScalar = (indent: number): string => {
    const out: string[] = [];
    while (at < lines.length) {
      const line = lines[at];
      if (line.trim() !== "" && indentOf(line) <= indent) break;
      out.push(line.slice(indent + 2));
      at += 1;
    }
    return out.join("\n");
  };

  const scalar = (raw: string): string => {
    const text = raw.trim();
    const quoted =
      (text.startsWith("'") && text.endsWith("'")) ||
      (text.startsWith('"') && text.endsWith('"'));
    return quoted ? text.slice(1, -1) : text;
  };

  const value = (raw: string, indent: number): Yaml => {
    const text = raw.trim();
    if (text === "|" || text === ">") return blockScalar(indent);
    if (text.startsWith("[") && text.endsWith("]"))
      return text
        .slice(1, -1)
        .split(",")
        .map(scalar)
        .filter((item) => item !== "");
    if (text !== "") return scalar(text);
    skip();
    if (at >= lines.length || indentOf(lines[at]) <= indent) return "";
    return lines[at].trim().startsWith("- ")
      ? sequence(indentOf(lines[at]))
      : mapping(indentOf(lines[at]));
  };

  function mapping(indent: number): { [key: string]: Yaml } {
    const out: { [key: string]: Yaml } = {};
    for (;;) {
      skip();
      if (at >= lines.length) break;
      const text = lines[at].trim();
      if (indentOf(lines[at]) !== indent || text.startsWith("- ")) break;
      const separator = keySeparator(text);
      if (separator === -1) break;
      const key = text.slice(0, separator);
      const rest = text.slice(separator + 1);
      at += 1;
      out[key] = value(rest, indent);
    }
    return out;
  }

  function sequence(indent: number): Yaml[] {
    const out: Yaml[] = [];
    for (;;) {
      skip();
      if (at >= lines.length) break;
      const text = lines[at].trim();
      if (indentOf(lines[at]) !== indent || !text.startsWith("- ")) break;
      const rest = text.slice(2);
      if (keySeparator(rest) === -1) {
        out.push(scalar(rest));
        at += 1;
        continue;
      }
      // An item that is itself a mapping: drop the dash and read the keys of
      // the item, which line up two columns further in.
      lines[at] = " ".repeat(indent + 2) + rest;
      out.push(mapping(indent + 2));
    }
    return out;
  }

  skip();
  return at >= lines.length ? {} : mapping(indentOf(lines[at]));
}

const obj = (node: Yaml | undefined): { [key: string]: Yaml } => {
  expect(node).toBeTypeOf("object");
  expect(Array.isArray(node)).toBe(false);
  return node as { [key: string]: Yaml };
};
const arr = (node: Yaml | undefined): Yaml[] => {
  expect(Array.isArray(node)).toBe(true);
  return node as Yaml[];
};
const str = (node: Yaml | undefined): string => {
  expect(node).toBeTypeOf("string");
  return node as string;
};

const workflowText = readFileSync(
  path.join(root, ".github/workflows/calendario-semanal.yml"),
  "utf8",
);
const workflow = obj(parseYaml(workflowText));
// "on" is a plain key here: this reader does not do the YAML 1.1 booleans.
const on = obj(workflow.on);
const jobs = obj(workflow.jobs);
const steps = (job: string) => arr(obj(jobs[job]).steps).map(obj);
const stepNamed = (job: string, name: string) =>
  steps(job).find((step) => step.name === name);

describe("SPEC-008 CA-8 the reader of the workflow", () => {
  // If the reader were wrong the assertions below would be worth nothing, so
  // the three constructs it has to get right are asserted first.
  it("reads a quoted scalar carrying a colon of its own", () => {
    const input = obj(obj(on.workflow_dispatch).inputs);
    expect(str(obj(input.cargar).description)).toBe(
      "si: corre solo el job load contra la base",
    );
  });

  it("reads a | block scalar whole, without parsing what is inside", () => {
    const run = str(stepNamed("sync", "Abrir o actualizar el PR")?.run);
    expect(run.split("\n")[0]).toBe("set -euo pipefail");
    expect(run).toContain('rama="chore/calendario"');
    expect(run).toContain('gh pr create --base main --head "$rama" \\');
  });

  it("reads a flow sequence", () => {
    expect(arr(obj(on.push).branches)).toEqual(["main"]);
  });
});

describe("SPEC-008 CA-8 calendario-semanal.yml", () => {
  it("runs every day from Tuesday to Saturday and can be launched by hand (SPEC-015 CA-1)", () => {
    // The provider gives the real kickoff days after the placeholder one; a
    // Tuesday-only sync put Wednesday-to-Saturday changes into the base after
    // the jornada was played. 5 requests per run, 25 a week.
    expect(arr(on.schedule).map(obj)).toEqual([{ cron: "0 5 * * 2-6" }]);
    expect(on).toHaveProperty("workflow_dispatch");
  });

  it("syncs against the provider, taking the key from secrets", () => {
    const sync = stepNamed("sync", "Sincronizar contra el proveedor");
    expect(str(sync?.run)).toContain("npm run calendario:sync --");
    expect(str(obj(sync?.env).API_FOOTBALL_KEY)).toContain(
      "secrets.API_FOOTBALL_KEY",
    );
  });

  it("gives every piped step a shell with pipefail (O-2)", () => {
    // The default shell is "bash -e {0}", with no pipefail: the status of a
    // pipeline would be the status of its last command, so a step that pipes
    // calendario:sync into tee would pass however the sync went.
    const piped = [...steps("sync"), ...steps("load")].filter(
      (step) => typeof step.run === "string" && step.run.includes(" | "),
    );
    expect(piped.length).toBeGreaterThan(0);
    for (const step of piped)
      expect(
        step.shell === "bash" || str(step.run).includes("set -euo pipefail"),
      ).toBe(true);
  });

  it("opens a PR only when there is a diff in the declared calendar", () => {
    const diff = stepNamed("sync", "¿Hay diff en el calendario declarado?");
    expect(diff?.id).toBe("diff");
    expect(str(diff?.run)).toContain(
      "git status --porcelain data/calendario data/alias",
    );
    const pr = stepNamed("sync", "Abrir o actualizar el PR");
    expect(pr?.if).toBe("steps.diff.outputs.cambios == 'si'");
  });

  it("loads into the database on a push to main that touched the data", () => {
    expect(arr(obj(on.push).branches)).toEqual(["main"]);
    expect(arr(obj(on.push).paths)).toEqual([
      "data/calendario/**",
      "data/alias/**",
    ]);
    const load = stepNamed("load", "Cargar el calendario en la base");
    expect(str(load?.run)).toContain("npm run calendario:load --");
    expect(str(obj(load?.env).DATABASE_URL)).toContain("secrets.DATABASE_URL");
  });

  it("pushes without force, on top of the remote branch (F-SPEC-008-16)", () => {
    // The branch chore/calendario-<fecha> already exists from the second
    // Tuesday on — this very step contemplates the PR being open — and
    // --force-with-lease aborted with "stale info" because a shallow clone
    // has no tracking ref for it. The fix is not to force harder: the step
    // builds on top of the remote branch, so the push is a fast forward and
    // nothing that lives on that branch is ever rewritten.
    const pr = stepNamed("sync", "Abrir o actualizar el PR");
    const run = str(pr?.run);
    // Comments out: the step explains in prose why it does not force.
    const commands = run
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    expect(commands).not.toContain("--force");
    expect(commands).toContain("git push");
    expect(run).toContain('git fetch origin "+refs/heads/$rama:');
    expect(run).toContain('git push origin "HEAD:refs/heads/$rama"');
    // Both halves: the branch may or may not be there.
    expect(run).toContain("git ls-remote --exit-code --heads origin");
    expect(run).toContain('git checkout -f -B "$rama"');
  });

  it("checks out the whole history in the job that pushes", () => {
    const checkout = steps("sync").find(
      (step) => typeof step.uses === "string" && step.uses.includes("checkout"),
    );
    expect(str(obj(checkout?.with)["fetch-depth"])).toBe("0");
  });

  const prRun = () => str(stepNamed("sync", "Abrir o actualizar el PR")?.run);
  const commandsOf = (run: string) =>
    run
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");

  it("SPEC-015 CA-2 keeps one fixed branch, chore/calendario", () => {
    const run = prRun();
    expect(run).toContain('rama="chore/calendario"\n');
    expect(run).not.toContain("chore/calendario-$fecha");
  });

  it("SPEC-015 CA-2 updates the open PR of that branch instead of opening another", () => {
    const run = commandsOf(prRun());
    // Only an OPEN PR counts: gh pr view <branch> also finds merged ones.
    expect(run).toContain(
      'gh pr list --head "$rama" --state open --json number --jq',
    );
    // By number: gh pr edit <branch> may pick a merged PR of the same branch.
    expect(run).toContain('gh pr edit "$abierto"');
    expect(run).toMatch(/if \[ -n "\$abierto" \]; then[\s\S]*gh pr edit/);
    expect(run).toContain('gh pr create --base main --head "$rama"');
  });

  it("SPEC-015 CA-2 rebuilds the branch from main once its PR was merged or closed", () => {
    const run = commandsOf(prRun());
    // Without an open PR the old branch goes away and a new one starts from
    // the checkout of main; deleting it keeps the push free of --force.
    expect(run).toContain('git push origin --delete "$rama"');
    expect(run).not.toContain("--force");
    const rebuild = run.slice(run.indexOf('git push origin --delete "$rama"'));
    expect(rebuild).toContain('git checkout -f -B "$rama"');
  });

  it("SPEC-015 CA-3 the title of the PR ends in — N urgentes when N > 0", () => {
    const step = stepNamed("sync", "Abrir o actualizar el PR");
    expect(str(obj(step?.env).URGENTES)).toBe(
      "${{ steps.sync.outputs.urgentes }}",
    );
    const run = prRun();
    expect(run).toContain('if [ "$URGENTES" -gt 0 ]; then');
    expect(run).toContain('titulo="$titulo — $URGENTES urgentes"');
    expect(run).toContain('--title "$titulo"');
    // The title is rewritten on update too: the count is today's.
    expect(run).toMatch(/gh pr edit "\$abierto" --title "\$titulo"/);
  });

  it("SPEC-015 CA-4 the sync step exposes its verdict", () => {
    const sync = stepNamed("sync", "Sincronizar contra el proveedor");
    expect(sync?.id).toBe("sync");
    const diff = stepNamed("sync", "¿Hay diff en el calendario declarado?");
    expect(str(diff?.run)).toContain("git status --porcelain data/alias");
    expect(str(diff?.run)).toContain('echo "alias=');
  });

  it("SPEC-015 CA-4 merges its own PR only for pure reschedules with data/alias untouched", () => {
    const merge = stepNamed(
      "sync",
      "Fusionar y cargar las reprogramaciones puras",
    );
    expect(str(merge?.if)).toBe(
      "steps.diff.outputs.cambios == 'si' && steps.diff.outputs.alias == 'no' && steps.sync.outputs.auto == 'si'",
    );
    const run = commandsOf(str(merge?.run));
    expect(run).toContain(
      'gh pr list --head "$rama" --state open --json number --jq',
    );
    expect(run).toContain('gh pr merge "$pr" --merge');
    // Nothing but data/calendario/** may differ from main: a human commit
    // left on the branch never merges without a human.
    expect(run).toContain("git diff --name-only origin/main HEAD");
    expect(run).toContain("data/calendario/");
  });

  it("SPEC-015 CA-4 launches load by workflow_dispatch after merging", () => {
    // A merge made with GITHUB_TOKEN does not fire on: push, so the load
    // that a human merge triggers has to be launched by hand.
    const merge = stepNamed(
      "sync",
      "Fusionar y cargar las reprogramaciones puras",
    );
    const run = commandsOf(str(merge?.run));
    expect(run).toContain(
      'gh workflow run calendario-semanal.yml --ref main -f cargar=si -f temporada="$TEMPORADA"',
    );
    expect(run.indexOf("gh workflow run")).toBeGreaterThan(
      run.indexOf("gh pr merge"),
    );
    expect(str(obj(obj(jobs.sync).permissions).actions)).toBe("write");
  });

  it("splits the two jobs by event", () => {
    expect(str(obj(jobs.sync).if)).toContain("github.event_name != 'push'");
    expect(str(obj(jobs.load).if)).toContain("github.event_name == 'push'");
  });
});
