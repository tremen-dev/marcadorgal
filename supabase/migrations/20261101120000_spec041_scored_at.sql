-- SPEC-041 CA-1 (ADR-022): when each side last scored, seen live.
--
-- Same web.xornada as 20261008120000_spec021_half_time.sql plus
-- home_scored_at and away_scored_at as the last columns. Derived on read
-- (ADR-022 §4): no column, table nor trigger; the engine and the ingest do
-- not change. create or replace keeps the owner and the grants (ADR-015 §3:
-- web_reader still holds SELECT on it and nothing else) and only appends, so
-- the deployed reader, which picks its fields by name, keeps working (N-1).
-- The board_delta payload is the row of this view, so it carries them too.
--
-- The rule, per side (ADR-022 §2-§3): the decided_at of the last Decision
-- whose score for that side differs from the previous Decision's, when both
-- are live and the score went up; null otherwise. Every later Decision then
-- has the same score for the side, so a goal disallowed (a lower score), a
-- rise seen only at the close or in the first Decision give null, and the
-- Decisions of the minute keep it.
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
  coalesce(d.half_time, false) as half_time,
  g.home_scored_at,
  g.away_scored_at
from public.matches m
join public.competitions c on c.id = m.competition_id and c.season = m.season
join public.teams h on h.id = m.home_team_id
join public.teams a on a.id = m.away_team_id
left join lateral (
  select d.status, d.home_score, d.away_score, d.minute, d.added_minute,
    d.qualifier, d.version, d.observation_ids, d.decided_at, d.half_time
  from public.decisions d where d.match_id = m.id order by d.version desc limit 1
) d on true
left join lateral (
  -- One pass over the match's Decisions: the last change of each side's
  -- score (array_agg ... [1], newest first) and whether it was a goal seen
  -- live. No Decision, or no change: null.
  select
    (array_agg(
      case when s.status = 'live' and s.prev_status = 'live'
        and s.home_score > s.prev_home then s.decided_at end
      order by s.version desc
    ) filter (where s.home_score is distinct from s.prev_home))[1] as home_scored_at,
    (array_agg(
      case when s.status = 'live' and s.prev_status = 'live'
        and s.away_score > s.prev_away then s.decided_at end
      order by s.version desc
    ) filter (where s.away_score is distinct from s.prev_away))[1] as away_scored_at
  from (
    select d.version, d.status, d.decided_at, d.home_score, d.away_score,
      lag(d.status) over w as prev_status,
      lag(d.home_score) over w as prev_home,
      lag(d.away_score) over w as prev_away
    from public.decisions d
    where d.match_id = m.id
    window w as (order by d.version)
  ) s
) g on true;
