select max(d.decided_at) ultimo_final from decisions d join matches m on m.id=d.match_id where m.kickoff >= '2026-10-09' and m.kickoff < '2026-10-13' and d.status='finished'
