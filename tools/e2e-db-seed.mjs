#!/usr/bin/env node
// Seed of npm run e2e:db (SPEC-020 CA-6, N-4): only the local Supabase.
// 1. Sets the web_reader secret from WEB_READER_PASSWORD.
// 2. Loads the declared calendar of the season of now if it is not there.
// 3. Once per season, gives Decisions to a few matches of the current xornada
//    (every state and qualifier of the screen) and a live one of an earlier
//    round (H-2). Decisions are append-only: a second run leaves them alone.
// Never reads .env: the remote project is production (ADR-014 §1).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { currentXornada, seasonOf } from "../src/board/current.ts";
import { readSeasons } from "../src/calendar/files.ts";
import { loadSeason } from "../src/calendar/load.ts";
import { createSql } from "../src/db/connect.ts";
import { isLoopbackUrl } from "../src/db/env.ts";
import { setWebReaderPassword } from "../src/db/web-reader.ts";

const url = process.env.DATABASE_URL ?? "";
if (!isLoopbackUrl(url)) {
  console.error("e2e:db only seeds the local Supabase: DATABASE_URL is not loopback");
  process.exit(1);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const now = new Date().toISOString();
const season = seasonOf(now);
const sql = createSql(process.env);

// [status, home, away, minute, added, qualifier] for the first matches of the
// current xornada, in kickoff order.
const STATES = [
  ["live", 2, 1, 45, 3, "confirmado"],
  ["live", 0, 0, null, null, "sen_sinal"],
  ["finished", 3, 0, null, null, "confirmado"],
  ["postponed", null, null, null, null, "provisional"],
  ["suspended", 1, 1, null, null, "confirmado"],
  ["scheduled", null, null, null, null, "sen_sinal"],
  ["finished", 1, 2, null, null, "provisional"],
];

async function decide(tx, matchId, [status, home, away, minute, added, qualifier, halfTime]) {
  const state = {
    status,
    home_score: home,
    away_score: away,
    minute,
    added_minute: added,
    // SPEC-021: only the half-time case names the column; the rest take the
    // default false.
    ...(halfTime === undefined ? {} : { half_time: halfTime }),
  };
  const [{ id }] = await tx`insert into observations ${tx({
    match_id: matchId,
    source_id: "e2e-seed",
    observed_at: now,
    raw_ref: "e2e/seed.json",
    ...state,
  })} returning id`;
  await tx`insert into decisions ${tx({
    match_id: matchId,
    qualifier,
    rule: "operator",
    observation_ids: [id],
    ...state,
  })}`;
}

try {
  await setWebReaderPassword(sql, process.env.WEB_READER_PASSWORD ?? "");

  const [{ count }] =
    await sql`select count(*)::int as count from matches where season = ${season}`;
  if (count === 0) {
    const [files] = readSeasons(path.join(root, "data"), season);
    if (!files || files.issues.length > 0) throw new Error(`no valid calendar for ${season}`);
    await sql.begin((tx) => loadSeason(tx, files));
  }

  const index = (
    await sql`select match_id, competition_id, season, round, kickoff, status
      from web.xornada where season = ${season}`
  ).map((r) => ({
    matchId: r.match_id,
    competitionId: r.competition_id,
    season: r.season,
    round: r.round,
    kickoff: r.kickoff.toISOString(),
    status: r.status,
  }));
  const seeded = await sql`select 1 from decisions d join matches m on m.id = d.match_id
    where m.season = ${season} and d.rule = 'operator' limit 1`;
  if (seeded.length === 0) {
    const current = currentXornada(index, now).sort(
      (a, b) => a.kickoff.localeCompare(b.kickoff) || a.matchId.localeCompare(b.matchId),
    );
    const earlier = index.find(
      (e) =>
        e.competitionId === current[0].competitionId &&
        e.round < current[0].round - 1,
    );
    await sql.begin(async (tx) => {
      for (const [i, state] of STATES.entries()) await decide(tx, current[i].matchId, state);
      if (earlier) await decide(tx, earlier.matchId, ["live", 1, 0, 67, null, "confirmado"]);
    });
  }
  // SPEC-021 CA-6, CA-7: a live at half-time (with the minute the source
  // reports), once per season and apart from the block above, so a local
  // database seeded before SPEC-021 gets it too.
  const halfTime = await sql`select 1 from decisions d join matches m on m.id = d.match_id
    where m.season = ${season} and d.half_time limit 1`;
  if (halfTime.length === 0) {
    const current = currentXornada(index, now).sort(
      (a, b) => a.kickoff.localeCompare(b.kickoff) || a.matchId.localeCompare(b.matchId),
    );
    const free = current[STATES.length];
    if (!free) throw new Error("no free match in the current xornada for half-time");
    await sql.begin((tx) =>
      decide(tx, free.matchId, ["live", 1, 0, 45, null, "confirmado", true]),
    );
  }
  console.log(`e2e:db seed ready for ${season}`);
} finally {
  await sql.end();
}
