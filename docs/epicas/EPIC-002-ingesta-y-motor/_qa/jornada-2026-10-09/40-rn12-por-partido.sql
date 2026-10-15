-- SPEC-013 CA-5, por partido (M-9), jornada 2026-10-09/12
with ff as (select match_id, min(opened_at) opened_at, count(*) n_alertas from alerts
  where kind = 'forced_finish' and opened_at >= '2026-10-09T19:00:00Z' and opened_at < '2026-10-13T01:00:00Z' group by match_id),
rec as (select ff.match_id, ff.opened_at, ff.n_alertas, min(d.decided_at) as rn12_at
  from ff left join decisions d on d.match_id = ff.match_id and d.rule = 'RN-12'
    and d.decided_at between ff.opened_at and ff.opened_at + interval '30 minutes'
  group by ff.match_id, ff.opened_at, ff.n_alertas)
select match_id, opened_at, n_alertas, rn12_at, extract(epoch from rn12_at - opened_at)::numeric(8,1) retraso_s from rec order by opened_at
