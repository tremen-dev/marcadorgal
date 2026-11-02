-- SPEC-043 CA-5: a harmless migration that proves the `migraciones` workflow
-- applies on merge, before Vercel promotes the deploy (ADR-024). It changes no
-- shape that any code reads, so it is compatible with the deployed code
-- (ADR-024 §3). Sorts after 20261101120000_spec041_scored_at.sql.
comment on schema web is 'Public read surface of marcador.gal; migrations applied on merge by the migraciones workflow (ADR-024).';
