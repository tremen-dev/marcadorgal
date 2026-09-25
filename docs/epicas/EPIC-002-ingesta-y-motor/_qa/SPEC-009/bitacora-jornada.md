# Bitácora de la jornada de medición (SPEC-009, CA-7)

Ventana: **viernes 2026-09-25 18:20Z → lunes 2026-09-28 21:00Z**.
Se rellena a mano durante los cuatro días. Sirve para tres cosas el lunes:

1. resolver las **tres declaraciones** que el bloque 9 del informe lista como
   pendientes (F-SPEC-009-1): intervención sobre el dato, intervención sobre la
   plataforma, y si cada alerta abierta tiene explicación;
2. contar las **peticiones manuales** al proveedor (las que no pasan por el
   tick y por tanto no están en `ingest_attempts`);
3. tener fechada cualquier rareza que el informe luego explique.

Instantes en UTC con `Z`. Lo que no esté aquí, el lunes no existió.

## Salud del tick (`npm run tick:salud`, solo lectura)

| Instante | Veredicto | Ejecuciones 10 min | Alertas sin resolver | Nota |
|---|---|---|---|---|
| 2026-09-25T18:49Z | OK | 20 · 100 % | 0 | ventana abierta; `girona-albacete` en `live`, `requests: 1` |
| 2026-09-25T19:07:20Z | OK | 20 · 100% | 0 | automática |

## Intervenciones sobre la PLATAFORMA (H-2 (ii) — bajan a `válida con reservas`)

| Instante | Qué se tocó | Por qué | Quién |
|---|---|---|---|
| — | (ninguna todavía) | | |

## Intervenciones sobre el DATO (H-2 (i) — invalidan el criterio 5)

| Instante | Qué | Por qué |
|---|---|---|
| — | **ninguna** | |

## Peticiones manuales al proveedor (fuera del tick)

| Instante | Petición | Motivo |
|---|---|---|
| 2026-09-25T19:07:09Z | `GET /fixtures?live=…` | prueba del script de captura de CA-8 (no se escribió fixture) |

## Incidencias y rarezas

| Instante | Qué pasó | Qué se hizo |
|---|---|---|
| — | | |
