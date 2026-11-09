---
id: SPEC-053
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-053 Ampliar ventana de directo en Explorer para cubrir descuentos

## Resumen
- Fase: completada
- Rama: `ft/SPEC-053-ampliar-ventana-live-explorer`

## Matriz de criterios de aceptación
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/state.ts` (`LIVE_AFTER_MINUTES = 130`) | `src/sources/rfef/state.test.ts` | 2026-11-07 | ✅ |
| CA-2 | `src/sources/rfef/explorer.ts` (ventana extendida 140 min con minuto explícito o descanso) | `src/sources/rfef/explorer.test.ts` | 2026-11-07 | ✅ |
| CA-3 | `src/sources/rfef/state.test.ts`, `src/sources/rfef/explorer.test.ts` | Suites unitarias de rfef | 2026-11-07 | ✅ |
| CA-4 | Gates completos (`npm run gates`) | CI local | 2026-11-07 | ✅ |
