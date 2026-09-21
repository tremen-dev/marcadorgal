-- Counters of an attempt (season, matches, requests, unresolved, skipped,
-- alerts) as jsonb instead of a column each: the measuring spec adds latencies
-- without a migration (SPEC-006 N-9, F-SPEC-002-1).
alter table public.ingest_attempts add column details jsonb not null default '{}'::jsonb;
