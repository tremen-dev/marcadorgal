# Corrección de la jornada medida — 2026-09-29 (SPEC-012 CA-4/CA-6)

> Nota aparte a propósito: `_qa/SPEC-009/informe-jornada-2026-09-28.md` **no se
> toca ni se regenera** (F-SPEC-009-2). Queda como evidencia de lo que hizo el
> sistema; esto es un hecho posterior y fechado (H-2).

- Ventana: `2026-09-25T18:20Z → 2026-09-28T21:00Z`, 39 partidos.
- Comando: `npm run replay:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z --aplicar`,
  ejecutado **una vez**, tras el replay en seco y con los tests en verde.
- Ninguna petición al proveedor (RN-08): el replay lee `observations` y `board`.
- Fidelidad del replay: con la copia congelada del motor de la jornada
  (`src/decide/fixtures/engine-812c805.ts`) el mismo replay **coincide con
  `board` en los 39**; con el motor de hoy divergen exactamente los cinco.

## Lo añadido (RN-07: nada se actualiza ni se borra)

`decisions` 3351 → **3356** (+5). `observations` 9341, `alerts` 17 (17 abiertas),
`ingest_attempts` 2766 y `raw_purges` 8: **sin cambio**.

| Partido | board antes | board después | versión | regla | `decided_at` |
|---|---|---|---|---|---|
| girona-albacete | 2-1 | **2-0** | 100 → 101 | RN-02 | 2026-09-29T00:09:14.708Z |
| lugo-racing-ferrol | 1-1 | **1-0** | 105 → 106 | RN-02 | ídem |
| celta-fortuna-sabadell | 1-2 | **1-1** | 101 → 102 | RN-02 | ídem |
| mirandes-unionistas | 0-1 | **1-0** | 107 → 108 | RN-02 | ídem |
| burgos-eldense | 0-1 | **1-0** | 97 → 98 | RN-02 | ídem |
| ceuta-real-sociedad-b | 2-1 | 2-1 | 107 | — | sin tocar |
| merida-logrones | 3-4 | 3-4 | 107 | — | sin tocar |

Todas `finished`, `provisional`, `minute` nulo, con **una** observación citada
(la ganadora del replay al cierre).

## Contraste con el proveedor

Sin volver a preguntar: el marcador del proveedor es el del bloque 8 del
informe del 2026-09-28. Antes **32 de 39**; después **37 de 39**. Siguen mal
`ceuta-real-sociedad-b` (2-1, proveedor 3-1) y `merida-logrones` (3-4,
proveedor 3-5): su última observación coincide con lo publicado y el replay no
puede inventar el dato que no se capturó (SPEC-009 N-9). Destino: SPEC-013.

Las alertas `regression` de la jornada siguen abiertas: el cierre no las
resuelve (EPIC-004).
