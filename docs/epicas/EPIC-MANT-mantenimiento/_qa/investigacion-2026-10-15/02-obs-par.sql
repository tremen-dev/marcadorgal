select o.match_id, o.source_id, o.status, o.observed_at, o.received_at, o.id
from observations o where o.match_id in ('tercera-rfef-g1-2026-27-j6-antela-barco','tercera-rfef-g1-2026-27-j6-celtiga-alondras')
  and o.received_at between '2026-10-11T15:30:00Z' and '2026-10-11T15:50:00Z' order by 1, received_at
