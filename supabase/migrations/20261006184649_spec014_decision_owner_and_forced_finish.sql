-- SPEC-014 CA-2 and CA-8, additive (RN-07): no row is updated, no column of
-- the base schema changes.
--
-- CA-2 (ADR-011 §3): the owner of each side of the score, the source of the
-- observation that fixed its published value. Null when there is no score and
-- in every row written before this migration, where it reads as api-football.
--
-- CA-8 (F-SPEC-013-5): the mark of the forced finish of RN-02. true only for
-- that close; false for every other Decision the engine or replay:jornada
-- writes; null in the rows written before this migration, and null reads as
-- "not a forced finish" (ADR-006: nothing is filled in after the fact).
alter table public.decisions
  add column home_source_id text,
  add column away_source_id text,
  add column forced_finish boolean;
