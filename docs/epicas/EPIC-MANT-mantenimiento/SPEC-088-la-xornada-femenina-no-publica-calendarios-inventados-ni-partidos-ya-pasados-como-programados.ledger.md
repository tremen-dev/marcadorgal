---
id: SPEC-088
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-088 La xornada femenina no publica calendarios inventados ni partidos ya pasados como programados

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-088-femenino-sin-inventos`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/explorer-xornada.ts` (`WOMEN_COMPETITIONS = ["liga-f"]`) | `src/lib/explorer-xornada.spec088.test.ts` › CA-1 (lista exacta; tres calendarios responden → solo sale `liga-f` y solo se pide `liga-f`); `explorer-xornada.test.ts` › WOMEN_COMPETITIONS / «asks only liga-f»; `xornada-board.test.ts` › SPEC-085 CA-4 (llamadas solo `liga-f`) | spec088 › CA-1 2/2 verdes; mutante «3 competiciones» → 2 rojos; grep: `WOMEN_COMPETITIONS` solo se consume en `explorer-xornada.ts:217` | ✅ |
| CA-2 | `src/lib/explorer-xornada.ts` `stillScheduled` (hora confirmada: `now < K + LIVE_BEFORE_MINUTES`) llamado desde `viewOf` | `explorer-xornada.spec088.test.ts` › CA-2 (K−1 h, K+9 min salen; K+10 min, K+3 d no) | spec088 › CA-2 4/4 (K−1h, K+9 sale; K+10, K+3d no); mutante `viewOf` sin `stillScheduled` → 6 rojos CA-2..CA-4 | ✅ |
| CA-3 | `src/lib/explorer-xornada.ts` `stillScheduled` (sin confirmar: `toMadridDate(now) <= toMadridDate(K)`) | `explorer-xornada.spec088.test.ts` › CA-3 (K `2026-11-22T00:00:00Z`: now 21-11 y 22-11 20:00Z salen; 22-11 23:30Z y 24-11 no) | spec088 › CA-3 4/4 incl. 22-11 20:00Z sale / 23:30Z (00:30 Madrid) no; mismo mutante lo tumba | ✅ |
| CA-4 | `src/lib/explorer-xornada.ts` `viewOf` (fila `SCHEDULED` → misma regla) | `explorer-xornada.spec088.test.ts` › CA-4 (confirmada K+9/K+10; sin confirmar mismo día / día siguiente) | spec088 › CA-4 4/4; mutante «solo `row === null`» → 2 rojos CA-4 | ✅ |
| CA-5 | `src/lib/explorer-xornada.ts` (la regla solo en la rama que devolvía `SCHEDULED`) | `explorer-xornada.spec088.test.ts` › CA-5 (FINISHED a K+3 d con marcador; LIVE a K+30); `explorer-xornada.spec086.test.ts` entero verde (kickoffs «programados» movidos a 17:00Z del mismo día) | spec088 › CA-5 2/2 (FINISHED K+3d 2-1, LIVE K+30); `spec086` entero verde (48/48 con spec088); diff de spec086 solo mueve kickoffs «programados» a 17:00Z | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-11-16 — sdd-verificador.** CA-1..CA-5 ✅.
- Gates (worktree LF en `e3e6785`): `tsc --noEmit` exit 0; `biome check .` «Checked 496 files… No fixes applied»; `vitest run` 178 ficheros, 3029 passed | 3 skipped. `next build` en árbol principal exit 0.
- Mutantes propios (worktree desechable, revertidos): lista con las 3 competiciones → 2 rojos CA-1; `viewOf` devuelve `SCHEDULED` sin plazo → 6 rojos; fila `SCHEDULED` fuera de la regla → 2 rojos CA-4.
- Flujo real contra explorer de producción: no observado (el token de `.env.local` da 401 en local; la clave de admin de explorer no se usó). Los CA se formulan sobre `WomenExplorer` inyectado y fixtures, así que la evidencia por tests basta.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-088/. Informe HTML opcional: _qa/SPEC-088/informe.html -->
Sin capturas: el cambio está en la capa de datos (`fetchWomenXornadaMatches`) y todos los CA se juzgan con `WomenExplorer` inyectado. Un navegador local no habría mostrado femenino (explorer responde 401 al token local), así que una captura no añadía evidencia.

## Salvedades / follow-ups
<!-- IDs F-SPEC-088-1, F-SPEC-088-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-088-1 (decisión de implementación, revisar): un kickoff que no es `Instant` no lo juzga `stillScheduled` (devuelve «sigue»), para que lo descarte `PublicMatch.safeParse` con su `warn` (SPEC-086 CA-5). Sin esto, `"2026-11-08 11:00"` se parseaba como hora local de la máquina y desaparecía en silencio. Cubierto por `explorer-xornada.spec086.test.ts` › CA-5.
- F-SPEC-088-2 (tests adaptados, CA-5): en `explorer-xornada.spec086.test.ts` los partidos que debían salir «programado» sin fila pasan a kickoff 17:00Z del mismo día (`KO1_LATE`/`KO2_LATE`); en `explorer-xornada.test.ts` se quitan las aserciones de 1ª/2ª Fed. Fem. (incluida la de nombre «RC Celta Femenino / As Celtas»); en `xornada-board.test.ts` SPEC-085 CA-4 cuenta solo `liga-f` y `counted(1)` en vez de `counted(3)`.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-5 implementados en `ft/SPEC-088-femenino-sin-inventos` (`4d5e16f` fix, `b15e106` versión 0.10.10, `6ca823e` formato). Gates: worktree LF `npm run typecheck` exit 0, `npm run lint` «Checked 496 files… No fixes applied», `npm test` 178 ficheros, 3029 passed | 3 skipped; `next build` en el árbol principal exit 0. Mutantes (revertidos): margen +1 min → 2 rojos CA-2/CA-4; regla de día → `true` → 3 rojos CA-3/CA-4. Falta: verificación (sdd-verificador), push y PR.
