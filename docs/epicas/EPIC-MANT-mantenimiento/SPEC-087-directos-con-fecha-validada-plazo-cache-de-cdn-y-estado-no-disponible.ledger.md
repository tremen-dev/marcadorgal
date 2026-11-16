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
| CA-1 | `src/lib/directos.ts` (`directosDate`) | `src/lib/directos.test.ts` › «SPEC-087 CA-1 directosDate» (sin date, borde 23:30Z, ±7, nulos, `string[]`) | | ❌ |
| CA-2 | `src/lib/directos.ts` (`readDirectos` → `redirect`), `src/app/directos-screen.tsx` (`redirect()` temporal), páginas `src/app/(gl)/directos/page.tsx` y `src/app/(es)/es/directos/page.tsx` | `src/lib/directos.test.ts` › «CA-2 …»; `src/app/directos-screen.test.ts` › «CA-2 the page redirects an invalid date» | | ❌ |
| CA-3 | `src/lib/directos.ts` (`getDayMatches(date, undefined, { timeoutMs })` + `withDeadline`) | `src/lib/directos.test.ts` › «CA-3 the day read has a deadline» (argumentos; temporizadores falsos) | | ❌ |
| CA-4 | `src/lib/directos.ts` (`console.error` con fecha y mensaje), `src/components/directos/DirectosView.tsx` (`directos-unavailable`), `src/i18n/gl.ts`, `src/i18n/es.ts` (`directos.unavailable`) | `src/lib/directos.test.ts` › «CA-4 …» (plazo, 5xx, JSON, cuerpo sin `matches`); `src/components/directos/DirectosView.test.ts` › «SPEC-087 CA-4 …» (gl y es); `src/app/directos-screen.test.ts` › «a failing explorer…» | | ❌ |
| CA-5 | `src/lib/directos.ts` (`kind: "page"`, `grouped: []`), `DirectosView.tsx` sin cambio en el vacío | `src/lib/directos.test.ts` › «CA-5 …»; `src/components/directos/DirectosView.test.ts` › «SPEC-087 CA-5 …» | | ❌ |
| CA-6 | `next.config.ts` (`/directos`, `/es/directos` con `home`) | `src/arch/home-cache.test.ts` › «SPEC-087 CA-6 …» | | ❌ |
| CA-7 | campo: pendiente (curl sobre el despliegue de la PR, no hecho por el implementador) | — | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-087/. Informe HTML opcional: _qa/SPEC-087/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-087-1, F-SPEC-087-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-087-1 (decisión de implementación, a validar): `?date=` vacío se trata como fecha inválida (redirección a la ruta sin query), no como «sin date»; la spec no lo nombra.
- F-SPEC-087-2 (versión): esta rama sube a `0.10.8` (patch, ADR-028) desde la misma base que el PR #149 (SPEC-086), que también sube a `0.10.8`; quien mergee el segundo ajusta a `0.10.9`. Destino: orquestador.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho CA-1..CA-6 en `ft/SPEC-087-directos-robusto` (commits 5f2ae85..a032296, versión eef3f71). Gates en worktree LF: typecheck OK, `biome check .` OK (494 ficheros), `vitest run` 176 ficheros / 2981 tests OK; `next build` OK en el árbol principal (`ƒ /directos`, `ƒ /es/directos`).
- Humo local (`next start`, `EXPLORER_BASE_URL=http://127.0.0.1:9`, sin red real): `/directos?date=2026-02-30` → 307 `location: /directos` con las dos cabeceras de caché; `/es/directos?date=x` → 307 `/es/directos`; `/directos` → 200 con `directos-unavailable` y log `directos: explorer failed for 2026-11-16: fetch failed`.
- Falta CA-7 (campo): dos `curl -sI` a `/directos?date=<hoy>` y uno a `?date=<ayer>` sobre el despliegue de la PR.
