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
| 2026-09-26T10:16:44Z | OK | 20 · 100% | 1 | automática |

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
| 2026-09-25T19:07:09Z | `GET /fixtures?live=…` | prueba del script local de captura de CA-8 (no se escribió fixture) |
| 2026-09-25T19:36:00Z | `GET /fixtures?live=…` | ensayo del workflow `captura-ca8` en GitHub Actions (run 36180127367; fixture de prueba, borrado) |

## Incidencias y rarezas

| Instante | Qué pasó | Qué se hizo |
|---|---|---|
| 2026-09-25T19:46:06Z | **Alerta `regression` en `girona-albacete`** (la única de la ventana hasta ahora): `current 2-1`, `proposed 2-0`. Ver el detalle escrito abajo. | Nada: no se toca el dato (H-2 (i)). Lleva explicación a mano el lunes (CA-4 (c)) |

### La alerta `regression` del viernes, con los números medidos

Medido en solo lectura el sábado 26 a las 10:20Z sobre `observations` y
`decisions` de `segunda-division-2026-27-j7-girona-albacete`:

- **La ingesta salió impecable**: 247 observaciones, cadencia **mediana 30,0 s ·
  p95 30,2 s · máximo 30,9 s**, y **cero huecos > 90 s** en las 2 h 03 min de
  ventana. Lo que se mide de CA-2 (a) está en verde para este partido.
- **Lo que dijo la fuente**: 2-0 hasta 19:44:34Z, **2-1 en exactamente dos
  observaciones** (19:45:04Z y 19:45:34Z), y **2-0 otra vez desde 19:46:04Z
  hasta el final**, incluido el `finished` de 20:23:06Z.
- **Lo que publicó el motor**: subió a 2-1 en la v61 (RN-01) y desde la v62
  **sostuvo 2-1 bajo RN-03** durante 37 minutos, cerrando el partido en
  **`finished 2-1`**. Abrió la alerta, que es lo que tiene que hacer.
- **Consecuencia para el lunes**: `--contrastar` de CA-5 va a encontrar una
  **discrepancia** en este partido (nosotros `2-1`, el proveedor `2-0`). Eso es
  «los dos lados dicen cosas distintas», o sea candidato a la rama **(c2)** de
  CA-9: ingesta sana y motor equivocado. Que es la rama **buena** de las dos:
  no se repite la jornada, se corrige el motor y se recalcula el log sobre las
  observaciones guardadas (ADR-004, SPEC-007 CA-8).
- **Lo que falta para saber quién tenía razón**: el resultado real del partido.
  Si acabó 2-0, RN-03 no sabe aceptar una corrección a la baja confirmada por 74
  observaciones seguidas y hay defecto de motor. Si acabó 2-1, el proveedor se
  equivocó y RN-03 nos salvó. **Se comprueba a mano**, con la misma fuente
  externa del domingo, y se anota aquí.
- **No se arregla nada ahora**: el código está congelado (decisión del
  2026-09-22) y la rama (c2) se decide con el informe, no antes.
