-- SPEC-020 CA-2, V-4 (ADR-015 §3): web_reader needs CONNECT on the project
-- database and nothing else from it. PostgreSQL gives PUBLIC TEMP too, which
-- would let any login create temporary tables. postgres owns this database,
-- so it can take TEMP from PUBLIC.
--
-- Nobody else loses it: every role that has TEMP today (the Supabase roles,
-- anon, authenticated, service_role, authenticator...) gets it by name first,
-- except web_reader, superusers (they bypass) and the predefined pg_* roles.
-- Idempotent: a second run finds web_reader without TEMP and grants the rest
-- what they already hold. Reverted with `grant temp on database ... to public`.
do $$
declare
  r record;
begin
  for r in
    select rolname from pg_roles
    where not rolsuper
      and rolname !~ '^pg_'
      and rolname <> 'web_reader'
      and has_database_privilege(oid, current_database(), 'TEMP')
  loop
    execute format('grant temp on database %I to %I', current_database(), r.rolname);
  end loop;
  execute format('revoke temp on database %I from public', current_database());
end
$$;
