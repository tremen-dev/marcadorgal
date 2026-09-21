#!/usr/bin/env node
// Prints the current round of every competition of a season from the board
// (SPEC-004 CA-12). Exits 1 if any competition yields no rows.
//
// Usage: npm run calendario:xornada -- [season]
import { currentRound } from "../src/calendar/current-round.ts";
import { createSql } from "../src/db/connect.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const [season = currentSeason()] = process.argv.slice(2);
if (!/^\d{4}-\d{2}$/.test(season)) {
  console.error("Uso: npm run calendario:xornada -- [temporada YYYY-YY]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

// Seasons start in summer: before July the season began the previous year.
function currentSeason() {
  const d = new Date();
  const start = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const now = new Date().toISOString();
const sql = createSql(process.env);
let failed = false;
try {
  const competitions = await sql`select id, name, tier from competitions
    where season = ${season} order by tier, id`;
  if (competitions.length === 0) {
    console.error(`${season}: ninguna competición cargada`);
    failed = true;
  }
  for (const c of competitions) {
    const matches = await sql`select round, kickoff from matches
      where competition_id = ${c.id} and season = ${season}`;
    const round = currentRound(
      matches.map((m) => ({ round: m.round, kickoff: m.kickoff.toISOString() })),
      now,
    );
    const rows =
      round === null
        ? []
        : await sql`select * from board
            where competition_id = ${c.id} and season = ${season} and round = ${round}
            order by kickoff, home_team_id`;
    console.log(`== ${c.id} (${c.name}) — xornada ${round ?? "-"} — ${rows.length} partidos`);
    for (const r of rows)
      console.log(`   ${r.kickoff.toISOString()}  ${r.home_team_name} - ${r.away_team_name}  [${r.status}]`);
    if (rows.length === 0) failed = true;
  }
} finally {
  await sql.end();
}
process.exit(failed ? 1 : 0);
