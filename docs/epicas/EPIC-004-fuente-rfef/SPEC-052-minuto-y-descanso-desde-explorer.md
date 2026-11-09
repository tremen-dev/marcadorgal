---
id: SPEC-052
tipo: spec
epica: EPIC-004
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-07, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-07, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-07, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-07, por: sdd-verificador}
---
# SPEC-052 — Minuto de juego y descanso desde la fuente explorer

## Problema
`marcador.gal` soporta completamente en su base de datos, motor de decisiones y componentes de interfaz (SPEC-021 y SPEC-040) la representación del minuto en juego (`47'`, `45+3'`) y el estado de descanso («DESCANSO»). Tras la retirada de API-Football (ADR-026), la fuente activa autoritativa es `rfef` vía `marcadorgal-explorer`. Sin embargo, el adaptador `src/sources/rfef/explorer.ts` fijaba de manera estática `minute: null, addedMinute: null` y omitía `halfTime` para todas las lecturas de partidos en directo (`LIVE_PROVISIONAL`). Al incorporar `marcadorgal-explorer` estos datos en su export `GET /api/export/matches`, el adaptador debe reconocerlos y propagarlos a las observaciones para que la pantalla los refleje en tiempo real.

## Usuarios / roles afectados
- Público: ve el minuto de juego en directo y el indicador «DESCANSO» en los partidos que se están disputando.

## Criterios de aceptación
- **CA-1 Esquema Zod de ExplorerMatch.** `ExplorerMatch` en `src/sources/rfef/explorer.ts` reconoce los campos opcionales `minute` (`number | null`), `addedMinute` (`number | null`) y `halfTime` (`boolean`). Partidos sin estos campos (fixtures existentes) continúan siendo válidos.
- **CA-2 Mapeo a Observation en `rowState`.** En `LIVE_PROVISIONAL`, si la lectura cae en ventana de directo (`inLiveWindow`), la observación toma `minute: row.minute ?? null`, `addedMinute` (acotado a 1..30 si es número positivo, o `null`) y `halfTime` (si viene definido en la fila, se propaga; si no, se omite para preservar compatibilidad con observaciones históricas).
- **CA-3 Tipos en `explorer-client.ts`.** `DayMatchesResponse.matches` en `src/lib/explorer-client.ts` añade los campos `minute?: number | null`, `addedMinute?: number | null` y `halfTime?: boolean`.
- **CA-4 Tests unitarios del adaptador.** `src/sources/rfef/explorer.test.ts` verifica:
  1. Que un partido `LIVE_PROVISIONAL` con `minute: 37`, `addedMinute: null`, `halfTime: false` produce una observación con `minute: 37`, `addedMinute: null` y `halfTime: false`.
  2. Que un partido `LIVE_PROVISIONAL` con `minute: 45`, `addedMinute: 2`, `halfTime: false` produce una observación con `minute: 45`, `addedMinute: 2`.
  3. Que un partido `LIVE_PROVISIONAL` con `halfTime: true` produce una observación con `halfTime: true`.
  4. Que los partidos sin estos campos siguen devolviendo `minute: null, addedMinute: null` sin propiedad `halfTime`.
- **CA-5 Gates.** `npm run gates` verde (typecheck, lint, test, build) sin regresiones.
