select d.version, d.status, d.home_score||'-'||d.away_score sc, d.minute, d.added_minute, d.half_time, d.qualifier, d.rule, d.decided_at, d.recorded_at, d.observation_ids
from decisions d where d.match_id='primera-division-2026-27-j8-rayo-vallecano-athletic-club'
 and d.decided_at between '2026-10-10T12:20Z' and '2026-10-10T13:30Z' order by version
