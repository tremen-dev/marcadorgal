---
id: SPEC-052
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-052 Minuto de juego y descanso desde la fuente explorer

## Resumen
- Fase: hecho
- Rama: `ft/SPEC-052-minuto-y-descanso-desde-explorer`

## Matriz de criterios de aceptación
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/explorer.ts` (`ExplorerMatch`) reconoce `minute`, `addedMinute` y `halfTime` | `src/sources/rfef/explorer.test.ts` (63 tests) | ✅ | ✅ |
| CA-2 | `src/sources/rfef/explorer.ts` (`rowState`) mapea a observación en `LIVE_PROVISIONAL` con acotación defensiva de minuto y añadido | `src/sources/rfef/explorer.test.ts` | ✅ | ✅ |
| CA-3 | `src/lib/explorer-client.ts` (`DayMatchesResponse`) añade los campos opcionales tipados | Typecheck | ✅ | ✅ |
| CA-4 | `src/sources/rfef/explorer.test.ts` añade tests para minuto, añadido, descuento acotado y descanso | `src/sources/rfef/explorer.test.ts` | ✅ | ✅ |
| CA-5 | Gates completos (`npm run gates`) | `typecheck` + `lint` + 2.194 tests `vitest` + `next build` en verde | ✅ | ✅ |

## Veredicto
**GREEN — 2026-11-07.** Implementación completada y verificada. El adaptador reconoce y propaga el minuto, descuento y descanso cuando Explorer los emite en el export, preservando compatibilidad retroactiva absoluta con fixtures sin dichos campos.
