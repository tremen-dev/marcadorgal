import { spawnSync } from "node:child_process";
import path from "node:path";
import postgres from "postgres";
import { LOCAL_DATABASE_URL } from "../playwright.db.config";
import { readSeasons } from "../src/calendar/files";

// e2e:db commits a calendar and Decisions (append-only) into the local
// Supabase, and the database tests expect the state they had before: the
// declared competitions and no matches (SPEC-018 inserts real match ids,
// SPEC-013 needs segunda-division). Reset with `--local`, which never reaches
// the remote project, then the competitions back.
export default async function teardown(): Promise<void> {
  const r = spawnSync("supabase", ["db", "reset", "--local"], {
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error("supabase db reset --local failed");
  const sql = postgres(LOCAL_DATABASE_URL, { ssl: false, max: 1 });
  try {
    for (const { season, calendars } of readSeasons(
      path.join(__dirname, "..", "data"),
    ))
      for (const { competition } of calendars)
        await sql`insert into competitions (id, season, name, tier)
          values (${competition.id}, ${season}, ${competition.name}, ${competition.tier})
          on conflict do nothing`;
  } finally {
    await sql.end();
  }
}
