// Verificador SPEC-035 (V-1): the upsert of src/calendar/load.ts against two
// real decideMatches, only on the local Supabase. Commits three test matches
// and removes them (as replica) at the end.
// Usage: node docs/epicas/EPIC-MANT-mantenimiento/_qa/SPEC-035/repro-calendario-load.mjs
import postgres from "postgres";
import { createIngestDb } from "../../../../../src/ingest/db.ts";
import { decideMatches } from "../../../../../src/ingest/engine.ts";
import { SOURCES } from "../../../../../src/sources/registry.ts";

const url = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const mk = () => postgres(url, { ssl: false, max: 1, onnotice: () => {} });
const [c, e1, e2, l] = [mk(), mk(), mk(), mk()];
const KICK = "2026-09-25T18:00:00.000Z";
const ids = ["test-v35-a", "test-v35-b", "test-v35-c"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waiting = async (pid) => {
  for (let i = 0; i < 100; i++) {
    const [r] = await c`select count(*)::int n from pg_stat_activity
      where pid = ${pid} and wait_event_type = 'Lock'`;
    if (r.n) return;
    await sleep(50);
  }
  throw new Error(`never waited ${pid}`);
};
try {
  await c.begin(async (tx) => {
    await tx`insert into competitions (id, season, name, tier)
      values ('primera-division', '2026-27', 'Test', 1) on conflict do nothing`;
    await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
      on conflict do nothing`;
    for (const id of ids)
      await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
        values (${id}, 'primera-division', '2026-27', 1, ${KICK}, 'test-home', 'test-away')`;
  });
  const [m1, m2, m3] = ids;
  // E1: an afterInsert on m2, left open.
  let releaseE1;
  const e1Rel = new Promise((r) => (releaseE1 = r));
  let e1Ran;
  const e1R = new Promise((r) => (e1Ran = r));
  const e1Done = createIngestDb(e1).transaction(async (tx) => {
    await decideMatches(tx, [m2], KICK, SOURCES);
    e1Ran();
    await e1Rel;
  });
  await e1R;
  // E2: the sweep over m1..m3: locks m1, waits on m2.
  const [{ pid: p2 }] = await e2`select pg_backend_pid() pid`;
  const e2Done = createIngestDb(e2)
    .transaction((tx) => decideMatches(tx, [m1, m2, m3], KICK, SOURCES))
    .then(() => "ok", (e) => `${e.code} ${e.message}`);
  await waiting(p2);
  // L: the statement of src/calendar/load.ts, rows in file order (m3, m1).
  const [{ pid: pl }] = await l`select pg_backend_pid() pid`;
  const rows = [m3, m1].map((id) => ({
    id, competition_id: "primera-division", season: "2026-27", round: 1,
    kickoff: KICK, home_team_id: "test-home", away_team_id: "test-away",
  }));
  const t0 = Date.now();
  const lDone = l
    .begin(async (tx) => {
      await tx`insert into matches ${tx(rows)}
        on conflict (id) do update set kickoff = excluded.kickoff`;
    })
    .then(() => "ok", (e) => `${e.code} ${e.message}`);
  await waiting(pl);
  releaseE1();
  await e1Done;
  console.log(JSON.stringify({ sweep: await e2Done, calendarLoad: await lDone, ms: Date.now() - t0 }));
} finally {
  await c.begin(async (tx) => {
    await tx`set local session_replication_role = replica`;
    const a = tx.array(ids);
    await tx`delete from decisions where match_id = any(${a})`;
    await tx`delete from alerts where match_id = any(${a})`;
    await tx`delete from observations where match_id = any(${a})`;
    await tx`delete from matches where id = any(${a})`;
    await tx`delete from teams t where t.id in ('test-home', 'test-away')
      and not exists (select 1 from matches m where t.id in (m.home_team_id, m.away_team_id))`;
  });
  await Promise.all([c, e1, e2, l].map((s) => s.end()));
}
