-- intentos de la jornada con 0 observaciones o con errores, y presupuesto total de peticiones
select count(*) intentos, sum((details->>'requests')::int) peticiones, count(*) filter (where not ok) fallidos,
  count(*) filter (where observations=0) cero_obs, sum((details->>'requestErrors')::int) request_errors,
  sum((details->>'skipped')::int) skipped, sum((details->>'unresolved')::int) unresolved
from ingest_attempts where started_at between '2026-10-09T19:00:00Z' and '2026-10-13T01:00:00Z'
