-- SPEC-066 CA-1 (ADR-030 §2): the outbox of the social publications. One row
-- per (Decision, side), written by the adapter of the engine in the same
-- transaction as the Decision and dispatched by the publisher at the end of
-- the tick. An ops table, mutable like alerts; it copies neither score nor
-- names: the text comes from the Decision, which is immutable (D-6).
-- created_at and closed_at are sealed by Postgres (ADR-016, ADR-030 §9).
-- Only creates (ADR-024 §3). RLS on with no policy, out of web_reader's
-- reach (ADR-014 §2, ADR-015 §3).

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions (id),
  match_id text not null references public.matches (id),
  side text not null check (side in ('home', 'away')),
  kind text not null check (kind in ('goal', 'goal_annulled')),
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'expired', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  reason text,
  template_id text,
  text text,
  provider text,
  provider_post_id text,
  created_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  unique (decision_id, side)
);

-- The publisher claims the open rows in order of creation.
create index social_posts_open_idx on public.social_posts (created_at)
  where status in ('pending', 'sending');

-- The context of a row: the last goal of the same match and side, and the
-- last template of a team.
create index social_posts_match_idx on public.social_posts (match_id, side, created_at desc);

alter table public.social_posts enable row level security;
