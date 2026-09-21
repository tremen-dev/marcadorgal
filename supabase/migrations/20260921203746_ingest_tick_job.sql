-- The first of the two triggers of the tick (ADR-002 §1, SPEC-008 CA-4): a
-- pg_cron job every 30 s that asks Vercel to run /api/ingest/tick. The second
-- one is Vercel Cron every minute (vercel.json); three invocations a minute at
-- most and one single call to the provider, because the cadence is guarded by
-- openAttempt and its advisory lock (RN-08, ADR-008 §3), not by the trigger.
--
-- No secret lives here (H-4): the URL and the token are read by name from
-- vault.decrypted_secrets, and npm run cron:setup is what gives them a value
-- from .env. The very same migration will serve prod, reading that project's
-- own vault.
create extension if not exists supabase_vault with schema vault;

-- Idempotent: cron.schedule would otherwise fail on a job that already exists.
select cron.unschedule('ingest-tick')
where exists (select 1 from cron.job where jobname = 'ingest-tick');

-- '30 seconds' needs pg_cron 1.5 or newer (H-3). pg_net enqueues the request
-- and returns at once, so the job never holds the connection for the response.
select cron.schedule(
  'ingest-tick',
  '30 seconds',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'ingest_tick_url'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'ingest_tick_token'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $job$
);
