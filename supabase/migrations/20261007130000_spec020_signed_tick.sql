-- SPEC-020 CA-9 (ADR-015 §2): the pg_cron trigger of the tick stops putting
-- INGEST_TICK_TOKEN in net.http_request_queue, which every login role reads
-- through what PUBLIC has on net (ADR-015 §1). It sends instead
--
--   Authorization: Bearer t1.<epoch>.<signature>
--
-- with <epoch> the whole UTC seconds of now() and <signature> the HMAC-SHA256,
-- in lower-case hex, of 't1.<epoch>' keyed with the vault secret
-- ingest_tick_token. The key never leaves the vault; authorizeTick accepts the
-- signature for 60 s either side of its own now, and keeps accepting the
-- static bearer of Vercel Cron and tick:salud.
--
-- Same name, same 30 s, same URL and body as 20260921203746_ingest_tick_job:
-- only the header changes. Idempotent like that migration.
create extension if not exists pgcrypto with schema extensions;

select cron.unschedule('ingest-tick')
where exists (select 1 from cron.job where jobname = 'ingest-tick');

select cron.schedule(
  'ingest-tick',
  '30 seconds',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'ingest_tick_url'
      ),
      headers := (
        select jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || s.payload || '.' || encode(
            extensions.hmac(s.payload, k.decrypted_secret, 'sha256'), 'hex'
          )
        )
        from (
          select 't1.' || floor(extract(epoch from now()))::bigint as payload
        ) s
        left join vault.decrypted_secrets k on k.name = 'ingest_tick_token'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $job$
);
