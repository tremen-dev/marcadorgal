---
id: SPEC-027
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-027 Navegar entre xornadas

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-027-navegar-entre-xornadas`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/board/weeks.ts` (`weekOf`, `weekXornada`, `seasonWeeks`); `src/calendar/current-round.ts` exporta `median` | `src/board/weeks.test.ts` «SPEC-027 CA-1 weekOf» (10 casos: martes 00:00, lunes 23:59, cambio de hora 2026-10-25, fin de año) y «CA-1 weekXornada and seasonWeeks» (vie-lun, lun 23:59, cambio de hora, ronda de miércoles + fin de semana, aplazado J3 en semana de J8, parón, índice vacío) | vitest verde; `weekOf` contra oráculo independiente (Intl weekday) cada 7 min de 2026-2027: 150172 instantes, 0 discrepancias; tabla cubre todos los casos de la letra | ✅ |
| CA-2 | `src/board/weeks.ts` (`homeWeek`, `neighbourWeeks`, `weekHref`, `weekArrows`) | `src/board/weeks.test.ts` «SPEC-027 CA-2 …» (sábado J5, miércoles tras punto medio, miércoles mixto Primeira J8 + Terceira J6, parón, primera/última → `null`, solo temporada de `now`, simetría, `weekHref`) | vitest verde; miércoles mixto revisado a mano (Primeira J9 pasa el punto medio, Terceira J6 no → home 10-17, ‹ 10-10 con Primeira J8 + Terceira J6); flechas reales en `next start`: `/` ‹ `/xornada/2026-10-03` › `/xornada/2026-10-17`; desde 10-03 › `/`, desde 10-17 ‹ `/` | ✅ |
| CA-3 | `src/board/week-route.ts` (`weekParam`, `weekPage`), `src/board/week-read.ts` (`readWeekPage`), `src/app/xornada-week.tsx`, `src/app/(gl)/xornada/[fecha]/page.tsx`, `src/app/(es)/es/xornada/[fecha]/page.tsx` | `src/board/week-route.test.ts` (tabla 404/308/307/404/page/unavailable; iter. 2: «1990-01-06», «2025-12-27», «2028-01-01» → 404 sin leer, «1990-01-03» → 308, «the season is the one of now»); `src/board/week-read.test.ts`; `e2e/xornada-weeks.db.spec.ts` «CA-3 without JS…», «CA-3 answers…», «CA-3 the names… gl and es»; `e2e/xornada-weeks.spec.ts` «CA-3 … without a reader» (semana de `now`, no fija), «308 … 404» (+ `1990-01-06` → 404 sin lector), «a browser follows the 308» | `curl -I` propio (abajo): 200/308/307/404 según la letra, `noindex, nofollow`, selector al par, filas = `weekXornada` (e2e) | ✅ |
| CA-4 | `next.config.ts` (`headers()` para `/xornada/:fecha` y `/es/xornada/:fecha`); `revalidate = 10` + `generateStaticParams() → []` en las dos páginas | `src/arch/week-cache.test.ts`; `curl -I` abajo; build: `● /xornada/[fecha]`, `● /es/xornada/[fecha]` sin páginas prerenderizadas | build sin `DATABASE_URL_PUBLIC` verde; `.next/server/app` sin HTML de `xornada/[fecha]`; `x-nextjs-cache: MISS` en primera visita; 200 con las directivas. Salvedades F-1 y F-2 | ⚠️ |
| CA-5 | `src/components/xornada/SnapshotFreshness.tsx`, `src/xornada/freshness.ts` (`snapshotFreshness`), `XornadaScreen` (`freshness`, sin `live` en las semanas) | `src/xornada/freshness.test.ts` «SPEC-027 CA-5 snapshotFreshness»; `e2e/xornada-weeks.db.spec.ts` «CA-5 a week page is a snapshot…» (interruptor on: 0 `/api/board`, 0 WebSocket, sin supabase-js; día, filtro, plegado); `e2e/xornada-weeks.spec.ts` (interruptor off); e2e SPEC-024 en verde | interruptor encendido: e2e:db verde en las 3 pasadas; apagado: recorrido propio con lector local, con y sin JS, 390/1440: 0 `/api/board`, 0 WebSocket, sin chunk supabase-js, `data-transport=snapshot`, «Actualizado ás HH:MM» | ✅ |
| CA-6 | `src/components/xornada/XornadaControls.tsx` (`WeekArrow`, `DayStrip` con `arrows`), `XornadaBody`/`XornadaLive`/`XornadaScreen` (prop `arrows`), `src/app/xornada-home.tsx` (`readHome`), `Xornada.module.css` (`.strip`, `.daysInStrip`, `.weekArrow`), `src/i18n/{gl,es}.ts` (`xornada.previous/next`) | `e2e/xornada-weeks.db.spec.ts` «CA-6 arrows on … at {360,390,1024,1440}px» (gl, es; portada y semana) y «CA-6 without JS…»; `src/i18n/i18n.test.ts` «SPEC-027 CA-6» | e2e verde (360-1440, gl/es, teclado, foco); recorrido propio sin JS 360/390/1440: › y ‹ visibles, 26×39 (móvil) y 24×43 (escritorio), sin truncado ni scroll horizontal, fuera de `day-strip`, sin `#`. Supresión Biome justificada (la regla rechaza `aria-label` con hijo `aria-hidden`; comprobado aislado) | ✅ |
| CA-7 | `e2e/xornada.db.spec.ts` «CA-6 team and competition names identical in gl and es» estabilizado (iter. 2, F-3) | iter. 2: `npm run gates` (1475 tests, build sin `DATABASE_URL_PUBLIC`), `npm run e2e` 98 ✓, `npm run e2e:db` 3 pasadas completas seguidas 31 ✓ + 1 skip cada una, `npm run test:db` 189 ✓; `git diff origin/main --stat -- src/sources src/decide src/ingest supabase src/app/api src/board/http.ts src/board/reader.ts` vacío; `package.json`/lock sin cambios; tests de `currentRound`/`currentXornada` sin cambios | gates, e2e (98 ✓) y test:db (189 ✓) verdes; diff de fronteras vacío; sin dependencias. **`e2e:db` rojo en 2 de 3 pasadas** (F-3); `origin/main` 4/4 verde y la rama sin `xornada-weeks.db.spec.ts` 3/3 verde | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**RED — 2026-10-10 (sdd-verificador).** CA-1, CA-2, CA-3, CA-5 y CA-6 cumplidos; CA-4 con salvedades F-1/F-2 aceptables; CA-7 no: `npm run e2e:db` falla en 2 de 3 pasadas completas.

Evidencia de F-3 (rama a59af85, base local, secuencial):
```
e2e:db rama completa       pasada 1 ✘  pasada 2 ✓  pasada 3 ✘   (xornada.db.spec.ts:108 «CA-6 team and competition names identical in gl and es»)
e2e:db origin/main         4/4 ✓ (14 passed)
rama sin xornada-weeks.db  3/3 ✓ (realtime + xornada.db, 14 passed)
```
El diff del fallo es de orden/estado de filas entre `/` y `/es`, no de nombres: las dos portadas son instantáneas ISR independientes tomadas antes y después de las Decisions de `xornada-realtime.db`; el nuevo `xornada-weeks.db.spec.ts`, que corre entre ambos, desplaza su regeneración. Defecto del test (supone dos ISR simultáneos), no de la app ni de ISR; lo destapa esta rama y CA-7 exige el gate en verde.

Otros: `test:db` falló una vez por estado sucio previo de la base local (`matches_pkey` en SPEC-018); tras reset, 189 ✓. Gates: 1468 ✓, 1 aviso Biome preexistente en `src/arch/deploy.test.ts`.

CA-4, `next start` propio (lector local, interruptor apagado, 2026-10-09, portada = 2026-10-10):
```
200 /xornada/2026-10-03, /es/xornada/2026-10-03, /xornada/2026-10-17   Cache-Control: public, s-maxage=10, stale-while-revalidate=30
308 /xornada/2026-10-05 → /xornada/2026-10-03 ; /es/xornada/2026-10-06 → /es/xornada/2026-10-10   (location x2 en MISS, x1 en HIT)
307 /xornada/2026-10-10 → / ; /es/xornada/2026-10-10 → /es
404 /xornada/2027-08-14, /xornada/2026-05-23, /xornada/2026-02-30, /xornada/hoxe, /es/xornada/2026-13-01   (todas con s-maxage=10)
```

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-027/. Informe HTML opcional: _qa/SPEC-027/informe.html -->
| CA | Captura (`_qa/SPEC-027/`) |
|---|---|
| CA-6 portada | `flechas-portada-{gl,es}-{360,390,1024,1440}.png` (el foco visible queda en ›, último Tab) |
| CA-6 semana | `flechas-semana-{gl,es}-{360,390,1024,1440}.png` |
| CA-6 primera semana (hueco sin ‹) | `flechas-primera-semana-{gl,es}.png` |
| CA-5/CA-6 verificador (interruptor apagado, lector local) | `verif-off-{portada-gl,portada-es,semana-gl-2026-10-03,semana-es-2026-10-03,semana-gl-2026-10-17,semana-es-2026-10-17}-{390,1440}-{js,nojs}.png` |

Generadas con `QA_CAPTURE_DIR=$PWD/docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-027 npm run e2e:db -- e2e/xornada-weeks.db.spec.ts` → 17 passed.

CA-4, `next start` local (base local, `web_reader`, 2026-10-09, portada = semana 2026-10-10):
```
$ curl -sI http://localhost:3120/xornada/2026-10-03
HTTP/1.1 200 OK
Cache-Control: public, s-maxage=10, stale-while-revalidate=30
$ curl -sI http://localhost:3120/es/xornada/2026-10-03
HTTP/1.1 200 OK
Cache-Control: public, s-maxage=10, stale-while-revalidate=30
$ curl -sI http://localhost:3120/xornada/2026-10-05
HTTP/1.1 308 Permanent Redirect
Cache-Control: public, s-maxage=10, stale-while-revalidate=30
location: /xornada/2026-10-03
location: /xornada/2026-10-03
$ curl -sI http://localhost:3120/es/xornada/2026-10-10
HTTP/1.1 307 Temporary Redirect
Cache-Control: public, s-maxage=10, stale-while-revalidate=30
location: /es
location: /es
$ curl -sI http://localhost:3120/xornada/2026-10-10
HTTP/1.1 307 Temporary Redirect
Cache-Control: public, s-maxage=10, stale-while-revalidate=30
location: /
location: /
$ curl -sI http://localhost:3120/xornada/2027-08-14
HTTP/1.1 404 Not Found
Cache-Control: public, s-maxage=10, stale-while-revalidate=30
$ curl -sI http://localhost:3120/xornada/2026-02-30
HTTP/1.1 404 Not Found
Cache-Control: public, s-maxage=10, stale-while-revalidate=30
```

## Salvedades / follow-ups
<!-- IDs F-SPEC-027-1, F-SPEC-027-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-027-1** `next start` (Next 16.3.5) repite la cabecera `Location` idéntica en el primer render (MISS) de un 307/308 ISR; en HIT sale una. Chrome la sigue (e2e «a browser follows the 308»); los tests normalizan. Comprobar en Vercel. Destino: EPIC-MEJORA.
- **F-SPEC-027-2** Los 404 y redirecciones de `/xornada/:fecha` llevan también `public, s-maxage=10, stale-while-revalidate=30` (la regla de `headers()` cubre la ruta entera). 10 s de caché de un 404 o un 307 parece inocuo; decidir si se quiere distinto. Destino: EPIC-MEJORA.
- **F-SPEC-027-3** Resuelto en iter. 2 (5aaad84): el test compara, sin JS, competición y equipos por `matchId`, mismo conjunto de partidos y de competiciones, sin depender del orden por estado.
- **F-SPEC-027-4** Resuelto en iter. 2 (95c090d): `weekParam(fecha, locale, now)` responde 404 sin leer a una clave de semana fuera de los años civiles de `seasonOf(now)` (2026-27 → 2026 y 2027), después del 308. Supuesto: una temporada S-(S+1) no tiene rondas fuera de esos dos años. Efecto en la letra: sin lector, `/xornada/1990-01-06` da 404 y no `unavailable` (fecha que nunca es de `seasonWeeks`).
- Biome `useAnchorContent` no admite `aria-label` con hijo `aria-hidden`: supresión por rango en `WeekArrow` con motivo.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho CA-1..CA-7 en `ft/SPEC-027-navegar-entre-xornadas` (commits c3f9f4c, 059b87b, 1030eae, 0cba1ec + ledger). Sin push ni PR.
- Iter. 2 tras RED: 5aaad84 (F-3, test de nombres gl/es por `matchId`) y 95c090d (F-4, corte por años de temporada en `weekParam`). Evidencia:
```
DATABASE_URL_PUBLIC="" npm run gates   exit 0 (1475 tests, 1 aviso Biome preexistente)
npm run e2e                            98 passed
npm run e2e:db  pasada 1/2/3           31 passed, 1 skipped (cada una; exit 0)
npm run test:db                        189 passed
git diff origin/main --stat -- src/sources src/decide src/ingest supabase src/app/api src/board/http.ts src/board/reader.ts   (vacío)
```
- F-1 y F-2 siguen para el titular.
- Puro en `src/board/weeks.ts` y `src/board/week-route.ts`; lecturas en `src/board/week-read.ts` (mismo `index` + `matches`, `reader.ts` intacto); páginas en `src/app/xornada-week.tsx`.
- Verificar: `npm run gates` con `DATABASE_URL_PUBLIC=""`, `npm run e2e`, `npm run e2e:db`, `npm run test:db` (base local). Para el `curl -I`: sembrar con `tools/e2e-db-seed.mjs` y `next start` con las variables de `playwright.db.config.ts` (nunca `.env`).
