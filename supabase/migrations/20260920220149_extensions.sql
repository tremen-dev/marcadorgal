-- Scheduler and HTTP client for the ingest tick (ADR-002); jobs come later.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
