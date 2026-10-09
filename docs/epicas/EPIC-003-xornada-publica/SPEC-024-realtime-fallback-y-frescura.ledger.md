---
id: SPEC-024
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-024 Realtime, fallback y frescura

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-024-realtime-fallback-y-frescura`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `supabase/migrations/20261009120000_spec024_board_delta.sql` (esquema `private`, `private.send_board_delta`, `private.board_delta`, trigger `board_delta` creado y deshabilitado) | `src/db/realtime.db.test.ts` «SPEC-024 CA-1 board_delta» (6 casos: `tgenabled = 'D'`; deshabilitado no deja fila; habilitado en rollback → `board:2026-27`, `decision`, `private`, payload = fila de la vista; error al emitir → `warning` y la Decision se confirma; `security definer` + `search_path=""`) | `test:db` 180/180; psql local: `tgenabled=D`, ACL de funciones `{postgres=X/postgres}`, `prosecdef=t`, `search_path=""`; e2e:db y recorrido `on` (trigger habilitado y luego `D`): payload = columnas de la vista **+ `id`** (V-2) | ⚠️ |
| CA-2 | misma migración (`create policy board_receive`, `revoke` de `private`) | `src/db/realtime.db.test.ts` «SPEC-024 CA-2 board_receive and private» (8 casos); `src/db/web.db.test.ts` (inventario ADR-015 §3 y SPEC-020 CA-2) sin tocar, en verde | psql local con rollback como `anon`: tema `board:2026-27` ve solo sus `broadcast`; `board:%`, `admin:x` o sin tema → 0; `INSERT` → RLS; `realtime.send` → warning sin fila; `private.*` → 42501; `authenticated` → 0; `web_reader` (vía superusuario) → 42501 en `realtime`, `private`, `public`; `has_schema_privilege(...,'private','USAGE')` = f para los tres; inventario ADR-015 (`web.db.test`) verde | ✅ |
| CA-3 | `src/board/row.ts` (`toPublicMatch`, `iso` acepta `Date` o cadena con offset) | `src/board/row.test.ts` «SPEC-024 CA-3 one conversion» (lector = payload; 3 payloads inválidos + 4 no-filas → `null` y `console.error` con `matchId`); `src/db/realtime.db.test.ts` (payload real del trigger = lector) | `row.test` y `realtime.db.test` verdes; delta real con `id` extra convertido y pintado (recorrido `on`) | ✅ |
| CA-4 | `src/xornada/live.ts` (reductor puro), `src/components/xornada/XornadaLive.tsx` (cliente), `XornadaBody.tsx`, `XornadaScreen.tsx`, `src/app/xornada-home.tsx` (`live`: partidos, `servedAt`, `season`, `etag`), `src/board/http.ts` (`boardEtag`), `src/board/reader.ts` (re-exporta `seasonOf`) | `src/xornada/live.test.ts` (tabla: igual/menor → nada; mayor → reemplazo; desconocido → petición ≤ 1/30 s; altas y bajas; días solo con 200); `src/board/http.test.ts` «SPEC-024 boardEtag»; `e2e/xornada-live.spec.ts` (sin errores de hidratación; 200 reemplaza «non dispoñibles»); e2e sin JS de SPEC-019/020/023 en verde | `live.test` verde; recorrido `on`: delta de partido de otra ronda (desconocido) → 1 petición `/api/board` → 200 lo añade (H-7); delta conocido sin petición (e2e:db); 0 errores de consola/hidratación en 8 cargas | ✅ |
| CA-5 | `XornadaFilters.tsx` (`REPAINT_EVENT` → reaplica el fragmento), `XornadaLive.tsx` (lo dispara tras cada repintado) | `e2e/xornada-live.spec.ts` «CA-5 …» (gl, es; polling simulado); `e2e/xornada-realtime.db.spec.ts` «CA-5 on …» (Decision real → `finished`) | e2e (gl, es) y e2e:db «CA-5 on» verdes: plegado y `#f=live` intactos tras el repintado | ✅ |
| CA-6 | `src/live/config.ts` (solo `on` exacto), `src/live/supabase.ts` (único import de supabase-js, cargado con `import()` solo con `on`), `src/live/transport.ts` (SUBSCRIBED, fallo, 10 s, reintento 60 s→5 min ±20 %), `next.config.ts` (`env.NEXT_PUBLIC_REALTIME` siempre inlinado), `playwright.db.config.ts` + `src/db/env.ts` (`localAnonKey`) | `src/live/config.test.ts`, `src/live/supabase.test.ts` (opciones `false`, canal `board:<season>` privado, latido N-3, cierre), `src/live/transport.test.ts` «SPEC-024 CA-6 Realtime» (10 casos), `src/db/env.test.ts`, `src/db/playwright-db-config.test.ts`; e2e cookie/`localStorage`/`sessionStorage` vacíos en ambos modos | unit verdes; build apagado: sin URL/clave (prod ni local) en `.next/static`, chunk supabase-js emitido pero no descargado (0 sockets, 0 scripts con `RealtimeClient`); build `on`: socket a `ws://127.0.0.1:54321/realtime/v1`, `board:2026-27`, cookie/localStorage/sessionStorage vacíos | ✅ |
| CA-7 | `src/live/transport.ts` (polling 30 s ±20 %, `If-None-Match`, `no-store`, pausa oculta, «sen conexión») | `src/live/transport.test.ts` «SPEC-024 CA-7 polling» (9 casos, incl. 20 min de fallos con partidos idénticos); `e2e/xornada-live.spec.ts` «CA-7/D-9 …» | unit (20 min de fallos, D-9) verdes; recorrido apagado: `/api/board` con `If-None-Match` del ETag servido (304), «Actualizado agora» sin aviso; `on` con `/api/board` abortado → «Sen conexión», filas iguales (e2e:db) | ✅ |
| CA-8 | `src/xornada/freshness.ts` (`screenFreshness`, `transportNotice`), `src/live/transport.ts` (`connect`: el reintento tras un fallo sigue en `polling`, V-1), `XornadaLive.tsx` (`FreshnessLine`), `Xornada.module.css` (`.freshness`), i18n `freshness.{servedAt,now,ago,polling,offline}` | `src/xornada/freshness.test.ts` (tablas); `src/live/transport.test.ts` «after a failure the notice stays through every retry until SUBSCRIBED» (V-1: rojo antes, verde después); `src/i18n/i18n.test.ts` «SPEC-024 CA-8» (paridad gl/es); e2e sin JS «Actualizado ás HH:MM»; `role="status"` solo en el aviso | `freshness.test` e i18n verdes; recorrido: «Actualizado ás HH:MM» servido, «agora» en cliente, aviso `#716F6C` (`--fg-dim`), 1 solo `role=status`; V-1 corregido: con Realtime local y el socket cortado, el aviso sigue en 2 reintentos (60 s y 187 s) y el polling continúa; al dejar pasar el socket, `SUBSCRIBED` lo quita (61.5 s); **V-7: en cada carga con `on` el aviso aparece ~15 ms antes de cargar el transporte (estado inicial `polling`)**; V-7 aceptado por el titular el 2026-10-09 (follow-up a la spec de la jornada publicada, `f5a8448`) | ⚠️ |
| CA-9 | `src/xornada/freshness.ts` (`rowAge`), `MatchRow.tsx` (`row-age`), `CompetitionSection.tsx`, `Xornada.module.css` (`.rowAge`, `--fg-dim`) | `src/xornada/freshness.test.ts` «CA-9 rowAge»; `e2e/xornada-live.spec.ts` «CA-9 at 360/390/1024/1440 px» (gl, es; recalculada sin red, sin truncar ni scroll horizontal) | `freshness.test` y e2e 360/390/1024/1440 verdes; recorrido `on`: «último dato hai 2 min» bajo filas `live`, sin scroll horizontal | ✅ |
| CA-10 | `e2e/xornada-live.spec.ts`, `e2e/xornada-realtime.db.spec.ts`, `playwright.config.ts` (`NEXT_PUBLIC_REALTIME=""`), `playwright.db.config.ts` (`on` + clave local) | apagado: sin WebSocket, sin chunk de supabase-js, `If-None-Match`, sin aviso, demos sin peticiones; encendido (gl·es, 390·1440): Decision local repinta en < 5 s sin recargar y sin pedir `/api/board`; socket cerrado → aviso + `If-None-Match`; `/api/board` abortado → filas iguales | `e2e` 90 passed; `e2e:db` 14 passed + 1 skipped (capturas QA sin `QA_CAPTURE_DIR`); recorrido propio: delta repinta en 35–95 ms; socket cerrado → aviso + `If-None-Match`; trigger local `D` al terminar | ✅ |
| CA-11 | `package.json` (`@supabase/supabase-js` `2.117.3` exacta), `tools/first-load-js.mjs`, `tools/medir-board-delta.mjs` | ver «Evidencia del implementador» | `DATABASE_URL_PUBLIC="" npm run gates` exit 0 (1281 tests); `first-load-js` apagado: 175.6 kB gzip, supabase-js absent; `git diff origin/main --stat -- src/sources src/decide src/ingest` vacío; única dependencia nueva `@supabase/supabase-js` 2.117.3 | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN condicionado (2026-10-09, sdd-verificador).** 9 CA ✅, 2 ⚠️ (CA-1, CA-8) que debe aceptar el titular; la spec sigue en `en-revision`.

| Comando (local; `.env` de producción nunca usado para escribir) | Salida |
|---|---|
| `DATABASE_URL_PUBLIC="" npm run gates` | exit 0; 74 ficheros, 1281 tests; build ok |
| `npm run e2e` | 90 passed |
| `DATABASE_URL=<local> npm run e2e:db` | 14 passed, 1 skipped (capturas QA) |
| `DATABASE_URL=<local> npm run test:db` | 17 ficheros, 180 tests passed |
| `grep` del host y de la clave del `.env`, y de `127.0.0.1:54321` y la clave local, en `.next/static` (build apagado con ambas en el entorno) | ninguna coincidencia |
| `node tools/first-load-js.mjs` (build apagado) | `/`: 7 scripts, 574.7 kB raw, **175.6 kB gzip**, supabase-js absent |
| psql local con rollback (ataques `anon`, `authenticated`, `web_reader`) | ver CA-2; `select tgenabled … board_delta` al terminar → `D` |

- **V-1 (baja, CA-8).** `fail()` deja `mode = polling` y el reintento (`connect()`) lo pone en `connecting` mientras el polling sigue: `transportNotice` devuelve `null` y «Sen tempo real» desaparece hasta 10 s en cada reintento (60 s → 5 min). Letra: «con el interruptor encendido y en polling, añade…». Sin efecto mientras siga apagado (H-6). Arreglar antes de encender en Pro (aviso también en `connecting` tras un fallo) o aceptar.
- **V-2 (baja, CA-1 = F-SPEC-024-1).** El payload lleva `id` (lo añade `realtime.send`) además de las columnas de `web.xornada`; la letra dice «exactamente». No es campo prohibido por ADR-014 §3 y `toPublicMatch` lo ignora. Aceptar y anotarlo en ADR-014 §5 o en la spec.
- **V-3 (baja, docs = F-SPEC-024-3).** CA-10 exige la clave anon local en e2e:db y contradice la letra de SPEC-022 CA-7 («deja vacías las variables de CA-4»). El test sigue impidiendo la clave del `.env` (sale solo de `supabase status` con `API_URL` loopback). Falta anotar la enmienda en SPEC-022 CA-7, como se hizo en SPEC-023 CA-6.
- **V-4 (info, CA-2 = F-SPEC-024-2).** `topic = realtime.topic()` es correcto y necesario para «ve los mensajes `board:%` y no otros» en SQL (sin él, quien fije el tema vería filas de cualquier tema); Realtime local autoriza y entrega con él. Conviene reflejarlo en la letra.
- **V-5 (info, CA-6 = F-SPEC-024-4).** El chunk de supabase-js existe en el build apagado (no se descarga ni contiene URL ni clave). El comentario de `src/components/xornada/XornadaLive.tsx` («no chunk of supabase-js exists») es falso.
- **V-6 (info, N-1).** El procedimiento es seguro (migración aditiva, trigger `D`, compatible con el `main` desplegado). Añadir al paso 1 `supabase migration list` (solo `20261009120000` pendiente) y `select to_regprocedure('realtime.topic()')`, y tras el paso 2 la comprobación de CA-2 en producción (`has_schema_privilege` de `anon`, `authenticated` y `web_reader` sobre `private` = `f`; `qual` de `board_receive`).

### Cierre (2026-10-09, sdd-verificador): GREEN
V-7 aceptado por el titular (Alberto Fojo, 2026-10-09; nota al final de la spec, `f5a8448`) como follow-up para la spec de la jornada publicada. 10 CA ✅ y CA-8 ⚠️ con salvedad aceptada; sin salvedades pendientes. Spec → `hecho`.

### Iteración 2 (2026-10-09, sdd-verificador): GREEN condicionado
V-1 y V-5 corregidos (`3a6aa1c`); V-2..V-4 en la letra (`71f2bb6`: CA-2 con `topic = realtime.topic()`, N-2 con `id`, SPEC-022 CA-7 enmendada), que cuadra con el código y los tests. 10 CA ✅, CA-8 ⚠️ por V-7. Spec en `en-revision`.

| Comando (local) | Salida |
|---|---|
| `DATABASE_URL_PUBLIC="" npm run gates` | exit 0; 1282 tests; build ok |
| `npm run e2e` | 90 passed |
| `DATABASE_URL=<local> npm run e2e:db` | 14 passed, 1 skipped (capturas QA) |
| build `on` + Playwright con `routeWebSocket` que cierra (Realtime local) | «Sen tempo real» sin huecos de 0.4 s a 187 s (muestreo cada 200 ms, 0 muestras vacías); reintentos a 60.0 s y 187.2 s; `/api/board` cada ~30 s |
| ídem, dejando pasar el socket tras el primer fallo | reintento a 61.3 s → `realtime`, aviso vacío |
| MutationObserver en carga normal con `on` (3 cargas) | `served` + «Sen tempo real» a 90 ms → `connecting` sin aviso a 105 ms → `realtime` a 130 ms (V-7) |
| `select tgenabled … board_delta` (local, al terminar) | `D` |

- **V-7 (baja, CA-8).** `src/components/xornada/XornadaLive.tsx`: el estado inicial es `mode: "polling"` y `setRealtime(true)` se ejecuta antes de que cargue `@/live/transport`; hasta entonces `transportNotice` da `freshness.polling` y la región `role="status"` anuncia «Sen tempo real» sin fallo alguno (~15 ms en local; lo que tarde el chunk en una red lenta). Sin efecto con el interruptor apagado (H-6). Arreglo: estado inicial `connecting` con el interruptor encendido, o ningún aviso hasta `started`.

#### Comprobaciones V-6 para el procedimiento N-1 (las ejecuta el titular; solo lectura salvo `db:push`)
1. Antes del paso 2: `npx supabase migration list` → la única pendiente en remoto es `20261009120000_spec024_board_delta`; `select to_regprocedure('realtime.topic()') is not null;` → `t`.
2. Tras el paso 2: `select tgenabled from pg_trigger where tgname = 'board_delta';` → `D`; `select r, has_schema_privilege(r, 'private', 'USAGE') from unnest(array['anon','authenticated','web_reader']) r;` → `f` en los tres; `select roles, cmd, qual from pg_policies where schemaname = 'realtime' and tablename = 'messages';` → una sola fila: `{anon}`, `SELECT`, con `extension = 'broadcast'`, `realtime.topic() ~~ 'board:%'` y `topic = realtime.topic()`.

## Evidencia del implementador (2026-10-09)
| Comando | Salida |
|---|---|
| `DATABASE_URL_PUBLIC="" npm run gates` | exit 0; 74 ficheros, 1281 tests; build ok (1 warning previo en `src/arch/deploy.test.ts`) |
| `DATABASE_URL_PUBLIC="" npm run e2e` | 90 passed |
| `DATABASE_URL=<local> npm run e2e:db` | 15 passed (incl. 7 de `xornada-realtime.db.spec.ts`, Realtime local) |
| `DATABASE_URL=<local> npm run test:db` | 17 ficheros, 180 tests passed |
| `node tools/first-load-js.mjs` (tras `next build`, apagado) | antes (`b21a2e6`): `/` 7 scripts, 556.2 kB raw, **170.3 kB gzip**; después: 7 scripts, 574.7 kB raw, **175.6 kB gzip** (+5.3 kB), supabase-js absent; `/es` igual |
| `grep` del host de `NEXT_PUBLIC_SUPABASE_URL` del `.env` en `.next/static` (apagado) | ninguna coincidencia |
| `DATABASE_URL=<local> node tools/medir-board-delta.mjs` | 50 Decisions, mediana de 5: sin trigger 11.2 ms (0.22 ms/Decision), con trigger 14.0 ms (0.28 ms/Decision), +25 %; 50 mensajes por pasada |
| `git diff origin/main --stat -- src/sources src/decide src/ingest` | vacío (el `main` local está atrasado respecto a `origin/main`; contra él sale el diff de SPEC-020/021 ya fusionado) |

## Evidencia del implementador, iteración 2 (2026-10-09: V-1, V-5)
| Comando | Salida |
|---|---|
| `npx vitest run src/live/transport.test.ts` (test V-1 nuevo, antes del arreglo) | 1 failed: los reintentos emiten `null` (`connecting`) entre `freshness.polling` |
| `npx vitest run src/live src/xornada` (tras el arreglo) | 8 ficheros, 152 passed |
| `DATABASE_URL_PUBLIC="" npm run gates` | exit 0; 74 ficheros, 1282 tests; build ok |
| `DATABASE_URL_PUBLIC="" npm run e2e` | 90 passed |
| `DATABASE_URL=<local> npm run e2e:db` | 14 passed, 1 skipped (capturas QA) |
| `select tgenabled … board_delta` (local, al terminar) | `D` |

V-5: comentario de `src/components/xornada/XornadaLive.tsx` corregido (el chunk de supabase-js se emite pero no se descarga con el interruptor apagado).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-024/. Informe HTML opcional: _qa/SPEC-024/informe.html -->
Generadas por `QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-024 npm run e2e` y `… npm run e2e:db` (implementador; el verificador decide su valor). El resto de PNG de la carpeta son capturas de SPEC-020/021/023 con la línea de frescura.

| CA | Captura |
|---|---|
| CA-8, CA-9 | `fila-edad-{gl,es}-{390,1440}.png` (polling simulado, «sen conexión», edad en filas `live`) |
| CA-10 | `realtime-{gl,es}-{390,1440}.png` (Realtime local, tras el delta) |
| CA-6, CA-7, CA-8 (verificador, apagado) | `verif-off-servido-{gl,es}-{390,1440}.png` («Actualizado ás HH:MM»), `verif-off-cliente-{gl,es}-{390,1440}.png` (tras el sondeo a 1440: «Actualizado agora», sin aviso) |
| CA-4, CA-10 (verificador, `on`) | `verif-on-delta-{gl,es}-{390,1440}.png` (Decision local repintada) |
| CA-8, CA-9, D-9 (verificador, `on`) | `verif-on-sen-tempo-real-gl-390.png` (socket cerrado: aviso neutro, «último dato hai 2 min»), `verif-on-sen-conexion-gl-390.png` (`/api/board` abortado) |
| CA-8 V-1 (verificador, `on`, iteración 2) | `verif-v1-reintento-gl-390.png` (tras 2 reintentos fallidos: aviso presente), `verif-v1-resuscrito-gl-390.png` (`SUBSCRIBED` de nuevo: sin aviso) |

## Salvedades / follow-ups
<!-- IDs F-SPEC-024-1, F-SPEC-024-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-024-1 (CA-1).** `realtime.send` añade al payload la clave `id` (uuid del mensaje) si no la trae. El payload es las columnas de `web.xornada` más `id`; el test compara `payload - id` con la fila y comprueba que `id` es cadena. `toPublicMatch` lo ignora. Destino: el verificador / nota en ADR-014 si el titular quiere.
- **F-SPEC-024-2 (CA-2).** `board_receive` añade `topic = realtime.topic()` a lo que fija la spec: con solo `realtime.topic() like 'board:%'`, quien fije el tema vería todas las filas de `realtime.messages` y «y no otros» no se cumpliría. Realtime local autoriza y entrega con ella (e2e:db).
- **F-SPEC-024-3 (CA-10).** `src/db/playwright-db-config.test.ts` (SPEC-022 CA-7) cambia: `NEXT_PUBLIC_SUPABASE_ANON_KEY` ya no va vacía en e2e:db sino con la clave local de `supabase status` (nunca la del `.env`; el test lo comprueba).
- **F-SPEC-024-4 (CA-6, CA-11).** Turbopack emite el chunk de supabase-js en `.next/static` también con el interruptor apagado (el `import()` existe en el grafo), pero no está en el JS inicial ni se pide (e2e). La URL y la clave de Supabase no llegan al bundle apagado gracias a `env.NEXT_PUBLIC_REALTIME` en `next.config.ts`.
- **F-SPEC-024-5 (CA-4, CA-11).** El transporte (y zod, por la conversión de CA-3) se carga con `import()` tras la primera pintura: sin eso, First Load JS subía a 265.7 kB gzip. Hasta que carga, `data-transport="served"`.
- **F-SPEC-024-6 (CA-6).** Tras un fallo de Realtime se pide `/api/board` en el acto (además del polling cada 30 s): la spec no lo prohíbe y recupera los deltas perdidos.
- **F-SPEC-024-7 (CA-4).** Con la página servida «non dispoñible» (lector caído), el cliente sondea igualmente y el primer 200 la rellena.
- **F-SPEC-024-8 (arquitectura).** `seasonOf` se re-exporta desde `src/board/reader.ts` para que la home siga importando solo el lector (test de SPEC-020 CA-4).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-11 implementados con test en `ft/SPEC-024-realtime-fallback-y-frescura` (sale de `docs/SPEC-024-realtime`, PR #48). Iteración 2 (2026-10-09): V-1 corregido (`connect` solo pone `connecting` en el primer intento; tras un fallo sigue `polling` y el aviso no se apaga) y V-5 (comentario). Spec en `en-revision`. Sin push ni PR. Falta: re-verificación de V-1/V-5 (sdd-verificador) y, tras el merge, el procedimiento del titular.

### Procedimiento del titular (N-1, fase «ahora, en Free»)
Nada de esto lo ejecuta el implementador. Orden obligatorio:
1. **Solo lectura en producción** (SQL Editor del proyecto): `select count(*) from pg_proc where proname = 'send' and pronamespace = 'realtime'::regnamespace;` → `1`. `select relrowsecurity from pg_class where oid = 'realtime.messages'::regclass;` → `t`. `select policyname from pg_policies where schemaname = 'realtime' and tablename = 'messages';` → ninguna fila (si hay alguna, parar y avisar: CA-2 asume que `board_receive` es la única). `select 1 from pg_namespace where nspname = 'private';` → ninguna fila.
2. **`npm run db:push`** con la rama ya revisada (antes del merge, ADR-014 §1). Aplica solo `20261009120000_spec024_board_delta.sql`: esquema `private`, funciones, política `board_receive` y trigger `board_delta` **deshabilitado**. Comprobación: `select tgenabled from pg_trigger where tgname = 'board_delta';` → `D`. Compatible con el código desplegado: nada emite.
3. **Merge y despliegue sin `NEXT_PUBLIC_REALTIME`**: en Vercel, la variable no existe (o no vale exactamente `on`) en Production ni en Preview. Todo es polling. Comprobación: `/` dice «Actualizado ás HH:MM», a los ~30 s «Actualizado agora», y el navegador pide `/api/board` con `If-None-Match` sin abrir WebSocket.

*Al pasar a Pro (otra spec):* 1) alta de usuarios cerrada en Auth; 2) migración `alter table public.decisions enable trigger board_delta` y `db:push`; 3) `NEXT_PUBLIC_REALTIME=on` en Production y Preview y redespliegue (la variable se fija en el build). La base va antes que la variable. Marcha atrás: quitar la variable y redesplegar; después, deshabilitar el trigger con otra migración.
