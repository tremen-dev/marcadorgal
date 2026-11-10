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
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createSql } from "../src/db/connect.ts";
import { socialConfig, watchedTeams } from "../src/social/config.ts";
import { reportRows } from "../src/social/report-db.ts";
import { buildReport, renderMarkdown } from "../src/social/report.ts";

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
  const sql = createSql(env);
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
