#!/usr/bin/env node
// Loads data/calendario/<season>/*.json and data/alias/<season>/*.json into the
// database in DATABASE_URL, one transaction per season (SPEC-004 CA-11).
// Everything is validated before a connection is opened.
//
// Usage: npm run calendario:load -- [season]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSeasons } from "../src/calendar/files.ts";
import { loadSeason } from "../src/calendar/load.ts";
import { createSql } from "../src/db/connect.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const root = fileURLToPath(new URL("..", import.meta.url));
const [season] = process.argv.slice(2);
if (season !== undefined && !/^\d{4}-\d{2}$/.test(season)) {
  console.error("Uso: npm run calendario:load -- [temporada YYYY-YY]");
  process.exit(1);
}

const seasons = readSeasons(path.join(root, "data"), season);
if (seasons.length === 0) {
  console.error("No hay temporadas en data/calendario/");
  process.exit(1);
}
let invalid = false;
for (const s of seasons) {
  if (s.issues.length === 0) continue;
  invalid = true;
  console.error(`${s.season}: ${s.issues.length} problema(s)`);
  for (const i of s.issues) console.error(`  ${path.relative(root, i.file)} ${i.path}: ${i.message}`);
}
if (invalid) process.exit(1);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = createSql(process.env);
try {
  for (const s of seasons) {
    const summary = await sql.begin((tx) => loadSeason(tx, s));
    console.log(JSON.stringify(summary, null, 2));
  }
} finally {
  await sql.end();
}
