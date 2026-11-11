---
id: SPEC-062
tipo: ledger
epica: EPIC-004
---
# Ledger de SPEC-062 — Extracción de la lógica de API-Football hacia MarcadorGal Explorer

Criterios de aceptación y evidencia de verificación de SPEC-062.

| Criterio | Módulos afectados | Pruebas | Estado |
| :--- | :--- | :--- | :--- |
| CA-1 Desacoplamiento del núcleo de ingesta y adaptadores | `src/sources/registry.ts`, `src/ingest/adapters.ts`, `src/decide/engine.ts` | `src/sources/registry.test.ts` (`SOURCES` = `[rfef]`, `sourceConfig("api-football")` undefined), `src/ingest/rfef-alta.test.ts` (`ADAPTERS` = `["rfef"]`) | ✅ Verificado (2.ª verif. 2026-11-11, GREEN) |
| CA-2 Desacoplamiento de importadores de calendario | `src/calendar/importers.ts`, `src/sources/rfef/calendar.ts` | `src/calendar/importers.test.ts` (nuevo: `IMPORTERS` = `[rfefCalendar]`, `importerFor("api-football")` undefined), `src/calendar/cli.test.ts` | ✅ Verificado (2.ª verif. 2026-11-11, GREEN) |
| CA-3 Saneamiento de herramientas CLI y variables de entorno | `.env.example`, `.github/workflows/calendario-semanal.yml`, `tools/calendario-sync.mjs`, `tools/informe-jornada.mjs`, `tools/reconciliar-cierre.mjs`, `tools/reconciliar-sin-directo.mjs`, `tools/legacy-api-football.mjs` | `src/calendar/cli.test.ts` (sale 1 sin `RFEF_EXPLORER_TOKEN`), `src/arch/deploy.test.ts` (workflow con `RFEF_EXPLORER_TOKEN`; nuevo «SPEC-062 CA-3 no API_FOOTBALL_KEY in env template or workflows») | ✅ Verificado (2.ª verif. 2026-11-11, GREEN) |
| CA-4 Aislamiento y retirada del directorio `src/sources/api-football/` | `src/sources/api-football/` (eliminado), `src/decide/fixtures/girona-albacete-observations.ts`, `src/medicion/goal-events.ts`, `src/medicion/fixtures/live-2026-09-26.json` | `src/decide/replay.test.ts`, `src/ingest/goal-events.test.ts`, `src/medicion/generar-informe.db.test.ts` (suite db, fuera de `npm run gates`) | ✅ Verificado (2.ª verif. 2026-11-11, GREEN) |
| CA-5 Actualización de tests de arquitectura y contratos | `src/arch/deploy.test.ts`, `src/arch/sources-boundary.test.ts`, `src/arch/source-contract.test.ts` | `src/arch/sources-boundary.test.ts` (nuevo «SPEC-062 CA-5 no coupling to api-football»: no existe `src/sources/api-football`, nada bajo `src/` importa `api-football`), `src/arch/deploy.test.ts` (CA-3), `src/arch/source-contract.test.ts` (sin usos de api-football) | ✅ Verificado (2.ª verif. 2026-11-11, GREEN) |
| CA-6 Gates en verde | Suite completa (`npm run gates`) | `npm run gates` en `71a97fd`: ver evidencia CA-6 | ✅ Verificado (2.ª verif. 2026-11-11, GREEN) |

## Evidencia de Verificación

- **CA-1 Desacoplamiento del núcleo de ingesta y adaptadores:**
  - `api-football` retirado de `SOURCES` en `src/sources/registry.ts`; `rfef` queda como la única fuente en el registro con prioridad 50 (`FEDERATION_PRIORITY`).
  - `createApiFootballResults` retirado de `ADAPTERS` en `src/ingest/adapters.ts`. `adapterFor("api-football")` responde `undefined`.
  - En `src/decide/engine.ts`, se preservó la regla de retirada de gol por fuente de menor prioridad (RN-03: `priority(owner) ?? (owner === LEGACY_OWNER ? 10 : undefined)`) para que las filas históricas grabadas originalmente por `api-football` puedan ser corregidas o sobreescritas por RFEF sin falsas alarmas de regresión de gol.
- **CA-2 Desacoplamiento de importadores de calendario:**
  - `apiFootballCalendar` retirado de `IMPORTERS` en `src/calendar/importers.ts`; `rfefCalendar` queda como único importador de calendario.
  - Sincronización semanal y tools delegan en Explorer mediante `RFEF_EXPLORER_TOKEN`.
  - Fijado por `src/calendar/importers.test.ts` › «SPEC-062 CA-2 calendar importers»: `IMPORTERS` `toEqual([rfefCalendar])`, `importerFor("rfef")` es `rfefCalendar` e `importerFor("api-football")` es `undefined`.
- **CA-3 Saneamiento de herramientas CLI y variables de entorno:**
  - `API_FOOTBALL_KEY` eliminado de `.env.example`.
  - Workflow de GitHub Actions `.github/workflows/calendario-semanal.yml` actualizado para usar `RFEF_EXPLORER_TOKEN`.
  - `tools/calendario-sync.mjs` no requiere ni soporta `--source api-football`.
  - Para los scripts de mantenimiento y auditoría histórica (`tools/informe-jornada.mjs`, `tools/reconciliar-cierre.mjs`, `tools/reconciliar-sin-directo.mjs`), se extrajo `tools/legacy-api-football.mjs` como cargador aislado y puramente histórico sin dependencias de producción.
- **CA-4 Aislamiento y retirada del directorio `src/sources/api-football/`:**
  - Se eliminaron los 14 archivos que componían `src/sources/api-football/` (`calendar.ts`, `events.ts`, `results.ts` y sus pruebas).
  - En `src/decide/replay.test.ts`, se reemplazó el parseo en tiempo de ejecución por la fixture estática `src/decide/fixtures/girona-albacete-observations.ts`.
  - En `src/medicion/goal-events.ts` y `src/medicion/fixtures/live-2026-09-26.json`, se independizó la extracción de eventos para informes de latencia histórica; lo ejercita `src/medicion/generar-informe.db.test.ts` (suite db). Retirada del directorio fijada por `src/arch/sources-boundary.test.ts` (CA-5).
- **CA-5 Actualización de tests de arquitectura y contratos:**
  - `src/arch/sources-boundary.test.ts` › «SPEC-062 CA-5 no coupling to api-football»: `src/sources/api-football` no existe y ningún fichero `.ts/.tsx` bajo `src/` tiene un import (estático, dinámico o re-export, vía `ts.preProcessFile`) cuyo especificador contenga `api-football`.
  - `src/arch/deploy.test.ts` › «SPEC-062 CA-3 no API_FOOTBALL_KEY in env template or workflows»: `.env.example` y cada `.github/workflows/*.yml` no contienen `API_FOOTBALL_KEY` (`REMOTE_SECRETS` de `src/db/env.ts` lo conserva solo para vaciarlo, permitido por CA-3).
  - Se adaptaron los dobles de test en `src/ingest/contraste.test.ts`, `src/ingest/tick.test.ts`, `src/ingest/reconciliacion.test.ts`, etc.
- **CA-6 Gates en verde:**
  - `npm run gates` en `71a97fd` → `EXIT=0`: `tsc --noEmit` sin salida; `biome check .` «Checked 487 files in 696ms. No fixes applied.»; `vitest run` «Test Files 173 passed (173) / Tests 2917 passed \| 3 skipped (2920)»; `next build` «✓ Compiled successfully in 860ms».

## Veredicto del verificador — 2026-11-11 — RED

La columna «Estado» de arriba la escribió el implementador; no es verificación. Estado real por CA:

| CA | Implementado | Test | Verif. | Estado |
| :--- | :--- | :--- | :--- | :--- |
| CA-1 | sí | `src/sources/registry.test.ts:40` (`sourceConfig("api-football")` undefined), `src/ingest/rfef-alta.test.ts:127` (`ADAPTERS` = `["rfef"]`) | runtime: `SOURCES` = `[rfef]` prioridad 50 ×5, `ADAPTERS` = `["rfef"]` | ✅ |
| CA-2 | sí | **ninguno**: `src/calendar/importers.test.ts` no existe; ningún test usa `IMPORTERS` ni `importerFor` | runtime: `IMPORTERS` = `["rfef"]`, `importerFor("api-football")` = `undefined` | ❌ (F-1) |
| CA-3 | sí (`API_FOOTBALL_KEY` sigue en `REMOTE_SECRETS` solo para vaciarlo: compatibilidad sin uso, permitido) | `src/calendar/cli.test.ts:41` (sale 1 sin `RFEF_EXPLORER_TOKEN`), `src/arch/deploy.test.ts:256` (workflow con `RFEF_EXPLORER_TOKEN`); **ningún test** de que `.env.example` no lleve `API_FOOTBALL_KEY` (el ledger dice lo contrario) | `grep API_FOOTBALL .env.example .github/workflows/*` vacío | ⚠️ (F-2) |
| CA-4 | sí (`git ls-files src/sources/api-football` = 0) | `src/decide/replay.test.ts` sobre `src/decide/fixtures/girona-albacete-observations.ts`; `src/ingest/goal-events.test.ts`. Inexistentes los citados `src/medicion/goal-events.test.ts` y `src/medicion/informe.test.ts` | suite verde | ✅ |
| CA-5 | parcial: se quitaron los usos de `api-football` en `source-contract.test.ts` | **ninguno certifica** la ausencia de importaciones/acoplamientos a `api-football` (`deploy.test.ts`, `sources-boundary.test.ts` y `source-contract.test.ts` no tienen esa aserción) | — | ❌ (F-3) |
| CA-6 | — | `npm run typecheck` ok; `npm run lint` «Checked 486 files… No fixes applied»; `npm run test` «Test Files 172 passed (172) / Tests 2905 passed \| 3 skipped»; `npm run build` EXIT=0 «Compiled successfully» | ejecutado en `beab20b` | ✅ |

Comando runtime: `node --experimental-strip-types check062.mts` (importa `importers.ts`, `adapters.ts`, `registry.ts`) →
`IMPORTERS [ 'rfef' ]`, `importerFor(api-football) undefined`, `ADAPTERS [ 'rfef' ]`, `sourceConfig(api-football) undefined`.

### Findings (accionables)
- **F-1 (CA-2)**: falta un test que fije `IMPORTERS` = `[rfefCalendar]` y `importerFor("api-football") === undefined`.
- **F-2 (CA-3)**: falta la aserción en `src/arch/deploy.test.ts` de que `.env.example` (y los workflows) no contienen `API_FOOTBALL_KEY`.
- **F-3 (CA-5)**: falta un test de arquitectura que certifique que nada bajo `src/` importa `sources/api-football` ni existe ese directorio.
- **F-4 (ledger)**: la mitad del implementador cita tests inexistentes (`src/calendar/importers.test.ts`, `src/medicion/goal-events.test.ts`, `src/medicion/informe.test.ts`) y una aserción que no existe (deploy.test sobre `.env.example`); corregir con rutas reales.

### Observaciones no bloqueantes
- O-1 (EPIC-MANT): `tools/informe-jornada.mjs --contrastar`, `tools/reconciliar-cierre.mjs` y `tools/reconciliar-sin-directo.mjs` hacen `SOURCES.find(id === "api-football")` y abortan siempre con «no api-football en el registro»; `tools/legacy-api-football.mjs` mapea todo estado ≠ `FT` a `live`. Herramientas muertas: retirarlas o documentarlas como tal. También `tools/medir-directo.mjs`, `tools/tick-salud.mjs` (`API_FOOTBALL_KEY`) y el comentario de `src/sources/registry.ts:5` («Priority 10 for API-Football»).
- O-2 (EPIC-MANT): `tools/calendario-sync.mjs --source api-football` sigue aceptando el flag y falla con «ningún importador cubre»; rechazarlo de forma explícita sería más claro.

## Respuesta del implementador al RED — 2026-11-11

- F-1: `src/calendar/importers.test.ts` (nuevo). F-2: `src/arch/deploy.test.ts` › «SPEC-062 CA-3 …». F-3: `src/arch/sources-boundary.test.ts` › «SPEC-062 CA-5 …». F-4: citas de la tabla y la evidencia de arriba corregidas a ficheros reales. Commit `71a97fd`.
- Mutación (revertida): `IMPORTERS` con un segundo importador `id: "api-football"` + `API_FOOTBALL_KEY=` en `.env.example` + `src/sources/api-football/results.ts` + `src/ingest/zz-mut.ts` importándolo → `vitest run` de los 3 ficheros: «Tests 5 failed \| 47 passed (52)», fallan exactamente los 5 casos nuevos. Restaurado: «Tests 52 passed (52)».
- Columna «Estado» de la primera tabla: no es mía (la dejó así la iteración anterior); la decide el verificador.

## Veredicto del verificador (2.ª verificación) — 2026-11-11 — GREEN

Sobre `50347c2` (rama `ft/SPEC-062-tests-desacoplamiento`). F-1..F-4 resueltos.

| CA | Implementado | Test | Verif. | Estado |
| :--- | :--- | :--- | :--- | :--- |
| CA-1 | sí | `src/sources/registry.test.ts`, `src/ingest/rfef-alta.test.ts` | sin cambios desde la 1.ª verificación; suite verde | ✅ |
| CA-2 | sí | `src/calendar/importers.test.ts` (2 casos) | mutación `IMPORTERS` + importador `id: "api-football"` → fallan los 2 | ✅ |
| CA-3 | sí (`API_FOOTBALL_KEY` en `REMOTE_SECRETS` solo para vaciarlo: permitido) | `src/calendar/cli.test.ts:41`, `src/arch/deploy.test.ts` › «SPEC-062 CA-3 …» | mutación `API_FOOTBALL_KEY=` en `.env.example` y comentario en `calendario-semanal.yml` → falla el caso de cada fichero | ✅ |
| CA-4 | sí | `src/decide/replay.test.ts` (fixture `girona-albacete-observations.ts`), `src/ingest/goal-events.test.ts` | suite verde; todas las rutas citadas existen | ✅ |
| CA-5 | sí | `src/arch/sources-boundary.test.ts` › «SPEC-062 CA-5 …» | mutación directorio `src/sources/api-football/` + `import()` dinámico y `export * from` en `src/ingest/zz-mut.ts` → fallan ambos casos | ✅ |
| CA-6 | — | `npm run gates` | `EXIT=0`: `tsc` sin salida; biome «Checked 487 files… No fixes applied»; vitest «Test Files 173 passed (173) / Tests 2917 passed \| 3 skipped (2920)»; `next build` «✓ Compiled successfully»; sin `warn` en el log | ✅ |

Mutaciones revertidas (`git status` limpio salvo ficheros ajenos). Combinada: `vitest run` de los 3 ficheros → «Tests 5 failed \| 47 passed (52)»; `.env.example` + re-export → «Tests 2 failed \| 48 passed (50)».
Ledger: todas las rutas citadas existen (comprobado fichero a fichero). O-1/O-2 siguen abiertas para EPIC-MANT, no bloqueantes.

## Cómo retomar (handoff)

Rama `ft/SPEC-062-tests-desacoplamiento`. Código de producción sin cambios en esta iteración; solo tests y ledger. Pendiente: verificación. O-1/O-2 quedan para EPIC-MANT (fuera de esta spec).
