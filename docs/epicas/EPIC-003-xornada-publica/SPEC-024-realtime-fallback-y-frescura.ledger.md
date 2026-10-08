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
| CA-1 | `supabase/migrations/20261009120000_spec024_board_delta.sql` (esquema `private`, `private.send_board_delta`, `private.board_delta`, trigger `board_delta` creado y deshabilitado) | `src/db/realtime.db.test.ts` «SPEC-024 CA-1 board_delta» (6 casos: `tgenabled = 'D'`; deshabilitado no deja fila; habilitado en rollback → `board:2026-27`, `decision`, `private`, payload = fila de la vista; error al emitir → `warning` y la Decision se confirma; `security definer` + `search_path=""`) | | ❌ |
| CA-2 | misma migración (`create policy board_receive`, `revoke` de `private`) | `src/db/realtime.db.test.ts` «SPEC-024 CA-2 board_receive and private» (8 casos); `src/db/web.db.test.ts` (inventario ADR-015 §3 y SPEC-020 CA-2) sin tocar, en verde | | |
| CA-3 | `src/board/row.ts` (`toPublicMatch`, `iso` acepta `Date` o cadena con offset) | `src/board/row.test.ts` «SPEC-024 CA-3 one conversion» (lector = payload; 3 payloads inválidos + 4 no-filas → `null` y `console.error` con `matchId`); `src/db/realtime.db.test.ts` (payload real del trigger = lector) | | |
| CA-4 | `src/xornada/live.ts` (reductor puro), `src/components/xornada/XornadaLive.tsx` (cliente), `XornadaBody.tsx`, `XornadaScreen.tsx`, `src/app/xornada-home.tsx` (`live`: partidos, `servedAt`, `season`, `etag`), `src/board/http.ts` (`boardEtag`), `src/board/reader.ts` (re-exporta `seasonOf`) | `src/xornada/live.test.ts` (tabla: igual/menor → nada; mayor → reemplazo; desconocido → petición ≤ 1/30 s; altas y bajas; días solo con 200); `src/board/http.test.ts` «SPEC-024 boardEtag»; `e2e/xornada-live.spec.ts` (sin errores de hidratación; 200 reemplaza «non dispoñibles»); e2e sin JS de SPEC-019/020/023 en verde | | |
| CA-5 | `XornadaFilters.tsx` (`REPAINT_EVENT` → reaplica el fragmento), `XornadaLive.tsx` (lo dispara tras cada repintado) | `e2e/xornada-live.spec.ts` «CA-5 …» (gl, es; polling simulado); `e2e/xornada-realtime.db.spec.ts` «CA-5 on …» (Decision real → `finished`) | | |
| CA-6 | `src/live/config.ts` (solo `on` exacto), `src/live/supabase.ts` (único import de supabase-js, cargado con `import()` solo con `on`), `src/live/transport.ts` (SUBSCRIBED, fallo, 10 s, reintento 60 s→5 min ±20 %), `next.config.ts` (`env.NEXT_PUBLIC_REALTIME` siempre inlinado), `playwright.db.config.ts` + `src/db/env.ts` (`localAnonKey`) | `src/live/config.test.ts`, `src/live/supabase.test.ts` (opciones `false`, canal `board:<season>` privado, latido N-3, cierre), `src/live/transport.test.ts` «SPEC-024 CA-6 Realtime» (10 casos), `src/db/env.test.ts`, `src/db/playwright-db-config.test.ts`; e2e cookie/`localStorage`/`sessionStorage` vacíos en ambos modos | | |
| CA-7 | `src/live/transport.ts` (polling 30 s ±20 %, `If-None-Match`, `no-store`, pausa oculta, «sen conexión») | `src/live/transport.test.ts` «SPEC-024 CA-7 polling» (9 casos, incl. 20 min de fallos con partidos idénticos); `e2e/xornada-live.spec.ts` «CA-7/D-9 …» | | |
| CA-8 | `src/xornada/freshness.ts` (`screenFreshness`, `transportNotice`), `XornadaLive.tsx` (`FreshnessLine`), `Xornada.module.css` (`.freshness`), i18n `freshness.{servedAt,now,ago,polling,offline}` | `src/xornada/freshness.test.ts` (tablas); `src/i18n/i18n.test.ts` «SPEC-024 CA-8» (paridad gl/es); e2e sin JS «Actualizado ás HH:MM»; `role="status"` solo en el aviso | | |
| CA-9 | `src/xornada/freshness.ts` (`rowAge`), `MatchRow.tsx` (`row-age`), `CompetitionSection.tsx`, `Xornada.module.css` (`.rowAge`, `--fg-dim`) | `src/xornada/freshness.test.ts` «CA-9 rowAge»; `e2e/xornada-live.spec.ts` «CA-9 at 360/390/1024/1440 px» (gl, es; recalculada sin red, sin truncar ni scroll horizontal) | | |
| CA-10 | `e2e/xornada-live.spec.ts`, `e2e/xornada-realtime.db.spec.ts`, `playwright.config.ts` (`NEXT_PUBLIC_REALTIME=""`), `playwright.db.config.ts` (`on` + clave local) | apagado: sin WebSocket, sin chunk de supabase-js, `If-None-Match`, sin aviso, demos sin peticiones; encendido (gl·es, 390·1440): Decision local repinta en < 5 s sin recargar y sin pedir `/api/board`; socket cerrado → aviso + `If-None-Match`; `/api/board` abortado → filas iguales | | |
| CA-11 | `package.json` (`@supabase/supabase-js` `2.117.3` exacta), `tools/first-load-js.mjs`, `tools/medir-board-delta.mjs` | ver «Evidencia del implementador» | | |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

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

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-024/. Informe HTML opcional: _qa/SPEC-024/informe.html -->
Generadas por `QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-024 npm run e2e` y `… npm run e2e:db` (implementador; el verificador decide su valor). El resto de PNG de la carpeta son capturas de SPEC-020/021/023 con la línea de frescura.

| CA | Captura |
|---|---|
| CA-8, CA-9 | `fila-edad-{gl,es}-{390,1440}.png` (polling simulado, «sen conexión», edad en filas `live`) |
| CA-10 | `realtime-{gl,es}-{390,1440}.png` (Realtime local, tras el delta) |

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
CA-1..CA-11 implementados con test en `ft/SPEC-024-realtime-fallback-y-frescura` (sale de `docs/SPEC-024-realtime`, PR #48). Spec en `en-revision`. Sin push ni PR. Falta: verificación (sdd-verificador) y, tras el merge, el procedimiento del titular.

### Procedimiento del titular (N-1, fase «ahora, en Free»)
Nada de esto lo ejecuta el implementador. Orden obligatorio:
1. **Solo lectura en producción** (SQL Editor del proyecto): `select count(*) from pg_proc where proname = 'send' and pronamespace = 'realtime'::regnamespace;` → `1`. `select relrowsecurity from pg_class where oid = 'realtime.messages'::regclass;` → `t`. `select policyname from pg_policies where schemaname = 'realtime' and tablename = 'messages';` → ninguna fila (si hay alguna, parar y avisar: CA-2 asume que `board_receive` es la única). `select 1 from pg_namespace where nspname = 'private';` → ninguna fila.
2. **`npm run db:push`** con la rama ya revisada (antes del merge, ADR-014 §1). Aplica solo `20261009120000_spec024_board_delta.sql`: esquema `private`, funciones, política `board_receive` y trigger `board_delta` **deshabilitado**. Comprobación: `select tgenabled from pg_trigger where tgname = 'board_delta';` → `D`. Compatible con el código desplegado: nada emite.
3. **Merge y despliegue sin `NEXT_PUBLIC_REALTIME`**: en Vercel, la variable no existe (o no vale exactamente `on`) en Production ni en Preview. Todo es polling. Comprobación: `/` dice «Actualizado ás HH:MM», a los ~30 s «Actualizado agora», y el navegador pide `/api/board` con `If-None-Match` sin abrir WebSocket.

*Al pasar a Pro (otra spec):* 1) alta de usuarios cerrada en Auth; 2) migración `alter table public.decisions enable trigger board_delta` y `db:push`; 3) `NEXT_PUBLIC_REALTIME=on` en Production y Preview y redespliegue (la variable se fija en el build). La base va antes que la variable. Marcha atrás: quitar la variable y redesplegar; después, deshabilitar el trigger con otra migración.
