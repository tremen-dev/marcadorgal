-- SPEC-021 CA-4: half-time is a moment inside live (dominio.md), never a sixth
-- status. Additive and with a default (N-1): the code deployed before this
-- migration inserts without half_time and keeps working; rows written before
-- it read false (RN-07, no backfill).
alter table public.observations
  add column half_time boolean not null default false,
  add constraint observations_half_time_check check (half_time = false or status = 'live');

alter table public.decisions
  add column half_time boolean not null default false,
  add constraint decisions_half_time_check check (half_time = false or status = 'live');

-- Same web.xornada as 20261007120000_spec020_web_xornada.sql plus half_time as
-- the last column (false with no Decision). create or replace keeps the owner
-- and the grants (ADR-015 §3: web_reader still holds SELECT on it and nothing
-- else), and only appends: the deployed reader picks its fields by name.
-- public.board does not change.
create or replace view web.xornada as
select
  m.id as match_id,
  m.competition_id,
  m.season,
  c.name as competition_name,
  c.tier,
  m.round,
  m.kickoff,
  h.name as home_name,
  h.short_name as home_short_name,
  a.name as away_name,
  a.short_name as away_short_name,
  coalesce(d.status, 'scheduled') as status,
  d.home_score,
  d.away_score,
  d.minute,
  d.added_minute,
  coalesce(d.qualifier, 'confirmado') as qualifier,
  coalesce(d.version, 0) as version,
  (select max(o.observed_at) from public.observations o where o.id = any (d.observation_ids)) as observed_at,
  d.decided_at,
  coalesce(d.half_time, false) as half_time
from public.matches m
join public.competitions c on c.id = m.competition_id and c.season = m.season
join public.teams h on h.id = m.home_team_id
join public.teams a on a.id = m.away_team_id
left join lateral (
  select d.status, d.home_score, d.away_score, d.minute, d.added_minute,
    d.qualifier, d.version, d.observation_ids, d.decided_at, d.half_time
  from public.decisions d where d.match_id = m.id order by d.version desc limit 1
) d on true;
