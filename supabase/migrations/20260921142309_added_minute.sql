-- Stoppage-time minute kept apart from the regulation minute (SPEC-005 N-8):
-- 45+3 is not 48. Only a live match may carry it, and never 0.
alter table public.observations add column added_minute integer null check (added_minute between 1 and 30);
alter table public.decisions add column added_minute integer null check (added_minute between 1 and 30);

-- Same state check as 20260920220153_append_only_logs.sql plus added_minute:
-- null in every state but live.
alter table public.observations drop constraint observations_state_check;
alter table public.observations add constraint observations_state_check check (
  case status
    when 'scheduled' then home_score is null and away_score is null and minute is null and added_minute is null
    when 'postponed' then home_score is null and away_score is null and minute is null and added_minute is null
    when 'live' then home_score is not null and away_score is not null
    else home_score is not null and away_score is not null and minute is null and added_minute is null
  end
);

alter table public.decisions drop constraint decisions_state_check;
alter table public.decisions add constraint decisions_state_check check (
  case status
    when 'scheduled' then home_score is null and away_score is null and minute is null and added_minute is null
    when 'postponed' then home_score is null and away_score is null and minute is null and added_minute is null
    when 'live' then home_score is not null and away_score is not null
    else home_score is not null and away_score is not null and minute is null and added_minute is null
  end
);

-- Every observation points at a stored capture (D-6, RN-09): not null was not
-- enough, the empty string got through (F-SPEC-002-7).
alter table public.observations add constraint observations_raw_ref_check check (raw_ref <> '');

-- Same board as 20260921090009_team_short_name.sql plus added_minute after
-- minute (ADR-006 §5). Dropped and recreated: a view only appends columns.
drop view public.board;
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
  h.short_name as home_short_name,
  m.away_team_id,
  a.name as away_team_name,
  a.short_name as away_short_name,
  coalesce(d.status, 'scheduled') as status,
  d.home_score,
  d.away_score,
  d.minute,
  d.added_minute,
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
