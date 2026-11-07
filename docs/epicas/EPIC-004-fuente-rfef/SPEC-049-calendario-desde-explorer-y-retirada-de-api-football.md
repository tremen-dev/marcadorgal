---
id: SPEC-049
tipo: spec
epica: EPIC-004
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-06, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-06, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-06, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-06, por: sdd-implementador}
---
# SPEC-049 — Calendario declarado desde explorer y retirada de API-Football

## Problema
El plan de API-Football ha vencido y no se renovará (roadmap H-9 de SPEC-036). Mantener API-Football en el registro de fuentes provoca fallos en el tick y bloquea la sincronización del calendario (`npm run calendario:sync`). Con el despliegue de marcadorgal-explorer v2.0, disponemos de `GET /api/export/calendar` y `GET /api/export/matches` con goles y datos multi-proveedor. Esta spec implementa el importador de calendario desde explorer, retira API-Football de las fuentes activas subiendo `rfef` a prioridad 50, y crea el cliente para las nuevas entidades.

## Criterios de aceptación
- **CA-1 Importador de calendario RFEF/Explorer.** `src/sources/rfef/calendar.ts` implementa `CalendarImporter` para las 5 competiciones de D-3. Llama a `GET /api/export/calendar?competition=:id&season=:season` con Bearer token. Parsea la respuesta a `ImportedCalendar` con Zod sin lecturas de reloj ni dependencias externas. Test unitario en `src/sources/rfef/calendar.test.ts`.
- **CA-2 Registro de importadores.** `src/calendar/importers.ts` registra `rfefCalendar` como primer importador.
- **CA-3 CLI de sincronización.** `tools/calendario-sync.mjs` lee `RFEF_EXPLORER_TOKEN` (o `EXPLORER_API_KEY` o `API_FOOTBALL_KEY`), desacoplando la dependencia exclusiva de API-Football.
- **CA-4 Registro de fuentes activas.** `src/sources/registry.ts` eleva `rfef` a prioridad 50 (`FEDERATION_PRIORITY`, ADR-017 §5 restaurado, ADR-026) en las cinco competiciones, asegurando que sus observaciones prevalecen como fuente federativa oficial.
- **CA-5 Cliente de consumo Explorer.** `src/lib/explorer-client.ts` expone funciones tipadas para consumir calendario, partidos con goles, clasificaciones, Pichichi y Zamora. Tests en `src/lib/explorer-client.test.ts`.
- **CA-6 Esquema Zod y resolución canónica de partidos.** `ExplorerMatch` en `src/sources/rfef/explorer.ts` tolera y reconoce los campos opcionales `goals`, `canonicalCompetitionId`, `canonicalHomeTeamId`, `canonicalAwayTeamId` y `liveProvider`. La ingesta en `parseRequest` y `resolveMatch` utiliza prioritariamente los identificadores canónicos: `canonicalCompetitionId` actúa como fallback de competición si `codGrupo` no está en el mapa de alias, y `canonicalHomeTeamId` / `canonicalAwayTeamId` resuelven directamente los equipos con fallback al mapa `teamByName` de alias.
- **CA-7 Gates.** Todos los tests pasan y no se rompen fronteras de módulo ni reglas de arquitectura.
