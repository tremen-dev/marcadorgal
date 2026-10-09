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
| CA-1 | `src/board/weeks.ts` (`weekOf`, `weekXornada`, `seasonWeeks`); `src/calendar/current-round.ts` exporta `median` | `src/board/weeks.test.ts` «SPEC-027 CA-1 weekOf» (10 casos: martes 00:00, luns 23:59, cambio de hora 2026-10-25, fin de año) y «CA-1 weekXornada and seasonWeeks» (ven-luns, luns 23:59, cambio de hora, ronda mércores + fin de semana, aprazado J3 en semana de J8, parón, índice vacío) | | ❌ |
| CA-2 | `src/board/weeks.ts` (`homeWeek`, `neighbourWeeks`, `weekHref`, `weekArrows`) | `src/board/weeks.test.ts` «SPEC-027 CA-2 …» (sábado J5, mércores tras punto medio, mércores mixto Primeira J8 + Terceira J6, parón, primera/última → `null`, só tempada de `now`, simetría, `weekHref`) | | |
| CA-3 | `src/board/week-route.ts` (`weekParam`, `weekPage`), `src/board/week-read.ts` (`readWeekPage`), `src/app/xornada-week.tsx`, `src/app/(gl)/xornada/[fecha]/page.tsx`, `src/app/(es)/es/xornada/[fecha]/page.tsx` | `src/board/week-route.test.ts` (táboa 404/308/307/404/page/unavailable); `src/board/week-read.test.ts`; `e2e/xornada-weeks.db.spec.ts` «CA-3 without JS…», «CA-3 answers…», «CA-3 the names… gl and es»; `e2e/xornada-weeks.spec.ts` «CA-3 … without a reader», «308 … 404», «a browser follows the 308» | | |
| CA-4 | `next.config.ts` (`headers()` para `/xornada/:fecha` e `/es/xornada/:fecha`); `revalidate = 10` + `generateStaticParams() → []` nas dúas páxinas | `src/arch/week-cache.test.ts`; `curl -I` abaixo; build: `● /xornada/[fecha]`, `● /es/xornada/[fecha]` sen páxinas prerenderizadas | | |
| CA-5 | `src/components/xornada/SnapshotFreshness.tsx`, `src/xornada/freshness.ts` (`snapshotFreshness`), `XornadaScreen` (`freshness`, sen `live` nas semanas) | `src/xornada/freshness.test.ts` «SPEC-027 CA-5 snapshotFreshness»; `e2e/xornada-weeks.db.spec.ts` «CA-5 a week page is a snapshot…» (interruptor on: 0 `/api/board`, 0 WebSocket, sen supabase-js; día, filtro, pregado); `e2e/xornada-weeks.spec.ts` (interruptor off); e2e SPEC-024 en verde | | |
| CA-6 | `src/components/xornada/XornadaControls.tsx` (`WeekArrow`, `DayStrip` con `arrows`), `XornadaBody`/`XornadaLive`/`XornadaScreen` (prop `arrows`), `src/app/xornada-home.tsx` (`readHome`), `Xornada.module.css` (`.strip`, `.daysInStrip`, `.weekArrow`), `src/i18n/{gl,es}.ts` (`xornada.previous/next`) | `e2e/xornada-weeks.db.spec.ts` «CA-6 arrows on … at {360,390,1024,1440}px» (gl, es; portada e semana) e «CA-6 without JS…»; `src/i18n/i18n.test.ts` «SPEC-027 CA-6» | | |
| CA-7 | — | `npm run gates` (1468 tests, build sen `DATABASE_URL_PUBLIC`), `npm run e2e` 98 ✓, `npm run e2e:db` 31 ✓ + 1 skip, `npm run test:db` 189 ✓; `git diff origin/main --stat -- src/sources src/decide src/ingest supabase src/app/api src/board/http.ts src/board/reader.ts` baleiro; `package.json`/lock sen cambios; tests de `currentRound`/`currentXornada` sen cambios | | |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-027/. Informe HTML opcional: _qa/SPEC-027/informe.html -->
| CA | Captura (`_qa/SPEC-027/`) |
|---|---|
| CA-6 portada | `flechas-portada-{gl,es}-{360,390,1024,1440}.png` (o foco visible queda en ›, último Tab) |
| CA-6 semana | `flechas-semana-{gl,es}-{360,390,1024,1440}.png` |
| CA-6 primeira semana (hueco sen ‹) | `flechas-primera-semana-{gl,es}.png` |

Xeradas con `QA_CAPTURE_DIR=$PWD/docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-027 npm run e2e:db -- e2e/xornada-weeks.db.spec.ts` → 17 passed.

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
- **F-SPEC-027-3** En una pasada completa de `e2e:db`, `xornada.db.spec.ts` «CA-6 team and competition names identical in gl and es» falló una vez (orden de filas `/` vs `/es` tras los cambios de `xornada-realtime.db`, snapshots ISR de momentos distintos); en verde aislado y en la pasada completa siguiente. No tocado. Destino: EPIC-MEJORA (test estable).
- Biome `useAnchorContent` no admite `aria-label` con hijo `aria-hidden`: supresión por rango en `WeekArrow` con motivo.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho CA-1..CA-7 en `ft/SPEC-027-navegar-entre-xornadas` (commits c3f9f4c, 059b87b, 1030eae, 0cba1ec + ledger). Sin push ni PR.
- Puro en `src/board/weeks.ts` y `src/board/week-route.ts`; lecturas en `src/board/week-read.ts` (mismo `index` + `matches`, `reader.ts` intacto); páginas en `src/app/xornada-week.tsx`.
- Verificar: `npm run gates` con `DATABASE_URL_PUBLIC=""`, `npm run e2e`, `npm run e2e:db`, `npm run test:db` (base local). Para el `curl -I`: sembrar con `tools/e2e-db-seed.mjs` y `next start` con las variables de `playwright.db.config.ts` (nunca `.env`).
