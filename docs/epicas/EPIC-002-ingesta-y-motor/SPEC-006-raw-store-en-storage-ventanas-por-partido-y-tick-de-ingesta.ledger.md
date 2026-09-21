---
id: SPEC-006
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-006 Raw store en Storage, ventanas por partido y tick de ingesta

## Resumen
- Fase: hecho (verificada GREEN el 2026-09-21 por sdd-verificador)
- Rama: `ft/SPEC-006-raw-store-en-storage-ventanas-por-partido-y-tick-de-ingesta`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `supabase/migrations/20260921142309_added_minute.sql`, `…142310_ingest_attempts_details.sql`, `…142311_raw_purges.sql`, `…142313_raw_bucket.sql` | `src/db/schema.db.test.ts` → «SPEC-006 CA-1 added_minute, raw_purges and the raw bucket» (8 casos) + las tres listas actualizadas de «CA-9 schema», «CA-11 board» y «CA-12 extensions and RLS» | `supabase db push --dry-run --db-url "$DATABASE_URL"` → `{"upToDate":true,"migrations":[]}`. En `dev`: bucket `raw` con `public=false`, `file_size_limit=52428800`, `allowed_mime_types={application/gzip}`; cero políticas en `storage.objects` y en `raw_purges` (con `relrowsecurity=true`); `observations_raw_ref_check` presente y los dos `*_state_check` exigen `added_minute is null` fuera de `live`; `board` lista `added_minute` justo tras `minute`; índice `raw_purges_started_idx (started_at desc)`. `npm run test:db` → 52/52. | ✅ |
| CA-2 | `src/raw/store.ts`, `src/raw/capture.ts`, `src/raw/env.ts`; `vitest.db.config.mts` incluye `src/**/*.db.test.ts` | `src/raw/store.test.ts` (20 casos) y `src/raw/store.db.test.ts` (ida y vuelta contra el bucket real) | `npm run test:db` corre `src/raw/store.db.test.ts` contra el bucket real (put → get mismos bytes → remove → `null`) y pasa; `store.test.ts` (20 casos) dentro de los 387 de `npm run gates`. Código leído: URL `…/storage/v1/object/raw/<key>`, cabeceras `apikey` + `Authorization: Bearer` + `Content-Type` + `x-upsert: false`, 404 y 400 con `statusCode 404` → `null`, error `storage responded <status>` sin clave ni key. | ✅ |
| CA-3 | `src/ingest/constants.ts`, `src/ingest/window.ts` | `src/ingest/window.test.ts` (9 casos) | `npm run gates` verde. `constants.ts` trae las siete constantes con su regla al lado y los valores del CA; `window.test.ts` prueba −11/−10/+149/+150 min, `finished` dentro de rango y los otros cuatro estados. | ✅ |
| CA-4 | `src/ingest/aliases.ts`, `next.config.ts` (`outputFileTracingIncludes`) | `src/ingest/aliases.test.ts` (5 casos) | `npm run build` sin ninguna variable de entorno → `.next/server/app/api/ingest/tick/route.js.nft.json` contiene `data/alias/2026-27/api-football.json`. `aliases.test.ts`: válido, inválido con `issues` de zod, ausente con el mensaje exacto, memoización comprobada borrando el fichero entre llamadas, y el alias real de `data/`. | ✅ |
| CA-5 | `src/ingest/adapters.ts` | `src/ingest/adapters.test.ts` (6 casos) | `npm run gates` verde. `adapters.test.ts` cubre los cuatro supuestos del CA, incluido el `pull` sin `fetch` con una tabla de adaptadores inyectada, más el `push` sin `fetch` que sí se acepta. | ✅ |
| CA-6 | `src/ingest/db.ts` | `src/ingest/db.db.test.ts` (16 casos, incluida la carrera de dos `openAttempt`) | `npm run test:db` verde: `db.db.test.ts` prueba ventana (kickoff = `now`, decisión `finished`, kickoff +11 min), cadencia 0/20/26 s, la carrera de dos `openAttempt` con `Promise.all` (exactamente un `id`, `count(*) = 1`, filas borradas al final), `added_minute` 3 en `live` y `null` en `finished`, deduplicación de `unresolved_team` (1 fila) y su ausencia sin `externalMatchId`, y `staleRawKeys` con dos objetos reales en `storage.objects` a −31 y −1 días. | ✅ |
| CA-7 | `src/ingest/tick.ts`, dobles en `src/ingest/memory.ts` y `src/raw/memory.ts` | `src/ingest/tick.test.ts` (16 casos) | `npm run gates` verde. `tick.test.ts` cubre los doce supuestos del CA: ventana vacía sin `adapterFor` ni `openAttempt`, competiciones/partidos/`userAgent`/`now` exactos, `put` antes de `parse` por el log compartido, claves del núcleo (`id` uuid, `sourceId`, `observedAt = capturedAt`, `receivedAt = now`, `rawRef`), alerta abierta, contadores en `details`, fallo de `fetch` aislado de la segunda fuente, `put` que lanza → `parse` nunca llamado y sin observaciones, `parse` que lanza → intento con `rawRef`, `transaction` que lanza → intento con error, `afterInsert` entre `begin` y `commit` y no llamado sin observaciones, cadencia sin `fetch`, dos temporadas → dos intentos. | ✅ |
| CA-8 | `src/ingest/purge.ts` | `src/ingest/purge.test.ts` (8 casos) + «CA-8 a failed purge never stops the tick» en `src/ingest/tick.test.ts` | `npm run gates` verde. `purge.test.ts`: 2.500 claves → `remove` de 1000/1000/500 y `deleted: 2500`; cero claves → `ran` con 0; `ok` hace 2 h → `skipped`; fallida hace 30 min → `skipped`; fallida hace 2 h → corre; fallo en el segundo lote → `failed` con `deleted: 1000` y el error registrado; `before` pedido = `now − 30 d`. El tick sigue: caso «a failed purge never stops the tick» con `attempts` presentes. | ✅ |
| CA-9 | `src/ingest/auth.ts`, `src/ingest/handler.ts`, `src/app/api/ingest/tick/route.ts`, `src/clock.ts` | `src/ingest/auth.test.ts` (12 casos), `src/ingest/handler.test.ts` (4 casos), `src/clock.test.ts` (2 casos) | Flujo real con `next start` en `:3123` y `.env`: `POST` sin cabecera → 401; `POST` con `Bearer` de igual longitud pero distinto → 401; `POST` con `Basic` → 401; `GET` con el token bueno → 405; `POST` con `Authorization: Bearer $INGEST_TICK_TOKEN` → 200 y `{"now":"2026-09-21T14:56:07.495Z","inWindow":0,"purge":"skipped","attempts":[]}`. `auth.test.ts`, `handler.test.ts` (503/401/200/500 sin filtrar el mensaje) y `clock.test.ts` verdes. **Salvedad aceptada F-SPEC-006-4**: la ruta abre el pool con `createSql(process.env)` de forma perezosa en vez de importar el `sql` de `src/db/client.ts`, que se evalúa al importarse y rompería el `next build` sin `DATABASE_URL` que exige CA-11. | ⚠️ |
| CA-10 | `tools/ingest-tick.mjs`, script `ingest:tick` en `package.json` | `src/ingest/cli.test.ts` (3 casos) | `npm run ingest:tick` fuera de ventana → `inWindow: 0`, `attempts: []`; con `API_FOOTBALL_KEY=invalido` resultado idéntico; `ingest_attempts` sigue en 0 y `storage.objects` del bucket `raw` en 0 (ninguna petición fuera de ventana, RN-08). `npm run ingest:tick -- --dry-run` con un partido sembrado por el verificador en `dev` (kickoff = `now`, borrado después: `matches like 'verif-spec006-%'` → vacío) imprime el partido por fuente y temporada y `https://v3.football.api-sports.io/fixtures?live=140`, sin abrir intento ni tocar Storage. `cli.test.ts` cubre las tres guardas. Los dos últimos puntos del CA quedan para la ventana real → residual R-SPEC-006-1, destino spec d por N-14. | ✅ |
| CA-11 | — (frontera, no hay código propio) | Comprobaciones mecánicas listadas abajo | `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm ci && npm run gates` con `.env` renombrado → salida 0 (387 tests en 34 ficheros; ruta `ƒ /api/ingest/tick`); `.env` restaurado y árbol limpio. `git diff main --stat -- src/sources` vacío y `src/arch/sources-boundary.test.ts` en los gates; el grep de `new Date(`/`Date.now(` sobre `src/ingest` y `src/raw` sin coincidencias; `src/decide` no existe; `git diff main -- package.json` = solo el script `ingest:tick`, `package-lock.json` sin cambios; `.env.example` sin cambios; bucle `git grep -qF` de los cinco valores de `.env` sin coincidencias; ningún import relativo sin `.ts` en los ficheros nuevos (el único `from "./client"` está en `src/db/schema.db.test.ts` y ya venía de `main`). | ✅ |

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
**GREEN — 2026-09-21, sdd-verificador.** Once CA verificados contra artefactos
ejecutados por el verificador: diez ✅ y uno ⚠️ con salvedad justificada y
aceptada (CA-9, F-SPEC-006-4). Nada de código ni de spec tocado.

Gates reproducidos desde cero con `.env` renombrado y las cinco variables
desarmadas: `npm ci` + `npm run gates` → salida 0, 387 tests en 34 ficheros,
`next build` con la ruta `ƒ /api/ingest/tick`. `npm run test:db` → 52 tests en
4 ficheros, incluido el ida y vuelta real contra el bucket `raw`.
`supabase db push --dry-run --db-url "$DATABASE_URL"` → `{"upToDate":true,
"migrations":[]}`. Esquema de `dev` inspeccionado a mano (bucket privado con
sus límites, cero políticas en `storage.objects` y `raw_purges`, checks de
`added_minute` y de `raw_ref`, `board` con `added_minute` tras `minute`).
Endpoint ejercitado con `next start`: 401 / 401 / 401 / 405 / 200. CLI
ejercitado fuera de ventana, con clave inválida y en `--dry-run` con un
partido sembrado y borrado por el verificador. `CLAUDE.md` intacto: se usó
`next start`, no `next dev`.

Salvedades del implementador, resueltas:
- **F-SPEC-006-1 y F-SPEC-006-2** — aceptadas y ya cerradas: el arquitecto las
  incorporó a la spec como N-13 y a la letra de CA-2. El código coincide con
  la spec vigente; queda la nota pendiente en ADR-007 §4 cuando se toque.
- **F-SPEC-006-3** — aceptada y cerrada: resuelta en la spec como N-12
  (`nowInstant()` en `src/clock.ts`). Verificado que `src/clock.ts` es el
  único fichero del repo que lee el reloj de pared y que ni `src/ingest/` ni
  `src/raw/` contienen `new Date(` o `Date.now(`.
- **F-SPEC-006-4** — **aceptada como salvedad abierta (⚠️ en CA-9)**. Es un
  desvío real de la letra de CA-9, pero la letra de CA-9 y la de CA-11 son
  incompatibles: `src/db/client.ts` evalúa `createSql(process.env)` en el
  ámbito del módulo, y `next build` sin `DATABASE_URL` falla. La forma del
  handler no cambia y la ruta sigue poniendo el `now`. Destino: volver
  `src/db/client.ts` perezoso en la spec d o en EPIC-MEJORA.
- **F-SPEC-006-5** — aceptada como aviso al titular, fuera de los CA. El
  verificador no la reprodujo (usó `next start`); `git status` limpio.
- **F-SPEC-006-6** — aceptada. `shiftInstant`, `instantDiff` y
  `MINUTE_MS`/`HOUR_MS`/`DAY_MS` son aritmética pura sin reloj, necesarias
  para que CA-8 calcule `now − 30 d` sin violar CA-11, y están cubiertas por
  `src/model/instant.test.ts`. No amplía la frontera de `src/model`.
- **F-SPEC-006-7** — aceptada, trivial: el alias `@` en
  `vitest.db.config.mts` no cambia ningún CA.
- **F-SPEC-006-8** — aceptada: la spec ya la absorbe en N-14. Se registra
  como residual, no como incumplimiento.

Residual que hereda la spec d:
- **R-SPEC-006-1 (de CA-10, vía N-14).** Sin verificar contra el proveedor
  real: el intento `ok` con un `raw_ref` cuyo objeto existe en el bucket, las
  filas de `observations` con ese `raw_ref`, el `skipped: 'cadence'` de una
  segunda ejecución antes de 25 s y una hora de tick con `started_at`
  separados ≥ 25 s. Primera ventana: viernes 2026-09-25 desde 18:30Z.

Observación para el arquitecto (no bloquea, no es un CA): el bucle de
`purgeRaw` termina solo si `store.remove` borra de verdad las filas de
`storage.objects`. La API de Storage responde 200 aunque no borre nada
(prefijo inexistente), así que una clave catalogada pero sin objeto haría
girar el bucle hasta agotar `maxDuration`. Es la letra de CA-8; si se quiere
cota, la spec d puede fijar un máximo de lotes o pedir que la purga avance
por `created_at`.

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
  **Resuelta en esta rama:** Alberto Fojo decidió añadir `agentRules: false` a
  `next.config.ts` (2026-09-21); comprobado que `next dev` ya no toca
  `CLAUDE.md`.
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
