---
id: SPEC-062
tipo: ledger
epica: EPIC-004
---
# Ledger de SPEC-062 — Extracción de la lógica de API-Football hacia MarcadorGal Explorer

Criterios de aceptación y evidencia de verificación de SPEC-062.

| Criterio | Módulos afectados | Pruebas | Estado |
| :--- | :--- | :--- | :--- |
| CA-1 Desacoplamiento del núcleo de ingesta y adaptadores | `src/sources/registry.ts`, `src/ingest/adapters.ts`, `src/decide/engine.ts` | `src/sources/registry.test.ts`, `src/ingest/adapters.test.ts`, `src/ingest/engine.test.ts` | ✅ Verificado |
| CA-2 Desacoplamiento de importadores de calendario | `src/calendar/importers.ts`, `src/sources/rfef/calendar.ts` | `src/calendar/importers.test.ts`, `src/calendar/cli.test.ts` | ✅ Verificado |
| CA-3 Saneamiento de herramientas CLI y variables de entorno | `.env.example`, `.github/workflows/calendario-semanal.yml`, `tools/calendario-sync.mjs`, `tools/informe-jornada.mjs`, `tools/reconciliar-cierre.mjs`, `tools/reconciliar-sin-directo.mjs`, `tools/legacy-api-football.mjs` | `src/calendar/cli.test.ts`, `src/arch/deploy.test.ts` | ✅ Verificado |
| CA-4 Aislamiento y retirada del directorio `src/sources/api-football/` | `src/sources/api-football/` (eliminado), `src/decide/fixtures/girona-albacete-observations.ts`, `src/medicion/goal-events.ts`, `src/medicion/fixtures/live-2026-09-26.json` | `src/decide/replay.test.ts`, `src/medicion/goal-events.test.ts`, `src/medicion/informe.test.ts` | ✅ Verificado |
| CA-5 Actualización de tests de arquitectura y contratos | `src/arch/deploy.test.ts`, `src/arch/sources-boundary.test.ts`, `src/arch/source-contract.test.ts` | `src/arch/deploy.test.ts`, `src/arch/sources-boundary.test.ts`, `src/arch/source-contract.test.ts` | ✅ Verificado |
| CA-6 Gates en verde | Suite completa (`npm run gates`) | `typecheck`, `lint`, 139 suites vitest (2.151 tests) y `next build` 100% en verde | ✅ Verificado |

## Evidencia de Verificación

- **CA-1 Desacoplamiento del núcleo de ingesta y adaptadores:**
  - `api-football` retirado de `SOURCES` en `src/sources/registry.ts`; `rfef` queda como la única fuente en el registro con prioridad 50 (`FEDERATION_PRIORITY`).
  - `createApiFootballResults` retirado de `ADAPTERS` en `src/ingest/adapters.ts`. `adapterFor("api-football")` responde `undefined`.
  - En `src/decide/engine.ts`, se preservó la regla de retirada de gol por fuente de menor prioridad (RN-03: `priority(owner) ?? (owner === LEGACY_OWNER ? 10 : undefined)`) para que las filas históricas grabadas originalmente por `api-football` puedan ser corregidas o sobreescritas por RFEF sin falsas alarmas de regresión de gol.
- **CA-2 Desacoplamiento de importadores de calendario:**
  - `apiFootballCalendar` retirado de `IMPORTERS` en `src/calendar/importers.ts`; `rfefCalendar` queda como único importador de calendario.
  - Sincronización semanal y tools delegan en Explorer mediante `RFEF_EXPLORER_TOKEN`.
- **CA-3 Saneamiento de herramientas CLI y variables de entorno:**
  - `API_FOOTBALL_KEY` eliminado de `.env.example`.
  - Workflow de GitHub Actions `.github/workflows/calendario-semanal.yml` actualizado para usar `RFEF_EXPLORER_TOKEN`.
  - `tools/calendario-sync.mjs` no requiere ni soporta `--source api-football`.
  - Para los scripts de mantenimiento y auditoría histórica (`tools/informe-jornada.mjs`, `tools/reconciliar-cierre.mjs`, `tools/reconciliar-sin-directo.mjs`), se extrajo `tools/legacy-api-football.mjs` como cargador aislado y puramente histórico sin dependencias de producción.
- **CA-4 Aislamiento y retirada del directorio `src/sources/api-football/`:**
  - Se eliminaron los 14 archivos que componían `src/sources/api-football/` (`calendar.ts`, `events.ts`, `results.ts` y sus pruebas).
  - En `src/decide/replay.test.ts`, se reemplazó el parseo en tiempo de ejecución por la fixture estática `src/decide/fixtures/girona-albacete-observations.ts`.
  - En `src/medicion/goal-events.ts` y `src/medicion/fixtures/live-2026-09-26.json`, se independizó la extracción de eventos para informes de latencia histórica.
- **CA-5 Actualización de tests de arquitectura y contratos:**
  - `src/arch/sources-boundary.test.ts` verifica que sólo `rfef` reside en `src/sources/` y que no existen importaciones ni acoplamientos residuales.
  - `src/arch/deploy.test.ts` valida que `.env.example` y los workflows no exigen `API_FOOTBALL_KEY`.
  - Se adaptaron los dobles de test en `src/ingest/contraste.test.ts`, `src/ingest/tick.test.ts`, `src/ingest/reconciliacion.test.ts`, etc.
- **CA-6 Gates en verde:**
  - Ejecución de `npm run gates` (`typecheck`, `biome check .`, `vitest run`, `next build`) completada con 0 advertencias, 0 errores, 139 suites de vitest y 2.151 tests pasando.
