-- Stubs of what the Supabase image provides; only so the project's
-- migrations apply on a plain postgres:17 for SPEC-041 CA-1.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit;
create role supabase_admin login superuser;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create table cron.job_run_details (runid bigserial primary key, jobid bigint, end_time timestamptz);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ insert into cron.job (jobname, schedule, command) values (n, s, c) returning jobid $$;
create function cron.unschedule(n text) returns boolean language sql as $$ delete from cron.job where jobname = n returning true $$;
create schema vault;
create table vault.secrets (name text, decrypted_secret text);
create view vault.decrypted_secrets as select * from vault.secrets;
create schema net;
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000) returns bigint language sql as $$ select 1::bigint $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create schema realtime;
create table realtime.messages (id uuid default gen_random_uuid(), topic text, extension text, event text, payload jsonb, private boolean, inserted_at timestamptz default now());
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('realtime.topic', true), '')::text $$;
create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $$
  insert into realtime.messages (topic, extension, event, payload, private)
  values (topic, 'broadcast', event, payload || jsonb_build_object('id', gen_random_uuid()), private) $$;
grant usage on schema realtime to anon, authenticated;
grant select on realtime.messages to anon, authenticated;
