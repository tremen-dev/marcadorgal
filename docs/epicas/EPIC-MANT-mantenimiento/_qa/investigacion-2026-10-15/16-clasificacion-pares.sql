with d as (
  select match_id, version, decided_at,
    lag(decided_at) over w as prev_decided,
    lag(row(status, home_score, away_score, minute, added_minute, half_time, qualifier)::text) over w as prev_tuple,
    row(status, home_score, away_score, minute, added_minute, half_time, qualifier)::text as tuple
  from decisions window w as (partition by match_id order by version)
), pares as (
  select d.*, exists(select 1 from ingest_attempts a where a.started_at = d.prev_decided) as prev_con_attempt,
              exists(select 1 from ingest_attempts a where a.started_at = d.decided_at) as cur_con_attempt
  from d where tuple = prev_tuple
)
select date_trunc('day', decided_at)::date as dia, prev_con_attempt, cur_con_attempt, (decided_at < prev_decided) as invertida,
  count(*) as filas, count(distinct match_id) as partidos,
  round(avg(extract(epoch from (decided_at - prev_decided)))::numeric, 2) as delta_now_s
from pares group by 1,2,3,4 order by 1,2,3,4
