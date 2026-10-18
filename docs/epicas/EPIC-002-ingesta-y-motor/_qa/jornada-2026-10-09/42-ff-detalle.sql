-- marcador forzoso vs reconciliado
select d.match_id, d.version, d.status, d.home_score||'-'||d.away_score sc, d.qualifier, d.rule, d.forced_finish, d.decided_at
from decisions d where d.match_id in (select match_id from alerts where kind='forced_finish' and opened_at >= '2026-10-09T19:00:00Z' and opened_at < '2026-10-13T01:00:00Z')
 and d.status='finished' order by d.match_id, d.version
