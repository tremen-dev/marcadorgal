-- Operator-facing tables: never public (N-8).

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('conflict', 'regression', 'silence', 'unresolved_team')),
  match_id text references public.matches (id),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  check (kind = 'unresolved_team' or match_id is not null)
);

create index alerts_open_idx on public.alerts (opened_at desc) where resolved_at is null;

-- One row per adapter call of the tick (ADR-003): errors never stop the tick.
create table public.ingest_attempts (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  error text,
  raw_ref text,
  observations integer not null default 0 check (observations >= 0)
);

create index ingest_attempts_source_idx on public.ingest_attempts (source_id, started_at desc);
