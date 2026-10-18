select status, min(received_at) desde, max(received_at) hasta, count(*) n from observations
where match_id='primera-division-2026-27-j8-rayo-vallecano-athletic-club' group by status order by 2
