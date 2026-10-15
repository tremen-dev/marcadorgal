select started_at, ok, observations, raw_ref, details from ingest_attempts where started_at between '2026-10-10T22:00Z' and '2026-10-10T22:12Z' order by started_at
