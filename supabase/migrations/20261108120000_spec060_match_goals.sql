-- SPEC-060 CA-1: Relational goals persistence and web.xornada projection.
--
-- Creates public.match_goals for persisting match goals (player, team, minute,
-- penalty, own_goal) and adds goals as the 24th column of web.xornada via
-- json_agg.

create table public.match_goals (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.matches (id) on delete cascade,
  team text not null check (team in ('home', 'away')),
  player text not null,
  minute integer not null check (minute >= 0),
  penalty boolean default false,
  own_goal boolean default false,
  created_at timestamptz default now()
);

create index match_goals_match_minute_idx on public.match_goals (match_id, minute asc);

alter table public.match_goals enable row level security;

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
  g.away_scored_at,
  coalesce(mg.goals, '[]'::json) as goals
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
) g on true
left join lateral (
  select coalesce(
    json_agg(
      json_build_object(
        'team', mg_inner.team,
        'player', mg_inner.player,
        'minute', mg_inner.minute,
        'penalty', mg_inner.penalty,
        'ownGoal', mg_inner.own_goal
      ) order by mg_inner.minute asc, mg_inner.id asc
    ) filter (where mg_inner.id is not null),
    '[]'::json
  ) as goals
  from public.match_goals mg_inner
  where mg_inner.match_id = m.id
) mg on true;
