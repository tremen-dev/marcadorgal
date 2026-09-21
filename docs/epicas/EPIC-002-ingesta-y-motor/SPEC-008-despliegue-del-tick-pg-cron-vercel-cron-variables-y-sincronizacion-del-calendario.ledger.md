---
id: SPEC-008
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-008 Despliegue del tick: pg_cron, Vercel Cron, variables y sincronizacion del calendario

## Resumen
- Fase: en-revisión (implementación cerrada el 2026-09-21 por sdd-implementador)
- Rama: `ft/SPEC-008-despliegue-del-tick`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/db/client.ts` (`getSql()` memoizado, `import "server-only"` intacto), `src/app/api/ingest/tick/route.ts` (sin `let pool`, importa `getSql`), `src/db/schema.db.test.ts` (pasa a `getSql()`), `vitest.config.mts` (alias `server-only`, F-SPEC-008-3) | `src/db/client.test.ts` → «SPEC-008 CA-1 src/db/client.ts is lazy» (3 casos: importa sin `DATABASE_URL`, `getSql()` lanza `DATABASE_URL is not set`, dos llamadas `toBe` la misma instancia) | | ❌ |
| CA-2 | `src/app/api/ingest/tick/route.ts` → `export const GET = POST`. Ningún fichero de `src/ingest/` tocado (`git diff main -- src/ingest` solo `engine.test.ts`, que es CA-9) | `src/app/api/ingest/tick/route.test.ts` → «SPEC-008 CA-2 GET and POST on /api/ingest/tick» (3 casos: importa con `process.env = {}`, `GET` `toBe` `POST`, `runtime`/`dynamic`/`maxDuration`) | | ❌ |
| CA-3 | `src/ingest/cron.ts` (`cronSecrets`, `setupCronSecrets`, `TICK_URL_SECRET`, `TICK_TOKEN_SECRET`), `tools/cron-setup.mjs`, `package.json` → `cron:setup`, `.env.example` → `INGEST_TICK_URL=` y `CRON_SECRET=` | `src/ingest/cron.test.ts` → 8 casos: Vault vacío → dos `vault.create_secret`; los dos presentes → dos `vault.update_secret`; el informe trae los dos nombres y ninguno de los dos valores; sin `INGEST_TICK_URL` / `INGEST_TICK_TOKEN` lanza nombrándola y sin emitir sentencia; `cron:setup` sale 1 sin variables y sin abrir conexión | | ❌ |
| CA-4 | `supabase/migrations/20260921203746_ingest_tick_job.sql` (única migración nueva): `create extension if not exists supabase_vault`, `unschedule` condicional y `cron.schedule('ingest-tick', '30 seconds', …)` con `net.http_post`, `timeout_milliseconds := 55000`, `body := '{}'::jsonb` y URL/token leídos de `vault.decrypted_secrets` por nombre | `src/db/cron.db.test.ts` → «SPEC-008 CA-4 pg_cron job ingest-tick» (4 casos: imprime `extversion`; `supabase_vault` instalado; una sola fila `ingest-tick`, `active`, `schedule = '30 seconds'`; el `command` menciona `vault.decrypted_secrets` y `net.http_post`, y no contiene ni `Bearer sb` ni el valor de `INGEST_TICK_TOKEN`) | | ❌ |
| CA-5 | `vercel.json` (solo `crons`, `/api/ingest/tick`, `* * * * *`) | `src/arch/deploy.test.ts` → «SPEC-008 CA-5 vercel.json» + «SPEC-008 CA-5 the cron path carries the alias» (4 casos: un solo cron con esa ruta y horario; `vercel.json` no declara nada más; esa ruta tiene entrada en `outputFileTracingIncludes` con `./data/alias/**/*.json`; la ruta apunta a un `route.ts` que existe) | | ❌ |
| CA-6 | Nada que implementar en el repo: son variables del panel de Vercel. **Bloqueado, F-SPEC-008-1** (sin CLI ni token de Vercel en este entorno) | n-a (verificación de flujo real) | | ❌ |
| CA-7 | `src/ingest/salud.ts` (puro: `tickSalud(input) → { ok, text }`, redacta secretos), `tools/tick-salud.mjs` (cáscara: `cron.job`, `cron.job_run_details` de la última hora, `net._http_response`, `ingest_attempts`, `alerts` sin resolver, `windowMatches`; sale 1 si `!ok`), `package.json` → `tick:salud` | `src/ingest/salud.test.ts` → «SPEC-008 CA-7 tickSalud» (6 casos: hora limpia → `ok: true`, seis bloques y `100%`; ejecución `failed` → `ok: false` nombrando el job; `failed` de hace 90 min → `ok: true`; intento `ok: false` → `ok: false` con su `error`; sin ninguna fila → seis bloques sin lanzar; el token en una fila sale como `[secreto]`) | | ❌ |
| CA-8 | `.github/workflows/calendario-semanal.yml`: `schedule: '0 5 * * 2'` + `workflow_dispatch`; job `sync` (npm run calendario:sync, PR `chore/calendario-<fecha>` solo con diff, cuerpo con la salida de `formatSyncDiff`); job `load` en `push` a `main` con `paths: [data/calendario/**, data/alias/**]` (entrada `cargar` para lanzarlo a mano, F-SPEC-008-5) | `src/arch/deploy.test.ts` → «SPEC-008 CA-8 calendario-semanal.yml» (4 casos: martes 05:00Z y `workflow_dispatch`; sync + PR solo con diff en `data/calendario`/`data/alias`; load en push a `main` con los dos `paths` y `secrets.DATABASE_URL`; `secrets.API_FOOTBALL_KEY` y nunca la clave en el repo) | | ❌ |
| CA-9 | Sin código nuevo: `createEngineSweep` ya existía (SPEC-007) | `src/ingest/engine.test.ts` → «SPEC-008 CA-9 createEngineSweep» (4 casos: abre exactamente una `db.transaction` y antes de ella no hay sentencia; las cuatro consultas de SPEC-007 CA-9 una sola vez y con los dos `matchId`; `counts.matches === 2`; con ventana vacía no emite ninguna sentencia) | | ❌ |
| CA-10 | `package.json` sin dependencias nuevas y solo dos scripts (`cron:setup`, `tick:salud`); una sola migración nueva; imports relativos con `.ts` en los ficheros nuevos | Cubierto por los gates y los greps de frontera (ver abajo) | | ❌ |

### Evidencia de ejecución (sdd-implementador, 2026-09-21)
- **Gates, sin `.env` en el árbol y con el entorno desnudo** (`mv .env` fuera + `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm run gates`): **salida 0**. `vitest run` → **44 ficheros, 529 tests, todo verde**; `next build` → `ƒ /api/ingest/tick` (CA-1).
- **`npm ci` en el mismo entorno desnudo**: salida 0.
- **`npm run test:db`**: **salida 0**. `db:push` → `{"upToDate":true,...}`; `vitest --config vitest.db.config.mts` → **6 ficheros, 63 tests** en verde.
- **`supabase db push --dry-run --db-url "$DATABASE_URL"`** → `{"upToDate":true,"dryRun":true,"migrations":[]}`.
- **pg_cron (H-3): `extversion = 1.6.4`, y aceptó `'30 seconds'` sin discusión.** El fallback de H-3 (job por minuto con dos `net.http_post` y un `pg_sleep(30)`) **no ha hecho falta**. Medido en `cron.job_run_details`: 15 ejecuciones entre `20:38:28.639Z` y `20:45:28.965Z`, separadas exactamente 30 s.
- **pg_net y Vault**: `pg_net 0.20.4`, `supabase_vault 0.3.1`, PostgreSQL 17.6. `net.http_post` vive en el esquema `net` y `net._http_response` también, como dan por hecho CA-4 y CA-7.
- **Estado del job hoy**: programado y disparando cada 30 s, pero las 15 ejecuciones son `failed` con `null value in column "url" of relation "http_request_queue"`, porque el Vault está vacío: falta `npm run cron:setup`, que a su vez necesita `INGEST_TICK_URL` en `.env` (F-SPEC-008-2). `select count(*) from ingest_attempts` → **0** (ninguna petición ha salido y estamos fuera de ventana).
- **Alias trazado en el build** (mitad local de CA-6): `.next/server/app/api/ingest/tick/route.js.nft.json` contiene `data/alias/2026-27/api-football.json`.
- **Frontera (CA-10)**: `git diff main --stat -- src/sources src/decide` → **vacío**. `grep -rnE "new Date\(|Date\.now\(" src/ingest src/raw src/decide` → **vacío**. `git grep -F` de `INGEST_TICK_TOKEN`, `API_FOOTBALL_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_PASSWORD` → **sin coincidencias** (con `vercel.json` y la migración en el árbol).
- **`npm run tick:salud` contra `dev`**: imprime los seis bloques, marca las cinco ejecuciones `failed` de la última hora y sale **1** con `REVISAR: el tick no está sano`. Es el comportamiento correcto: el job existe y falla porque le falta el secreto.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-008/. Informe HTML opcional: _qa/SPEC-008/informe.html -->

## Salvedades / follow-ups
- **F-SPEC-008-1 — CA-6 no se puede hacer desde aquí: necesita mano humana en Vercel.** En este entorno no hay CLI de Vercel (`vercel` no está instalado) ni token (`VERCEL_TOKEN` no está en `.env`) ni proyecto enlazado (no hay `.vercel/`), así que **ni las siete variables de Production ni la ausencia de variables en Preview ni el flujo 401/200/405/503 contra el despliegue se han tocado**. No se ha simulado nada. Lo que hace falta: (i) las siete variables en **Production** (`DATABASE_URL` del pooler transaccional, `API_FOOTBALL_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INGEST_TICK_TOKEN`, `CRON_SECRET` con el mismo valor que el anterior); (ii) **ninguna** en Preview; (iii) desplegar la rama a producción para que existan `vercel.json` y la ruta con `GET`. Destino: el titular, antes del ensayo del miércoles 2026-09-23.
- **F-SPEC-008-2 — el job de pg_cron está vivo pero sin secretos, y por eso falla cada 30 s.** La migración de CA-4 está aplicada en `dev` y el job dispara puntualmente, pero `vault.decrypted_secrets` está vacío: `url` sale `null` y `net.http_post` revienta antes de encolar nada. Se arregla con **una** orden, `npm run cron:setup`, que exige antes dos líneas nuevas en `.env` del titular: `INGEST_TICK_URL=https://<dominio de producción>/api/ingest/tick` y `CRON_SECRET=<el mismo valor que INGEST_TICK_TOKEN>`. No he inventado la URL de producción a propósito: es dato del titular (la spec se lo asigna) y un valor mal puesto se traga el ensayo. Mientras tanto el job deja ruido en `cron.job_run_details`, que es exactamente lo que `npm run tick:salud` enseña.
- **F-SPEC-008-3 — `vitest.config.mts` gana el alias `server-only` → `tools/empty-module.mjs`.** Es el mismo alias que ya tenía `vitest.db.config.mts` (precedente F-SPEC-006-7) y hacía falta porque CA-1 y CA-2 obligan a importar `src/db/client.ts` y la ruta desde un test, y el paquete `server-only` lanza fuera de un React Server Component. No cambia nada del build: `next build` sigue viendo el `import "server-only"` real.
- **F-SPEC-008-4 — `src/db/schema.db.test.ts` pasa de `import { sql }` a `getSql()`.** Era el único consumidor del `sql` que CA-1 elimina; sin este cambio no compila. Está dentro de CA-1 pero el CA no lo nombra.
- **F-SPEC-008-5 — el workflow de CA-8 gana una entrada `cargar` en `workflow_dispatch`.** La verificación de CA-8 pide «el job `load` lanzado a mano», y con `load` condicionado solo a `push` un `workflow_dispatch` nunca lo ejecutaría. Con `cargar: si` corre solo `load`; con el valor por omisión (`no`) corre solo `sync`, como pide el CA.
- **F-SPEC-008-6 — CA-8 no es verificable hasta que el workflow esté en `main`.** GitHub solo ofrece `workflow_dispatch` (y solo respeta `schedule`) para ficheros presentes en la rama por defecto, así que los tres puntos de verificación de CA-8 —dispatch limpio sin PR, dispatch con cambio forzado que abre PR, y `load` a mano contra `dev`— **no se pueden ejecutar desde la rama**. El YAML sí está validado estructuralmente (parseado con Psych: `on.schedule[0].cron = '0 5 * * 2'`, `on.push.paths`, los dos jobs con sus `if`) y atado con tests de texto. Destino: verificación tras la fusión.

## Cómo retomar (handoff)
**Hecho y verde en local**: CA-1, CA-2, CA-3, CA-4, CA-5, CA-7, CA-9 y CA-10, con `npm run gates` y `npm run test:db` los dos en salida 0. Nueve commits en `ft/SPEC-008-despliegue-del-tick`, uno por CA, sin push ni PR.

**El riesgo declarado de la épica está despejado**: pg_cron **1.6.4** admite `'30 seconds'` y el job dispara cada 30 s exactos contra `dev`. No hace falta el fallback de H-3 ni plantearse los 60 s.

**Lo que queda, y es todo humano**, en este orden y antes del miércoles 2026-09-23:
1. Añadir a `.env` `INGEST_TICK_URL` (URL absoluta de `/api/ingest/tick` en producción) y `CRON_SECRET` (mismo valor que `INGEST_TICK_TOKEN`).
2. Poner las siete variables de CA-6 en **Production** de Vercel y **ninguna** en Preview.
3. Fusionar la rama y desplegar a producción, para que existan `vercel.json`, el cron de respaldo y el `GET` de la ruta.
4. `npm run cron:setup` una vez contra `dev`: deja los dos secretos en Vault y el job deja de fallar.
5. `npm run tick:salud`: debe salir **0** con `succeeded: 100%` y `partidos en ventana: 0`. Ese es el semáforo del ensayo.
6. Verificar CA-6 (401/200/405 contra producción, 503 contra un preview, `ingest_attempts` sin crecer) y CA-8 (`workflow_dispatch` del calendario, ya en `main`).

**Nada de esto es código**: si el paso 5 sale en verde, el tick está desplegado y SPEC-009 hereda una casa lista para medir el viernes.
