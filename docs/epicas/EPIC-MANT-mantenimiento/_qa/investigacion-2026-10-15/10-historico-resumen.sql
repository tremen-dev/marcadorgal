with d as (
  select match_id, version, decided_at, recorded_at, status, home_score, away_score, minute, added_minute, half_time, qualifier, rule,
    lag(decided_at) over w as prev_decided,
    lag(row(status, home_score, away_score, minute, added_minute, half_time, qualifier)::text) over w as prev_tuple,
    row(status, home_score, away_score, minute, added_minute, half_time, qualifier)::text as tuple
  from decisions window w as (partition by match_id order by version)
)
select count(*) as decisions,
  min(decided_at) as desde, max(decided_at) as hasta,
  count(*) filter (where prev_decided is not null and decided_at < prev_decided) as decided_at_invertido,
  count(*) filter (where tuple = prev_tuple) as tupla_repetida,
  count(*) filter (where decided_at < prev_decided and tuple <> prev_tuple) as invertido_con_contenido_distinto,
  count(*) filter (where decided_at = prev_decided and tuple <> prev_tuple) as mismo_now_distinta_tupla,
  count(distinct match_id) filter (where tuple = prev_tuple or decided_at < prev_decided) as partidos_afectados
from d
