-- SPEC-020 CA-2 (ADR-014 §2-§4): what the public reads, and nothing else.
--
-- web is outside api.schemas (supabase/config.toml), so PostgREST never
-- exposes it. web.xornada carries exactly the PublicMatch columns of ADR-014
-- §3 plus season (SPEC-020 N-2): never the source, the rule, the observation
-- ids, the score owners, the alerts nor the raw capture.
--
-- The view runs with its owner's rights (no security_invoker), so web_reader
-- needs SELECT on it and on nothing below it.
create schema web;
revoke all on schema web from public;

create view web.xornada as
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
  d.decided_at
from public.matches m
join public.competitions c on c.id = m.competition_id and c.season = m.season
join public.teams h on h.id = m.home_team_id
join public.teams a on a.id = m.away_team_id
left join lateral (
  select d.status, d.home_score, d.away_score, d.minute, d.added_minute,
    d.qualifier, d.version, d.observation_ids, d.decided_at
  from public.decisions d where d.match_id = m.id order by d.version desc limit 1
) d on true;

revoke all on web.xornada from public;

-- The login role of DATABASE_URL_PUBLIC (ADR-014 §4). Its secret never lives
-- in the repo: npm run db:web-reader sets it (SPEC-020 CA-3). Roles are per
-- cluster, so a local reset that keeps them does not fail here.
do $$
begin
  if not exists (select from pg_roles where rolname = 'web_reader') then
    create role web_reader with login nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

grant usage on schema web to web_reader;
grant select on web.xornada to web_reader;

-- ADR-014 §2 supersedes ADR-006 §6: with RLS on and no policy, anon and
-- authenticated read nothing of the five tables, and board is not theirs.
-- Nothing in src/ or tools/ reads as anon today (SPEC-020 N-1).
drop policy public_read on public.competitions;
drop policy public_read on public.teams;
drop policy public_read on public.matches;
drop policy public_read on public.observations;
drop policy public_read on public.decisions;
revoke all on public.board from anon, authenticated;
