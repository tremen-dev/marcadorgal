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
| CA-1 | `src/xornada/scorers.ts` (`squareGoals`); `src/model/public.ts` (`PublicGoal.minute` opcional) | `src/xornada/scorers.test.ts` «SPEC-094 CA-1 squareGoals» (10 casos) | | ❌ |
| CA-2 | `src/components/goals/TeamGoals.tsx` (prop `lines`), `src/components/xornada/MatchRow.tsx`, `src/components/directos/DirectosView.tsx` | `src/components/xornada/goals.test.ts` «SPEC-094 CA-2…» y los dos casos H-1 cambiados; `src/components/directos/DirectosView.test.ts` «SPEC-094 CA-2…» | | ❌ |
| CA-3 | `TeamGoals.tsx` (`data-unknown`, minuto vacío); `src/i18n/gl.ts`, `src/i18n/es.ts` (`xornada.goalUnknown`) | `goals.test.ts` «SPEC-094 CA-3 the line without author»; e2e `xornada-goleadores.spec.ts` «SPEC-094 CA-6» (color `--fg-muted`) | | ❌ |
| CA-4 | `src/lib/explorer-enrichment.ts` (`sanitizeGoals`), `src/sources/rfef/explorer.ts` (`ExplorerGoal`), `src/lib/explorer-matches.ts` (`TransformedGoal`), `src/lib/explorer-client.ts` | `explorer-enrichment.test.ts` «SPEC-094 CA-4 sanitizeGoals…»; `explorer.test.ts` «SPEC-094 CA-4 a goal without minute in the export»; `goals.test.ts` «SPEC-094 CA-4 a goal without minute» | | ❌ |
| CA-5 | `src/ingest/historico.ts` (`completeGoals`, línea «Goles incompletos»), `src/ingest/historico-db.ts` (guarda) | `historico.test.ts` «SPEC-094 CA-5 match_goals admits no gaps»; enriquecimiento: `explorer-enrichment.test.ts` «preserves existing goals if already populated» (sin cambios) | | ❌ |
| CA-6 | `src/xornada/demo.ts` (Compostela 1 de 2, Albacete 3 de 2, Pontevedra sin minuto; Sevilla sin goleadores) | `src/xornada/demo.test.ts` «SPEC-094 CA-6…»; `e2e/xornada-goleadores.spec.ts` «SPEC-094 CA-6…» (360/1440, gl/es) y CA-5 de SPEC-068 con fila 0–0 | | ❌ |
| CA-7 | `package.json` 0.12.0 (minor) | `npm run gates` y `npm run e2e` (ver handoff) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-094/. Informe HTML opcional: _qa/SPEC-094/informe.html -->

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
