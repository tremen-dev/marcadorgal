---
id: SPEC-054
tipo: spec
epica: EPIC-004
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-07, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-07, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-07, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-07, por: sdd-implementador}
---
# SPEC-054 — Resolución robusta de equipos en Explorer priorizando emparejamientos del calendario

## Problema
En el commit `2ee1d53c` (SPEC-049), `resolveMatch` en `src/sources/rfef/explorer.ts` comenzó a priorizar `canonicalHomeTeamId` y `canonicalAwayTeamId` procedentes de Explorer sobre el mapa `teamByName` (`row.canonicalAwayTeamId ?? teamByName.get(...)`).
Sin embargo, los identificadores canónicos generados sintéticamente en Explorer (e.g. `rc-deportivo`, `real-oviedo`, `valencia-cf`, etc.) difieren de los identificadores canónicos oficiales fijados en el calendario de marcadorgal (`deportivo`, `oviedo`, `valencia`). Al dar precedencia ciega al slug de Explorer frente a los alias del fichero oficial (`data/alias/2026-27/rfef.json`), el cruce con el calendario (`matchOf.get(...)`) fallaba con `unknown_match` para partidos clave como Espanyol - Deportivo, impidiendo que el ingestor reconociera el inicio del partido.

## Usuarios / roles afectados
- Afición y público general: visualizan el estado en directo de todos los partidos sin omisiones por discrepancia entre slugs de Explorer y del calendario.

## Criterios de aceptación
- **CA-1 Resolución por candidatos.** `resolveMatch` en `src/sources/rfef/explorer.ts` evalúa combinaciones de candidatos locales y visitantes (`teamByName` y `canonical...Id`) buscando el emparejamiento que coincida con un partido declarado en `matchOf`.
- **CA-2 Preservación de fallbacks.** Si ni el nombre ni el ID canónico resuelven un equipo, se devuelve `unknown_team`. Si el partido no existe en ninguna combinación, se devuelve `unknown_match`. Si la jornada difiere, `inconsistent_alias`.
- **CA-3 Test unitario de discrepancia.** En `src/sources/rfef/explorer.test.ts`, se añade un test donde el ID canónico de Explorer diverge del ID de marcadorgal pero el alias sí coincide, verificando que se resuelve la observación sin errores.
- **CA-4 Gates.** `npm run gates` verde al 100%.
