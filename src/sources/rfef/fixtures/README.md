# Fixtures de la RFEF (SPEC-031 CA-1)

Respuestas reales de `https://marcadores.rfef.es/pnfg/NPcd/NFG_CMP_Paneles`
(PNFG, Novanet), sin recortar. Los tests corren contra estos ficheros, nunca
contra la red. Se leen como el texto de `TextDecoder("iso-8859-15")` sobre los
bytes del servidor (`fixture-files.ts`):

- `.raw`: los bytes tal cual llegaron (ISO-8859-15, `curl --compressed`),
  sin cabeceras.
- `.raw.gz`: lo mismo, comprimido con `gzip -9` tal cual lo guardó la serie de
  campo. El cargador lo descomprime.
- `.html`: capturas de las que solo se conservó el texto ya decodificado
  (UTF-8), sin bytes ni cabeceras. Se guardan tal cual.

Sesión: `JSESSIONID` de un GET previo a `https://marcadores.rfef.es/pnfg/`.
La cookie nunca está en el fixture.
`User-Agent: marcador.gal (ingesta; https://marcador.gal)`.

Parámetros (`Q`, la query de ADR-017 §1):
`cod_primaria=3001668&grupo_categoria=900163685,900163686&resultados=1&columna=1&extendido=1&no_paginacion=1&tipo_peticion=1`.

## Sondeo del 2026-10-10 (GET, posible caché)

**GET, posible caché** (ADR-018, enmienda E-1): son cuerpos reales que generó
el servidor, y valen para la decodificación (CA-2, CA-3, CA-4), pero su `Date`
**no** prueba cuándo se generó el contenido. La serie GET del 2026-10-11
devolvió durante horas la foto del sábado, así que estas capturas no sirven
como evidencia de estados.

| Fichero | Petición | `Date` del servidor (UTC) | Procedencia |
|---|---|---|---|
| `paneles-masculino.html` | GET, panel masculino de todas las federaciones (parámetros exactos no conservados) | no conservada; fichero de las 20:49Z | sondeo, texto UTF-8 |
| `paneles-femenino-fed3.html` | GET, panel femenino `federacion=3` (parámetros exactos no conservados) | no conservada; fichero de las 20:49Z | sondeo, texto UTF-8 |
| `paneles-masculino-enjuego-2026-10-10T21-25-32Z.raw` | GET `Q&Sch_en_juego=1`, masculino sin `federacion=3` (trae Segunda Federación G5) | Sat, 10 Oct 2026 21:25:32 GMT | sondeo `arq/enjuego.raw` + `h1.txt` |
| `paneles-masculino-fed3-2026-10-10T21-25-36Z.raw` | GET `Q&federacion=3` (la query de ADR-017 §1, por GET) | Sat, 10 Oct 2026 21:25:36 GMT | sondeo `arq/fed3.raw` + `h2.txt` |
| `paneles-fed3-enjuego-GET-hacia-2026-10-10T21-28Z.raw` | GET `Q&federacion=3&Sch_en_juego=1` | no conservada; hacia las 21:28Z | sondeo `arq/get.raw` |
| `paneles-fed3-enjuego-2026-10-10T21-33-30Z.raw` | GET `Q&federacion=3&Sch_en_juego=1` | Sat, 10 Oct 2026 21:33:30 GMT | sondeo `arq/enj3-1.raw` + `.h` |
| `paneles-fed3-enjuego-2026-10-10T21-40-32Z.raw` | GET `Q&federacion=3&Sch_en_juego=1` | Sat, 10 Oct 2026 21:40:32 GMT | sondeo `arq/enj3-2.raw` + `.h` |
| `paneles-fed3-enjuego-2026-10-10T21-47-34Z.raw` | GET `Q&federacion=3&Sch_en_juego=1` | Sat, 10 Oct 2026 21:47:34 GMT | sondeo `arq/enj3-3.raw` + `.h` |
| `sin-cookie-aceptada.html` | respuesta sin la cookie de sesión aceptada («No se ha aceptado el cookie»), 117 B | no conservada; 20:48Z | sondeo, `rfef.html`. Cuerpo real de no-panel para CA-4 (vi) |

Todas con `Content-Type: text/html;charset=ISO-8859-15`.

## Serie de campo del 2026-10-11 (POST, ADR-018)

`POST https://marcadores.rfef.es/pnfg/NPcd/NFG_CMP_Paneles`, sin query en la
URL, con `Content-Type: application/x-www-form-urlencoded` y este
`requestBody`:

`cod_primaria=3001668&grupo_categoria=900163685,900163686&resultados=1&columna=1&extendido=1&no_paginacion=1&tipo_peticion=1&federacion=3`

Origen: `<scratchpad>/campo-2026-10-11-post/<TS>-todos.raw.gz` y `.headers`,
fuera del repo. `capturedAt` es la `<TS>` del nombre (reloj local de la
captura). La `Date` del servidor va unos 2 min por delante.

| Fichero | `Date` del servidor | Tamaño | Contenido |
|---|---|---|---|
| `campo-post-2026-10-11T15-00-15Z-todos.raw.gz` | Sun, 11 Oct 2026 15:02:19 GMT | 166.321 B (md5 `572b697d…`) | Segunda Fed. (Arosa–Bergantiños, Coruxo–Compostela) y Tercera (Villalbés–Estradense) recién empezados con `parpadea`; Tercera de las 12:30 terminada, sin enlace; actas cerradas de Segunda Fed. |
| `campo-post-2026-10-11T15-02-24Z-todos.raw.gz` | Sun, 11 Oct 2026 15:04:28 GMT | 165.857 B (md5 `d79bb3f0…`) | la misma query dos minutos después: **bytes distintos** (ADR-018 §4) |
| `campo-post-2026-10-11T15-35-05Z-todos.raw.gz` | Sun, 11 Oct 2026 15:37:08 GMT | 168.084 B (md5 `85c5e01f…`) | Pontevedra–Mérida 0-1 y Real Sociedad–Deportivo 2-0 en juego; tres de Tercera a kickoff +5 |
| `campo-post-2026-10-11T15-12-22Z-todos-vacio.raw` | Sun, 11 Oct 2026 15:14:25 GMT, `Content-Length: 0`, sin `Content-Type` | 0 B | `200` con cuerpo vacío: el bloqueo por IP (abajo). Fixture de `empty body` (CA-4, CA-7) |

### Bloqueo por IP

La RFEF **bloquea por IP** tras unas 5 vueltas (~10 min) de consultas
automáticas. Durante el bloqueo responde a todo `200` con `Content-Length: 0`,
y los bloqueos crecen (8 → 16 → 30 → 50 → 76 → más de 80 min). Los cuerpos
vacíos de la serie son ese bloqueo, no fallos de red. Solo hubo datos en las
vueltas de 15:00:15Z a 15:07:47Z y de 15:26:27Z a 15:35:05Z. El titular
decidió cerrar SPEC-031 y pausar el alta hasta tener acceso autorizado.

## Marcas por partido (serie POST, 2026-10-11)

Diez vueltas con datos (15:00:15Z … 15:35:05Z). Kickoff local Europe/Madrid
(CEST = UTC+2); «k+N» es `capturedAt` − kickoff. `parpadea` = `<span
class=parpadea>` en la celda. Enlace = `verPartido(acta)` (acta cerrada),
`verPartidoEnJuego(acta)` o ninguno. «Última actualización» es el texto de la
ficha `NFG_CmpPartidoEnJuego` pedida **por POST** (desde 15:07:47Z), solo para
las actas con ficha en la serie; las fichas de 15:00:15Z fueron GET y no cuentan.

| Partido (grupo) | Kickoff local | Vueltas (k+N) | Marcador | `parpadea` | Enlace | Última actualización (ficha POST) |
|---|---|---|---|---|---|---|
| Coruxo–Compostela (Segunda Fed., 33836092) | 17:00 | k+0 … k+35 | 0-0 | sí | ninguno a k+0; `verPartidoEnJuego` desde k+2 | «17:00 h. (Inicio de partido)» de 15:07:47Z a 15:35:05Z |
| Arosa–Bergantiños (Segunda Fed.) | 17:00 | k+0 … k+35 | 0-0 | sí | ninguno | — |
| Villalbés–Estradense (Tercera, 26991073) | 17:00 | k+0 … k+35 | 0-0 | sí | ninguno | — |
| Céltiga–Alondras, Boiro–Viveiro, Antela–Barco (Tercera) | 17:30 | k+1 … k+5 (antes, `-`) | 0-0 | sí | ninguno | — |
| Pontevedra–Mérida (Primera Fed., 33836089) | 16:30 | k+30 … k+65 | 0-0, 0-1 desde k+56 | sí | `verPartidoEnJuego` | «17:06 h. (Minuto 33)» a 15:07:47Z; «17:23 h. (Final 1ª parte)» de 15:26:27Z a 15:35:05Z |
| Ponferradina–Avilés (Primera Fed.) | 16:30 | k+30 … k+65 | 0-0 | sí | `verPartidoEnJuego` | «17:06 h. (Minuto 32)»; luego «17:25 h. (Final 1ª parte)» |
| Real Sociedad–Deportivo (Primera, 33836085) | 16:15 | k+45 … k+80 | 0-0, 2-0 | sí | ninguno | — |
| Almería–Leganés (Segunda, 33836087) | 16:15 | k+45 … k+80 | 0-0 | sí | ninguno | — |
| Montañeros–Gran Peña (Tercera) | 12:30 | k+270 … k+305 | 3-1 | no | **ninguno** (Tercera no muestra acta) | — |
| Alavés B–Gernika, Oviedo Vetusta–Rayo Cantabria (Segunda Fed.) | 12:00, 12:30 | k+270 … k+335 | 1-1, 2-1 | no | `verPartido` | — |
| Elche–Celta (Primera), Andorra–Castellón (Segunda), Athletic B–Real Unión (Primera Fed.) | 14:00, 14:00, 12:00 | k+180 … k+335 | 0-0, 1-0, 0-0 | no | `verPartido` | — |

Contraste con ADR-017 §4. Todas las filas con `parpadea` cayeron dentro de
`[k−10, k+110)`, y todas las filas sin `parpadea` con marcador tenían enlace
`verPartido` o estaban por encima de k+100. Ninguna fila salió
`ambiguous_state`: 339 lecturas de filas con marcador, 250 `finished`, 79 `live`
y 10 `suspended_without_score` (Rayo–Athletic, del sábado). **La serie no
contradice la tabla.** No hubo ningún paso de juego a final: entre la primera
y la última vuelta con datos pasaron 35 min, y ningún partido en juego llegó al
final. Ninguna ficha POST dijo «(Final de partido)».

**Minuto:** el panel no trae el minuto. La ficha sí trae el texto de su último
evento: `<span class=ult_act_txt> Última actualización: 17:06 h. (Minuto 33) </span>`
(70695435, POST, 15:07:47Z). Es el minuto **del último evento**, no el minuto
en curso (ADR-018). Esta spec no lee la ficha y deja `minute: null`.

## Alias de prueba (CA-6)

`alias-test.json` no es el alias real (lo trae una spec siguiente): mapea los
cinco `codgrupo` y unos pocos equipos del panel de las 21:25:36Z, con tres
errores **a propósito** para los casos de identidad: CP Cacereño sin alias
(`unknown_team`), Barakaldo CF apuntando a `celta-c` (par sin partido:
`unknown_match`) y CD Coria y CD Extremadura cruzados (el par existe en la
jornada 26, no en la 7: `inconsistent_alias`).
