#!/usr/bin/env node
// One-off: applies the human review (H-2 of SPEC-004) recorded in
// tools/revision-nombres-<season>.json to data/calendario/<season>/*.json and
// data/alias/<season>/api-football.json. Idempotent: entries are matched by
// their old or new id, so running it twice changes nothing.
//
// Usage: node tools/aplicar-revision-nombres.mjs [season]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const [season = "2026-27"] = process.argv.slice(2);
const review = JSON.parse(readFileSync(path.join(root, "tools", `revision-nombres-${season}.json`), "utf8"));
const calendarDir = path.join(root, "data", "calendario", season);
const aliasFile = path.join(root, "data", "alias", season, "api-football.json");

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

// old id and new id both resolve to the reviewed entry (idempotence).
const byId = new Map();
for (const teams of Object.values(review.teams)) {
  for (const [oldId, entry] of Object.entries(teams)) {
    const resolved = { id: entry.id ?? oldId, name: entry.name, shortName: entry.shortName };
    byId.set(oldId, resolved);
    byId.set(resolved.id, resolved);
  }
}
const resolveId = (id) => byId.get(id)?.id ?? id;

let changed = 0;
for (const [competitionId, name] of Object.entries(review.competitions)) {
  const file = path.join(calendarDir, `${competitionId}.json`);
  const calendar = readJson(file);
  const before = JSON.stringify(calendar);
  calendar.competition.name = name;
  calendar.teams = calendar.teams.map((t) => {
    const r = byId.get(t.id);
    if (!r) throw new Error(`${competitionId}: team ${t.id} is not in the review`);
    return r.shortName ? { id: r.id, name: r.name, shortName: r.shortName } : { id: r.id, name: r.name };
  });
  calendar.matches = calendar.matches.map((m) => ({ ...m, home: resolveId(m.home), away: resolveId(m.away) }));
  if (JSON.stringify(calendar) !== before) {
    writeJson(file, calendar);
    changed++;
  }
}

const aliases = readJson(aliasFile);
const before = JSON.stringify(aliases);
aliases.teams = aliases.teams.map((t) => ({ ...t, teamId: resolveId(t.teamId) }));
if (JSON.stringify(aliases) !== before) {
  writeJson(aliasFile, aliases);
  changed++;
}
console.log(`aplicar-revision-nombres: ${changed} fichero(s) reescrito(s)`);
