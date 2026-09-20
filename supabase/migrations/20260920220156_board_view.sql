-- Public projection: every match with its current decision, if any (ADR-006 §5).
create view public.board with (security_invoker = true) as
select
  m.id as match_id,
  m.competition_id,
  m.season,
  c.name as competition_name,
  c.tier,
  m.round,
  m.kickoff,
  m.home_team_id,
  h.name as home_team_name,
  m.away_team_id,
  a.name as away_team_name,
  coalesce(d.status, 'scheduled') as status,
  d.home_score,
  d.away_score,
  d.minute,
  d.qualifier,
  d.id as decision_id,
  d.version as decision_version,
  d.decided_at,
  (select max(o.observed_at) from public.observations o where o.id = any (d.observation_ids)) as observed_at
from public.matches m
join public.competitions c on c.id = m.competition_id and c.season = m.season
join public.teams h on h.id = m.home_team_id
join public.teams a on a.id = m.away_team_id
left join lateral (
  select * from public.decisions d where d.match_id = m.id order by d.version desc limit 1
) d on true;
