-- One row per raw retention run (ADR-007 §5): the tick runs it at most once a
-- day and reads the last row to decide whether to run again.
create table public.raw_purges (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  deleted integer not null default 0 check (deleted >= 0),
  error text
);

create index raw_purges_started_idx on public.raw_purges (started_at desc);

-- Operational table: no policy, so RLS denies every role but the server (ADR-006 §6).
alter table public.raw_purges enable row level security;
