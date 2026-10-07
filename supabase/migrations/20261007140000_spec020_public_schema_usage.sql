-- SPEC-020 CA-2 (ADR-015 §1 and §3): web_reader keeps nothing but USAGE on
-- web, SELECT on web.xornada and the residue of PUBLIC on net. PostgreSQL
-- also gives PUBLIC USAGE on schema public; unlike net, public belongs to
-- pg_database_owner and postgres owns the database, so this one can go.
--
-- Nobody loses anything they use: postgres, anon, authenticated and
-- service_role hold their own USAGE on public (Supabase grants it by name),
-- and they are the only roles with privileges on objects in public.
revoke usage on schema public from public;
