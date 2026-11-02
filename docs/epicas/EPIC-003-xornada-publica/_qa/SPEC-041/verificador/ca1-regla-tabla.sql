insert into competitions (id, season, name, tier) values ('v', '2026-27', 'V', 5);
insert into teams (id, name) select 'vt' || i, 'T' || i from generate_series(1, 40) i;
insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
select x, 'v', '2026-27', 1, '2026-11-01T16:00:00Z', 'vt' || (2*n-1), 'vt' || (2*n)
from unnest(array['a','c','d','e','f','g','h','i','ip','j','k','l','m','n','q']) with ordinality u(x, n);
insert into observations (id, match_id, source_id, observed_at, raw_ref, status)
select gen_random_uuid(), m.id, 's', '2026-11-01T16:00:00Z', 'raw', 'scheduled' from matches m where competition_id = 'v';
create temp table s(m text, k int, st text, h int, a int, ht boolean default false);
insert into s values
('a',1,'live',0,0,false),('a',2,'live',1,0,false),('a',3,'live',1,0,false),
('c',1,'live',0,0,false),('c',2,'live',1,0,false),('c',3,'live',2,0,false),
('d',1,'live',0,0,false),('d',2,'live',1,0,false),('d',3,'live',2,0,false),('d',4,'live',1,0,false),
('e',1,'live',0,0,false),('e',2,'live',1,0,false),('e',3,'live',0,0,false),('e',4,'live',1,0,false),
('f',1,'live',1,0,false),('f',2,'live',1,0,false),
('g',1,'live',0,0,false),('g',2,'live',2,1,false),('g',3,'finished',2,1,false),
('h',1,'live',0,0,false),('h',2,'live',1,0,false),('h',3,'finished',2,0,false),
('ip',1,'scheduled',null,null,false),('ip',2,'postponed',null,null,false),
('j',1,'scheduled',null,null,false),('j',2,'live',0,0,false),('j',3,'live',0,1,false),
('k',1,'live',0,0,false),('k',2,'suspended',0,0,false),('k',3,'live',1,0,false),
('l',1,'live',0,0,false),('l',2,'live',1,0,false),('l',3,'suspended',1,0,false),
('m',1,'live',0,0,false),('m',2,'live',2,0,false),
('n',1,'live',0,0,false),('n',2,'live',1,0,true),
('q',1,'live',0,0,false),('q',2,'live',1,0,false),('q',3,'live',1,1,false),('q',4,'live',1,1,false);
do $$ declare r record; begin
for r in select * from s order by m, k loop
  insert into decisions (match_id, status, home_score, away_score, minute, qualifier, rule, observation_ids, decided_at, half_time)
  values (r.m, r.st, r.h, r.a, case when r.st='live' then 10*r.k end, 'confirmado', 'RN-01',
    array[(select o.id from observations o where o.match_id = r.m)], timestamptz '2026-11-01T16:00:00Z' + r.k * interval '1 minute', r.ht);
end loop; end $$;
select match_id, status, home_score||'-'||away_score sc, to_char(home_scored_at at time zone 'UTC','HH24:MI') hs, to_char(away_scored_at at time zone 'UTC','HH24:MI') aws
from web.xornada where competition_id='v' order by match_id;
