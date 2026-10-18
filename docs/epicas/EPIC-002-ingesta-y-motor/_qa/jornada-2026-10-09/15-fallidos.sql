select started_at, ok, observations, details->>'requests' req, details->>'requestErrors' rerr, left(error,160) error
from ingest_attempts where started_at between '2026-10-09T19:00:00Z' and '2026-10-13T01:00:00Z' and (not ok or observations=0 or (details->>'requestErrors')::int>0) order by 1
