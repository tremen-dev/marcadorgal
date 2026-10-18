select d.match_id, d.version, d.status, d.home_score||'-'||d.away_score sc, d.qualifier, d.rule, d.decided_at, d.forced_finish
from decisions d where d.match_id in ('tercera-rfef-g1-2026-27-j6-pontevedra-b-portonovo','segunda-rfef-g1-2026-27-j6-astorga-ourense-cf','tercera-rfef-g1-2026-27-j6-antela-barco','tercera-rfef-g1-2026-27-j6-celtiga-alondras') order by 1,2
