select match_id, version, status, home_score, away_score, minute, qualifier, rule, observation_ids, decided_at, recorded_at
from decisions where match_id in ('tercera-rfef-g1-2026-27-j6-antela-barco','tercera-rfef-g1-2026-27-j6-celtiga-alondras') and version <= 5 order by 1,2
