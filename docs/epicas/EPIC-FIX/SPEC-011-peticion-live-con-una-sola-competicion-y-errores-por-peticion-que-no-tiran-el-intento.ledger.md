---
id: SPEC-011
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-011 Petición live= con una sola competición y errores por petición que no tiran el intento

## Resumen
- Fase: borrador (escrita el 2026-09-23 por sdd-arquitecto; aprobación pendiente del gate humano)
- Rama: `ft/EPIC-FIX-live-una-sola-competicion` (ya creada desde `origin/main` en `e0a88dc`; la spec se escribió sobre ella y no sobre `ft/SPEC-011-…`)
- Plazo: **mergeada en `main` antes del viernes 2026-09-25 18:20Z** (H-1)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 `live=` nunca con menos de dos ids | | | | ❌ |
| CA-2 `parse` total: `requestErrors` | | | | ❌ |
| CA-3 invariante sobre los 31 subconjuntos | | | | ❌ |
| CA-4 fixture del error real y regresión | | | | ❌ |
| CA-5 intento parcial: se guarda y `ok = false` | | | | ❌ |
| CA-6 presupuesto, frontera y gates | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-011/. Informe HTML opcional: _qa/SPEC-011/informe.html -->

## Evidencia de campo del fallo (2026-09-22, ensayo de CA-6 de SPEC-009)
<!-- Rellenar con la clave del objeto del bucket del intento fallido del que sale el fixture de CA-4 (N-5: la clave va aquí, nunca en el fixture), y con los identificadores de las filas de ingest_attempts de la frontera 22:07:06Z ok / 22:07:38Z primer fallo / 23 fallos seguidos. -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-011-1, F-SPEC-011-2… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
