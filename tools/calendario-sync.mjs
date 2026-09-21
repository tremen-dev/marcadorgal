#!/usr/bin/env node
// Imports the declared calendar of a season from the registered importers and
// merges it into data/calendario/<season>/<competition>.json and
// data/alias/<season>/<source>.json (SPEC-004 CA-7).
//
// Usage: npm run calendario:sync -- <season> [competition_id...] [--dry-run]
// Runs on Node's native type stripping: no tsx, no build step.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPETITIONS, IMPORTERS } from "../src/calendar/importers.ts";
import { validateAliases, validateCalendar } from "../src/calendar/schema.ts";
import { formatSyncDiff, syncCalendar } from "../src/calendar/sync.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const USER_AGENT = "marcador.gal (calendario; https://marcador.gal)";
const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const [season, ...requested] = args.filter((a) => !a.startsWith("--"));

if (!season || !/^\d{4}-\d{2}$/.test(season)) {
  console.error("Uso: npm run calendario:sync -- <temporada YYYY-YY> [competition_id...] [--dry-run]");
  process.exit(1);
}
const apiKey = process.env.API_FOOTBALL_KEY;
if (!apiKey) {
  console.error("API_FOOTBALL_KEY no está definida (H-1)");
  process.exit(1);
}
const unknown = requested.filter((id) => !COMPETITIONS.some((c) => c.id === id));
if (unknown.length) {
  console.error(`Competiciones desconocidas: ${unknown.join(", ")}`);
  process.exit(1);
}
const competitions = COMPETITIONS.filter((c) => !requested.length || requested.includes(c.id));

const calendarDir = path.join(root, "data", "calendario", season);
const aliasDir = path.join(root, "data", "alias", season);
const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null);
const writeJson = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const nonEmpty = (errors) =>
  Array.isArray(errors) ? errors.length > 0 : errors && typeof errors === "object" && Object.keys(errors).length > 0;
const printIssues = (file, issues) => {
  console.error(`${file}: ${issues.length} problema(s)`);
  for (const i of issues) console.error(`  ${i.path}: ${i.message}`);
};

// Team ids of every calendar of the season on disk, so the shared alias file
// validates against the union (CA-3, CA-11).
const knownTeams = new Map();
if (existsSync(calendarDir)) {
  for (const name of readdirSync(calendarDir).filter((f) => f.endsWith(".json"))) {
    const file = readJson(path.join(calendarDir, name));
    knownTeams.set(name.slice(0, -5), (file?.teams ?? []).map((t) => t.id));
  }
}

const aliasFiles = new Map();
const aliasesFor = (sourceId) => {
  if (!aliasFiles.has(sourceId)) {
    const file = path.join(aliasDir, `${sourceId}.json`);
    aliasFiles.set(sourceId, readJson(file) ?? { source: sourceId, season, teams: [] });
  }
  return aliasFiles.get(sourceId);
};

let failed = false;
for (const competition of competitions) {
  const importer = IMPORTERS.find((i) => i.covers(competition.id, season));
  if (!importer) {
    console.error(`${competition.id}: ningún importador cubre la temporada ${season}`);
    failed = true;
    continue;
  }
  let raw;
  try {
    raw = await importer.fetch(competition.id, season, { apiKey, fetch: globalThis.fetch, userAgent: USER_AGENT });
  } catch (e) {
    console.error(`${competition.id}: ${e.message}`);
    failed = true;
    continue;
  }
  if (nonEmpty(raw?.errors)) {
    console.error(`${competition.id}: el proveedor devolvió errors: ${JSON.stringify(raw.errors)}`);
    failed = true;
    continue;
  }
  const calendarFile = path.join(calendarDir, `${competition.id}.json`);
  const result = syncCalendar({
    current: readJson(calendarFile),
    aliases: aliasesFor(importer.id),
    imported: importer.parse(raw),
    competition: { id: competition.id, season, name: competition.name, tier: competition.tier },
    sourceId: importer.id,
  });
  console.log(formatSyncDiff(competition.id, result.diff));

  const issues = validateCalendar(result.calendar, { season, competitionId: competition.id });
  if (issues.length) {
    printIssues(calendarFile, issues);
    failed = true;
    continue;
  }
  knownTeams.set(competition.id, result.calendar.teams.map((t) => t.id));
  aliasFiles.set(importer.id, result.aliases);
  if (!dryRun) writeJson(calendarFile, result.calendar);
}

const allTeams = [...knownTeams.values()].flat();
for (const [sourceId, aliases] of aliasFiles) {
  const file = path.join(aliasDir, `${sourceId}.json`);
  const issues = validateAliases(aliases, { season, sourceId, knownTeams: allTeams });
  if (issues.length) {
    printIssues(file, issues);
    failed = true;
    continue;
  }
  if (!dryRun) writeJson(file, aliases);
}

if (dryRun) console.log("(--dry-run: no se ha escrito nada)");
process.exit(failed ? 1 : 0);
