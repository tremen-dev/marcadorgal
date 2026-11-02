\o /dev/null
select * from web.xornada where match_id = any (array(select 'perf-m' || i from generate_series(1, 60) i)) order by kickoff, match_id;
select * from web.xornada where match_id = any (array(select 'perf-m' || i from generate_series(1, 60) i)) order by kickoff, match_id;
\o
explain (analyze, buffers, timing) select * from web.xornada where match_id = any (array(select 'perf-m' || i from generate_series(1, 60) i)) order by kickoff, match_id;
explain (analyze, timing) select match_id, competition_id, season, round, kickoff, status from web.xornada where season = '2026-27';
