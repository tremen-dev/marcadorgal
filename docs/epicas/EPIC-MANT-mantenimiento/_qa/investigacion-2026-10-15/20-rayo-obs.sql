select o.received_at, o.observed_at, o.source_id, o.status, o.minute, o.added_minute, o.half_time, o.home_score||'-'||o.away_score sc, o.id
from observations o where o.match_id='primera-division-2026-27-j8-rayo-vallecano-athletic-club'
 and o.received_at between '2026-10-10T12:25Z' and '2026-10-10T13:00Z' order by o.received_at, o.id
