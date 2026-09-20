---
id: SPEC-002
tipo: spec
epica: EPIC-001
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-09-20, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-20, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-09-20, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-09-21, por: sdd-implementador}
---
# SPEC-002 — Modelo zod, migraciones base y test de arquitectura

## Problema
No existe el modelo ni la base de datos: EPIC-002 no puede escribir Observations
ni Decisions y nada protege los invariantes (RN-07, cinco estados, RN-09) donde
se ejecutan. Esta spec fija la única definición de las entidades (zod 4), las
migraciones base en Supabase `dev` con los invariantes en SQL, el acceso de
servidor con `postgres.js` y el test de arquitectura de la frontera de
`src/sources` (no-negociable, ADR-003). Criterios de éxito 3, 5 y 6 de EPIC-001.
Convenciones de esquema y acceso: ADR-006 (nuevo, borrador).

## Usuarios / roles afectados
- sdd-implementador de EPIC-002/003: hereda modelo, tablas, `board` y frontera.
- Titular (humano): aprueba ADR-006. La base `dev` ya existe; sin actos nuevos.
- Público: ninguno; la web no lee la base hasta EPIC-003.

## Criterios de aceptación
- **CA-1 Dependencias y scripts.** `package.json` añade `zod` ^4.6, `postgres` ^3.4 y `server-only`; scripts `db:push` (`node tools/db-push.mjs`: carga `.env` con `process.loadEnvFile` y ejecuta `supabase db push --db-url "$DATABASE_URL"`, sin imprimir la URL) y `test:db` (`npm run db:push && vitest run --config vitest.db.config.mts`). `vitest.config.mts` excluye `**/*.db.test.ts`. Dado un clon limpio, `npm ci && npm run gates` sale 0 sin `DATABASE_URL`. Verif.: comando con `env -u DATABASE_URL`.
- **CA-2 Vocabularios cerrados.** `src/model/` exporta `MatchStatus` (`scheduled|live|finished|postponed|suspended`, en ese orden), `Qualifier` (`confirmado|provisional|sen_sinal`), `DecisionRule` (`operator|RN-01|RN-02|RN-03|RN-05`, N-1), `AlertKind` (`conflict|regression|silence|unresolved_team`, N-2) y `Season` (`^\d{4}-\d{2}$`). Test: `.options` de cada enum es exactamente esa lista; `halftime`, `RN-04`, `RN-06` y `2026/27` se rechazan.
- **CA-3 Instantes.** `Instant = z.iso.datetime()` (zod 4: sin offset, sin hora local). Test: acepta `2026-09-20T18:30:00Z` y `2026-09-20T18:30:00.000Z`; rechaza `2026-09-20T20:30:00+02:00`, `2026-09-20T18:30:00`, `new Date()` y `1758393000`. `grep -rn "z.date()" src/model` → vacío.
- **CA-4 Ids branded.** `CompetitionId`, `TeamId`, `SourceId` = slug `^[a-z0-9]+(-[a-z0-9]+)*$`; `MatchId` = string no vacía (su derivación la fija la spec d); `ObservationId`, `DecisionId`, `AlertId` = `z.uuid()`. Todos con `.brand<'…'>()`. Test: `tercera-rfef-g1` pasa como CompetitionId, `Tercera RFEF` no; una línea con `// @ts-expect-error` asigna un `TeamId` a un `CompetitionId` y `npm run typecheck` pasa (si las marcas se pierden, falla).
- **CA-5 Estado con marcador.** `MatchState` es unión discriminada por `status`: `scheduled|postponed` ⇒ `score: null, minute: null`; `live` ⇒ `score: {home, away}` enteros ≥ 0 y `minute: int 0..130 | null`; `finished|suspended` ⇒ `score` obligatorio y `minute: null`. `Observation` y `Decision` la extienden. Test: los ocho casos (cinco válidos, `live` sin score, `scheduled` con score, `finished` con minute) dan el resultado esperado.
- **CA-6 Entidades.** `Competition {id, season, name, tier 1..5}`, `Team {id, name}`, `Match {id, competitionId, season, round ≥1 (N-3), kickoff, homeTeamId, awayTeamId}` con `home ≠ away`; `Observation = MatchState & {id, matchId, sourceId, observedAt, receivedAt, rawRef (no vacío)}`; `Decision = MatchState & {id, matchId, version ≥1, qualifier, rule, observationIds (≥1, N-4), decidedAt}` con `sen_sinal ⇒ status live`; `Alert {id, kind, matchId | null, openedAt, resolvedAt | null, details: Record<string, unknown>}` con `kind ≠ unresolved_team ⇒ matchId` no nulo. Los tipos se infieren (`z.infer`); no hay `interface` duplicada. Test: cada refine tiene su caso inválido.
- **CA-7 Ida y vuelta.** `src/model/model.test.ts`: para las seis entidades, `parse(fixture)` → `JSON.stringify` → `JSON.parse` → `parse` es `toEqual` al primero, y el JSON serializado no contiene `Date`. Verif.: `npm test`; mutación: cambiar `postponed` por `aplazado` en el enum → al menos un test falla.
- **CA-8 Proyecto Supabase en el repo.** `supabase/config.toml` creado con `supabase init` (sin login ni Docker); seis migraciones creadas con `supabase migration new`: `extensions`, `core_tables`, `append_only_logs`, `ops_tables`, `board_view`, `rls`. Tras `npm run db:push`, `supabase db push --dry-run --db-url "$DATABASE_URL"` no lista ninguna pendiente. Verif.: `ls supabase/migrations` (patrón `<timestamp>_<nombre>.sql`) + comando.
- **CA-9 Esquema.** Tablas `competitions (pk id, season)`, `teams`, `team_aliases (pk source_id, season, alias)`, `matches`, `observations`, `decisions`, `alerts`, `ingest_attempts` con las columnas de ADR-006. Todo instante es `timestamptz`: `select count(*) from information_schema.columns where table_schema='public' and data_type='timestamp without time zone'` = 0. CHECK de los cinco estados y de marcador/minuto (CA-5) en `observations` y `decisions`; `raw_ref text not null` en `observations`. Test (`src/db/schema.db.test.ts`, cada caso en transacción con rollback): `status='halftime'` → `23514`; `live` sin marcador → `23514`; `scheduled` con marcador → `23514`.
- **CA-10 Append-only y versión.** Triggers que rechazan `UPDATE`, `DELETE` y `TRUNCATE` en `observations` y `decisions` (RN-07). `decisions.version` lo asigna un trigger `BEFORE INSERT` (`max+1` por partido) si llega nulo; índice único `(match_id, version)`. Test: `update`/`delete` → error con texto `append-only`; dos inserts sin `version` → 1 y 2; insert explícito repetido → `23505`.
- **CA-11 Vista `board`.** `board` = cada `matches` unido a `competitions` y `teams` con su Decision vigente (mayor `version`) por `LEFT JOIN` (N-5): columnas `match_id, competition_id, season, competition_name, tier, round, kickoff, home_team_id, home_team_name, away_team_id, away_team_name, status (coalesce → 'scheduled'), home_score, away_score, minute, qualifier, decision_id, decision_version, decided_at, observed_at (max observed_at de las observaciones citadas)`. Test: partido sin Decision → fila con `status='scheduled'` y marcador nulo; tras dos Decisions → la fila muestra la versión 2 y su `observed_at`. Fuera de transacción: `count(*) from board` = `count(*) from matches` (hoy 0, el verificador anota el valor).
- **CA-12 Extensiones y RLS.** `pg_cron` y `pg_net` activadas (`select extname from pg_extension`). `relrowsecurity = true` en las ocho tablas. Políticas `for select to anon, authenticated using (true)` solo en `competitions, teams, matches, observations, decisions`; ninguna política en `team_aliases, alerts, ingest_attempts`; `board` con `security_invoker = true`. Test: en una transacción, tras insertar una fila en `alerts` y con `set local role anon`, `select count(*) from alerts` = 0, `select * from board` no falla e `insert into observations` → `42501`.
- **CA-13 Cliente de servidor.** `src/db/client.ts` hace `import "server-only"`, exporta `sql = postgres(url, { ssl: "require", prepare: false })` (N-6) y toma la URL de `src/db/env.ts` → `databaseUrl(env)`, que lanza `DATABASE_URL is not set` si falta. Test unitario de `env.ts` (sin base de datos). `vitest.db.config.mts` incluye `src/db/**/*.db.test.ts`, carga `.env` si existe y sustituye `server-only` por un módulo vacío. `npm run test:db` pasa en local contra `dev`. Verif.: comando (local; N-7).
- **CA-14 Frontera de fuentes.** `src/arch/sources-boundary.ts` exporta `checkSourceImports(file, source): Violation[]` (especificadores vía `ts.preProcessFile` o equivalente) que solo admite `zod`, `node:*`, `@/model/*`, relativos que resuelvan dentro de `src/model/` o de la propia carpeta `src/sources/<id>/`, y `vitest` en `*.test.ts`. `src/arch/sources-boundary.test.ts` (a) prueba el checker con fuentes en memoria: un adaptador válido, e importaciones de `postgres`, `next/server`, `@/db/client`, `../../decide/x` y `fs` sin prefijo `node:` → una violación cada una; (b) recorre `src/sources/**/*.{ts,tsx}` y exige cero violaciones; si el directorio no existe lo declara en el nombre del caso («árbol vacío: la regla se prueba con fixtures en memoria»). Sin fixtures falsos en `src/sources/`. Verif.: `npm test`; mutación: crear `src/sources/x/a.ts` con `import postgres from "postgres"` → falla; borrarlo.
- **CA-15 Sin secretos ni ruido.** `.env.example` no cambia (`git diff --stat main -- .env.example` vacío). Ningún fichero del repo contiene un valor de `.env` (bucle `git grep -qF`). `git check-ignore -q supabase/.temp` sale 0. Ni `tools/db-push.mjs` ni los tests imprimen `DATABASE_URL`.

## Entidades y reglas afectadas
Competition, Team, Match, Xornada, Observation, Decision, Alert, Board, Raw
capture, Cualificador, Estado de partido, Frescura (dominio.md). D-3 (cinco
competiciones: `tier`), D-5/D-6 (logs inmutables), D-9 (`observed_at` y
`decided_at` separados; el del navegador no entra en el modelo). RN-03/04/05
(kinds de Alert), RN-06 (`rule`, `observationIds`), RN-07 (triggers), RN-09
(`rawRef`), RN-10 (N-2), RN-11 (`observed_at` en `board`). ADR-001 (zod 4,
`postgres.js`, migraciones CLI), ADR-002 (vista `board`, crudo en Storage,
pg_cron/pg_net), ADR-003 (frontera, `ingest_attempts`), ADR-004 (`rule`,
cualificador derivado), ADR-006 (esquema y RLS).

## Fuera de alcance
Tokens e i18n (spec c); calendario, cargador, derivación de `MatchId` y datos de
`team_aliases` (spec d); `src/sources/registry.ts`, cualquier adaptador, tick,
job de pg_cron, motor, `src/decide/`, Realtime y trigger de Broadcast, Storage y
su retención, política Storage del crudo, RLS fina del operador y Auth, Supabase
`prod`, `DATABASE_URL` en Vercel o en GitHub, borrado de `alerts` resueltas.

## Notas para el gate humano
- **N-1 `Decision.rule`** = `operator|RN-01|RN-02|RN-03|RN-05`, de reglas.md (solo RN-01..RN-06 pueden aparecer) y ADR-004 (precedencia operador > RN-03 > RN-05 > RN-02 > RN-01). Fuera RN-04 (el conflicto «nunca se publica») y RN-06 (dice qué se registra, no decide). RN-03 entra porque ADR-004 lo lista en la cadena; si EPIC-002 no emite Decision por monotonía, se retira allí. Cubierto por ADR-004: nota, no ADR.
- **N-2 Observaciones sin equipo resuelto (RN-10)** no entran en `observations` (`match_id not null`): el crudo ya está en Storage y se abre una Alert `unresolved_team` con `raw_ref` y nombres externos en `details` (ADR-006).
- **N-3 `round`** como campo/columna de la Xornada (identificadores en inglés). Resuelto: `round`, por decisión de Alberto Fojo (2026-09-20); «Xornada» se mantiene como término de dominio y nombre de la pantalla.
- **N-4 `observationIds ≥ 1`** por D-6; una Decision por RN-05 cita las de la versión que hereda. Sin FK sobre el array (ADR-006).
- **N-5 `board` con `LEFT JOIN`.** dominio.md dice «Decision vigente por partido», pero la pantalla necesita los partidos aún sin Decision: salen con `status='scheduled'` y marcador nulo. Con `INNER JOIN`, la spec d tendría que crear una Decision inicial por partido.
- **N-6 `prepare: false`** para que el mismo cliente sirva con el transaction pooler (6543) que Vercel necesitará; en local, session pooler (5432).
- **N-7 `test:db` solo en local**, no en CI: exigiría `DATABASE_URL` como secreto en GitHub, corre contra una única base compartida sin aislamiento entre PRs, y Supabase Free pausa el proyecto inactivo (check rojo sin defecto). Lo ejecuta el verificador y anota salida y fecha en el ledger. Si EPIC-002 lo necesita en CI, se decide un proyecto efímero en un ADR.
- **N-8 RLS:** lectura anónima de las cinco tablas públicas (`observations` incluida: D-6 hace pública la trazabilidad); nada en `team_aliases`, `alerts`, `ingest_attempts`. Toda escritura entra por el servidor (rol `postgres`, ignora RLS). Alternativas en ADR-006.

Mirar con lupa: N-1, N-3, N-5 y N-8 (constriñen datos que heredan las tres épicas siguientes) y ADR-006 entero.
