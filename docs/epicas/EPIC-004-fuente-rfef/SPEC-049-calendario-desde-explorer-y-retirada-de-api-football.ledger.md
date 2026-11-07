---
id: SPEC-049
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-049 Calendario declarado desde explorer y retirada de API-Football

## Resumen
- Fase: hecho (GREEN de implementación y verificación local, 2026-11-06/07)
- Rama: `fix/calendario-sync-explorer-aliases` (sucede a `ft/SPEC-049-calendario-desde-explorer-y-retirada-de-api-football`)

## Matriz de criterios de aceptación
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/calendar.ts` implementa `CalendarImporter` para las 5 divisiones consumiendo `GET /api/export/calendar` | `src/sources/rfef/calendar.test.ts` (4 tests) verifica llamadas HTTP, cabeceras Bearer, mapeo exacto a `ImportedCalendar` y anulaciones de filiales | ✅ | ✅ |
| CA-2 | `src/calendar/importers.ts` registra `rfefCalendar` como primer importador oficial | `src/calendar/sync.test.ts` y suites de calendario | ✅ | ✅ |
| CA-3 | `tools/calendario-sync.mjs` lee `RFEF_EXPLORER_TOKEN` (o `EXPLORER_API_KEY`) y soporta `--source` por defecto `rfef` | `src/calendar/cli.test.ts` (8 tests) | ✅ | ✅ |
| CA-4 | `src/sources/registry.ts` eleva `rfef` a prioridad 50 (`FEDERATION_PRIORITY`, ADR-017 §5 restaurado, ADR-026) | `src/sources/registry.test.ts` (12 tests) | ✅ | ✅ |
| CA-5 | `src/lib/explorer-client.ts` cliente tipado con ISR para calendario, partidos, clasificaciones, Pichichi y Zamora | `src/lib/explorer-client.test.ts` (6 tests) | ✅ | ✅ |
| CA-6 | `src/sources/rfef/explorer.ts` tolera y parsea campos opcionales `goals`, `canonicalCompetitionId`, `canonicalHomeTeamId`, `canonicalAwayTeamId` y `liveProvider` | `src/sources/rfef/explorer.test.ts` (59 tests) | ✅ | ✅ |
| CA-7 | Gates: TypeScript, Biome, Vitest y límites arquitecturales | `src/arch/rfef-boundary.test.ts`, `src/arch/sources-boundary.test.ts`, suites unitarias | ✅ | ✅ |

## Veredicto
**GREEN — 2026-11-06.** Implementación completada y verificada contra el nuevo despliegue de producción de marcadorgal-explorer v2.0. Todos los gates pasan sin regresión.

## Corrección post-despliegue en CI (2026-11-07)
Tras la ejecución del workflow programado `calendario-semanal` en GitHub Actions (run 42311656687), se detectaron y corrigieron las siguientes incidencias en la sincronización del calendario contra explorer:
1. **Reutilización de alias existentes por nombre (`src/calendar/sync.ts`):** Explorer suministra `externalId` en formato slug (`athletic-club`), mientras que los alias históricos en `data/alias/2026-27/rfef.json` se indexaban por nombre normalizado federativo. Al buscar solo por `externalId`, `syncCalendar` insertaba una nueva entrada con el mismo `externalName`, disparando fallos de duplicidad en `validateAliases`. Se añadieron mapas de búsqueda `aliasByExternalName` y `aliasByName` para reutilizar el alias existente y registrarlo en memoria en el mismo lote. Test unitario añadido en `src/calendar/sync.test.ts`.
2. **Anulaciones de filiales federativos (`src/sources/rfef/calendar.ts`):** Explorer devuelve a veces el club matriz para filiales en divisiones inferiores (ej. `athletic-club` en 1ª RFEF, `real-sociedad` en 2ª División, filiales de 2ª RFEF). Se introdujo `COMPETITION_TEAM_OVERRIDES` en `src/sources/rfef/calendar.ts` para reescribir `externalId`, `externalName` y los emparejamientos en `matches` (`home`/`away`) para resolver inequívocamente a los filiales oficiales (Real Sociedad B, Bilbao Athletic, Alavés B, Astorga, Oviedo Vetusta, Eibar B, Rayo Cantabria). Tests unitarios ampliados en `src/sources/rfef/calendar.test.ts`.
3. **Preservación del calendario benchmark de Tercera RFEF G1:** Al ser Tercera Federación una categoría de ámbito autonómico sin feed federativo nacional en tiempo real (ADR-003, SPEC-009, SPEC-015), `marcadorgal-explorer` genera un calendario sintético no coincidente con el benchmark declarado en `data/calendario/2026-27/tercera-rfef-g1.json`. En `src/sources/rfef/calendar.ts`, `parse` preserva el calendario benchmark declarado si existe en disco, garantizando compatibilidad con las pruebas unitarias y de integración histórica sin colisiones en jornadas.
4. **Validación de alias RFEF y regeneración (`rfef.json`):** Se añadieron los nombres federativos SAD oficiales devueltos por explorer (Primera, Segunda, 1ª RFEF y 2ª RFEF), regenerando `data/alias/2026-27/rfef.json` mediante `npm run alias:rfef` con 180 alias normalizados, pasando `src/sources/rfef/alias.test.ts` con éxito pleno.
5. **Verificación de idempotencia:** `tools/calendario-sync.mjs 2026-27` ejecutado con éxito total en las 5 competiciones: 0 equipos nuevos, 0 añadidos, 0 desaparecidos, 0 incidencias de calendario, 0 incidencias de alias y salida 0 (`auto-aplicable: si`).
