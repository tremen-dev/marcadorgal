# Medición de las bajadas en vivo — jornada 2026-09-25/28 (ADR-011)

> Solo lectura, 2026-09-29. Cero peticiones al proveedor, cero escrituras, cero
> ticks. Fuente: `observations`, `alerts` y `decisions` de `dev` en transacción
> `read only`, y las **2733** capturas crudas de la ventana descargadas por GET
> del bucket `raw` (todas; 0 fallos). El crudo se purga el **2026-10-25**.

- Ventana `2026-09-25T18:20Z → 2026-09-28T21:00Z`; 9331 observaciones; 8 alertas `regression`.
- **Bajada** = observación `live` con un lado menor que la observación anterior del partido. Hay **11**; 8 abrieron alerta, 3 no (ya había una abierta del partido).
- **Real / falsa** = el gol retirado ¿existe al final? Se decide con los eventos `Goal` de la última captura, el marcador del proveedor (informe SPEC-009, bloque 8) y la radio (`referencias.csv`, `mirandes 1-0` a las 14:42Z).
- **Gol sin evento** = en la captura que subió el marcador, los eventos `Goal` del lado no llegan a su cuenta.

## Tabla por caso

| # | Partido | Bajada (min) | ¿Gol subido con evento `Goal`? | Evento `Var` del lado | ¿Real? | Retención hoy (board ≠ fuente) |
|---|---|---|---|---|---|---|
| 1 | girona-albacete | 2-1 → 2-0 (57') | **no** (2 de H, 0 de A) | nunca | **real** | 75 ticks, 37,0 min, mal |
| 2 | ceuta-real-sociedad-b | 1-1 → 0-1 (57') | sí, 30 s después (51') | `Var` 51' desde 13:18:29, **2 min antes**; «Goal cancelled» 13:20:59 | **real** | 21 ticks, 10,5 min, mal |
| 3 | lugo-racing-ferrol | 1-0 → 0-0 (21') | sí (20') | nunca; la respuesta de la bajada viene **sin eventos** | **falsa** (vuelve a 1-0 en 2 min) | 4 ticks, **bien** |
| 4 | lugo-racing-ferrol | 1-1 → 1-0 (61') | sí (58') | nunca; el evento desaparece | **real** | 72 ticks, mal (sin alerta propia) |
| 5 | celta-fortuna-sabadell | 1-2 → 1-1 (63') | **no** | nunca | **real** | 64 ticks, 31,5 min, mal |
| 6 | barakaldo-aviles | 0-1 → 0-0 (7') | sí (4') | «Goal Disallowed» 4', **10,5 min después** | **real** | 47 ticks, 23,5 min, mal |
| 7 | mirandes-unionistas | 0-1 → 0-0 (16') | sí (12') | «Goal Disallowed» 12', **26 min después** | **real** | 207 ticks, 103 min, mal |
| 8 | burgos-eldense | 0-1 → 0-0 (26') | sí (26') | nunca; el evento desaparece a los 19,5 min | **real** | 168 ticks, 84 min, mal |
| 9 | burgos-eldense | 2-0 → 1-0 (87') | **no** | nunca | **real** | dentro de la fila 8 (sin alerta propia) |
| 10 | eibar-las-palmas | 3-1 → 2-1 (39') | **no** (2 de H) | nunca | **real** | 88 ticks, 44 min, mal |
| 11 | eibar-las-palmas | 3-2 → 3-1 (86') | sí (85') | nunca | **falsa** (vuelve en 30 s) | 1 tick, **bien** (sin alerta propia) |

**9 bajadas reales, 2 falsas.** Las falsas duran **4 ticks (2 min)** y **1 tick
(30 s)**. Las reales retenidas suman **742 ticks (~373 min)** de marcador
publicado distinto del de la fuente, y la fuente tenía razón.

## Corrección a una premisa

`eibar-las-palmas` y `barakaldo-aviles` **no** son «retenciones que acertaron»
(`hallazgos-jornada.md` h. 2; SPEC-012 N-2). En los dos **el marcador bajo era
el verdadero**: el 3.º gol del Eibar en el 38' nunca tuvo evento y los goles
finales del Eibar son 6', 9' y 62'; el 0-1 del Avilés en el 4' lo anuló el VAR.
Acabaron bien **por coincidencia**: la fuente alcanzó después el marcador
retenido con un gol real (62' y 30'). Durante 44 y 23,5 min, RN-03 publicó el
marcador falso. **El dato de la jornada da 0 retenciones largas acertadas.**

## Eventos `Var` en toda la jornada

568 apariciones, **9 incidencias distintas** en 6 partidos. Las 3 de gol son las
filas 2, 6 y 7; las otras 6 son de tarjeta (Granada-Andorra, Mallorca-Almería,
Oviedo-Sporting). El `Var` llega **antes** de la bajada en 1 caso de 3 y
**10,5 y 26 min después** en los otros 2. Además, en **163 de 7679** capturas
con marcador los eventos `Goal` no cuadran con él, y en `lugo-racing-ferrol` la
lista de eventos entra y sale vacía entre capturas: el evento es una señal
ruidosa.

## Tres reglas contra el mismo dato

| Regla en vivo | Falsas publicadas | Reales retenidas (ticks mal) |
|---|---|---|
| Hoy: solo baja una fuente con más peso | 0 | **742** (9 de 9) |
| **Misma fuente u otra de más peso** | **5 ticks** (filas 3 y 11) | **0** |
| + filtro A: aceptar solo con `Var` visible o gol subido sin evento | 0 | ≈ 313 (filas 4 y 8 hasta el cierre; 6 y 7 con 10,5 y 26 min de retraso) |
| + filtro B: aceptar cuando los eventos `Goal` cuadran con el marcador bajo | 4 ticks (fila 3) | ≈ 113 (filas 2, 6, 7 y 8 con retraso) |

## Conclusión

- **«Misma fuente» a secas separa lo que importa**: publica las 9 bajadas reales
  al instante y deja pasar 2 parpadeos falsos de 30 s y 2 min. Contra hoy, pasa
  de **742 ticks mal** a **5**.
- **Ningún filtro de evidencia lo mejora**: el A quita 5 ticks falsos a cambio de
  ~313 ticks mal; el B, 1 tick falso a cambio de ~113. El `Var` llega tarde y
  solo hay 3; el evento `Goal` falta o sobra en ~2 % de las capturas. Con n = 11
  **la medición no sostiene un filtro**.
