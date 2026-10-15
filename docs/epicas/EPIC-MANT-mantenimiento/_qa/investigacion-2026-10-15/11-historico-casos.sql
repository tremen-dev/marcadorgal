with d as (
  select match_id, version, decided_at, recorded_at, status, home_score, away_score, minute, qualifier, rule,
    lag(decided_at) over w as prev_decided, lag(recorded_at) over w as prev_recorded,
    lag(row(status, home_score, away_score, minute, added_minute, half_time, qualifier)::text) over w as prev_tuple,
    row(status, home_score, away_score, minute, added_minute, half_time, qualifier)::text as tuple
  from decisions window w as (partition by match_id order by version)
)
select match_id, version, prev_decided, decided_at, prev_recorded, recorded_at, prev_tuple, tuple, rule,
  (tuple = prev_tuple) as repetida, (decided_at < prev_decided) as invertida
from d where tuple = prev_tuple or decided_at < prev_decided order by decided_at
