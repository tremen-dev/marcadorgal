-- SPEC-029 CA-4 (H-3, H-4): cron.job_run_details keeps one row per run of
-- every job, and the tick runs every 30 s (~2,880 rows a day): on 2026-10-07
-- it was 29 of the 68 MB of the database. A job of pg_cron of its own, only
-- SQL and no deployed code, keeps 14 days: enough for tick:salud (10 min) and
-- for the report of a matchday (<= 4 days) generated up to 10 days after it.
-- cron.log_run = off was rejected: it would blind tick:salud (SPEC-017 CA-5).
-- No grant is added (ADR-015 §3).

-- Idempotent, as 20260921203746_ingest_tick_job.sql.
select cron.unschedule('purge-cron-history')
where exists (select 1 from cron.job where jobname = 'purge-cron-history');

select cron.schedule(
  'purge-cron-history',
  '17 4 * * *',
  $job$
    delete from cron.job_run_details
    where start_time < now() - interval '14 days';
  $job$
);
