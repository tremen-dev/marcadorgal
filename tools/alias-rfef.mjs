#!/usr/bin/env node
// Generates data/alias/<season>/rfef.json (SPEC-038 CA-5, ADR-017 §2): the
// federative names of the declared calendar, normalized, plus the entries of
// src/sources/rfef/fixtures/alias-test.json already validated over real
// panels (SPEC-031 CA-6), plus whatever the file already holds (corrections
// by hand survive a regeneration). The calendar wins every conflict.
//
// Usage: npm run alias:rfef -- [--season 2026-27] [--export <export.json>]...
//   --export <file>  after writing the alias, lists the names of the five
//                    competitions in that export body that do not resolve.
//                    Exits 1 when there is any, so the list is a check too.
//
// Only data/ and the fixtures are read; no network, no database.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AliasFile } from "../src/model/index.ts";
import {
  buildRfefAlias,
  unresolvedExportNames,
} from "../src/sources/rfef/alias.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const FIVE = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];
const TEST_ALIAS = "src/sources/rfef/fixtures/alias-test.json";
// The three errors alias-test.json carries on purpose for the identity cases
// of SPEC-031 CA-6 (its README): never part of the real alias.
const TEST_ONLY_ERRORS = new Set(["barakaldo cf", "cd coria", "cd extremadura"]);
const USAGE =
  "Uso: npm run alias:rfef -- [--season YYYY-YY] [--export <export.json>]...";

function parseArgs(argv) {
  const flags = { season: "2026-27", exports: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (arg === "--season" && value !== undefined) {
      flags.season = value;
      i += 1;
    } else if (arg === "--export" && value !== undefined) {
      flags.exports.push(value);
      i += 1;
    } else {
      console.error(USAGE);
      process.exit(1);
    }
  }
  if (!/^\d{4}-\d{2}$/.test(flags.season)) {
    console.error(USAGE);
    process.exit(1);
  }
  return flags;
}

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

const { season, exports } = parseArgs(process.argv.slice(2));
const target = path.join(ROOT, "data", "alias", season, "rfef.json");

const calendars = FIVE.map((competitionId) => {
  const file = path.join(ROOT, "data", "calendario", season, `${competitionId}.json`);
  if (!existsSync(file)) {
    console.error(`no calendar for ${competitionId} ${season}: ${path.relative(ROOT, file)}`);
    process.exit(1);
  }
  const { teams } = readJson(file);
  return { competitionId, teams: teams.map((t) => ({ id: t.id, name: t.name })) };
});
const testAlias = AliasFile.parse(readJson(path.join(ROOT, TEST_ALIAS)));
const existing = existsSync(target) ? AliasFile.parse(readJson(target)).teams : [];

const file = buildRfefAlias({
  season,
  competitions: testAlias.competitions ?? {},
  calendars,
  validated: testAlias.teams.filter((t) => !TEST_ONLY_ERRORS.has(t.externalId)),
  existing,
});
const known = new Set(calendars.flatMap((c) => c.teams.map((t) => t.id)));
const covered = new Set(file.teams.map((t) => t.teamId));
const missing = [...known].filter((id) => !covered.has(id));

writeFileSync(target, `${JSON.stringify(file, null, 2)}\n`);
console.log(
  `${path.relative(ROOT, target)}: ${file.teams.length} alias de ${covered.size} equipos` +
    ` (${existing.length} ya en el fichero), ${Object.keys(file.competitions).length} grupos`,
);
if (missing.length > 0) console.log(`equipos del calendario sin alias: ${missing.join(", ")}`);

let unresolved = 0;
for (const exportFile of exports) {
  const names = unresolvedExportNames(file, readJson(path.resolve(exportFile)));
  console.log(`\n${exportFile}: ${names.length} nombre(s) sin resolver`);
  for (const n of names) console.log(`  ${n.codGrupo} ${n.competitionId}  ${JSON.stringify(n.name)}`);
  unresolved += names.length;
}
if (unresolved > 0) process.exitCode = 1;
