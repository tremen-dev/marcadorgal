-- RLS everywhere; anonymous read only on what board publishes (ADR-006 §6, N-8).
alter table public.competitions enable row level security;
alter table public.teams enable row level security;
alter table public.team_aliases enable row level security;
alter table public.matches enable row level security;
alter table public.observations enable row level security;
alter table public.decisions enable row level security;
alter table public.alerts enable row level security;
alter table public.ingest_attempts enable row level security;

create policy public_read on public.competitions for select to anon, authenticated using (true);
create policy public_read on public.teams for select to anon, authenticated using (true);
create policy public_read on public.matches for select to anon, authenticated using (true);
create policy public_read on public.observations for select to anon, authenticated using (true);
create policy public_read on public.decisions for select to anon, authenticated using (true);
