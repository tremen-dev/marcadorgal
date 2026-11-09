---
id: SPEC-069
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-069 La rfef acepta cualquier liveProvider de explorer

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-069-rfef-acepta-cualquier-live-provider`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/explorer.ts` (`liveProvider: z.string().min(1).optional()` + comentario de valores conocidos) | `src/sources/rfef/explorer.test.ts › SPEC-069` › «CA-1 liveProvider: "" still rejects…», «CA-1 known and unknown providers validate…» | | ❌ |
| CA-2 | `src/sources/rfef/fixtures/export/export-2026-11-09-proveedores.json` (+ README) | `src/sources/rfef/explorer.test.ts › SPEC-069` › «CA-2 the fixture has…», «CA-2 the export parses…», «CA-2 all its observations come out…» | | ❌ |
| CA-3 | sin cambio de código en el mapeo | tests previos de `explorer.test.ts` sin tocar (251/251 en `src/sources/rfef`); volcado sha256 de ParseResult de los 6 fixtures antes/después: idéntico (ver Evidencia) | | ❌ |
| CA-4 | `src/lib/explorer-client.ts`, `src/lib/explorer-matches.ts` (`liveProvider?: string`) | `npm run typecheck` → 0 (local y en gates Docker) | | ❌ |
| CA-5 | `src/sources/rfef/explorer.ts` (enums `ExplorerStatus` y `goals[].team` sin tocar; comentario) | `src/sources/rfef/explorer.test.ts › SPEC-069` › «CA-5 estado: "HALFTIME"…», «CA-5 goals[].team: "neutral"…» | | ❌ |
| CA-6 | diff solo en explorer.ts, explorer-client.ts, explorer-matches.ts, test, fixture y README del fixture | `git diff --stat d019897..HEAD` (ver Evidencia); `npm run gates` en Docker → 0 sobre `git archive` de 09a8f54 en `mcr.microsoft.com/playwright:v1.63.0-noble` (typecheck 0; lint 401 ficheros sin errores; test 142 ficheros, 2303 passed, 3 skipped; build OK; `GATES_EXIT=0`) | | ❌ |
| CA-7 | pendiente de despliegue (fuera de esta entrega) |  | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-069/. Informe HTML opcional: _qa/SPEC-069/informe.html -->
Sin UI. Evidencia de comando (implementador):

- RED antes del arreglo (`npx vitest run src/sources/rfef/explorer.test.ts -t SPEC-069`): 3 fallos; el CA-2 da `export: matches.0.liveProvider: Invalid option: expected one of "marca"|"rfef"; matches.1.liveProvider: …` — el mismo error que producción.
- CA-3, ParseResult de cada fixture (obs/skipped/unresolved/errors, sha256[0:16] del JSON), idéntico en d019897 (src igual a 6148242) y en 09a8f54:
  `export-2026-10-31` 16/0/0/0 `83d82713769541c1` · `export-2026-11-01` 28/0/0/0 `4ba3ced4c0d5be4e` · `export-2026-11-02` 0/0/0/0 `d94584603529124d` · `export-local-2026-10-31` 14/0/0/0 `48df930e0d64e020` · `export-local-2026-11-01` 15/5/0/0 `bff4c8cf079b6c4c` · `export-local-2026-11-02` 0/0/0/0 `d94584603529124d`.
- Fixture nuevo → 1 observación (Sabadell–Real Sociedad B `live` 0-0, descanso), 1 `skipped ambiguous_state` (Las Palmas–Eldense), 1 `unresolved unknown_match` (Liga F, `marca-grupo`), 0 `requestErrors`.
- CA-6 `git diff --stat d019897..HEAD`: explorer-client.ts 3, explorer-matches.ts 3, explorer.test.ts 115, explorer.ts 9, fixtures/export/README.md 12, export-2026-11-09-proveedores.json 1 (+ la spec por estado.mjs); `-- src/decide src/model supabase` vacío.

## Salvedades / follow-ups
<!-- IDs F-SPEC-069-1, F-SPEC-069-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-069-1 (fixture del 11-09, no del 11-08).** La spec pide basarlo en un crudo real del 2026-11-08; el único crudo con `"espn"` a mano es el export desplegado del 2026-11-09 20:34Z (QA de SPEC-039, `export-2026-11-09-dia-2034Z.json`); el del 11-08 (`export-2026-11-08-acta.json`, capturado el 11-09 11:42Z) solo trae `rfef`/`marca`. Se usó el del 11-09 con un campo cambiado (documentado en el README del fixture). Destino: ninguno, salvo que el verificador lo objete.
- **F-SPEC-069-2 (partido aplazado y rejugado sale `ambiguous_state`).** Las Palmas–Eldense (Segunda j13) se aplazó el 11-08 y se jugó el 11-09; el calendario declarado conserva el kickoff `2026-11-08T17:30:00Z`, así que la fila `LIVE_PROVISIONAL` del 11-09 cae fuera de ventana y no da observación. No es de esta spec (no depende de `liveProvider`). Destino: EPIC-MANT/EPIC-FIX (reprogramación de kickoff en el calendario).
- **F-SPEC-069-3 (filas de Liga F vía MARCA dan `unresolved`).** Explorer exporta filas `codGrupo: "marca-grupo"` con `canonicalCompetitionId: "liga-f"`; salen `unknown_match` en cada tick. Ruido, no fallo. Destino: EPIC-MEJORA (ignorar competiciones fuera del mapa también por `canonicalCompetitionId`).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-6 implementados en la rama `ft/SPEC-069-rfef-acepta-cualquier-live-provider` (worktree `D:\src	remen-dev\wt-069`), commits locales sin push. Falta: verificación, push/PR/merge y despliegue (orquestador); después, CA-7 (consulta de solo lectura a `ingest_attempts` ≥ 1 h de partidos en juego tras el despliegue, con id y sha del despliegue).
