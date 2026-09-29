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
| 2026-09-26T15:10:00Z | `GET /fixtures?live=140-141-435-875-439` | **captura de CA-8** en GitHub Actions (run 36235253961). **Una sola petición**: aceptó en el primer sondeo con las cuatro ligas en juego |
| 2026-09-28T21:26Z | `GET /fixtures?ids=…` ×2 | **contraste de CA-5**, una sola tanda al terminar la jornada y fuera de ventana (RN-08). Las anota el propio informe, bloque 8 |

## Incidencias y rarezas

| Instante | Qué pasó | Qué se hizo |
|---|---|---|
| 2026-09-25T19:46:06Z | **Alerta `regression` en `girona-albacete`** (la única de la ventana hasta ahora): `current 2-1`, `proposed 2-0`. Ver el detalle escrito abajo. | Nada: no se toca el dato (H-2 (i)). Lleva explicación a mano el lunes (CA-4 (c)) |

### 2026-09-27T18:40Z — LA FUENTE NO DA EN DIRECTO EL 44 % DE TERCEIRA

Destapado al cruzar la muestra de H-3: nueve de las 24 referencias no casaban, y
seis eran del mismo partido. Medido sobre los 37 partidos de la ventana que
tienen observaciones, contando los que **nunca** tuvieron una observación `live`
con marcador —o sea, los que la fuente pasó de `scheduled` directo a `finished`—:

| Competición | Sin directo | Cuáles |
|---|---|---|
| Primeira Fed. G1 | **0 de 10** | — |
| Segunda División | **0 de 9** | — |
| Segunda Fed. G1 | **1 de 9** | arosa-alaves-b |
| **Terceira Fed. G1** | **4 de 9 (44 %)** | boiro-villalbes, montaneros-viveiro, portonovo-silva, sarriana-celta-c |

**Total: 5 de 37 (14 %).** Y el patrón es exactamente el que la épica declaró
como riesgo, ahora con número: **la cobertura en directo se degrada con la
categoría**, y en la categoría que es el nicho del producto falla casi la mitad.

Ejemplo completo, `arosa-alaves-b`: **270 observaciones** con cadencia perfecta,
todas `scheduled null-null`, y a las 17:04:58Z un salto a `finished 2-5`. La
radio había cantado los siete goles entre las 15:06Z y las 16:27Z. Igual
`boiro-villalbes` (314 observaciones → `finished 1-1` a las 18:27:02Z) y
`portonovo-silva` (298 → `finished 4-2` a las 18:19:02Z).

**No es un fallo nuestro**: el tick muestreó esos partidos cada 30 s durante dos
horas y media sin un hueco. Es que **la respuesta del proveedor no los trae en
juego**. Ninguno abrió alerta.

**Y el informe no lo ve.** El bloque «partidos sin señal» de CA-4 (b) cuenta los
partidos con **cero observaciones** o con un hueco > `SILENCE_MINUTES`; estos
tienen 270-314 observaciones y ningún hueco, así que **no aparecen en ningún
bloque**. Un partido que la fuente nunca mostró en juego es invisible para la
letra de CA-4 (b). Eso es trabajo de arquitecto antes de cerrar la épica.

**Efecto sobre la muestra de H-3**: de las 24 referencias, **9 no casan** —las 6
de `arosa-alaves-b`, `boiro 1-0`, `portonovo 2-0` (fuente muda) y
`mirandes 1-0` (RN-03)—. Ninguna es errata de quien anotó.

### 2026-09-27T18:40Z — la latencia contra la radio, con n = 15

Cruce de las 24 referencias contra las Decisions publicadas:

- **n = 15 casadas · mediana +53 s · rango [−95 s, +2278 s]**, 11 positivas y 4
  negativas.
- Quitando el atípico de `arosa-alaves-b 2-5` (+2278 s, que **no es latencia**
  sino la fuente publicando el resultado final 38 min después del último gol):
  n = 14, **mediana ≈ +55 s**, rango [−95, +267].
- **Contraste con `vision.md` (mediana < 45 s): NO se cumple.** El p95 no se
  puede calcular: con n < 20 el informe imprime `peor caso (n=15)` (CA-3).
- **La referencia es ruidosa y hay que decirlo**: el gol de `eibar-b-compostela`
  se midió con las dos fuentes y salió **−1 s contra flashcore y −95 s contra la
  radio**. La radio es carrusel: canta el gol cuando puede cortar. Así que +53 s
  es «nuestra publicación frente a la narración de la radio», con un ruido propio
  del orden de ±95 s, **no** un «gol → pantalla» limpio. Esa fila duplicada se
  conserva a propósito: es el único punto de calibración entre las dos fuentes.
- **Instantes al minuto, no al segundo**: las 21 referencias de la tarde se
  tomaron en el móvil con precisión de minuto y se cargaron con `:00` segundos, lo
  que **adelanta** la referencia y por tanto **agranda** la latencia. El sesgo es
  conservador a propósito.

### El domingo a las 15:00Z: `regression` no fue un caso aislado, son SEIS

Medido en solo lectura sobre `alerts` a las 2026-09-27T15:00Z, con 22 partidos
ya jugados o en juego de los 39 de la ventana:

| Instante | Partido | Retenido | Propuesto por la fuente |
|---|---|---|---|
| 2026-09-25T19:46:06Z | girona-albacete | 2-1 | 2-0 (real: **2-0**) |
| 2026-09-26T13:20:30Z | ceuta-real-sociedad-b | 1-1 | 0-1 |
| 2026-09-26T14:54:05Z | lugo-racing-ferrol | 1-0 | 0-0 |
| 2026-09-26T17:51:13Z | celta-fortuna-sabadell | 1-2 | 1-1 |
| 2026-09-27T10:08:07Z | barakaldo-aviles | 0-1 | 0-0 |
| 2026-09-27T14:16:51Z | mirandes-unionistas | 0-1 | 0-0 |

**Seis de 22 partidos, un 27 %.** Cada una deja el marcador publicado mal hasta
el final del partido, porque RN-03 no tiene vuelta sin operador (EPIC-004).
Y hay **cinco `forced_finish`** además (RN-02 cerrando a kickoff + 120 sin que la
fuente confirme el final), que también piden explicación en el informe.

**El caso del Mirandés, en vivo mientras se anotaba la muestra de H-3**, es el más
claro de los seis porque tiene referencia externa independiente:

- 14:13:49Z la fuente da `0-1` · 14:16:49Z se retracta a `0-0` → RN-03 retiene
  `0-1` y abre su alerta.
- 14:42:51Z la fuente da `1-0` (gol del Mirandés, confirmado por radio galega a
  las 14:42:29Z). **Tampoco se publica**: sigue `0-1` en la v53 de las 14:52:51Z.
- **Y esa segunda regresión NO abrió alerta propia**: solo hay una fila de
  `mirandes-unionistas` en `alerts`. O sea que **la cuenta de alertas subestima
  el daño**: seis alertas no son seis marcadores mal, son seis partidos mal con
  un número de errores mayor dentro.
- Efecto colateral en CA-3: la fila `mirandes…,1-0` de `referencias.csv` saldrá
  como **no casada, «el marcador 1-0 nunca se publicó»**. No es una errata de
  quien anotó: es el defecto apareciendo por el otro lado.

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
- **Referencia externa (Alberto Fojo, sábado 26): el partido acabó 2-0.** Fuente:
  crónica de Marca del 2026-09-25. O sea que **el marcador publicado era falso**
  y el `finished` con el que cerramos también.
- **El tamaño del defecto, medido**: las 75 observaciones que van de 19:46:04Z a
  20:23:06Z dicen **2-0 las 75, sin una sola discrepancia**; el motor sostuvo
  2-1 durante **37,0 min** y emitió **39 de sus 100 decisiones bajo RN-03**,
  incluida la última. El marcador fantasma (2-1) vivió **dos** observaciones,
  60 s; su corrección se confirmó **75 veces**.
- **Y no es un bug del motor: el motor cumple RN-03 al pie de la letra.**
  `reglas.md`: «Un marcador no baja salvo **por el operador**. Si la fuente
  ganadora propone un marcador menor que el vigente, se mantiene el vigente y se
  abre una Alert.» El orden de ADR-004 pone RN-03 por encima de RN-02, así que
  el cierre hereda el marcador retenido. Todo correcto según lo escrito.
- **Lo que está mal es la regla**, y su único camino de vuelta —el operador— es
  **EPIC-004**, dos épicas más allá. Hasta entonces, cada gol anulado por el VAR
  deja un marcador falso publicado hasta el final del partido y un `finished`
  falso para siempre. Con 39 partidos por delante esto **se va a repetir**.
- **Decisión que fuerza, y de quién es**: RN-03 vive en `reglas.md` y su
  prioridad en ADR-004, así que la letra es de **sdd-arquitecto** (vía
  `/sdd-orquestador`), no un parche.
  **CORREGIDO el 2026-09-28 con las 8 regresiones medidas**: aquí se propuso un
  umbral de «dos o tres confirmaciones seguidas» para aceptar una bajada. **El
  dato lo refuta**, y está en «Umbral de confirmaciones» más abajo: el número de
  confirmaciones **no separa** una corrección real de un error de la fuente.
- **Consecuencia para el lunes**: `--contrastar` de CA-5 dará **discrepancia**
  aquí (nosotros `2-1`, el proveedor `2-0`), y cada partido con gol anulado dará
  otra. Eso apunta a la rama **(c2)** de CA-9 —ingesta sana, decisiones
  equivocadas—, que **no** obliga a repetir la jornada: se corrige y se recalcula
  el log sobre las observaciones guardadas (ADR-004, SPEC-007 CA-8). La ingesta
  de este partido salió perfecta, y eso es lo irrepetible (N-3).
- **No se arregla nada ahora**: el código está congelado (decisión del
  2026-09-22), la rama (c2) se decide con el informe, y tocar el dato invalidaría
  el criterio 5. Esto es la medición **haciendo su trabajo**: ningún test contra
  fixtures del repo podía encontrarlo.
