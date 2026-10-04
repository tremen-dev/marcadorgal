# Medición: partidos que la fuente nunca muestra en juego (ADR-013)

> Solo lectura, 2026-10-04 18:00-18:04Z. `dev` en `begin read only`
> (`current_setting('transaction_read_only')` → `on`) y GET al bucket `raw` de
> Storage. **Cero peticiones al proveedor**, cero escrituras, cero ticks. Script
> en el scratchpad de la sesión, no en el repo. Medido **después** del cierre de
> la ventana de `barco-pontevedra-b` (18:00Z): su última observación es 17:59:51Z.

## Alcance

72 partidos con kickoff ≥ 2026-09-25 y kickoff + 150 min < `now()` (kickoff
vigente en `dev`). Todos tienen observaciones (0 sin ninguna).

| Competición | Semana | Partidos | (a) `scheduled`, ventana cerrada, sin `PST` | (b) `finished` sin ninguna `live` | `PST` |
|---|---|---|---|---|---|
| primera-rfef-g1 | 25-28 / 02-04 | 10 / 9 | 0 / 0 | 0 / 0 | 0 |
| segunda-division | 25-28 / 02-04 | 11 / 7 | 0 / 0 | 0 / 0 | 0 / 1 (`sabadell-andorra`, ADR-012) |
| segunda-rfef-g1 | 25-28 / 02-04 | 9 / 9 | 0 / **1** | **1** / 0 | 0 |
| tercera-rfef-g1 | 25-28 / 02-04 | 9 / 8 | 0 / **1** | **4** / **3** | 0 |
| **Total** | | **72** | **2** | **8** | 1 |

## Descarte del calendario (kickoff declarado vs. `fixture.date` del crudo)

- **2 de los 8 de (b) son calendario**, ya probados en
  `EPIC-FIX/_qa/diagnostico-2026-09-29.md`: `sarriana-celta-c` (crudo
  `2026-09-27T15-50-23.935Z-ca9711ca…`: `fixture.date 2026-09-26T17:00`, `FT`;
  20 obs, todas `finished`, en la ventana de la hora de relleno) y
  `montaneros-viveiro` (ídem, 20 obs `finished`). No son «sin directo».
- **Los otros 8 (6 de (b) + 2 de (a)): kickoff declarado = `fixture.date` del
  proveedor** en el crudo del primer tick de su ventana. La ventana se abrió a
  la hora buena; la fuente no dio directo.

## Lo que dice el crudo

| Partido | Kickoff | `fixture.id` | Crudo en ventana | Primer `finished` |
|---|---|---|---|---|
| **(a)** `segunda-rfef-g1-j5-bergantinos-coruxo` | 10-04 15:00Z | 1572068 | **`NS` congelado**, `date 15:00`, `elapsed null`, en `ids=` de k−10, k+90 y k+150 (320 obs, 320 intentos) | — |
| **(a)** `tercera-rfef-g1-j5-barco-pontevedra-b` | 10-04 15:30Z | 1612741 | **`NS` congelado**, `date 15:30`, en k−10, k+90 y k+150 (320 obs) | — |
| (b) `segunda-rfef-g1-j4-arosa-alaves-b` | 09-27 15:00Z | 1572058 | `NS` → `FT 2-5` | **+125** |
| (b) `tercera-rfef-g1-j4-portonovo-silva` | 09-27 16:00Z | 1612737 | `NS` → `FT 4-2` | **+139** |
| (b) `tercera-rfef-g1-j4-boiro-villalbes` | 09-27 16:00Z | 1612733 | `NS` → `FT 1-1` | **+147** |
| (b) `tercera-rfef-g1-j5-arenteiro-antela` | 10-03 17:00Z | 1612740 | `NS` → `FT 2-3` | **+128** |
| (b) `tercera-rfef-g1-j5-viveiro-celtiga` | 10-04 10:00Z | 1612747 | `NS` → `FT 0-0` | **+125** |
| (b) `tercera-rfef-g1-j5-portonovo-lalin` | 10-04 15:00Z | 1612744 | `NS` → `FT 0-1` | **+138** |

Ni `TBD`, ni `PST`, ni otra fecha: el proveedor tiene el partido a su hora y
**nunca lo pasa de `NS` hasta que publica el `FT`**, sin pasar por `1H`/`2H`.
Ninguno de los 8 aparece en las respuestas `live=` de su ventana. Los dos de (a)
tienen 1 Decision (`scheduled provisional RN-01`) y 0 alertas: `board` los da
«por jugar» y así se quedan.

Crudos citados (`raw/api-football/2026-10-04/…`, se purgan el **2026-11-03**):
`2026-10-04T14-50-06.320Z-6f4568fe…`, `…T16-30-16.649Z-74e3a973…`,
`…T17-00-18.256Z-c733c8da…`, `…T17-29-50.048Z-b984691b…`,
`…T15-20-12.371Z-c3301d9d…`, `…T17-59-51.517Z-ae03755b…`; los `FT` de (b), el
`raw_ref` de su primera observación `finished`.

## Lectura

- **(a) y (b) son el mismo fenómeno**: la fuente no cubre el partido en directo
  y publica el resultado al final, entre **+125 y +147** (mediana +133, n = 6).
  Si llega antes de +150 es (b); si llega después, es (a) y nadie lo oye.
  **2 de 8 (25 %)** cayeron fuera.
- Sin directo de la fuente, con calendario bueno: **Tercera 2 de 9 (J4) y 4 de
  8 (J5); Segunda RFEF 1 de 9 y 1 de 9; Primera RFEF y Segunda 0.** El
  recuento de R-SPEC-009-3 (4 de 9 en J4) queda en 2 de 9.
- En los 6 de (b), `board` dijo «por jugar» desde el kickoff hasta el `FT`: el
  partido entero.
- **No se sabe** si el proveedor publicó ya el `FT` de los dos de (a): saberlo
  exige una petición `ids=1572068-1612741`, que esta medición no hace (ADR-013 H-5).

## Residuales

- **R-ADR-013-1** — `bergantinos-coruxo` y `barco-pontevedra-b` se quedan
  `scheduled` en `dev` sin salida automática: no hay observación con su final.
  Dueño: ADR-013 (H-6). No se corrige a mano.
- **R-ADR-013-2** — cuándo publica el proveedor el `FT` de un partido sin
  directo pasado +150: sin medir (H-5). Fija el horizonte de la prórroga (H-1).
- **R-SPEC-009-3** (EPIC-004, de producto): recuento nuevo arriba; lo actualiza
  sdd-producto en `docs/roadmap.md`.
