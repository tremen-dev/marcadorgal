---
id: SPEC-094
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-094 Los goleadores siempre cuadran con el marcador

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-094-los-goleadores-siempre-cuadran-con-el-marcador`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/xornada/scorers.ts` (`squareGoals`); `src/model/public.ts` (`PublicGoal.minute` opcional) | `src/xornada/scorers.test.ts` «SPEC-094 CA-1 squareGoals» (10 casos) | Worktree LF: `vitest run` 186 ficheros, 4867 pasan / 3 skipped; los 10 casos cubren cada regla (nulo, 2–1 sin goleadores, 1–0 con dos, 0–0 con gol, sin minuto, `ownGoal`, longitud = N). Lectura: puro, sin reloj/red/React | ✅ |
| CA-2 | `src/components/goals/TeamGoals.tsx` (prop `lines`), `src/components/xornada/MatchRow.tsx`, `src/components/directos/DirectosView.tsx` | `src/components/xornada/goals.test.ts` «SPEC-094 CA-2…» y los dos casos H-1 cambiados; `src/components/directos/DirectosView.test.ts` «SPEC-094 CA-2…» | Vitest verde; único punto de pintado de goleadores es `TeamGoals` (grep en `src/app`, `src/components`). Playwright local 4 combinaciones gl/es × 360/1440: 14 filas con cajón de 22, 0 filas con goles en el marcador sin cajón, 0 cajones sin goles | ✅ |
| CA-3 | `TeamGoals.tsx` (`data-unknown`, minuto vacío); `src/i18n/gl.ts`, `src/i18n/es.ts` (`xornada.goalUnknown`) | `goals.test.ts` «SPEC-094 CA-3 the line without author»; e2e `xornada-goleadores.spec.ts` «SPEC-094 CA-6» (color `--fg-muted`) | Playwright local: 15 líneas `data-unknown` por ruta, texto «gol» en gl y es, `goal-minute` vacío con ancho 26 px conservado; color y familia calculados idénticos a un nombre conocido (`rgb(167,165,160)`, Geist). Captura `ca6-gl-360-sevilla-fc-getafe-cf.png` | ✅ |
| CA-4 | `src/lib/explorer-enrichment.ts` (`sanitizeGoals`), `src/sources/rfef/explorer.ts` (`ExplorerGoal`), `src/lib/explorer-matches.ts` (`TransformedGoal`), `src/lib/explorer-client.ts` | `explorer-enrichment.test.ts` «SPEC-094 CA-4 sanitizeGoals…»; `explorer.test.ts` «SPEC-094 CA-4 a goal without minute in the export»; `goals.test.ts` «SPEC-094 CA-4 a goal without minute» | Vitest verde (ausente/nulo/texto/NaN conservados sin clave; sintético, team inválido y player vacío descartados; tick con fixture 2026-11-01 da las mismas 28 observaciones). Demo: Pontevedra 1–0 «Brais Abelenda» sin minuto ni `'` (`ca6-gl-360-pontevedra-cf-zamora-cf.png`) | ✅ |
| CA-5 | `src/ingest/historico.ts` (`completeGoals`, línea «Goles incompletos»), `src/ingest/historico-db.ts` (guarda) | `historico.test.ts` «SPEC-094 CA-5 match_goals admits no gaps»; enriquecimiento: `explorer-enrichment.test.ts` «preserves existing goals if already populated» (sin cambios) | Vitest verde: plan en memoria 2–1 con gol sin minuto → `goalsComplete:false`, `replaceGoals:false`, «goles válidos 2 · sin minuto 1». Sin migración en el diff. e2e:db no corrido: el CA pide plan en memoria (guarda de `historico-db.ts` leída, aborta la fecha) | ✅ |
| CA-6 | `src/xornada/demo.ts` (Compostela 1 de 2, Albacete 3 de 2, Pontevedra sin minuto; Sevilla sin goleadores) | `src/xornada/demo.test.ts` «SPEC-094 CA-6…»; `e2e/xornada-goleadores.spec.ts` «SPEC-094 CA-6…» (360/1440, gl/es) y CA-5 de SPEC-068 con fila 0–0 | `npm run e2e` verde (incluye los 4 casos CA-6). Recorrido propio (Chromium local, `next start`): cada fila desplegada suma su marcador en gl/es × 360/1440; Sevilla 2–1 con 2 + 1 «gol»; Compostela 2–0 con 1 nombre + «gol»; Albacete 2–1 Cádiz deja fuera el 89'; 0–0 y sin empezar sin cajón | ✅ |
| CA-7 | `package.json` 0.12.0 (minor) | `npm run gates` y `npm run e2e` (ver handoff) | Worktree LF: `tsc --noEmit` OK, `biome check .` 510 ficheros sin errores, vitest 4867 verdes. Árbol principal: `next build` OK; `playwright test` 461 pasan, 1 skipped (5.2 min), sin reintentos. Sin hex nuevos en el diff; ningún `font:` shorthand en CSS de `src/` | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-11-23 (sdd-verificador).** CA-1..CA-7 ✅. Gates en verde (typecheck, lint, 4867 tests, build) y `npm run e2e` 461/461 sin reintentos. Recorrido real de `/demo/xornada` y `/es/demo/xornada` a 360 y 1440 px: en cada una de las 14 filas con cajón, cada lado suma su marcador; «gol» en ambos idiomas, distinguible por texto (mismo color y familia que un nombre); 0–0 y sin empezar sin cajón. Expectativas cambiadas (F-SPEC-094-1) revisadas: consecuencia directa de CA-4/CA-5/CA-6, aceptadas. F-SPEC-094-2: lectura del informe aceptada. F-SPEC-094-3: e2e:db no corrido, no lo exige ningún CA (CA-5 se prueba con plan en memoria).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-094/. Informe HTML opcional: _qa/SPEC-094/informe.html -->
| CA | Captura (`_qa/SPEC-094/`, para `{gl,es}` × `{360,1440}`) |
|---|---|
| CA-2, CA-3, CA-6 (sin ningún goleador) | `ca6-<idioma>-<ancho>-sevilla-fc-getafe-cf.png` |
| CA-6 (menos goleadores que goles) | `ca6-<idioma>-<ancho>-sd-compostela-ourense-cf.png` |
| CA-2, CA-6 (más goleadores que goles) | `ca6-<idioma>-<ancho>-albacete-balompie-cadiz-cf.png` |
| CA-4, CA-6 (gol sin minuto) | `ca6-<idioma>-<ancho>-pontevedra-cf-zamora-cf.png` |
| CA-6 (página entera, todas las filas desplegadas) | `ca6-<idioma>-<ancho>-pagina.png` |

## Salvedades / follow-ups
<!-- IDs F-SPEC-094-1, F-SPEC-094-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-094-1 (implementador): expectativas que cambian además de las que lista CA-6, por consecuencia directa de CA-4/CA-5/CA-6: `explorer-xornada.spec086.test.ts` «only the valid goals come out» (el gol con `minute: "x"` ahora sale sin minuto); `historico.test.ts` línea de «Goles incompletos» (añade «· sin minuto N»); `demo.test.ts` «every match with goals…» (ahora cuadra la lista pintada, no la cruda). En `goals.test.ts` varios casos de SPEC-068 solo cambian el marcador del fixture para que cuadre, sin tocar lo que esperan. Destino: verificador.
- F-SPEC-094-2 (implementador): en el informe, «goles válidos N» cuenta los goles con minuto y «sin minuto M» los que no lo tienen (los dos ya sin autor sintético). Destino: verificador / titular si prefiere otra lectura.
- F-SPEC-094-3 (implementador): `e2e/xornada-goleadores-historico.db.spec.ts` (e2e:db) no se ha corrido: requiere Supabase local en Docker. Destino: verificador.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho CA-1..CA-7 en `ft/SPEC-094-goleadores-cuadran` (commits por CA + chore). Sin push ni PR.
- Verificación del implementador: worktree LF (`D:/src/tremen-dev/wt-094`): `tsc --noEmit` OK, `biome check .` sin errores (510 ficheros), `vitest run` 4866/4867 (el fallo, `api/ingest/tick/route.test.ts` «imports with no environment variable», es timeout por carga: aislado 6/6). Árbol principal: `vitest run` 186 ficheros, 4867 pasan. `npm run e2e` (incluye `next build`): 461 pasan, 1 skipped (4.8m); una primera pasada dio 2 timeouts por carga (`xornada-controls` CA-6 sin JS y el e2e nuevo de CA-6, que se aligeró: sin esperar la transición, `setTimeout` 90 s); aislados, 67/67.
- Sigue: sdd-verificador (Playwright 360/1440 gl/es sobre `/demo/xornada`, captura de Sevilla con «gol»).
