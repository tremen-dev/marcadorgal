-- Cada intento solo-prórroga, con el hueco al anterior y observaciones
select a.started_at, a.ok, a.observations, (a.details->>'requests')::int req, (a.details->>'matches')::int matches,
  extract(epoch from a.started_at - lag(a.started_at) over (order by a.started_at))::int gap_s, a.error
from ingest_attempts a
where a.started_at between '2026-10-09T19:00:00Z' and '2026-10-13T01:00:00Z'
  and not exists (select 1 from matches m where a.started_at >= m.kickoff - interval '10 min'
                    and a.started_at < m.kickoff + interval '150 min')
  and exists (select 1 from matches m where a.started_at >= m.kickoff + interval '150 min'
                and a.started_at < m.kickoff + interval '360 min')
order by 1
