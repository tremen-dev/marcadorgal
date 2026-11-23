---
id: SPEC-093
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-093 El tick no se cuelga ni calla ante un explorer lento o estancado

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-093-tick-robusto-explorer`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/tick.ts` (`withDeadline`, `fetchWithSignal`, `attemptTimeoutMs`), `src/ingest/constants.ts` (`SOURCE_ATTEMPT_TIMEOUT_MS`) | `src/ingest/tick.spec093.test.ts` › «SPEC-093 CA-1 the deadline of the attempt» (6 casos) | | ❌ |
| CA-2 | `src/ingest/salud.ts` (`isOrphan`, fila `sin cerrar`, razón), `src/ingest/constants.ts` (`SALUD_ORPHAN_MINUTES`) | `src/ingest/salud.test.ts` › «SPEC-093 CA-2 tickSalud sees the orphan attempt» (4 casos) | | ❌ |
| CA-3 | `src/model/source.ts` (`SourceReading`, `ParseResult.readings?`), `src/sources/rfef/explorer.ts` (`parseRequest`, `parse`) | `src/sources/rfef/explorer.test.ts` › «SPEC-093 CA-3 the readings of the source» (7 casos); ajustados con `said()` los 5 casos de SPEC-038 que comparaban el resultado entero | | ❌ |
| CA-4 | `src/ingest/tick.ts` (`readingAge`, veredicto en `runAttempt`, `details.ultimaLectura`/`edadLecturaMin`) | `src/ingest/tick.spec093.test.ts` › «SPEC-093 CA-4 the stalled source» (7 casos, uno sobre `export-local-2026-11-01.json` con el adaptador real y `tickSalud`) | | ❌ |
| CA-5 | `src/lib/explorer-client.ts` (`requiredEnv`), `src/sources/rfef/calendar.ts` (`requiredEnv`, origen leído en `fetch`), `tools/calendario-sync.mjs` (solo `RFEF_EXPLORER_TOKEN`, y sale 1 sin `RFEF_EXPLORER_URL`), `playwright.config.ts` (mock con `RFEF_EXPLORER_URL`) | `src/lib/explorer-sin-respaldo.test.ts` › «SPEC-093 CA-5 no silent fallback to explorer» (10 casos) y «… no alias and no fixed url in the code» (3 casos); `src/calendar/cli.test.ts` › «exits 1 without RFEF_EXPLORER_URL (SPEC-093 CA-5)»; `src/lib/explorer-client.test.ts` con `vi.stubEnv` | | ❌ |
| CA-6 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-093/. Informe HTML opcional: _qa/SPEC-093/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-093-1, F-SPEC-093-2… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
