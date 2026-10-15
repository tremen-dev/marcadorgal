select m.competition_id, count(*) n, min(m.kickoff) primer_kickoff, max(m.kickoff) ultimo_kickoff
from matches m where m.kickoff >= '2026-10-09' and m.kickoff < '2026-10-13' group by 1 order by 1
