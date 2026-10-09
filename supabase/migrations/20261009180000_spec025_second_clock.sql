-- SPEC-025 CA-1 (ADR-016): the second clock, Postgres's own, for measuring
-- only. Two nullable timestamptz columns that no code writes nor reads to
-- decide: the column default seals them with clock_timestamp(), the instant of
-- the statement and not of the transaction (ADR-016 §1).
--
-- Added WITHOUT a default and only then given one (ADR-016 §2): the tables are
-- not rewritten and the rows written before this migration keep null instead
-- of a false instant. Compatible with the deployed code, which never names
-- these columns. Neither web.xornada nor public.board list them (both name
-- their columns or were expanded at creation), so nothing public changes and
-- the board_delta payload (a row of web.xornada) stays the same (ADR-016 §4).

-- opened_at: the insert of the attempt, right before the provider's fetch.
alter table public.ingest_attempts add column opened_at timestamptz;
alter table public.ingest_attempts alter column opened_at set default clock_timestamp();

-- recorded_at: the insert of the Decision.
alter table public.decisions add column recorded_at timestamptz;
alter table public.decisions alter column recorded_at set default clock_timestamp();
