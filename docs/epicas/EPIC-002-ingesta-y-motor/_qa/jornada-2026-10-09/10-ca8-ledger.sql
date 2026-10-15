-- Consulta literal del ledger de SPEC-018 (CA-8), desde = primer kickoff, hasta = último kickoff + 360 (fin de prórroga posible)
select date_trunc('hour', a.started_at) as tanda, count(*) as intentos,
       sum((a.details->>'requests')::int) as peticiones
from ingest_attempts a
where a.started_at between '2026-10-09T19:00:00Z' and '2026-10-13T01:00:00Z'
  and not exists (select 1 from matches m where a.started_at >= m.kickoff - interval '10 min'
                    and a.started_at < m.kickoff + interval '150 min')
  and exists (select 1 from matches m where a.started_at >= m.kickoff + interval '150 min'
                and a.started_at < m.kickoff + interval '360 min')
group by 1 order by 1
