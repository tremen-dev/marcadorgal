---
id: SPEC-016
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-016 RN-02 por fuente: aplazado y suspendido sin operador

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-016-rn-02-por-fuente-aplazado-y-suspendido-sin-operador`

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
| CA-5 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-016/. Informe HTML opcional: _qa/SPEC-016/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-016-1, F-SPEC-016-2… con destino (spec futura o EPIC-MEJORA). -->
- **R-SPEC-016-1** (hallazgo de campo del 2026-10-03; lo registra sdd-arquitecto el 2026-10-04).
  - Partido: `segunda-division-2026-27-j8-sabadell-andorra`.
  - Estado en `dev`: 319 observaciones `postponed` (`PST`, `fixture.id 1569958`), 0 Decisions y `board.status = scheduled` con kickoff `2026-10-03T16:30Z` ya pasado.
  - Evidencia: `_qa/RN-02-postponed/medicion.md`.
  - Esta spec no lo corrige: `replay:jornada --aplicar` solo corrige `finished` y la ventana ya se cerró. Se arregla solo si el partido se reprograma, porque `calendario:load` mueve el kickoff y abre la ventana otra vez.
  - Destino: **H-3 de ADR-012**, del titular. Debe resolverse antes de que EPIC-003 publique `board`.
  - Mientras siga así, el informe de la jornada del 2026-10-02/04 lo cuenta como discrepancia c2-ii (N-4 de la spec).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
