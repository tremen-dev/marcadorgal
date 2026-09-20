-- Observations and decisions: immutable logs (D-6, RN-07), invariants in SQL.

create function public.reject_mutation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append-only: % on % is not allowed', tg_op, tg_table_name
    using errcode = 'triggered_action_exception';
end;
$$;

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.matches (id),
  source_id text not null,
  status text not null check (status in ('scheduled', 'live', 'finished', 'postponed', 'suspended')),
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  minute integer check (minute between 0 and 130),
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  raw_ref text not null,
  constraint observations_state_check check (
    case status
      when 'scheduled' then home_score is null and away_score is null and minute is null
      when 'postponed' then home_score is null and away_score is null and minute is null
      when 'live' then home_score is not null and away_score is not null
      else home_score is not null and away_score is not null and minute is null
    end
  )
);

create index observations_match_observed_idx on public.observations (match_id, observed_at desc);

create trigger observations_append_only
  before update or delete on public.observations
  for each row execute function public.reject_mutation();
create trigger observations_no_truncate
  before truncate on public.observations
  for each statement execute function public.reject_mutation();

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.matches (id),
  version integer not null check (version >= 1),
  status text not null check (status in ('scheduled', 'live', 'finished', 'postponed', 'suspended')),
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  minute integer check (minute between 0 and 130),
  qualifier text not null check (qualifier in ('confirmado', 'provisional', 'sen_sinal')),
  rule text not null check (rule in ('operator', 'RN-01', 'RN-02', 'RN-03', 'RN-05')),
  observation_ids uuid[] not null check (cardinality(observation_ids) >= 1),
  decided_at timestamptz not null default now(),
  constraint decisions_state_check check (
    case status
      when 'scheduled' then home_score is null and away_score is null and minute is null
      when 'postponed' then home_score is null and away_score is null and minute is null
      when 'live' then home_score is not null and away_score is not null
      else home_score is not null and away_score is not null and minute is null
    end
  ),
  constraint decisions_sen_sinal_check check (qualifier <> 'sen_sinal' or status = 'live'),
  unique (match_id, version)
);

-- Current decision = highest version per match (ADR-006 §3).
create function public.assign_decision_version() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.version is null then
    select coalesce(max(version), 0) + 1 into new.version
      from public.decisions where match_id = new.match_id;
  end if;
  return new;
end;
$$;

create trigger decisions_assign_version
  before insert on public.decisions
  for each row execute function public.assign_decision_version();
create trigger decisions_append_only
  before update or delete on public.decisions
  for each row execute function public.reject_mutation();
create trigger decisions_no_truncate
  before truncate on public.decisions
  for each statement execute function public.reject_mutation();
