#!/usr/bin/env node
// The calibration of the RFEF cadence (SPEC-032, ADR-019). The shell and
// nothing more: it reads the clock, the calendar and the previous JSONL,
// passes the real fetch, and writes the JSONL, the raw bodies and the report.
// Every decision (plan, preconditions, stop, report) is the pure
// src/sources/rfef/calibration.ts. The source is not registered.
//
// Usage:
//   npm run rfef:calibrar -- --dry-run [--plan lento] [--jitter <s>]
//   npm run rfef:calibrar -- [--plan lento] [--jitter <s>] --ultima-peticion <ISO> --crudo <dir fuera del repo>
//   npm run rfef:calibrar -- --informe <fichero.jsonl> [--plan <plan>]
//
//   --plan <plan>            original (by default) or lento (E-2: 300/240/180 s,
//                            60 min each).
//   --jitter <s>             additive jitter per interval, in [0, 5] s; by
//                            default 5 in lento and 0 in original.
//   --ultima-peticion <ISO>  last known request to marcadores.rfef.es from
//                            this IP, manual browsing included (CA-5 i).
//   --crudo <dir>            where the bodies go as .raw.gz, outside the repo.
//   --informe <jsonl>        only (re)writes the report of a series.
//
// During the series nobody browses the RFEF from this IP (H-4).
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { gzipSync } from "node:zlib";
import { AliasFile } from "../src/model/index.ts";
import {
  buildReport,
  calibrate,
  exitCode,
  planOfLines,
  resolvePlan,
} from "../src/sources/rfef/calibration.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const QA_DIR = path.join(
  ROOT,
  "docs/epicas/EPIC-004-fuente-rfef/_qa/calibracion",
);
const SEASON = "2026-27";
const FIVE = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];
// The only codgrupo -> competition map of the rfef (SPEC-031 CA-6).
const ALIASES = "src/sources/rfef/fixtures/alias-test.json";
const USAGE =
  "Uso: npm run rfef:calibrar -- [--plan original|lento] [--jitter <s>] --dry-run | --ultima-peticion <ISO> --crudo <dir> | --informe <jsonl>";

function parseArgs(argv) {
  const flags = {
    dryRun: false,
    lastRequest: null,
    crudo: null,
    informe: null,
    plan: undefined,
    jitter: undefined,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") flags.dryRun = true;
    else if (
      arg === "--ultima-peticion" ||
      arg === "--crudo" ||
      arg === "--informe" ||
      arg === "--plan" ||
      arg === "--jitter"
    ) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--"))
        throw new Error(`${arg} necesita un valor`);
      if (arg === "--ultima-peticion") flags.lastRequest = value;
      else if (arg === "--jitter")
        flags.jitter = value.trim() === "" ? Number.NaN : Number(value);
      else flags[arg.slice(2)] = value;
      i += 1;
    } else throw new Error(`opción desconocida: ${arg}`);
  }
  return flags;
}

const readLines = (file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));

// CA-5 (ii): the newest `inicio` of every JSONL already written.
function lastLogged() {
  if (!existsSync(QA_DIR)) return null;
  let newest = null;
  for (const f of readdirSync(QA_DIR)) {
    if (!f.endsWith(".jsonl")) continue;
    const lines = readLines(path.join(QA_DIR, f));
    const last = lines.at(-1);
    if (last && (newest === null || last.inicio > newest))
      newest = last.inicio;
  }
  return newest;
}

function loadCalendar() {
  return FIVE.flatMap((competition) => {
    const file = JSON.parse(
      readFileSync(
        path.join(ROOT, `data/calendario/${SEASON}/${competition}.json`),
        "utf8",
      ),
    );
    return file.matches.map((m) => ({
      id: `${competition}-${SEASON}-j${m.round}-${m.home}-${m.away}`,
      competitionId: competition,
      round: m.round,
      homeTeamId: m.home,
      awayTeamId: m.away,
      kickoff: m.kickoff,
    }));
  });
}

function writeReport(jsonl, plan) {
  const lines = readLines(jsonl);
  const out = jsonl.replace(/\.jsonl$/, "-informe.md");
  writeFileSync(out, buildReport(lines, plan ?? planOfLines(lines)));
  console.log(`Informe: ${path.relative(ROOT, out)}`);
}

function insideRepo(dir) {
  mkdirSync(dir, { recursive: true });
  const real = realpathSync(dir);
  const root = realpathSync(ROOT);
  return real === root || real.startsWith(`${root}${path.sep}`);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.informe !== null) {
    let plan;
    if (flags.plan !== undefined) {
      const resolved = resolvePlan(flags.plan, flags.jitter);
      if ("reasons" in resolved) throw new Error(resolved.reasons.join("; "));
      plan = resolved.plan;
    }
    return writeReport(path.resolve(flags.informe), plan);
  }
  // E-2: an unknown --plan or a --jitter out of [0, 5] stops here, with
  // nothing written and no request.
  const resolved = resolvePlan(flags.plan, flags.jitter);
  if ("reasons" in resolved) throw new Error(resolved.reasons.join("; "));

  if (!flags.dryRun) {
    if (flags.crudo === null) throw new Error("falta --crudo <dir>");
    if (insideRepo(path.resolve(flags.crudo)))
      throw new Error("--crudo tiene que estar fuera del repo (CA-6)");
  }

  const started = new Date(Date.now()).toISOString();
  const fecha = started.slice(0, 10);
  const jsonl = path.join(QA_DIR, `${fecha}.jsonl`);
  const crudo = flags.crudo && path.join(path.resolve(flags.crudo), fecha);
  let written = false;

  const outcome = await calibrate(
    {
      dryRun: flags.dryRun,
      lastRequest: flags.lastRequest,
      lastLogged: flags.dryRun ? null : lastLogged(),
      plan: flags.plan,
      jitterSeconds: flags.jitter,
    },
    {
      fetch: globalThis.fetch,
      now: () => Date.now(),
      sleep: (ms) => delay(ms),
      random: () => Math.random(),
      log: (message) => console.log(message),
      calendar: loadCalendar(),
      aliases: AliasFile.parse(
        JSON.parse(readFileSync(path.join(ROOT, ALIASES), "utf8")),
      ),
      record: (line, body) => {
        mkdirSync(QA_DIR, { recursive: true });
        appendFileSync(jsonl, `${JSON.stringify(line)}\n`);
        written = true;
        if (body.length > 0) {
          mkdirSync(crudo, { recursive: true });
          const name = `${String(line.total).padStart(3, "0")}-${line.variante}-${line.inicio.replace(/:/g, "-")}.raw.gz`;
          writeFileSync(path.join(crudo, name), gzipSync(body, { level: 9 }));
        }
      },
    },
  );
  if (outcome.kind === "rechazada")
    for (const reason of outcome.reasons) console.error(`No se calibra: ${reason}`);
  if (written) writeReport(jsonl, resolved.plan);
  process.exitCode = exitCode(outcome);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  console.error(USAGE);
  process.exitCode = 2;
});
