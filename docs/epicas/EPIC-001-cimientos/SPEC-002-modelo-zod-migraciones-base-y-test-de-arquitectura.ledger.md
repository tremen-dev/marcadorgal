---
id: SPEC-002
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-002 Modelo zod, migraciones base y test de arquitectura

## Resumen
- Fase: en-revision (implementación completa CA-1..CA-15 en local; pendiente de sdd-verificador)
- Rama: `ft/SPEC-002-modelo-zod-migraciones-base-y-test-de-arquitectura`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `package.json` (`zod` ^4.6.5, `postgres` ^3.4.9, `server-only` 0.0.1; scripts `db:push`, `test:db`), `tools/db-push.mjs` (`process.loadEnvFile` + `supabase db push --db-url`, sin imprimir la URL), `vitest.config.mts` (`exclude: **/*.db.test.ts`) | `rm -rf node_modules && npm ci && env -u DATABASE_URL npm run gates` → exit 0 (46 tests, Node 26.4.0 local, F-SPEC-002-3) | | ❌ |
| CA-2 | `src/model/vocab.ts` (`MatchStatus`, `Qualifier`, `DecisionRule`, `AlertKind`, `Season`) | `src/model/model.test.ts` › «CA-2 closed vocabularies» (5 casos: `.options` exactos; `halftime`, `RN-04`, `RN-06`, `2026/27` rechazados) | | ❌ |
| CA-3 | `src/model/instant.ts` (`Instant = z.iso.datetime()`) | `src/model/model.test.ts` › «CA-3 instants» (2 casos); `grep -rn "z.date()" src/model` → vacío | | ❌ |
| CA-4 | `src/model/ids.ts` (slug branded `CompetitionId`/`TeamId`/`SourceId`, `MatchId` no vacío, `ObservationId`/`DecisionId`/`AlertId` uuid) | `src/model/model.test.ts` › «CA-4 branded ids» (4 casos, incluye `// @ts-expect-error` TeamId→CompetitionId); mutación: quitar `.brand` → `tsc` falla con TS2578 | | ❌ |
| CA-5 | `src/model/state.ts` (`Score`, `Minute`, `MatchState` unión discriminada en orden de `MatchStatus`) | `src/model/model.test.ts` › «CA-5 match state with score» (6 casos: cinco válidos + `live` sin score, `scheduled` con score, `finished` con minute, límites, paridad con `MatchStatus.options`) | | ❌ |
| CA-6 | `src/model/entities.ts` (`Competition`, `Team`, `Match`, `Observation`, `Decision`, `Alert`; tipos por `z.infer`, sin `interface`) | `src/model/model.test.ts` › «CA-6 entities» (6 casos: fixtures válidos, `tier` 0/6, `round` 0, home=away, `rawRef` vacío, `version` 0, `observationIds` [], `sen_sinal` con `finished`, `conflict` sin `matchId`) | | ❌ |
| CA-7 | `src/model/index.ts` (re-exporta todo) | `src/model/model.test.ts` › «CA-7 JSON round trip» (6 entidades `it.each` + «no Date instance»); mutación `postponed`→`aplazado` en `vocab.ts` → `1 failed | 28 passed` | | ❌ |
| CA-8 | `supabase/config.toml` (`supabase init`), `supabase/.gitignore`, `supabase/migrations/20260920220149_extensions.sql`, `…151_core_tables.sql`, `…153_append_only_logs.sql`, `…154_ops_tables.sql`, `…156_board_view.sql`, `…157_rls.sql` (`supabase migration new`) | `npm run db:push` → 6 migraciones aplicadas; `supabase db push --dry-run --db-url "$DATABASE_URL"` → `"upToDate":true,"migrations":[]` | | ❌ |
| CA-9 | `…151_core_tables.sql` (`competitions` pk `(id, season)`, `teams`, `team_aliases` pk `(source_id, season, alias)`, `matches`), `…153_append_only_logs.sql` (`observations`, `decisions` con CHECK de estados y `*_state_check`), `…154_ops_tables.sql` (`alerts`, `ingest_attempts`) | `src/db/schema.db.test.ts` › «CA-9 schema» (5 casos: ocho tablas, 0 `timestamp without time zone`, `halftime`→23514, `live` sin score→23514, `scheduled` con score→23514, `raw_ref` null→23502) | | ❌ |
| CA-10 | `…153_append_only_logs.sql` (`reject_mutation()` en triggers `before update or delete` fila y `before truncate` sentencia; `assign_decision_version()` `before insert`; `unique (match_id, version)`) | `src/db/schema.db.test.ts` › «CA-10 append-only and version» (4 casos: update/delete → `/append-only/` en ambas tablas, truncate → `/append-only/`, versiones 1 y 2, repetida → 23505) | | ❌ |
| CA-11 | `…156_board_view.sql` (`board` con `LEFT JOIN LATERAL` a la mayor `version`, `coalesce(status,'scheduled')`, `observed_at` = max de las citadas, `security_invoker = true`) | `src/db/schema.db.test.ts` › «CA-11 board» (4 casos: sin Decision → `scheduled` y nulos; dos Decisions → versión 2 y `observed_at` 16:30Z; 20 columnas en el orden de la spec; `count(board)` = `count(matches)`, hoy 0) | | ❌ |
| CA-12 | `…149_extensions.sql` (`pg_cron`, `pg_net` en `extensions`), `…157_rls.sql` (RLS en las ocho tablas, `public_read` `for select to anon, authenticated using (true)` en las cinco públicas) | `src/db/schema.db.test.ts` › «CA-12 extensions and RLS» (4 casos: extensiones, `relrowsecurity` + recuento de políticas por tabla, `security_invoker=true`, `set local role anon` → `alerts` 0 filas, `board` legible, insert en `observations` → 42501) | | ❌ |
| CA-13 | `src/db/client.ts` (`import "server-only"`, `postgres(url, { ssl: "require", prepare: false })`), `src/db/env.ts` (`databaseUrl(env)`), `vitest.db.config.mts` (`src/db/**/*.db.test.ts`, `loadEnvFile` si existe, alias `server-only` → `tools/empty-module.mjs`, `fileParallelism: false`) | `src/db/env.test.ts` (2 casos, sin base de datos); `npm run test:db` → exit 0, `17 passed` contra `dev` (2026-09-21); su salida no contiene `DATABASE_URL` ni `DATABASE_PASSWORD` (`grep -cF` → 0) | | ❌ |
| CA-14 | `src/arch/sources-boundary.ts` (`checkSourceImports(file, source): Violation[]` sobre `ts.preProcessFile`) | `src/arch/sources-boundary.test.ts` (a) 10 casos en memoria: adaptador válido, `vitest` solo en tests, `postgres`, `next/server`, `@/db/client`, `../../decide/x`, `fs`, `../other/adapter`, `export from @supabase/supabase-js`, `import()` dinámico → 1 violación cada uno; (b) recorrido de `src/sources/**` con el nombre «src/sources does not exist yet (empty tree…)»; mutación `src/sources/x/a.ts` con `import postgres` → `1 failed`, borrado | | ❌ |
| CA-15 | `.gitignore` ya ignoraba `supabase/.temp/`; `.env.example` intacto | `git diff --stat main -- .env.example` → vacío; bucle `git grep -qF` sobre los 7 valores no vacíos de `.env` contra `HEAD` → 0 coincidencias; `git check-ignore -q supabase/.temp` → 0; `grep DATABASE_URL` en `tools/db-push.mjs` y tests: solo el nombre de la variable y el mensaje de error | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-002/. Informe HTML opcional: _qa/SPEC-002/informe.html -->
n-a (sin UI).

## Salvedades / follow-ups
<!-- IDs F-SPEC-002-1, F-SPEC-002-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-002-1** ADR-006 no fija las columnas de `ingest_attempts`; se han elegido `id, source_id, started_at, finished_at, ok, error, raw_ref, observations` (una fila por llamada a adaptador, ADR-003). Destino: spec del tick de EPIC-002 (ajustar si necesita otras).
- **F-SPEC-002-2** `zod` y `postgres` van con rango `^` como pide CA-1, mientras el resto de `package.json` usa versiones exactas (SPEC-001); `package-lock.json` fija 4.6.5 y 3.4.9. Informativo.
- **F-SPEC-002-3** Gates y `test:db` ejecutados en local con Node 26.4.0 (sin `nvm`; `.nvmrc` sigue en 24). `test:db` no corre en CI (N-7). Destino: verificación.
- **F-SPEC-002-4** `supabase init` genera `config.toml` con los valores por defecto del stack local (puertos, `openai_api_key = "env(OPENAI_API_KEY)"` para Studio); no se usa sin Docker y se commitea tal cual. Informativo.
- **F-SPEC-002-5** `Observation` y `Decision` se construyen con `MatchState.and(z.object(...))` (intersección zod); el tipo inferido es `MatchState & {...}` como pide CA-6. Si EPIC-002 necesita `.extend`/`.pick` sobre ellas, habrá que reconstruir la unión opción a opción. Informativo.
- **F-SPEC-002-6** El orquestador pidió push de la rama al terminar, mientras el fichero de rol lo prohíbe; se ha hecho push (sin PR ni merge) por instrucción explícita del orquestador. Informativo.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho en local: CA-1..CA-15 con código, tests y comandos en verde. Base `dev` con las seis migraciones aplicadas (tablas vacías).
- Reproducir: `npm ci && env -u DATABASE_URL npm run gates` (46 tests); con `.env` local: `npm run test:db` (aplica migraciones pendientes y corre 17 tests con rollback); `set -a; . ./.env; set +a; supabase db push --dry-run --db-url "$DATABASE_URL"` → sin pendientes.
- Mutaciones de la spec verificadas: CA-4 (sin `.brand` → TS2578), CA-7 (`aplazado` → 1 failed), CA-14 (`src/sources/x/a.ts` → 1 failed).
- Siguiente paso: sdd-verificador (rellena Verif./Estado, anota fecha y salida de `test:db` según N-7). Sin PR abierta.
