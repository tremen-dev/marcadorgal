select table_name, string_agg(column_name||':'||data_type, ', ' order by ordinal_position) cols
from information_schema.columns where table_schema='public' and table_name in ('matches','decisions','alerts','ingest_attempts','observations','board') group by 1
