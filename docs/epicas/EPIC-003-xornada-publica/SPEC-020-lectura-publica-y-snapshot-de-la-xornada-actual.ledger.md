---
id: SPEC-020
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-020 Lectura pública y snapshot de la xornada actual

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-020-lectura-publica-y-snapshot-de-la-xornada-actual`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `tools/test-db.mjs`; `src/db/env.ts` (`isLoopbackUrl`); `src/db/connect.ts` (`sqlOptionsFor`, TLS salvo loopback); guarda también en `vitest.db.config.mts`; `package.json` `test:db` | `src/db/test-db.test.ts` (host remoto → exit 1 sin llamar al CLI, URL no impresa; sin URL; loopback → `supabase db push --db-url`); `src/db/env.test.ts` «SPEC-020 CA-1 isLoopbackUrl»; `src/db/connect.test.ts`. Evidencia: `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db` → 14 ficheros, 125 tests en verde | `test:db` local exit 0 (14 ficheros, 125 tests). `DATABASE_URL=postgresql://postgres:fakepw@db.invalid:5432/postgres npm run test:db` → exit 1, mensaje fijo, sin URL impresa ni CLI lanzado; `127.0.0.1.db.invalid` y multihost → rechazados. Ver V-3 (menor) | ✅ |
| CA-2 | `supabase/migrations/20261007120000_spec020_web_xornada.sql` | `src/db/web.db.test.ts` (columnas exactas, sin Decision, `web` fuera de `api.schemas`, `web_reader` LOGIN sin más poderes ni contraseña en la migración, grants solo `SELECT web.xornada`, 42501 en matches/decisions/observations/board/alerts e INSERT; anon y authenticated: 0 filas en las cinco tablas, 42501 en board y en web.xornada); `src/db/schema.db.test.ts` CA-12 actualizado (0 políticas) | Columnas exactas y `web` fuera de `api.schemas` verificadas. **Falla «SELECT solo en web.xornada»**: como `web_reader` (tx con rollback) `INSERT into net.http_request_queue` → OK; `has_table_privilege` da SELECT/INSERT/UPDATE/DELETE/TRUNCATE en `net.http_request_queue` y `net._http_response` (ACL `=arwdDxtm/supabase_admin`, vía PUBLIC). Ver V-1 | ❌ |
| CA-3 | `tools/db-web-reader.mjs`; `src/db/web-reader.ts` (verificador SCRAM-SHA-256: Postgres nunca recibe la contraseña); `.env.example`; `package.json` `db:web-reader` | `src/db/web-reader.test.ts` (verificador, validación, CLI nunca imprime la contraseña ni con fallo de conexión, `.env.example`); `src/db/web-reader.db.test.ts` (login real como `web_reader` en local, lee la vista, 42501 en `public.matches`). Pendiente del titular: `vercel env ls` | Tests verdes; 503 con contraseña errónea no la registra (log: `password authentication failed for user "web_reader"`). `vercel env ls`: pendiente del titular, y bloqueado por V-1 | ⚠️ |
| CA-4 | `src/board/reader.ts` (único módulo `server-only` con `DATABASE_URL_PUBLIC`); `src/board/row.ts` (`toPublicMatches`) | `src/arch/board-reader.test.ts`; `src/board/row.test.ts` (fila inválida omitida con `console.error` y `matchId`); `src/board/reader.db.test.ts` (como `web_reader`: sin Decision, 5 estados, live 45+3, `sen_sinal` en live y scheduled, provisional → todas `PublicMatch`) | Test de arquitectura leído (no vacío); `reader.db.test.ts` verde; `/api/board` local: 50 partidos, claves = `PublicMatch` (sin fuente, regla, ids de observación, alertas ni crudo) | ✅ |
| CA-5 | `src/board/current.ts` (`seasonOf`, `currentXornada`, `readCurrentXornada`) | `src/board/current.test.ts` (sábado J5, miércoles antes/después del punto medio, empate → menor, lunes, rondas distintas, live de J3 en vista de J5, competición sin partidos, regla de julio) | Tabla de `current.test.ts` cubre los 7 casos de la letra; `currentRound` reutilizado; live de otra ronda solo de la misma competición | ✅ |
| CA-6 | `src/app/xornada-home.tsx`; `src/app/(gl)/page.tsx`, `src/app/(es)/es/page.tsx` (ISR 10 s); `XornadaScreen` prop `unavailable`; `MatchRow` `data-match-id`; i18n `xornada.unavailable`; `WaitingPage` borrada; `tools/e2e-db-seed.mjs`; `playwright.db.config.ts`; `e2e/db-teardown.ts` | `e2e/home.spec.ts` (CI: mensaje i18n, 0 filas, noindex, sin terceros/cookies); `e2e/xornada.db.spec.ts` (`npm run e2e:db`, 6 passed: sin JS las filas = selección CA-5, ninguna de otra ronda salvo live, todos los estados, live de ronda anterior, nombres idénticos gl/es); `e2e/digits.spec.ts` adaptado | `e2e:db` 6 passed (dos ejecuciones). Recorrido propio sin JS, base local sembrada: `/` y `/es` 200, 50 filas, los 5 estados, `noindex, nofollow`, `lang` gl/es, 0 cookies, sin scroll horizontal a 390 y 1280. `e2e` (CI, sin variable) 34 passed | ✅ |
| CA-7 | `src/board/http.ts` (`boardResponse`, `BOARD_CACHE_CONTROL`); `src/app/api/board/route.ts`; `next.config.ts` (`expireTime: 40` + `headers()` para `/` y `/es`) | `src/board/http.test.ts` (200, ETag fuerte = sha256 del cuerpo, cambia con cualquier campo, 304 sin cuerpo, 503 `no-store`); e2e CI y db. `curl -I` contra `next start` sin `DATABASE_URL_PUBLIC`: `/` y `/es` 200 `Cache-Control: public, s-maxage=10, stale-while-revalidate=30`; `/api/board` 503 `cache-control: no-store`. `npm run build` pasa sin la variable. Pendiente: `curl -I` contra el preview | `next start` local: `/`, `/es`, `/api/board` → `public, s-maxage=10, stale-while-revalidate=30`; `If-None-Match` → 304, 0 bytes; contraseña mala → 503 `no-store` sin ETag. Build sin variable OK. `curl -I` del preview: pendiente del titular (F-SPEC-020-4) | ⚠️ |
| CA-8 | — | `npm run gates` exit 0 (64 ficheros, 1045 tests); `npm run e2e` 34 passed; `npm run e2e:db` 6 passed; `test:db` local 125 passed; sin dependencias nuevas; `git diff main --stat -- src/sources src/decide src/ingest` vacío | `npm run gates` exit 0 (1045 tests); `e2e` 34; `e2e:db` 6; `test:db` 125; sin dependencias nuevas; diff de `src/sources src/decide src/ingest` vacío. Los gates no detectan V-1 | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**RED — 2026-10-07 (sdd-verificador).** Gates, e2e, e2e:db y test:db en verde; CA-1, CA-4, CA-5, CA-6 y CA-8 cumplidos. CA-2 no: `web_reader` no tiene «SELECT solo en `web.xornada`».

- **V-1 (alta, CA-2 / ADR-014 §4).** `web_reader` hereda de PUBLIC `USAGE` en `net` y todos los privilegios sobre `net.http_request_queue` y `net._http_response` (ACL de pg_net concedida por `supabase_admin`; `postgres` no puede revocarla: `REVOKE ... FROM public` → «no privileges could be revoked»). Con `DATABASE_URL_PUBLIC` (Production **y Preview**) se puede: leer la cola, donde el job del tick deja `Authorization: Bearer <INGEST_TICK_TOKEN>` (`20260921203746_ingest_tick_job.sql`); insertar peticiones HTTP salientes desde la base (SSRF); vaciar la cola (DoS del tick). Reproducido en local dentro de una transacción con rollback. `web.db.test.ts` solo mira `role_table_grants` con `grantee = 'web_reader'`, por eso no lo ve. Acción: el arquitecto decide la mitigación (p. ej. lo que conceda/permita el `supabase_admin`, sacar el token de las cabeceras de pg_net, u otra vía de lectura) y el test debe afirmar con `has_table_privilege`/`has_schema_privilege` sobre **todos** los esquemas que `web_reader` no tiene más que `SELECT web.xornada`.
- **V-2 (baja, letra de CA-2).** F-SPEC-020-1 aceptable: retirar el privilegio (que la misma CA pide) hace imposible «0 filas» en `board`; 42501 es más fuerte. F-SPEC-020-2 aceptable (`has_table_privilege` INSERT = false). Conviene que el arquitecto ajuste la letra.
- **V-3 (baja, CA-1).** `isLoopbackUrl` acepta `postgresql://…@127.0.0.1:54322/postgres?host=db.invalid` (true); la CLI de Supabase (pgx) honra `host` en la query. No es accidental, pero la guarda puede endurecerse rechazando `host`/`hostaddr` en la query.
- Pendiente del titular (no bloquea por sí, pero **no ejecutar los pasos 2-4 del handoff hasta resolver V-1**): `vercel env ls` (CA-3) y `curl -I` del preview (CA-7, F-SPEC-020-4).
- `WaitingPage` borrada: coherente con «la página de espera sale de `/`» (sin otros usos; build y e2e verdes). F-SPEC-020-6 recoge las claves `waiting.*` huérfanas.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-020/. Informe HTML opcional: _qa/SPEC-020/informe.html -->
| CA | Captura |
|---|---|
| CA-6 | `_qa/SPEC-020/xornada-gl-390.png` (`/`, Supabase local con semilla de `e2e:db`, 390 px) |
| CA-6 | `_qa/SPEC-020/xornada-es-390.png` (`/es`, ídem) |
| CA-6 | `_qa/SPEC-020/verif-ca6-gl-390.png`, `verif-ca6-es-390.png`, `verif-ca6-gl-1280.png`, `verif-ca6-es-1280.png` (verificador; sin JS, base local sembrada) |

Regenerar: `QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-020 npm run e2e:db`.

## Salvedades / follow-ups
<!-- IDs F-SPEC-020-1, F-SPEC-020-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-020-1 (letra de CA-2): «anon y authenticated, 0 filas … en `board`». Al retirar el privilegio (que CA-2 también pide) leer `board` da 42501, no 0 filas; el test afirma 42501 (más fuerte). Se revoca `all` (no solo `SELECT`) de `anon`/`authenticated` sobre `public.board`: tenían también INSERT/UPDATE/DELETE/TRUNCATE por defecto.
- F-SPEC-020-2 (CA-2): «42501 en cualquier INSERT»: en tablas sí; en `web.xornada` Postgres responde 55000 (vista no actualizable) antes que el ACL, así que se comprueba `has_table_privilege(..., 'INSERT') = false`.
- F-SPEC-020-3 (CA-3): `db:web-reader` exige ASCII imprimible sin espacios y ≥ 16 caracteres (SASLprep identidad) y envía el verificador SCRAM, no la contraseña. Recomendado `openssl rand -hex 32` (sin caracteres que haya que escapar en la URL).
- F-SPEC-020-4 (CA-7): las páginas son ISR (`revalidate = 10`, `expireTime: 40`) y `public` se añade con `headers()` de `next.config.ts`; verificado con `next start`. En Vercel la capa ISR puede reescribir `Cache-Control` hacia el navegador: lo dirá el `curl -I` contra el preview (pendiente del titular). En build con la variable presente, la primera pintura se prerenderiza leyendo producción (solo lectura).
- F-SPEC-020-5 (CA-6): `e2e:db` carga el calendario y Decisions en la base local y al terminar hace `supabase db reset --local` y repone las competiciones (estado del que dependen `reconciliacion*.db.test.ts`). Borra cualquier dato local previo.
- F-SPEC-020-6: las claves `waiting.*` de i18n y su test (SPEC-003) quedan sin uso tras borrar `WaitingPage`. Destino: EPIC-MEJORA.
- F-SPEC-020-7: `src/board/current.ts` duplica la regla de temporada de `tools/calendario-xornada.mjs` (`currentSeason`); el tool podría importarla. Destino: EPIC-MEJORA.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-8 implementados en `ft/SPEC-020-lectura-publica-y-snapshot-de-la-xornada-actual` (sin push). Spec en `en-revision`. Reproducir: `supabase start`; `npm run gates && npm run e2e`; `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db`; `npm run e2e:db` (resetea la base local al acabar).

**Pendiente del titular, antes del merge y en este orden (N-1):**
1. `npm run db:push` con el `DATABASE_URL` de producción (aplica `20261007120000_spec020_web_xornada.sql`).
2. `WEB_READER_PASSWORD=$(openssl rand -hex 32)` (guardarla en el gestor de secretos) y `npm run db:web-reader` con ese `DATABASE_URL`: debe imprimir `web_reader: contraseña actualizada`.
3. Vercel → `DATABASE_URL_PUBLIC` en Production y Preview: la URL del pooler de transacciones (puerto 6543) de `DATABASE_URL` cambiando usuario por `web_reader.<ref-del-proyecto>` y contraseña por la del paso 2. Evidencia para el ledger: `vercel env ls` (solo nombres).
4. Redeploy del preview del PR y `curl -I <preview>/`, `/es` y `/api/board` al ledger (CA-7).
