with m as (select id, competition_id, kickoff from matches where kickoff >= '2026-10-09' and kickoff < '2026-10-13')
select m.id, m.kickoff, b.status, b.home_score||'-'||b.away_score sc, b.qualifier, d.rule, d.forced_finish ff, b.decided_at,
 (select min(decided_at) from decisions x where x.match_id=m.id and x.status='finished') first_fin,
 (select max(decided_at) from decisions x where x.match_id=m.id) last_dec,
 (select count(*) from decisions x where x.match_id=m.id) ndec,
 (select count(*) from observations o where o.match_id=m.id) nobs
from m left join board b on b.match_id=m.id left join decisions d on d.id=b.decision_id order by m.kickoff, m.id
