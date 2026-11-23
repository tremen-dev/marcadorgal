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
| CA-3 | | | | ❌ |
| CA-4 | | | | ❌ |
| CA-5 | | | | ❌ |
| CA-6 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-093/. Informe HTML opcional: _qa/SPEC-093/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-093-1, F-SPEC-093-2… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
