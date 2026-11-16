---
id: SPEC-087
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-087 Directos con fecha validada, plazo, cache de CDN y estado no disponible

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-087-directos-robusto`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/directos.ts` (`directosDate`) | `src/lib/directos.test.ts` › «SPEC-087 CA-1 directosDate» (sin date, borde 23:30Z, ±7, nulos, `string[]`) | 2026-11-16: 15 casos de `directosDate` verdes; borde 23:30Z → `2026-11-16`; `''` y `string[]` → null. Mutación `RANGE_DAYS=8` → 3 tests caen (muerde). | ✅
| CA-2 | `src/lib/directos.ts` (`readDirectos` → `redirect`), `src/app/directos-screen.tsx` (`redirect()` temporal), páginas `src/app/(gl)/directos/page.tsx` y `src/app/(es)/es/directos/page.tsx` | `src/lib/directos.test.ts` › «CA-2 …»; `src/app/directos-screen.test.ts` › «CA-2 the page redirects an invalid date» | `next start` + stub: `/directos?date=2026-02-30`, `?date=2026-11-24`, `?date=`, `?date=a&date=b` → `307` `location: /directos`; `/es/directos?date=x` y `?date=20261116` → `307` `location: /es/directos`; el stub no recibió ninguna petición de esas fechas. Navegador: `ca2-redirect-es-*` acaba en `/es/directos`. | ✅
| CA-3 | `src/lib/directos.ts` (`getDayMatches(date, undefined, { timeoutMs })` + `withDeadline`) | `src/lib/directos.test.ts` › «CA-3 the day read has a deadline» (argumentos; temporizadores falsos) | Test de argumentos y de temporizadores falsos (no resuelve a 1999 ms, `unavailable` a 2000 ms). Mutación `getDay(date)` sin `timeoutMs` → 1 test cae. Con explorer en `127.0.0.1:9` la página responde `unavailable`. | ✅
| CA-4 | `src/lib/directos.ts` (`console.error` con fecha y mensaje), `src/components/directos/DirectosView.tsx` (`directos-unavailable`), `src/i18n/gl.ts`, `src/i18n/es.ts` (`directos.unavailable`) | `src/lib/directos.test.ts` › «CA-4 …» (plazo, 5xx, JSON, cuerpo sin `matches`); `src/components/directos/DirectosView.test.ts` › «SPEC-087 CA-4 …» (gl y es); `src/app/directos-screen.test.ts` › «a failing explorer…» | Navegador (360/1440, gl/es), explorer muerto y stub 500: `directos-unavailable` con `role=status`, texto gl «Os directos non están dispoñibles agora mesmo.» / es «Los directos no están disponibles en este momento.», sin `competitions.noMatches`, con la fecha. Log del servidor: `directos: explorer failed for 2026-11-15: [explorer] Error 500 en /api/export/matches` y `… 2026-11-16: fetch failed`. Estado en texto, no solo color. | ✅
| CA-5 | `src/lib/directos.ts` (`kind: "page"`, `grouped: []`), `DirectosView.tsx` sin cambio en el vacío | `src/lib/directos.test.ts` › «CA-5 …»; `src/components/directos/DirectosView.test.ts` › «SPEC-087 CA-5 …» | Stub 200 `matches: []` (`?date=2026-11-14`, gl/es): «Non hai/No hay partidos…», sin `directos-unavailable`, sin `console.error` en el log. | ✅
| CA-6 | `next.config.ts` (`/directos`, `/es/directos` con `home`) | `src/arch/home-cache.test.ts` › «SPEC-087 CA-6 …» | Test de `next.config.ts` verde; mutación quitando `/es/directos` → cae. `curl -sI` local: `Cache-Control: public, s-maxage=10, stale-while-revalidate=30` y `Vercel-CDN-Cache-Control: s-maxage=10, stale-while-revalidate=30`. | ✅
| CA-7 | campo: pendiente (curl sobre el despliegue de la PR, no hecho por el implementador) | — | Pendiente de campo: no hay despliegue de la PR. No verificado; sin evidencia inventada. | ⚠️

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN CONDICIONAL — 2026-11-16, sdd-verificador.** CA-1..CA-6 ✅, CA-7 ⚠️ (campo, pendiente). La spec se queda en `en-revision`: `hecho` es terminal y CA-7 solo se puede medir sobre el despliegue de la PR.
- Gates (worktree LF en `0e178f8`): `tsc --noEmit` exit 0; `biome check .` 494 ficheros, exit 0; `vitest run` 176 ficheros, 2981 passed, 3 skipped, exit 0. Tests de la spec: 4 ficheros, 46 passed.
- Mutaciones (worktree desechable, revertidas): `DIRECTOS_RANGE_DAYS=8` → 3 fallos; sin `{ timeoutMs }` → 1 fallo; sin la regla de `/es/directos` → 1 fallo.
- e2e (árbol principal, `next build` incluido, `EXPLORER_BASE_URL=http://127.0.0.1:9`): `playwright test e2e/cabecera-movil.spec.ts e2e/identidade-celeste.spec.ts e2e/ligas-preferencias.spec.ts` → 101 passed, exit 0.
- Flujo real: `next start` contra un stub local (16: un partido, 15: HTTP 500, 14: `matches: []`) y otro contra `127.0.0.1:9`. Comandos y salidas en las filas de la matriz.
- Para cerrar: en el despliegue de la PR, `curl -sI <url>/directos?date=<hoy>` dos veces (la 2ª `x-vercel-cache: HIT`/`STALE`) y `curl -s[I] <url>/directos?date=<ayer>` (`MISS` y cuerpo con la fecha de ayer). Con eso, `estado.mjs … hecho --por sdd-verificador`.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-087/. Informe HTML opcional: _qa/SPEC-087/informe.html -->
| CA | Captura (`_qa/SPEC-087/`, 360 y 1440 px) |
|---|---|
| CA-2 | `ca2-redirect-es-{360,1440}.png` (final `/es/directos`) |
| CA-4 | `ca4-dead-{gl,es}-*.png` (explorer muerto), `ca4-5xx-{gl,es}-*.png` (HTTP 500) |
| CA-5 | `ca5-empty-{gl,es}-*.png` |
| contraste | `ok-matches-gl-*.png` (día con partido, sin estado de error) |

## Salvedades / follow-ups
<!-- IDs F-SPEC-087-1, F-SPEC-087-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-087-1 (decisión de implementación, a validar): `?date=` vacío se trata como fecha inválida (redirección a la ruta sin query), no como «sin date»; la spec no lo nombra.
- F-SPEC-087-2 (versión): esta rama sube a `0.10.8` (patch, ADR-028) desde la misma base que el PR #149 (SPEC-086), que también sube a `0.10.8`; quien mergee el segundo ajusta a `0.10.9`. Destino: orquestador.
- F-SPEC-087-1 (verificador): aceptado. `?date=` vacío redirige; es coherente con CA-1 (`''` no es `YYYY-MM-DD`) y no pide explorer.
- F-SPEC-087-3 (verificador): CA-7 pendiente de campo sobre el despliegue de la PR. Bloquea `hecho`.
- O-1 (verificador, sin acción): la 307 de una fecha inválida también lleva las cabeceras de CDN (10 s + 30 s stale); es inocua y protege a explorer.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho CA-1..CA-6 en `ft/SPEC-087-directos-robusto` (commits 5f2ae85..a032296, versión eef3f71). Gates en worktree LF: typecheck OK, `biome check .` OK (494 ficheros), `vitest run` 176 ficheros / 2981 tests OK; `next build` OK en el árbol principal (`ƒ /directos`, `ƒ /es/directos`).
- Humo local (`next start`, `EXPLORER_BASE_URL=http://127.0.0.1:9`, sin red real): `/directos?date=2026-02-30` → 307 `location: /directos` con las dos cabeceras de caché; `/es/directos?date=x` → 307 `/es/directos`; `/directos` → 200 con `directos-unavailable` y log `directos: explorer failed for 2026-11-16: fetch failed`.
- Falta CA-7 (campo): dos `curl -sI` a `/directos?date=<hoy>` y uno a `?date=<ayer>` sobre el despliegue de la PR.
