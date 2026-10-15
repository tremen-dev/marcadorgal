select count(*) filter (where error ilike '%duplicate%' or error ilike '%version%' or error ilike '%unique%') as dup_errors,
  count(*) filter (where not ok) as not_ok, count(*) as total, min(started_at), max(started_at)
from ingest_attempts
