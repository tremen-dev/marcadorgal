import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Instant } from "../model/index.ts";
import type { Report } from "./report.ts";

// SPEC-079 CA-3: tools/social-informe.mjs, the thin shell of the report.
// Arguments are checked before anything else, DATABASE_URL right after, and
// a failing database never prints its password.
const root = fileURLToPath(new URL("../..", import.meta.url));
const SCRIPT = path.join(root, "tools", "social-informe.mjs");

type Window = { from: Instant; to: Instant };
type Args = { window: Window; json: boolean; issue: boolean };
type Modulo = {
  parseArgs: (argv: string[], now: Instant) => Args;
  githubOutput: (report: Pick<Report, "matches" | "verdict">) => string;
};
let m: Modulo;
beforeAll(async () => {
  m = (await import(pathToFileURL(SCRIPT).href)) as Modulo;
});

// A cwd without .env, so process.loadEnvFile() finds nothing and no real
// secret enters the child.
const cleanCwd = mkdtempSync(path.join(tmpdir(), "marcadorgal-redes-"));
const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
for (const key of [
  "DATABASE_URL",
  "GITHUB_OUTPUT",
  "GH_TOKEN",
  "GH_REPO",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
])
  delete cleanEnv[key];

const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: cleanCwd,
    env: { ...cleanEnv, ...env },
    encoding: "utf8",
    timeout: 60_000,
  });

const NOW = "2026-11-10T06:00:00.000Z" as Instant;

describe("SPEC-079 CA-3 parseArgs", () => {
  it("defaults to the last 4 days, ending now", () => {
    expect(m.parseArgs([], NOW)).toEqual({
      window: { from: "2026-11-06T06:00:00.000Z", to: NOW },
      json: false,
      issue: false,
    });
  });

  it("--dias N, --json and --issue", () => {
    expect(m.parseArgs(["--dias", "7", "--json", "--issue"], NOW)).toEqual({
      window: { from: "2026-11-03T06:00:00.000Z", to: NOW },
      json: true,
      issue: true,
    });
  });

  it("--desde and --hasta, normalised to UTC with Z", () => {
    expect(
      m.parseArgs(
        ["--desde", "2026-11-07T00:00:00+01:00", "--hasta", "2026-11-10"],
        NOW,
      ).window,
    ).toEqual({
      from: "2026-11-06T23:00:00.000Z",
      to: "2026-11-10T00:00:00.000Z",
    });
  });

  it.each([
    [["--dias", "0"], /--dias/],
    [["--dias", "x"], /--dias/],
    [["--dias"], /--dias/],
    [["--desde", "2026-11-07"], /--hasta/],
    [["--hasta", "2026-11-07"], /--desde/],
    [["--desde", "2026-11-10", "--hasta", "2026-11-07"], /anterior/],
    [["--desde", "ayer", "--hasta", "2026-11-07"], /ISO-8601/],
    [
      ["--dias", "2", "--desde", "2026-11-07", "--hasta", "2026-11-08"],
      /--dias/,
    ],
    [["--todo"], /--todo/],
    [["extra"], /extra/],
  ])("rejects %j", (argv, re) => {
    expect(() => m.parseArgs(argv, NOW)).toThrow(re);
  });
});

describe("SPEC-079 CA-3 GITHUB_OUTPUT", () => {
  it("partidos and veredicto, SIN_PARTIDOS for an empty window", () => {
    expect(m.githubOutput({ matches: 3, verdict: "OK" })).toBe(
      "partidos=3\nveredicto=OK\n",
    );
    expect(m.githubOutput({ matches: 2, verdict: "DESVIACIONES" })).toBe(
      "partidos=2\nveredicto=DESVIACIONES\n",
    );
    expect(m.githubOutput({ matches: 0, verdict: "OK" })).toBe(
      "partidos=0\nveredicto=SIN_PARTIDOS\n",
    );
  });
});

describe("SPEC-079 CA-3 the shell", () => {
  it("is the npm script", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    );
    expect(pkg.scripts["social:informe"]).toBe("node tools/social-informe.mjs");
  });

  it("exits 1 with the usage on bad arguments, before DATABASE_URL", () => {
    const r = run(["--dias", "0"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--dias");
    expect(r.stderr).toContain("npm run social:informe");
    expect(r.stdout).toBe("");
  });

  it("exits 1 without DATABASE_URL and says so", () => {
    const r = run([]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("DATABASE_URL");
    expect(r.stdout).toBe("");
  });

  it("exits 1 when the database fails, without printing the password", () => {
    const sentinel = "CENTINELA-s3cr3t-9f1c";
    const r = run([], {
      DATABASE_URL: `postgresql://postgres:${sentinel}@127.0.0.1:1/postgres`,
    });
    expect(r.status).toBe(1);
    expect(r.stdout).not.toContain(sentinel);
    expect(r.stderr).not.toContain(sentinel);
    expect(r.stderr.length).toBeGreaterThan(0);
  });
});

// SPEC-079 CA-4: --issue carries the report to the channel of ADR-032, with
// gh injected. This fake keeps issues and labels in memory.
type Gh = (args: string[]) => string;
type IssueModulo = {
  publishIssue: (o: {
    gh: Gh;
    report: Report;
    markdown: string;
    today: string;
    run: string;
  }) => { accion: string; numero?: number };
  enlaceEjecucion: (env: Record<string, string | undefined>) => string;
};
type FakeIssue = {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  labels: string[];
  assignees: string[];
};

function ghFalso(etiquetas: string[] = []) {
  const issues: FakeIssue[] = [];
  const labels = [...etiquetas];
  const llamadas: string[][] = [];
  const opt = (args: string[], name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const gh: Gh = (args) => {
    llamadas.push(args);
    const [grupo, verbo] = args;
    if (grupo === "label" && verbo === "list")
      return labels.length === 0
        ? ""
        : JSON.stringify(labels.map((name) => ({ name })));
    if (grupo === "label" && verbo === "create") {
      labels.push(args[2] ?? "");
      return "";
    }
    if (grupo === "issue" && verbo === "list") {
      const label = opt(args, "--label") ?? "";
      const state = opt(args, "--state");
      const rows = issues
        .filter((i) => i.labels.includes(label) && i.state === state)
        .map(({ number, title }) => ({ number, title }));
      return rows.length === 0 ? "" : JSON.stringify(rows);
    }
    if (grupo === "issue" && verbo === "create") {
      const label = opt(args, "--label") ?? "";
      if (!labels.includes(label)) throw new Error(`no label ${label}`);
      const number = issues.length + 1;
      issues.push({
        number,
        title: opt(args, "--title") ?? "",
        body: opt(args, "--body") ?? "",
        state: "open",
        labels: [label],
        assignees: [opt(args, "--assignee") ?? ""],
      });
      return `https://github.com/o/r/issues/${number}\n`;
    }
    const issue = issues.find((i) => i.number === Number(args[2]));
    if (!issue) throw new Error(`gh ${args.join(" ")}: no issue`);
    if (verbo === "edit") issue.body = opt(args, "--body") ?? "";
    else throw new Error(`gh ${args.join(" ")}: unexpected`);
    return "";
  };
  const cuenta = (g: string, v: string) =>
    llamadas.filter((a) => a[0] === g && a[1] === v).length;
  return { gh, issues, labels, llamadas, cuenta };
}

const reportOf = (matches: number, verdict: Report["verdict"]): Report => ({
  window: { from: "2026-11-06T06:00:00.000Z", to: NOW },
  matches,
  mode: "seco",
  verdict,
  deviations: verdict === "OK" ? [] : ["esperado sin fila: d-1 home"],
  expected: [],
  annulled: [],
  extra: [],
  duplicates: [],
  counts: [],
  texts: [],
});
const runUrl = (n: number) => `https://github.com/o/r/actions/runs/${n}`;

describe("SPEC-079 CA-4 --issue, one issue per day", () => {
  let im: IssueModulo;
  beforeAll(() => {
    im = m as unknown as IssueModulo;
  });

  it("two runs the same day: 1 create + 1 edit; the next day, a new create", () => {
    const f = ghFalso();
    const md = "# Informe\n\ncuerpo";
    const a = im.publishIssue({
      gh: f.gh,
      report: reportOf(3, "OK"),
      markdown: md,
      today: "2026-11-10",
      run: runUrl(1),
    });
    const b = im.publishIssue({
      gh: f.gh,
      report: reportOf(3, "DESVIACIONES"),
      markdown: `${md} 2`,
      today: "2026-11-10",
      run: runUrl(2),
    });
    expect(a).toEqual({ accion: "crear", numero: 1 });
    expect(b).toEqual({ accion: "editar", numero: 1 });
    expect(f.cuenta("issue", "create")).toBe(1);
    expect(f.cuenta("issue", "edit")).toBe(1);
    expect(f.cuenta("issue", "comment")).toBe(0);
    const c = im.publishIssue({
      gh: f.gh,
      report: reportOf(2, "OK"),
      markdown: md,
      today: "2026-11-11",
      run: runUrl(3),
    });
    expect(c).toEqual({ accion: "crear", numero: 2 });
    expect(f.issues.map((i) => i.title)).toEqual([
      "Informe de redes: 2026-11-10",
      "Informe de redes: 2026-11-11",
    ]);
  });

  it("creates the label `redes` when missing, assigns the owner, puts the verdict first and links the run", () => {
    const f = ghFalso();
    im.publishIssue({
      gh: f.gh,
      report: reportOf(1, "DESVIACIONES"),
      markdown: "# Informe\n\n- esperado sin fila: d-1 home",
      today: "2026-11-10",
      run: runUrl(7),
    });
    expect(f.cuenta("label", "create")).toBe(1);
    expect(f.labels).toEqual(["redes"]);
    const [issue] = f.issues;
    expect(issue?.labels).toEqual(["redes"]);
    expect(issue?.assignees).toEqual(["albertofojo"]);
    expect(issue?.body.split("\n")[0]).toMatch(
      /^Veredicto: \*\*DESVIACIONES\*\*/,
    );
    expect(issue?.body).toContain("- esperado sin fila: d-1 home");
    expect(issue?.body).toContain(runUrl(7));
  });

  it("does not create the label when it exists; the edit carries the new body", () => {
    const f = ghFalso(["bug", "redes"]);
    im.publishIssue({
      gh: f.gh,
      report: reportOf(1, "OK"),
      markdown: "v1",
      today: "2026-11-10",
      run: runUrl(1),
    });
    im.publishIssue({
      gh: f.gh,
      report: reportOf(1, "OK"),
      markdown: "v2",
      today: "2026-11-10",
      run: runUrl(2),
    });
    expect(f.cuenta("label", "create")).toBe(0);
    expect(f.issues[0]?.body).toContain("v2");
    expect(f.issues[0]?.body).not.toContain("v1");
    expect(f.issues[0]?.body).toContain(runUrl(2));
  });

  it("a closed issue of the day is not edited: a new one is created", () => {
    const f = ghFalso(["redes"]);
    im.publishIssue({
      gh: f.gh,
      report: reportOf(1, "OK"),
      markdown: "x",
      today: "2026-11-10",
      run: runUrl(1),
    });
    const first = f.issues[0];
    if (first) first.state = "closed";
    const r = im.publishIssue({
      gh: f.gh,
      report: reportOf(1, "OK"),
      markdown: "x",
      today: "2026-11-10",
      run: runUrl(2),
    });
    expect(r.accion).toBe("crear");
    expect(f.issues).toHaveLength(2);
  });

  it("with no match in the window it never calls gh", () => {
    const f = ghFalso();
    expect(
      im.publishIssue({
        gh: f.gh,
        report: reportOf(0, "OK"),
        markdown: "x",
        today: "2026-11-10",
        run: runUrl(1),
      }),
    ).toEqual({ accion: "nada" });
    expect(f.llamadas).toEqual([]);
  });

  it("--issue without GH_TOKEN/GH_REPO exits 1 before touching the database", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "--issue"], {
      cwd: cleanCwd,
      env: {
        ...cleanEnv,
        DATABASE_URL: "postgresql://postgres:CENTINELA-x@127.0.0.1:1/postgres",
      },
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("GH_TOKEN");
    expect(r.stderr).not.toContain("CENTINELA-x");
  });

  it("links the run from the Actions environment", () => {
    expect(
      im.enlaceEjecucion({
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "tremen-dev/marcadorgal",
        GITHUB_RUN_ID: "42",
      }),
    ).toBe("https://github.com/tremen-dev/marcadorgal/actions/runs/42");
  });
});
