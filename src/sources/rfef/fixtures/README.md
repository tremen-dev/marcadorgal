# Fixtures de la RFEF (SPEC-031 CA-1)

Respuestas reales de `https://marcadores.rfef.es/pnfg/NPcd/NFG_CMP_Paneles`
(PNFG, Novanet), sin recortar. Los tests corren contra estos ficheros, nunca
contra la red. Se leen como el texto de `TextDecoder("iso-8859-15")` sobre los
bytes del servidor (`fixture-files.ts`):

- `.raw`: los bytes tal cual llegaron (ISO-8859-15, `curl --compressed`),
  sin cabeceras. Del sondeo del 2026-10-10 (`EPIC-004/_qa/sondeo/`, donde
  están convertidos a UTF-8; el test de CA-1 comprueba que coinciden).
- `.html`: capturas de las que solo se conservó el texto ya decodificado
  (UTF-8), sin bytes ni cabeceras. Se guardan tal cual.

Sesión: `JSESSIONID` de un GET previo a `https://marcadores.rfef.es/pnfg/`
(ADR-017 §1). La cookie nunca está en el fixture.
`User-Agent: marcador.gal (ingesta; https://marcador.gal)`.

Parámetros base (`Q`): `cod_primaria=3001668&grupo_categoria=900163685,900163686&resultados=1&columna=1&extendido=1&no_paginacion=1&tipo_peticion=1`.

| Fichero | Petición | `Date` del servidor (UTC) | Procedencia |
|---|---|---|---|
| `paneles-masculino.html` | GET, panel masculino de todas las federaciones (parámetros exactos no conservados) | no conservada; fichero de las 20:49Z | sondeo, texto UTF-8 |
| `paneles-femenino-fed3.html` | GET, panel femenino `federacion=3` (parámetros exactos no conservados) | no conservada; fichero de las 20:49Z | sondeo, texto UTF-8 |
| `paneles-masculino-enjuego-2026-10-10T21-25-32Z.raw` | GET `Q&Sch_en_juego=1`, masculino sin `federacion=3` (trae Segunda Federación G5) | Sat, 10 Oct 2026 21:25:32 GMT | sondeo `arq/enjuego.raw` + `h1.txt` |
| `paneles-masculino-fed3-2026-10-10T21-25-36Z.raw` | GET `Q&federacion=3`: **la petición de ADR-017 §1** | Sat, 10 Oct 2026 21:25:36 GMT | sondeo `arq/fed3.raw` + `h2.txt` |
| `paneles-fed3-enjuego-GET-hacia-2026-10-10T21-28Z.raw` | GET `Q&federacion=3&Sch_en_juego=1` | no conservada; hacia las 21:28Z | sondeo `arq/get.raw` |
| `paneles-fed3-enjuego-2026-10-10T21-33-30Z.raw` | GET `Q&federacion=3&Sch_en_juego=1` | Sat, 10 Oct 2026 21:33:30 GMT | sondeo `arq/enj3-1.raw` + `.h` |
| `paneles-fed3-enjuego-2026-10-10T21-40-32Z.raw` | GET `Q&federacion=3&Sch_en_juego=1` | Sat, 10 Oct 2026 21:40:32 GMT | sondeo `arq/enj3-2.raw` + `.h` |
| `paneles-fed3-enjuego-2026-10-10T21-47-34Z.raw` | GET `Q&federacion=3&Sch_en_juego=1` | Sat, 10 Oct 2026 21:47:34 GMT | sondeo `arq/enj3-3.raw` + `.h` |
| `sin-cookie-aceptada.html` | respuesta sin la cookie de sesión aceptada («No se ha aceptado el cookie»), 117 B | no conservada; 20:48Z | sondeo, `rfef.html`. Cuerpo real de no-panel para CA-4 (vi) |

Todas las respuestas con `Content-Type: text/html;charset=ISO-8859-15`.
La cabecera `Date` iba ~124 s por delante del reloj local (ADR-017): no se usa
como `capturedAt` sin corregir. En los tests, `capturedAt` es un parámetro.

## Marcas por partido y minuto

Del sondeo (2026-10-10), filas con marcador de las cinco competiciones.
Kickoff local (Europe/Madrid, CEST = UTC+2). `parpadea` = `<span
class=parpadea>` en la celda; enlace = `verPartido(acta)` (acta cerrada),
`verPartidoEnJuego(acta)` o ninguno.

| Partido (grupo) | Kickoff local | Captura | Marcador | `parpadea` | Enlace |
|---|---|---|---|---|---|
| Málaga–Espanyol (Primera, 33836085) | VIE 09-10 21:00 | 21:25:36Z | 1-1 | no | `verPartido` |
| Rayo–Athletic (Primera) | SÁB 10-10 14:00 | 21:25:36Z | «Suspendido» | no | `verPartido` |
| Real Madrid–Villarreal (Primera) | SÁB 10-10 21:00 | 21:25:36Z … 21:47:34Z | 0-0 | **sí, hasta 21:47Z** (kickoff +167 min) | ninguno |
| Celta Fortuna–Real Sociedad B (Segunda, 33836087) | SÁB 10-10 21:00 | 21:25:36Z, 21:33:30Z, 21:40:32Z | marcador | no (sí en `paneles-masculino`, 20:49Z) | ninguno |
| Fabril–Racing Ferrol (Primera Fed., 33836089) | SÁB 10-10 16:30 | 21:25:36Z | 0-1 | no | `verPartido` |
| Mirandés–Zamora (Primera Fed.) | SÁB 10-10 21:00 | 21:25:32Z … 21:28Z | marcador | sí | `verPartidoEnJuego` |
| Atl. Arteixo–Somozas (Tercera, 26991073) | SÁB 10-10 17:02 | 21:25:36Z | marcador | no | ninguno |
| Pontevedra B–Portonovo (Tercera) | SÁB 10-10 20:00 | 21:25:36Z | marcador | no | ninguno |

**Minuto:** ninguna captura del panel trae el minuto (ADR-017 §8.2). La ficha
`NFG_CmpPartidoEnJuego` no está entre los fixtures.

## Serie de campo del 2026-10-11 (H-4) — PENDIENTE

La serie (`<scratchpad>/campo-2026-10-11/`, fuera del repo) se captura el
domingo 2026-10-11 de 09:30Z a 20:00Z. Cuando exista, entran aquí los fixtures
que pide CA-1 (un partido de Segunda o Tercera Federación en juego, el paso de
juego a final y de final a acta cerrada, y un «Suspendido» o «Aplazado» si los
hay), con su fila en la tabla de marcas y si el panel trae el minuto.
