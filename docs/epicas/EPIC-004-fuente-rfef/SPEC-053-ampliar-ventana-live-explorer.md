---
id: SPEC-053
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
# SPEC-053 — Ampliar ventana de directo en Explorer para cubrir descuentos

## Problema
El filtro `inLiveWindow` fijaba `LIVE_AFTER_MINUTES = 110` (ADR-017 §4, ADR-023 §5). En el fútbol moderno con descansos de 17 minutos, retrasos de inicio y descuentos de 6 a 10 minutos (VAR), un partido dura habitualmente entre 115 y 125 minutos desde la hora programada. Con el límite a 110 minutos, cualquier actualización en directo a partir del minuto ~80-83 de juego real se descartaba como `ambiguous_state`, congelando el marcador y el minuto antes del desenlace del partido (ocurrido el 2026-11-07 a las 15:55 en el Málaga-Racing). Con la llegada de minutos explícitos desde Explorer (SPEC-052), la presencia de un minuto en juego o descanso descarta falsos positivos por parpadeos zombis de Novanet.

## Usuarios / roles afectados
- Público: ve el minuto, los descuentos y goles del tramo final de los partidos sin cortes prematuros.

## Criterios de aceptación
- **CA-1 Umbral general `LIVE_AFTER_MINUTES`.** En `src/sources/rfef/state.ts`, `LIVE_AFTER_MINUTES` se amplía de 110 a 130 minutos (`[kickoff − 10, kickoff + 130)`).
- **CA-2 Ventana extendida con minuto explícito en Explorer.** En `src/sources/rfef/explorer.ts`, si la fila incluye `minute !== null` o `halfTime === true`, la ventana de directo se admite hasta 140 minutos (`[kickoff − 10, kickoff + 140)`), asegurando continuidad en partidos con descuentos largos o interrupciones.
- **CA-3 Tests unitarios.** Actualizados `src/sources/rfef/state.test.ts` y `src/sources/rfef/explorer.test.ts` verificando los nuevos límites de 130 min (sin minuto) y 140 min (con minuto explícito).
- **CA-4 Gates.** `npm run gates` verde (typecheck, lint, test, build).
