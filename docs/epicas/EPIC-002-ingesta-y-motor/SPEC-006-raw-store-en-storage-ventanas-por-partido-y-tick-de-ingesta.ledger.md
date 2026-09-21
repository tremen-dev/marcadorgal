---
id: SPEC-006
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-006 Raw store en Storage, ventanas por partido y tick de ingesta

## Resumen
- Fase: en-revisión (implementación completa; pendiente del verificador)
- Rama: `ft/SPEC-006-raw-store-en-storage-ventanas-por-partido-y-tick-de-ingesta`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `supabase/migrations/20260921142309_added_minute.sql`, `…142310_ingest_attempts_details.sql`, `…142311_raw_purges.sql`, `…142313_raw_bucket.sql` | `src/db/schema.db.test.ts` → «SPEC-006 CA-1 added_minute, raw_purges and the raw bucket» (8 casos) + las tres listas actualizadas de «CA-9 schema», «CA-11 board» y «CA-12 extensions and RLS» | | ❌ |
| CA-2 | `src/raw/store.ts`, `src/raw/capture.ts`, `src/raw/env.ts`; `vitest.db.config.mts` incluye `src/**/*.db.test.ts` | `src/raw/store.test.ts` (20 casos) y `src/raw/store.db.test.ts` (ida y vuelta contra el bucket real) | | ❌ |
| CA-3 | `src/ingest/constants.ts`, `src/ingest/window.ts` | `src/ingest/window.test.ts` (9 casos) | | ❌ |
| CA-4 | `src/ingest/aliases.ts`, `next.config.ts` (`outputFileTracingIncludes`) | `src/ingest/aliases.test.ts` (5 casos) | | ❌ |
| CA-5 | `src/ingest/adapters.ts` | `src/ingest/adapters.test.ts` (6 casos) | | ❌ |
| CA-6 | `src/ingest/db.ts` | `src/ingest/db.db.test.ts` (16 casos, incluida la carrera de dos `openAttempt`) | | ❌ |
| CA-7 | `src/ingest/tick.ts`, dobles en `src/ingest/memory.ts` y `src/raw/memory.ts` | `src/ingest/tick.test.ts` (16 casos) | | ❌ |
| CA-8 | `src/ingest/purge.ts` | `src/ingest/purge.test.ts` (8 casos) + «CA-8 a failed purge never stops the tick» en `src/ingest/tick.test.ts` | | ❌ |
| CA-9 | `src/ingest/auth.ts`, `src/ingest/handler.ts`, `src/app/api/ingest/tick/route.ts`, `src/clock.ts` | `src/ingest/auth.test.ts` (12 casos), `src/ingest/handler.test.ts` (4 casos), `src/clock.test.ts` (2 casos) | | ❌ |
| CA-10 | `tools/ingest-tick.mjs`, script `ingest:tick` en `package.json` | `src/ingest/cli.test.ts` (3 casos) | | ❌ |
| CA-11 | — (frontera, no hay código propio) | Comprobaciones mecánicas listadas abajo | | ❌ |

## Evidencia recogida por el implementador
<!-- Comprobaciones mecánicas ejecutadas durante la implementación. El veredicto lo da el verificador. -->
- `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm ci && npm run gates` → salida 0 (387 tests en 34 ficheros; build con la ruta `ƒ /api/ingest/tick`).
- `npm run build` con `.env` renombrado (situación de CI, sin ninguna variable) → salida 0.
- `npm run test:db` → salida 0, 52 tests en 4 ficheros.
- `supabase db push --dry-run --db-url "$DATABASE_URL"` → `{"upToDate":true,"migrations":[]}`.
- `.next/server/app/api/ingest/tick/route.js.nft.json` contiene `data/alias/2026-27/api-football.json` (CA-4).
- `npm run dev` + `curl`: `POST` sin cabecera → 401; `POST` con token inválido → 401; `GET` con token → 405; `POST` con `Authorization: Bearer $INGEST_TICK_TOKEN` → 200 con `{"now":"2026-09-21T14:43:24.128Z","inWindow":0,"purge":"skipped","attempts":[]}` (CA-9).
- `npm run ingest:tick` fuera de ventana → `inWindow: 0`, `attempts: []`; con `API_FOOTBALL_KEY=invalido` el resultado es idéntico y `select count(*) from ingest_attempts` sigue en 0 (ninguna petición fuera de ventana, RN-08).
- `npm run ingest:tick -- --dry-run` con un partido sembrado en ventana y borrado después → lista el partido por fuente y temporada e imprime `https://v3.football.api-sports.io/fixtures?live=140`, sin abrir intento ni tocar Storage.
- Tras el primer tick real contra `dev`: una fila en `raw_purges` (`ok: true`, `deleted: 0`), cero en `ingest_attempts` y cero en `observations`.
- CA-11: `git diff main --stat -- src/sources` vacío · `grep -rnE "new Date\(|Date\.now\(" src/ingest src/raw` vacío · `test ! -d src/decide` · `git diff main -- .env.example` vacío · `git diff main -- package.json package-lock.json` = solo el script `ingest:tick` · bucle `git grep -qF` de cada valor de `.env` sin coincidencias · imports relativos con `.ts` en todos los ficheros nuevos · `src/arch/sources-boundary.test.ts` en verde.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-006/. Informe HTML opcional: _qa/SPEC-006/informe.html -->
n-a: esta spec no toca interfaz.

## Salvedades / follow-ups
- **F-SPEC-006-1 (resuelta en código, confirmar en ADR-007).** La clave de
  servicio de este proyecto tiene el formato nuevo `sb_secret_…`, que Storage
  rechaza con `Invalid Compact JWS` si solo va en `Authorization: Bearer`. El
  store manda además la cabecera `apikey` con el mismo valor; CA-2 solo
  enumeraba `Authorization`, `Content-Type` y `x-upsert`. Destino: nota en
  ADR-007 §4 cuando se toque.
- **F-SPEC-006-2 (resuelta en código).** Un objeto inexistente responde
  HTTP 400 con `{"statusCode":"404","code":"NoSuchKey"}`, no HTTP 404. `get`
  devuelve `null` en ambos casos.
- **F-SPEC-006-3 (contradicción interna de la spec).** CA-9 sitúa
  `run(new Date().toISOString())` en `src/ingest/handler.ts`, pero CA-11 exige
  que `grep -rnE "new Date\(" src/ingest` salga vacío y ADR-008 §7 dice que
  nada bajo `src/ingest/` consulta el reloj. Resuelto sin cambiar la forma
  `createTickHandler({ authorize, run })`: el reloj vive en `src/clock.ts`
  (`nowInstant()`) y el handler lo llama. Pide confirmación del arquitecto.
- **F-SPEC-006-4 (desvío de la letra de CA-9).** La ruta no importa el `sql`
  de `src/db/client.ts`: ese módulo evalúa `createSql(process.env)` al
  importarse y `next build` sin `DATABASE_URL` falla con
  «Failed to collect configuration for /api/ingest/tick», que CA-11 prohíbe.
  La ruta abre el pool de forma perezosa en la primera petición. Destino:
  volver `src/db/client.ts` perezoso en la spec d o en EPIC-MEJORA.
- **F-SPEC-006-5 (para el titular).** `next dev` (Next 16) añade un bloque
  `nextjs-agent-rules` al final de `CLAUDE.md`, que es documento de verdad.
  Se revirtió con `git checkout -- CLAUDE.md`; volverá a aparecer cada vez que
  alguien levante el servidor de desarrollo. Se desactiva con
  `agentRules: false` en `next.config.ts`; no se ha hecho por estar fuera de
  los CA.
- **F-SPEC-006-6 (añadido fuera de los CA, mínimo).** `src/model/instant.ts`
  gana `shiftInstant`, `instantDiff` y `MINUTE_MS`/`HOUR_MS`/`DAY_MS`:
  aritmética pura de instantes, sin reloj. Era necesaria porque CA-8 pide
  `now − RAW_RETENTION_DAYS` dentro de `src/ingest/` y CA-11 prohíbe ahí
  `new Date(`. Cubierta por `src/model/instant.test.ts`.
- **F-SPEC-006-7 (menor).** `vitest.db.config.mts` gana el alias `@` además
  del `include` que pedía CA-2: `src/ingest/db.db.test.ts` importa `@/model`.
- **F-SPEC-006-8 (verificación pendiente de calendario).** Los dos últimos
  puntos de CA-10 no se pueden hacer hoy: el primer partido en ventana es el
  viernes 2026-09-25 a las 18:30Z. Quedan sin comprobar contra el proveedor
  real el intento `ok` con `raw_ref` existente en el bucket, el `skipped:
  'cadence'` de la segunda ejecución antes de 25 s y la hora de tick con
  `started_at` separados ≥ 25 s. La cadencia sí está probada contra la base en
  `src/ingest/db.db.test.ts` y contra dobles en `src/ingest/tick.test.ts`.

## Cómo retomar (handoff)
Implementación completa de CA-1 a CA-11 en la rama, en ocho commits, con
`npm run gates` y `npm run test:db` en verde y las cuatro migraciones
aplicadas a `dev`. Sin push ni PR: los hace el orquestador tras verificar.

Lo que hereda la spec c (motor): `afterInsert(tx, observations)` en
`runTick` se llama dentro de la transacción que inserta las observaciones y
solo cuando hay alguna (N-11); `IngestTx.sql` es el `TransactionSql` con el
que escribir `decisions` y `alerts`. El doble en memoria
(`src/ingest/memory.ts`) deja `sql` sin definir a propósito: lo que use
`tx.sql` se prueba con `npm run test:db`.

Lo que hereda la spec d (despliegue): `POST /api/ingest/tick` con
`Authorization: Bearer $INGEST_TICK_TOKEN`, `maxDuration = 60`; `GET`
responde 405 y la decisión sobre el `GET` de Vercel Cron sigue siendo suya
(N-7). `createTickHandler` no depende del método. El alias viaja al
despliegue por `outputFileTracingIncludes`; si el tracing fallara, el intento
muere con `no alias for api-football <temporada>` visible en
`ingest_attempts.error`.

Pendiente de verificación humana: el flujo real en ventana del viernes
2026-09-25 (F-SPEC-006-8) y la vigilancia a mano del consumo de Storage en el
plan Free durante la primera jornada (N-3).
