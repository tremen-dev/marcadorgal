-- tick "now" values seen in decisions that have no ingest_attempt with the same started_at: ticks whose attempt was skipped (only their sweep wrote)
with nows as (select distinct decided_at as now from decisions where decided_at >= '2026-10-09' )
select (a.id is not null) as con_attempt, extract(second from n.now)::int as segundo, count(*)
from nows n left join ingest_attempts a on a.started_at = n.now
group by 1,2 order by 1,2
