-- One row per calendario:load run and season, with the summary it printed (SPEC-004 N-4).
create table public.calendar_loads (
  id uuid primary key default gen_random_uuid(),
  season text not null check (season ~ '^\d{4}-\d{2}$'),
  loaded_at timestamptz not null default now(),
  summary jsonb not null
);

create index calendar_loads_season_idx on public.calendar_loads (season, loaded_at desc);

-- Operational table: no policy, so RLS denies every role but the server (ADR-006 §6).
alter table public.calendar_loads enable row level security;
