---
id: SPEC-022
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-022 test:db no toca Storage de producción

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-022-test-db-no-toca-storage-de-produccion`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `tools/test-db.mjs`; `localStorageEnv`/`parseStatusEnv` en `src/db/env.ts` | `src/db/test-db.test.ts` «SPEC-022 CA-1» (supabase y npx falsos; entorno y `.env` de producción) · `src/db/env.test.ts` «SPEC-022 local Storage env» | | 🚧 |
| CA-2 | `tools/test-db.mjs` (status falla / API_URL no loopback / sin SERVICE_ROLE_KEY → exit 1) | `src/db/test-db.test.ts` «SPEC-022 CA-2» (status falla; `API_URL=https://x.supabase.co`) | | 🚧 |
| CA-3 | `vitest.db.config.mts` | `src/db/db-config.test.ts` (import en subproceso: remota, `.env` de producción, ausente → falla; loopback → carga) | | 🚧 |
| CA-4 | `REMOTE_SECRETS`/`withoutRemoteSecrets` en `src/db/env.ts`; `tools/test-db.mjs`; `vitest.db.config.mts`; `src/db/cron.db.test.ts` (valor fijo) | `src/db/remote-secrets.db.test.ts` · `src/db/test-db.test.ts` «blanks the remote secrets» · `src/db/env.test.ts` | | 🚧 |
| CA-5 | `src/db/fetch-guard.ts` (+ `isLoopbackHost` en `src/db/env.ts`), `src/db/fetch-guard.setup.ts`, `setupFiles` en `vitest.db.config.mts` | `src/db/fetch-guard.test.ts`; suite de base entera verde con la guarda (16 ficheros, 166 tests) | | 🚧 |
| CA-6 | (sin código: consecuencia de CA-1) | `npm run test:db` con `.env` de producción → 0; ver evidencia abajo | | 🚧 |
| CA-7 | `playwright.db.config.ts` | `src/db/playwright-db-config.test.ts` | | 🚧 |
| CA-8 | Ficheros: los de arriba más tests; sin migraciones, dependencias ni cambios en `src/raw/*` | `npm run gates` → 0 (67 ficheros, 1136 tests) | | 🚧 |

### Evidencia del implementador (2026-10-08)
- `npm run test:db` con el `.env` de producción (`NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co`), solo `DATABASE_URL` exportada a loopback: `exit=0`, `Test Files 16 passed (16)`, `Tests 166 passed (166)`.
- Log del contenedor `supabase_storage_marcadorgal` durante esa ejecución (`docker logs --since`): `POST /object/raw/test/<uuid>.json.gz`, `GET …`, `DELETE /object/raw`, `GET …` (null), `GET …` (nunca escrito), `DELETE /object/raw`. El put/get/remove fue al bucket local.
- `supabase status -o env` (CLI v2.117.0, claves redactadas): `API_URL="http://127.0.0.1:54321"`, `DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"`, `SERVICE_ROLE_KEY="<redacted>"`, `ANON_KEY`, `JWT_SECRET`, `PUBLISHABLE_KEY`, `SECRET_KEY`, `S3_*` también `<redacted>`. Los nombres `API_URL` y `SERVICE_ROLE_KEY` siguen siendo los de la spec.
- CA-3 a mano: `vitest run --config vitest.db.config.mts` con el `.env` de producción → `Startup Error … NEXT_PUBLIC_SUPABASE_URL is not loopback`, exit 1.
- `npm run e2e` → 38 passed. `npm run e2e:db` → 7 passed, 1 skipped (capturas QA sin `QA_CAPTURE_DIR`, preexistente).

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-022/. Informe HTML opcional: _qa/SPEC-022/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-022-1, F-SPEC-022-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-022-1: `src/db/cron.db.test.ts` ahora afirma que el comando del job no contiene un token fijo que nunca se le dio; la aserción queda casi trivial (la de `Bearer sb` sigue cubriendo la intención). Destino: EPIC-MEJORA si se quiere una comprobación más fuerte.
- F-SPEC-022-2: el setup de `fetch` son dos ficheros (`fetch-guard.ts` puro y testeable + `fetch-guard.setup.ts` de una línea que lo instala). `isLoopbackUrl` se refactorizó para delegar en un nuevo `isLoopbackHost` (mismo comportamiento, tests de SPEC-020 verdes).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-8 implementados con test en la rama; spec en `en-revision`. Falta la verificación (columnas Verif./Estado). Para reproducir CA-6: `supabase start` y `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db` con el `.env` tal cual; comprobar con `docker logs --since <t> supabase_storage_marcadorgal | grep test/`. Lectura opcional del prefijo `test/` del bucket remoto no hecha (sin acceso de solo lectura usado aquí).
