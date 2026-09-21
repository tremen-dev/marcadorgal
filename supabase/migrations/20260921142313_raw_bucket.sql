-- Private bucket for the raw captures (ADR-007 §1): one gzipped JSON per
-- capture, 50 MiB cap. No policy on storage.objects, so anon and authenticated
-- see nothing and only the service role writes and reads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('raw', 'raw', false, 52428800, '{application/gzip}')
on conflict (id) do nothing;
