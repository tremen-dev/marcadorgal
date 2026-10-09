#!/usr/bin/env node
// SPEC-024 CA-11: the cost of board_delta. Inserts 50 Decisions with the
// trigger disabled and 50 with it enabled, in a transaction that is rolled
// back, only against the local Supabase. Prints the median of 5 runs.
//
// Usage: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node tools/medir-board-delta.mjs
import postgres from "postgres";
import { isLoopbackUrl } from "../src/db/env.ts";

const url = process.env.DATABASE_URL ?? "";
if (!isLoopbackUrl(url)) {
  console.error("medir-board-delta only runs against the local Supabase");
  process.exit(1);
}
const sql = postgres(url, { ssl: false, max: 1, onnotice: () => {} });
const N = 50;
const RUNS = 5;
const ROLLBACK = Symbol("rollback");

async function run() {
  const out = {};
  await sql
    .begin(async (tx) => {
      await tx`insert into competitions (id, season, name, tier) values ('medir-comp', '2026-27', 'Medir', 5) on conflict do nothing`;
      await tx`insert into teams (id, name) values ('medir-home', 'Home'), ('medir-away', 'Away') on conflict do nothing`;
      for (const enabled of [false, true]) {
        const match = `medir-${enabled ? "on" : "off"}`;
        await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
          values (${match}, 'medir-comp', '2026-27', 1, now(), 'medir-home', 'medir-away')`;
        const [{ id }] = await tx`insert into observations (match_id, source_id, observed_at, raw_ref, status, home_score, away_score, minute)
          values (${match}, 'medir', now(), 'raw/medir.json', 'live', 0, 0, 1) returning id`;
        await tx.unsafe(
          `alter table public.decisions ${enabled ? "enable" : "disable"} trigger board_delta`,
        );
        const t0 = performance.now();
        for (let i = 0; i < N; i++)
          await tx`insert into decisions (match_id, status, home_score, away_score, minute, qualifier, rule, observation_ids)
            values (${match}, 'live', ${i}, 0, 1, 'confirmado', 'RN-01', ${[id]})`;
        out[enabled ? "on" : "off"] = performance.now() - t0;
        if (enabled) {
          const [{ n }] =
            await tx`select count(*)::int as n from realtime.messages where topic = 'board:2026-27' and payload ->> 'match_id' = ${match}`;
          out.messages = n;
        }
      }
      throw ROLLBACK;
    })
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });
  return out;
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
try {
  const runs = [];
  for (let r = 0; r < RUNS; r++) runs.push(await run());
  const off = median(runs.map((r) => r.off));
  const on = median(runs.map((r) => r.on));
  console.log(
    `${N} Decisions, median of ${RUNS}: without trigger ${off.toFixed(1)} ms (${(off / N).toFixed(2)} ms/Decision), with trigger ${on.toFixed(1)} ms (${(on / N).toFixed(2)} ms/Decision), +${(((on - off) / off) * 100).toFixed(0)} %; messages with trigger: ${runs.map((r) => r.messages).join(",")}`,
  );
} finally {
  await sql.end();
}
