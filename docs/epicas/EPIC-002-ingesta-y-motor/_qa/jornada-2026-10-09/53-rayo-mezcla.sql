select o.received_at, o.observed_at, o.status, o.minute, o.home_score||'-'||o.away_score sc, right(o.raw_ref,60) raw from observations o
where o.match_id='primera-division-2026-27-j8-rayo-vallecano-athletic-club' and (o.received_at between '2026-10-10T12:29Z' and '2026-10-10T12:32Z' or o.received_at between '2026-10-10T12:52Z' and '2026-10-10T12:55Z') order by 1
