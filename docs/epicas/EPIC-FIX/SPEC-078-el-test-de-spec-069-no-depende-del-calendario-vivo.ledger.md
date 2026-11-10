---
id: SPEC-078
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-078 El test de SPEC-069 no depende del calendario vivo

## Resumen
- Fase: borrador
- Rama: `ft/SPEC-078-test-spec069-sin-calendario-vivo`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | | | | ❌ |
| CA-2 | | | | ❌ |
| CA-3 | | | | ❌ |
| CA-4 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-078/. Informe HTML opcional: _qa/SPEC-078/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-078-1, F-SPEC-078-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-078-1** (EPIC-MEJORA): otras suites leen `data/calendario/**` vivo (`src/sources/rfef/adapter.test.ts`, `alias.test.ts`, `src/calendar/sync-rfef.test.ts`, `src/social/text.test.ts`, `src/arch/*`). Auditar cuáles deberían congelarlo.
- **F-SPEC-078-2** (EPIC-FIX): el CI del PR del bot (`chore/calendario`, run 42821507457) falla en 1 s por un problema del workflow y no corre los gates. Así entró este rojo en `main`.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
