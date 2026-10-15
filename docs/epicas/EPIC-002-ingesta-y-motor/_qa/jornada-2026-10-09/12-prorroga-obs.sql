-- Observaciones del único partido en prórroga y su ritmo, desde kickoff+150
select o.received_at, o.status, o.home_score||'-'||o.away_score sc, o.minute, o.source_id,
  extract(epoch from o.received_at - lag(o.received_at) over (order by o.received_at))::int gap_s
from observations o join matches m on m.id=o.match_id
where o.match_id='tercera-rfef-g1-2026-27-j6-pontevedra-b-portonovo' and o.received_at >= m.kickoff + interval '140 min'
order by 1
