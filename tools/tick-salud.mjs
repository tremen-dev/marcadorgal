#!/usr/bin/env node
// Says whether the deployed tick is alive (SPEC-008 CA-7, N-5). Reads the two
// clocks (cron.job, cron.job_run_details), what pg_net got back, the last
// attempts, the open alerts and the matches in window now. Exits 1 when the
// last hour has a failed run or a finished attempt with ok = false.
//
// Usage: npm run tick:salud
import { nowInstant } from "../src/clock.ts";
import { createSql } from "../src/db/connect.ts";
import { createIngestDb } from "../src/ingest/db.ts";
import { tickSalud } from "../src/ingest/salud.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const message = (e) => (e instanceof Error ? e.message : String(e));
const iso = (value) => (value === null || value === undefined ? null : value.toISOString());

// Every value that must never appear in the output, whatever row carried it.
const secrets = [
  process.env.INGEST_TICK_TOKEN,
  process.env.CRON_SECRET,
  process.env.API_FOOTBALL_KEY,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.DATABASE_URL,
].filter((v) => typeof v === "string" && v.length > 0);

const now = nowInstant();
const sql = createSql(process.env);
try {
  const jobs = await sql`select jobname, schedule, active from cron.job order by jobname`;
  const runs = await sql`select coalesce(j.jobname, d.jobid::text) as jobname,
      d.status, d.start_time
    from cron.job_run_details d left join cron.job j on j.jobid = d.jobid
    where d.start_time >= now() - interval '1 hour'
    order by d.start_time desc`;
  const responses = await sql`select status_code, created
    from net._http_response order by created desc limit 10`;
  const attempts = await sql`select started_at, finished_at, source_id, ok, error, details
    from ingest_attempts order by started_at desc limit 10`;
  const alerts = await sql`select kind, count(*)::int as count
    from alerts where resolved_at is null group by kind order by kind`;
  const matches = await createIngestDb(sql).windowMatches(now);

  const report = tickSalud({
    now,
    secrets,
    jobs: jobs.map((j) => ({ jobname: j.jobname, schedule: j.schedule, active: j.active })),
    runs: runs.map((r) => ({ jobname: r.jobname, status: r.status, startTime: iso(r.start_time) })),
    responses: responses.map((r) => ({ statusCode: r.status_code, created: iso(r.created) })),
    // finished_at null is an attempt still open, not a failed one: ok is
    // not null by default and would read as a failure.
    attempts: attempts.map((a) => ({
      startedAt: iso(a.started_at),
      sourceId: a.source_id,
      ok: a.finished_at === null ? null : a.ok,
      error: a.error,
      details: a.details,
    })),
    alerts: alerts.map((a) => ({ kind: a.kind, count: a.count })),
    matches: matches.map((m) => ({ id: m.id, kickoff: m.kickoff, status: m.status })),
  });
  console.log(report.text);
  if (!report.ok) process.exitCode = 1;
} catch (e) {
  console.error(message(e));
  process.exitCode = 1;
} finally {
  await sql.end();
}
