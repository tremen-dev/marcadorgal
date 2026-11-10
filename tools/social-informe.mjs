#!/usr/bin/env node
// SPEC-079 CA-3/CA-4: the report of the social queue after a matchday. The
// shell and nothing more, like tools/informe-jornada.mjs: it reads
// DATABASE_URL, runs the read-only query (src/social/report-db.ts), lets the
// pure src/social/report.ts contrast and judge, and prints the Markdown (or
// the JSON). With --issue it also carries the report to the channel of
// ADR-032: one GitHub issue per UTC date, labelled `redes`, created once and
// edited on every later run of the day. gh is injected, so the tests never
// touch the network. Runs on Node's native type stripping: no tsx, no build.
//
// Usage: npm run social:informe -- [--dias N | --desde <ISO> --hasta <ISO>] [--json] [--issue]
//   --dias N          window = [now − N days, now); 4 by default.
//   --desde/--hasta   ISO-8601 instants, [desde, hasta).
//   --json            print the report object instead of the Markdown.
//   --issue           create or edit the issue of the day (needs GH_TOKEN and
//                     GH_REPO); with no match in the window, gh is not called.
// With GITHUB_OUTPUT set, appends partidos=<n> and veredicto=<OK|DESVIACIONES|SIN_PARTIDOS>.
// Exit 0 even with deviations (the issue is the channel); 1 without
// DATABASE_URL, on bad arguments or when the database fails.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createSql } from "../src/db/connect.ts";
import { socialConfig, watchedTeams } from "../src/social/config.ts";
import { reportRows } from "../src/social/report-db.ts";
import { buildReport, renderMarkdown } from "../src/social/report.ts";

export const ETIQUETA = "redes";
export const TITULAR = "albertofojo";
const DAY_MS = 24 * 60 * 60 * 1000;
const USAGE =
  "Uso: npm run social:informe -- [--dias N | --desde <ISO> --hasta <ISO>] [--json] [--issue]";

const isoOf = (value, flag) => {
  const ms = Date.parse(value ?? "");
  if (Number.isNaN(ms)) throw new Error(`${flag}: '${value}' no es un instante ISO-8601`);
  // Normalised to UTC with Z: the model has no other spelling.
  return new Date(ms).toISOString();
};

/** The window and the flags; throws on anything it does not understand. */
export function parseArgs(argv, now) {
  let dias = null;
  let desde = null;
  let hasta = null;
  let json = false;
  let issue = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") json = true;
    else if (arg === "--issue") issue = true;
    else if (arg === "--dias" || arg === "--desde" || arg === "--hasta") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--"))
        throw new Error(`${arg} necesita un valor`);
      if (arg === "--dias") {
        if (!/^\d+$/.test(value) || Number(value) < 1)
          throw new Error(`--dias tiene que ser un entero ≥ 1 (pedido: '${value}')`);
        dias = Number(value);
      } else if (arg === "--desde") desde = isoOf(value, arg);
      else hasta = isoOf(value, arg);
      i += 1;
    } else if (arg.startsWith("--")) throw new Error(`opción desconocida: ${arg}`);
    else throw new Error(`argumento inesperado: ${arg}`);
  }
  if (dias !== null && (desde !== null || hasta !== null))
    throw new Error("--dias no se combina con --desde/--hasta");
  if ((desde === null) !== (hasta === null))
    throw new Error("--desde y --hasta van juntos");
  let window;
  if (desde !== null && hasta !== null) {
    if (Date.parse(desde) >= Date.parse(hasta))
      throw new Error("--desde tiene que ser anterior a --hasta");
    window = { from: desde, to: hasta };
  } else {
    const to = isoOf(now, "now");
    window = {
      from: new Date(Date.parse(to) - (dias ?? 4) * DAY_MS).toISOString(),
      to,
    };
  }
  return { window, json, issue };
}

/** The lines for GITHUB_OUTPUT. */
export function githubOutput(report) {
  const veredicto = report.matches === 0 ? "SIN_PARTIDOS" : report.verdict;
  return `partidos=${report.matches}\nveredicto=${veredicto}\n`;
}

/** The title of the issue of a UTC date (AAAA-MM-DD). */
export const issueTitle = (today) => `Informe de redes: ${today}`;

/** The body: verdict first, the Markdown of CA-3, the link to the run. */
export function issueBody({ report, markdown, run }) {
  return `Veredicto: **${report.verdict}** (modo ${report.mode}, ${report.matches} partidos)

${markdown}
---
Ejecución: ${run}
`;
}

/**
 * Parses the JSON of a gh list command. With no matches, gh list --json
 * prints nothing at all instead of [] (gh 2.83), so empty output is [].
 */
const listaJson = (salida) => (salida.trim() === "" ? [] : JSON.parse(salida));

function asegurarEtiqueta(gh) {
  const etiquetas = listaJson(
    gh(["label", "list", "--search", ETIQUETA, "--limit", "100", "--json", "name"]),
  );
  if (etiquetas.some((e) => e.name === ETIQUETA)) return;
  gh([
    "label",
    "create",
    ETIQUETA,
    "--color",
    "1D76DB",
    "--description",
    "Informe de la cola de redes tras cada jornada (SPEC-079, ADR-032)",
  ]);
}

/**
 * CA-4: with no match in the window, nothing. Otherwise the OPEN issue of the
 * day (label `redes`, exact title) is edited, which does not notify; without
 * one, a new issue is created, labelled and assigned to the owner. Returns
 * the action and the number.
 */
export function publishIssue({ gh, report, markdown, today, run }) {
  if (report.matches === 0) return { accion: "nada" };
  const title = issueTitle(today);
  const body = issueBody({ report, markdown, run });
  asegurarEtiqueta(gh);
  const abiertas = listaJson(
    gh([
      "issue",
      "list",
      "--label",
      ETIQUETA,
      "--state",
      "open",
      "--limit",
      "100",
      "--json",
      "number,title",
    ]),
  );
  const abierta = abiertas.find((i) => i.title === title);
  if (abierta !== undefined) {
    gh(["issue", "edit", String(abierta.number), "--body", body]);
    return { accion: "editar", numero: abierta.number };
  }
  const url = gh([
    "issue",
    "create",
    "--title",
    title,
    "--label",
    ETIQUETA,
    "--assignee",
    TITULAR,
    "--body",
    body,
  ]).trim();
  const numero = Number(url.split("/").pop());
  return { accion: "crear", numero: Number.isFinite(numero) ? numero : undefined };
}

/** URL of the current Actions run, or a placeholder outside Actions. */
export function enlaceEjecucion(env) {
  if (!env.GITHUB_RUN_ID) return "(ejecución local)";
  return `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
}

const ghReal = (args) =>
  execFileSync("gh", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });

// Nothing of the connection string ever reaches a message: the error of the
// driver is printed with the URL, its password and its user redacted.
function redact(text, env) {
  let out = text;
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    for (const part of [env.DATABASE_URL, url.password, decodeURIComponent(url.password), url.username])
      if (part) out = out.split(part).join("<redactado>");
  } catch {
    // no URL to redact
  }
  return out;
}

async function main(argv, env) {
  let args;
  try {
    args = parseArgs(argv, new Date().toISOString());
  } catch (e) {
    console.error(`${e instanceof Error ? e.message : String(e)}\n${USAGE}`);
    return 1;
  }
  if (!env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    return 1;
  }
  if (args.issue && (!env.GH_TOKEN || !env.GH_REPO)) {
    console.error("--issue necesita GH_TOKEN y GH_REPO");
    return 1;
  }

  const config = socialConfig(env);
  const watched = (season) => watchedTeams(config, season);
  // An unparsable DATABASE_URL would be echoed back by the driver's error
  // (`Invalid URL ... input: ...`): never print that message.
  let sql;
  try {
    sql = createSql(env);
  } catch {
    console.error("DATABASE_URL is not a valid connection string");
    return 1;
  }
  let report;
  try {
    const rows = await reportRows(sql, args.window);
    report = buildReport({ window: args.window, ...rows, watched });
  } catch (e) {
    console.error(redact(e instanceof Error ? e.message : String(e), env));
    return 1;
  } finally {
    await sql.end();
  }

  const markdown = renderMarkdown(report);
  console.log(args.json ? JSON.stringify(report, null, 2) : markdown);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, githubOutput(report));
  if (args.issue) {
    const r = publishIssue({
      gh: ghReal,
      report,
      markdown,
      today: new Date().toISOString().slice(0, 10),
      run: enlaceEjecucion(env),
    });
    console.error(
      r.numero === undefined ? `Issue: ${r.accion}` : `Issue: ${r.accion} #${r.numero}`,
    );
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.loadEnvFile();
  } catch {
    // no .env: rely on the environment
  }
  process.exitCode = await main(process.argv.slice(2), process.env);
}
