import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Observacion } from "./aviso.ts";

// SPEC-075 CA-2 (ADR-032): tools/aviso-bot-calendario.mjs turns the decision
// into gh calls. gh is injected: this fake keeps issues and labels in memory
// and never touches the network.
const root = fileURLToPath(new URL("../..", import.meta.url));
const SCRIPT = path.join(root, "tools/aviso-bot-calendario.mjs");

type Gh = (args: string[]) => string;
type Modulo = {
  avisar: (o: { gh: Gh; observaciones: Observacion[]; ejecucion: string }) => {
    accion: string;
    numero?: number;
  };
  enlaceEjecucion: (env: Record<string, string | undefined>) => string;
  observacionesDeJobs: (
    env: Record<string, string | undefined>,
  ) => Observacion[];
  observacionesVigia: (o: {
    gh: Gh;
    ahora: string;
    simular?: string;
  }) => Observacion[];
};
let m: Modulo;
beforeAll(async () => {
  m = (await import(pathToFileURL(SCRIPT).href)) as Modulo;
});

type Issue = {
  number: number;
  body: string;
  state: "open" | "closed";
  labels: string[];
  assignees: string[];
  comments: string[];
};

function ghFalso(etiquetas: string[] = []) {
  const issues: Issue[] = [];
  const labels = [...etiquetas];
  const llamadas: string[][] = [];
  const opt = (args: string[], name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const gh: Gh = (args) => {
    llamadas.push(args);
    const [grupo, verbo] = args;
    if (grupo === "issue" && verbo === "list") {
      const label = opt(args, "--label") ?? "";
      const state = opt(args, "--state");
      return JSON.stringify(
        issues
          .filter((i) => i.labels.includes(label) && i.state === state)
          .map(({ number, body }) => ({ number, body })),
      );
    }
    if (grupo === "label" && verbo === "list") {
      // Like the real gh 2.83: no matching label prints nothing, not [].
      if (labels.length === 0) return "";
      return JSON.stringify(labels.map((name) => ({ name })));
    }
    if (grupo === "label" && verbo === "create") {
      labels.push(args[2] ?? "");
      return "";
    }
    if (grupo === "issue" && verbo === "create") {
      const label = opt(args, "--label") ?? "";
      if (!labels.includes(label)) throw new Error(`no label ${label}`);
      const number = issues.length + 1;
      issues.push({
        number,
        body: opt(args, "--body") ?? "",
        state: "open",
        labels: [label],
        assignees: [opt(args, "--assignee") ?? ""],
        comments: [],
      });
      return `https://github.com/o/r/issues/${number}\n`;
    }
    const issue = issues.find((i) => i.number === Number(args[2]));
    if (!issue) throw new Error(`gh ${args.join(" ")}: no issue`);
    if (verbo === "edit") issue.body = opt(args, "--body") ?? "";
    else if (verbo === "comment")
      issue.comments.push(opt(args, "--body") ?? "");
    else if (verbo === "close") issue.state = "closed";
    else if (verbo === "reopen") issue.state = "open";
    else throw new Error(`gh ${args.join(" ")}: unexpected`);
    return "";
  };
  const cuenta = (g: string, v: string) =>
    llamadas.filter((a) => a[0] === g && a[1] === v).length;
  return { gh, issues, labels, llamadas, cuenta };
}

const run = (n: number) => `https://github.com/o/r/actions/runs/${n}`;
const falloSync: Observacion[] = [{ causa: "sync", resultado: "fallo" }];
const okSync: Observacion[] = [{ causa: "sync", resultado: "ok" }];

describe("SPEC-075 CA-2 one alert per incident", () => {
  it("three sync failures and a success: 1 create, 2 edit, 1 comment, 1 close", () => {
    const f = ghFalso();
    const acciones = [
      m.avisar({ gh: f.gh, observaciones: falloSync, ejecucion: run(1) }),
      m.avisar({ gh: f.gh, observaciones: falloSync, ejecucion: run(2) }),
      m.avisar({ gh: f.gh, observaciones: falloSync, ejecucion: run(3) }),
      m.avisar({ gh: f.gh, observaciones: okSync, ejecucion: run(4) }),
    ].map((r) => r.accion);
    expect(acciones).toEqual(["abrir", "actualizar", "actualizar", "cerrar"]);
    expect(f.cuenta("issue", "create")).toBe(1);
    expect(f.cuenta("issue", "edit")).toBe(2);
    expect(f.cuenta("issue", "comment")).toBe(1);
    expect(f.cuenta("issue", "close")).toBe(1);
    expect(f.cuenta("issue", "reopen")).toBe(0);
  });

  it("opens the issue labelled, assigned to the owner and linking the run; creates the label", () => {
    const f = ghFalso();
    m.avisar({ gh: f.gh, observaciones: falloSync, ejecucion: run(1) });
    expect(f.cuenta("label", "create")).toBe(1);
    expect(f.labels).toEqual(["bot-calendario"]);
    const [issue] = f.issues;
    expect(issue?.labels).toEqual(["bot-calendario"]);
    expect(issue?.assignees).toEqual(["albertofojo"]);
    expect(issue?.body).toContain(run(1));
  });

  it("does not create the label when it already exists", () => {
    const f = ghFalso(["bug", "bot-calendario"]);
    m.avisar({ gh: f.gh, observaciones: falloSync, ejecucion: run(1) });
    expect(f.cuenta("label", "create")).toBe(0);
    expect(f.issues).toHaveLength(1);
  });

  it("an update only edits the body, adding the run, and never comments", () => {
    const f = ghFalso();
    m.avisar({ gh: f.gh, observaciones: falloSync, ejecucion: run(1) });
    m.avisar({ gh: f.gh, observaciones: falloSync, ejecucion: run(2) });
    const [issue] = f.issues;
    expect(issue?.body).toContain(run(1));
    expect(issue?.body).toContain(run(2));
    expect(issue?.comments).toEqual([]);
  });

  it("closing comments «resuelto» with the run link", () => {
    const f = ghFalso();
    m.avisar({ gh: f.gh, observaciones: falloSync, ejecucion: run(1) });
    m.avisar({ gh: f.gh, observaciones: okSync, ejecucion: run(2) });
    const [issue] = f.issues;
    expect(issue?.state).toBe("closed");
    expect(issue?.comments).toHaveLength(1);
    expect(issue?.comments[0]).toMatch(/resuelto/i);
    expect(issue?.comments[0]).toContain(run(2));
  });

  it("a later failure opens a new issue and leaves the closed one closed", () => {
    const f = ghFalso();
    m.avisar({ gh: f.gh, observaciones: falloSync, ejecucion: run(1) });
    m.avisar({ gh: f.gh, observaciones: okSync, ejecucion: run(2) });
    const r = m.avisar({
      gh: f.gh,
      observaciones: falloSync,
      ejecucion: run(3),
    });
    expect(r.accion).toBe("abrir");
    expect(f.issues.map((i) => i.state)).toEqual(["closed", "open"]);
    expect(f.issues[1]?.body).toContain(run(3));
    expect(f.issues[1]?.body).not.toContain(run(1));
    expect(f.cuenta("issue", "reopen")).toBe(0);
  });

  it("a load ok does not close a sync incident", () => {
    const f = ghFalso();
    m.avisar({ gh: f.gh, observaciones: falloSync, ejecucion: run(1) });
    const r = m.avisar({
      gh: f.gh,
      observaciones: [{ causa: "load", resultado: "ok" }],
      ejecucion: run(2),
    });
    expect(r.accion).toBe("actualizar");
    expect(f.issues[0]?.state).toBe("open");
  });

  it("all ok and no incident: only looks, never writes", () => {
    const f = ghFalso();
    expect(
      m.avisar({ gh: f.gh, observaciones: okSync, ejecucion: run(1) }).accion,
    ).toBe("nada");
    expect(f.llamadas.map((a) => `${a[0]} ${a[1]}`)).toEqual(["issue list"]);
  });
});

describe("SPEC-075 CA-2/CA-3 inputs of the executor", () => {
  it("links the run from the Actions environment", () => {
    expect(
      m.enlaceEjecucion({
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "tremen-dev/marcadorgal",
        GITHUB_RUN_ID: "42",
      }),
    ).toBe("https://github.com/tremen-dev/marcadorgal/actions/runs/42");
  });

  it("translates the results of sync and load; skipped observes nothing", () => {
    expect(
      m.observacionesDeJobs({ SYNC_RESULT: "failure", LOAD_RESULT: "skipped" }),
    ).toEqual([{ causa: "sync", resultado: "fallo" }]);
    expect(
      m.observacionesDeJobs({ SYNC_RESULT: "skipped", LOAD_RESULT: "success" }),
    ).toEqual([{ causa: "load", resultado: "ok" }]);
    expect(
      m.observacionesDeJobs({
        SYNC_RESULT: "cancelled",
        LOAD_RESULT: "skipped",
      }),
    ).toEqual([{ causa: "sync", resultado: "fallo" }]);
  });
});

describe("SPEC-075 CA-4/CA-5 the watchman's observation", () => {
  const ghRuns = (createdAt: string[]) => {
    const llamadas: string[][] = [];
    const gh: Gh = (args) => {
      llamadas.push(args);
      return JSON.stringify(createdAt.map((c) => ({ createdAt: c })));
    };
    return { gh, llamadas };
  };

  it("reads the scheduled runs of calendario-semanal.yml", () => {
    const f = ghRuns(["2026-11-07T12:00:00Z"]);
    expect(
      m.observacionesVigia({ gh: f.gh, ahora: "2026-11-10T23:00:00Z" }),
    ).toEqual([{ causa: "sin-ejecuciones", resultado: "ok" }]);
    const args = f.llamadas[0] ?? [];
    expect(args.slice(0, 2)).toEqual(["run", "list"]);
    expect(args).toContain("calendario-semanal.yml");
    expect(args[args.indexOf("--event") + 1]).toBe("schedule");
  });

  it("is a failure past 96 h", () => {
    const f = ghRuns(["2026-11-07T12:00:00Z"]);
    expect(
      m.observacionesVigia({ gh: f.gh, ahora: "2026-11-11T13:00:00Z" }),
    ).toEqual([{ causa: "sin-ejecuciones", resultado: "fallo" }]);
  });

  it("simular=fallo forces the failure without asking gh", () => {
    const f = ghRuns(["2026-11-10T12:00:00Z"]);
    expect(
      m.observacionesVigia({
        gh: f.gh,
        ahora: "2026-11-10T13:00:00Z",
        simular: "fallo",
      }),
    ).toEqual([{ causa: "sin-ejecuciones", resultado: "fallo" }]);
    expect(f.llamadas).toEqual([]);
  });
});

describe("SPEC-075 CA-5 fix: gh prints nothing for an empty list", () => {
  it("opens the issue when label list, issue list and run list print nothing", () => {
    const creadas: string[][] = [];
    const gh: Gh = (args) => {
      const [grupo, verbo] = args;
      if (verbo === "list") return "";
      if (grupo === "label" && verbo === "create") {
        creadas.push(args);
        return "";
      }
      if (grupo === "issue" && verbo === "create") {
        creadas.push(args);
        return "https://github.com/tremen-dev/marcadorgal/issues/9\n";
      }
      throw new Error(`unexpected gh ${args.join(" ")}`);
    };
    const observaciones = m.observacionesVigia({
      gh,
      ahora: "2026-11-10T13:00:00Z",
    });
    expect(observaciones).toEqual([
      { causa: "sin-ejecuciones", resultado: "fallo" },
    ]);
    const r = m.avisar({ gh, observaciones, ejecucion: "https://x/runs/1" });
    expect(r).toEqual({ accion: "abrir", numero: 9 });
    expect(creadas.map((a) => `${a[0]} ${a[1]}`)).toEqual([
      "label create",
      "issue create",
    ]);
  });
});
