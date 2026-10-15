with m as (select id, competition_id, kickoff from matches where kickoff >= '2026-10-09' and kickoff < '2026-10-13'),
f as (select d.match_id, min(d.decided_at) first_finished from decisions d join m on m.id=d.match_id where d.status='finished' group by 1)
select count(*) partidos, count(f.first_finished) con_finished, min(m.kickoff) primer_kickoff, max(f.first_finished) ultimo_primer_final
from m left join f on f.match_id=m.id
