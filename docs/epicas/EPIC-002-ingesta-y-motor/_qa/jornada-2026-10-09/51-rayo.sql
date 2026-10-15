select d.version, d.status, d.home_score||'-'||d.away_score sc, d.minute, d.qualifier, d.rule, d.decided_at from decisions d
where d.match_id='primera-division-2026-27-j8-rayo-vallecano-athletic-club' and (d.version<=3 or d.version>=38) order by version
