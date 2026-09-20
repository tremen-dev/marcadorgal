-- Reference entities with readable, stable text ids (ADR-006 §1).
create table public.competitions (
  id text not null,
  season text not null check (season ~ '^\d{4}-\d{2}$'),
  name text not null,
  tier smallint not null check (tier between 1 and 5),
  primary key (id, season)
);

create table public.teams (
  id text primary key,
  name text not null
);

-- How each source names a team, per season (ADR-003 resolveTeam).
create table public.team_aliases (
  source_id text not null,
  season text not null,
  alias text not null,
  team_id text not null references public.teams (id),
  primary key (source_id, season, alias)
);

create table public.matches (
  id text primary key,
  competition_id text not null,
  season text not null,
  round integer not null check (round >= 1),
  kickoff timestamptz not null,
  home_team_id text not null references public.teams (id),
  away_team_id text not null references public.teams (id),
  foreign key (competition_id, season) references public.competitions (id, season),
  check (home_team_id <> away_team_id)
);

create index matches_competition_round_idx on public.matches (competition_id, season, round);
