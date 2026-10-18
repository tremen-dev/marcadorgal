with ff as (select match_id, min(opened_at) opened_at from alerts
  where kind = 'forced_finish' and opened_at >= '2026-10-09T19:00:00Z' and opened_at < '2026-10-13T01:00:00Z' group by match_id),
rec as (select ff.match_id, ff.opened_at, min(d.decided_at) as rn12_at
  from ff left join decisions d on d.match_id = ff.match_id and d.rule = 'RN-12'
    and d.decided_at <= ff.opened_at + interval '30 minutes'
  group by ff.match_id, ff.opened_at)
select count(*) as cierres_forzosos, count(rn12_at) as con_rn12_en_30min,
  percentile_cont(0.5) within group (order by extract(epoch from rn12_at - opened_at)) as mediana_s,
  max(extract(epoch from rn12_at - opened_at)) as max_s,
  (select count(*) from decisions d join matches m on m.id=d.match_id where d.rule='RN-12' and m.kickoff >= '2026-10-09' and m.kickoff < '2026-10-13') rn12_total_jornada,
  (select count(*) from decisions d join matches m on m.id=d.match_id where d.forced_finish and m.kickoff >= '2026-10-09' and m.kickoff < '2026-10-13') decisions_forced_finish
from rec
