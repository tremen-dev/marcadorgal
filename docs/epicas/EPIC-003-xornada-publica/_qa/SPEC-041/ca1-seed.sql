-- 60 matches x 150 Decisions (SPEC-041 CA-1 budget), live with goals now and then.
insert into competitions (id, season, name, tier) values ('perf', '2026-27', 'Perf', 5);
insert into teams (id, name) select 'perf-t' || i, 'Team ' || i from generate_series(1, 120) i;
insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
select 'perf-m' || i, 'perf', '2026-27', 1, timestamptz '2026-10-03T16:00:00Z' + (i % 5) * interval '1 hour',
  'perf-t' || (2 * i - 1), 'perf-t' || (2 * i)
from generate_series(1, 60) i;
insert into observations (id, match_id, source_id, observed_at, raw_ref, status)
select gen_random_uuid(), 'perf-m' || i, 'perf', timestamptz '2026-10-03T16:00:00Z', 'raw/perf.json', 'scheduled'
from generate_series(1, 60) i;
insert into decisions (match_id, version, status, home_score, away_score, minute, qualifier, rule, observation_ids, decided_at)
select 'perf-m' || i, v, 'live', v / 40, v / 55, least(v - 1, 130), 'confirmado', 'RN-01',
  array[(select o.id from observations o where o.match_id = 'perf-m' || i)],
  timestamptz '2026-10-03T16:00:00Z' + v * interval '30 seconds'
from generate_series(1, 60) i, generate_series(1, 150) v;
analyze;
