---
id: SPEC-049
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-049 Calendario declarado desde explorer y retirada de API-Football

## Resumen
- Fase: hecho (GREEN de implementación y verificación local, 2026-11-06)
- Rama: `ft/SPEC-049-calendario-desde-explorer-y-retirada-de-api-football`

## Matriz de criterios de aceptación
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/calendar.ts` implementa `CalendarImporter` para las 5 divisiones consumiendo `GET /api/export/calendar` | `src/sources/rfef/calendar.test.ts` (3 tests) verifica llamadas HTTP, cabeceras Bearer y mapeo exacto a `ImportedCalendar` | ✅ | ✅ |
| CA-2 | `src/calendar/importers.ts` registra `rfefCalendar` como primer importador oficial | `src/calendar/sync.test.ts` y suites de calendario | ✅ | ✅ |
| CA-3 | `tools/calendario-sync.mjs` lee `RFEF_EXPLORER_TOKEN` (o `EXPLORER_API_KEY`) y soporta `--source` por defecto `rfef` | `src/calendar/cli.test.ts` (8 tests) | ✅ | ✅ |
| CA-4 | `src/sources/registry.ts` eleva `rfef` a prioridad 50 (`FEDERATION_PRIORITY`, ADR-017 §5 restaurado, ADR-026) | `src/sources/registry.test.ts` (12 tests) | ✅ | ✅ |
| CA-5 | `src/lib/explorer-client.ts` cliente tipado con ISR para calendario, partidos, clasificaciones, Pichichi y Zamora | `src/lib/explorer-client.test.ts` (6 tests) | ✅ | ✅ |
| CA-6 | `src/sources/rfef/explorer.ts` tolera y parsea campos opcionales `goals`, `canonicalCompetitionId`, `canonicalHomeTeamId`, `canonicalAwayTeamId` y `liveProvider` | `src/sources/rfef/explorer.test.ts` (59 tests) | ✅ | ✅ |
| CA-7 | Gates: TypeScript, Biome, Vitest y límites arquitecturales | `src/arch/rfef-boundary.test.ts`, `src/arch/sources-boundary.test.ts`, suites unitarias | ✅ | ✅ |

## Veredicto
**GREEN — 2026-11-06.** Implementación completada y verificada contra el nuevo despliegue de producción de marcadorgal-explorer v2.0. Todos los gates pasan sin regresión.
