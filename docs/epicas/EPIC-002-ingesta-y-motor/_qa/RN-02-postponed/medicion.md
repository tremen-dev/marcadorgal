# Medición: `postponed`/`suspended` de fuente sin Decision (RN-02, ADR-012)

> Solo lectura, 2026-10-04. Cero peticiones al proveedor, cero escrituras, cero
> ticks. `dev` en transacción `read only` (`show transaction_read_only` → `on`)
> y dos GET al bucket `raw` (Storage, no el proveedor). Script en el scratchpad
> de la sesión, no en el repo.

## Alcance de «toda la temporada»

Lo que `dev` tiene guardado: **71 partidos** con observaciones, **15 572
observaciones**, de `2026-09-22T22:02:38Z` a `2026-10-04T15:05:41Z`; **5 456
Decisions** sobre 70 partidos.

| Estado | Observaciones | Partidos | Decisions |
|---|---|---|---|
| `scheduled` | 2 910 | 66 | 67 |
| `live` | 12 232 | 61 | 5 313 |
| `finished` | 111 | 52 | 76 |
| `postponed` | **319** | **1** | **0** |
| `suspended` | 0 | 0 | 0 |

## El caso

| Campo | Valor |
|---|---|
| Partido | `segunda-division-2026-27-j8-sabadell-andorra` |
| Kickoff | `2026-10-03T16:30:00Z` |
| Observaciones `postponed` | 319, todas de `api-football` (prioridad 10) |
| Primera / última | `16:20:25.643Z` / `18:59:34.721Z` = ventana entera (kickoff −10 → +150) |
| Intentos de tick en ese intervalo | 319 (`ingest_attempts`): una observación por tick |
| Observaciones de otro estado antes | 0 (el `PST` ya estaba al abrir la ventana) |
| Observaciones `live` / `finished` después | **0 / 0** |
| Decisions del partido | 0 (ni `postponed` ni ninguna otra) |
| Alertas del partido | 0 |
| `board.status` | `scheduled` (sin Decision: `coalesce` de la vista) |
| Crudo, primera y última captura | `status.short = "PST"`, «Match Postponed», `fixture.id 1569958`, `date 2026-10-03T16:30:00+00:00` (sin fecha nueva) |

Crudos: `raw/api-football/2026-10-03/2026-10-03T16-20-25.643Z-bc77ea97-….json.gz`
y `…/2026-10-03T18-59-34.721Z-b44e0369-….json.gz`. Se purgan el **2026-11-02**
(ADR-007, 30 días); las `observations` no.

## Lectura

- **1 de 71 partidos** tiene `postponed`/`suspended` de fuente sin Decision
  equivalente: este. **0 volvieron a jugarse**: ninguna observación `live` ni
  `finished` posterior. No hay ningún `PST` erróneo medido: n = 1, sin contraejemplo.
- El motor hace lo que dice RN-02 (`transitionAllowed`, `src/decide/engine.ts`:
  `postponed`/`suspended` exigen prioridad ≥ 50). Es un **defecto de regla**,
  no de implementación (SPEC-009 N-9, rama c2-ii), como RN-03 en ADR-011.
- Sin Decision, el partido queda `scheduled` con kickoff pasado hasta que el
  calendario le dé fecha nueva: no sale de ahí por sí solo (residual
  R-SPEC-016-1).
