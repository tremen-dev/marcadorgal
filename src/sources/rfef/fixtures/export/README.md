# Fixtures del export de explorer (SPEC-038 CA-1)

Respuestas reales de `GET /api/export/matches?date=<YYYY-MM-DD>` del servicio
**explorer** (`marcadorgal-explorer`, fuera de este repo), con el contrato de
ADR-023 §4, guardadas **sin recortar**: el cuerpo tal cual lo sirvió el
endpoint, byte a byte (el `Content-Length` de la respuesta es el tamaño del
fichero; `explorer.test.ts` lo comprueba). Los tests corren contra estos
ficheros, nunca contra la red. Para ninguna captura se hizo una petición a
`marcadores.rfef.es`: explorer sirve lo que ya tenía en Postgres.

Dos juegos de los mismos tres días:

- `export-<fecha>.json`: el **endpoint desplegado** en Vercel
  (`https://marcadorgal-explorer.vercel.app`), el que consume el tick. Son el
  contrato de CA-1.
- `export-local-<fecha>.json`: el mismo código (`src/export/export-matches.ts`
  de explorer) corriendo en local una hora antes, **durante la jornada**: es el
  único juego con filas `LIVE_PROVISIONAL` reales, y se conserva por eso.

`biome.json` excluye estos JSON del formateador para que sigan byte a byte
(`!src/sources/rfef/fixtures/export/*.json`).

## Endpoint desplegado (Vercel), 2026-11-01 23:15Z

Capturas del titular con el Bearer real contra
`https://marcadorgal-explorer.vercel.app/api/export/matches?date=<fecha>`
(`Authorization: Bearer <RFEF_EXPLORER_TOKEN>`; el token no está en ningún
fichero de esta carpeta). Las cabeceras de cada respuesta están en el
`export-<fecha>.headers` de al lado (sin la petición, finales de línea
normalizados a LF): `HTTP/1.1 200 OK`, `Cache-Control: no-store`,
`Content-Type: application/json; charset=utf-8`, `Server: Vercel`,
`X-Vercel-Cache: BYPASS`. Hechas después del último partido del día
(`lastSeenAt` 22:58Z en todas las filas): no hay ninguna `LIVE_PROVISIONAL`.

| Fichero | Petición | `exportedAt` | `Date` del servidor | Filas | Contenido |
|---|---|---|---|---|---|
| `export-2026-10-31.json` | `?date=2026-10-31` | `2026-11-01T23:15:02.917Z` | `Sun, 01 Nov 2026 23:15:02 GMT` | 25 | todas `FINISHED`: 16 de las cinco competiciones (4 Primera, 4 Segunda, 4 Primera RFEF, 2 Segunda RFEF, 2 Tercera) y 9 de juvenil (`26991075`, `33836117`) |
| `export-2026-11-01.json` | `?date=2026-11-01` | `2026-11-01T23:15:03.547Z` | `Sun, 01 Nov 2026 23:15:03 GMT` | 36 | 35 `FINISHED` y 1 `POSTPONED` (CD Tenerife – FC Andorra, Segunda J12, sin marcador, `strategy: none:scheduled`); 28 de las cinco competiciones (4 Primera, 3+1 Segunda, 6 Primera RFEF, 7 Segunda RFEF, 7 Tercera) y 8 de juvenil. **0 filas duplicadas**: el explorer desplegado deduplica (F-SPEC-038-6). Es el día que explorer leyó por POST a través de proxies |
| `export-2026-11-02.json` | `?date=2026-11-02` | `2026-11-01T23:15:04.032Z` | `Sun, 01 Nov 2026 23:15:04 GMT` | 4 | solo `SCHEDULED` (1 Primera, 3 Segunda): nada que observar |

## Endpoint en local, 2026-11-01 22:07Z

Las tres capturas se tomaron el 2026-11-01 (22:07:51Z) contra el endpoint
**corriendo en local** (`npm run dev` de explorer) sobre su Postgres, con los
datos que explorer había leído de `marcadores.rfef.es` a lo largo del
2026-11-01 (de 12:09Z a 20:51Z, 13 grupos, 170 partidos). Petición con
`Authorization: Bearer <RFEF_EXPLORER_TOKEN>`, respuesta `200`,
`Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store`.
En la misma sesión se comprobaron el `401` sin Bearer y el `400` con fecha
mal formada. El explorer en local de entonces **no** deduplicaba filas.

| Fichero | Petición | `exportedAt` | Filas | Contenido |
|---|---|---|---|---|
| `export-local-2026-10-31.json` | `?date=2026-10-31` | `2026-11-01T22:07:51.229Z` | 42 | 33 `FINISHED` (14 de las cinco competiciones: 4 Primera, 4 Segunda, 4 Primera RFEF, 2 Segunda RFEF; el resto, femenino y juvenil), 9 `SCHEDULED`. Las 9 `SCHEDULED` son filas de Tercera y juvenil del panel de jornada, **con marcador** pero sin estado: el adaptador no les hace caso (ADR-023 §5) |
| `export-local-2026-11-01.json` | `?date=2026-11-01` | `2026-11-01T22:07:51.253Z` | 78 | 27 `FINISHED`, 14 `LIVE_PROVISIONAL`, 37 `SCHEDULED`; 12 grupos: los cinco de D-3 (`33836085`, `33836087`, `33836089`, `33836092`, `26991073`) más juvenil (`26991075`, `26992215`, `33836117`) y femenino (`33836143`, `33836145`, `33836148`, `33836149`). 39 filas con `codEquipo*` null y 40 con `codActa` null (el panel no los da en Tercera ni en las filas de jornada). Nombres de Tercera en minúsculas y con comillas (`r.c. celta "B"`). Un mismo partido aparece a veces dos veces (28 pares): la fila `SCHEDULED` del panel de jornada (sin `codActa`) y la fila con estado del panel de resultados |
| `export-local-2026-11-02.json` | `?date=2026-11-02` | `2026-11-01T22:07:51.269Z` | 9 | solo `SCHEDULED` (Primera, Segunda y una de femenino): nada que observar |

## Lo que las capturas tienen y lo que no

- **Desplegado, 11-01:** las cinco competiciones dan `finished` (27, Tercera
  incluida) y el `POSTPONED` real sale `postponed` sin marcador. Nada
  `skipped`, nada `unresolved`.
- **Local, 11-01:** 13 `FINISHED` (3 Primera, 3 Segunda, 4 Primera RFEF, 3
  Segunda RFEF) y 7 `LIVE_PROVISIONAL` de las cinco competiciones. Con el
  kickoff del calendario declarado y la ventana de ADR-023 §5, solo dos salen
  `live` (Amorebieta–Gimnástica, `lastSeenAt` 18:12:37Z, kickoff 17:00Z;
  Extremadura–Unionistas, 20:42:37Z, kickoff 20:00Z); las otras cinco son
  filas vistas horas después de su kickoff (p. ej. Arenteiro–Céltiga, 12:00
  local, vista a las 20:50Z) y salen `skipped: ambiguous_state`. Tercera no da
  ninguna observación en las capturas locales: sus filas son `SCHEDULED` (el
  2026-10-31, con marcador) o `LIVE_PROVISIONAL` fuera de ventana.
- **Hay** un `POSTPONED` real (Tenerife–Andorra, desplegado 11-01). **No hay**
  `SUSPENDED` ni `discardedReadings > 0` reales en ningún juego: no hubo
  suspendidos y explorer no descartó ninguna lectura. `explorer.test.ts`
  deriva esos dos casos de filas reales mutadas en memoria y lo dice en el
  nombre del caso.
- `strategy` siempre es `static:*` o `none:scheduled`: ninguna fila resuelta
  por `vm` ni `playwright` (ADR-023, follow-ups).
- El desplegado no trae ninguna fila de femenino ni del juvenil `26992215`
  (7 grupos frente a los 12 del local); las de femenino están en el local.

## Proveedor abierto (SPEC-069), 2026-11-09 20:34Z

`export-2026-11-09-proveedores.json` **no es byte a byte**: es la respuesta
real del endpoint desplegado a `?date=2026-11-09` (`exportedAt`
`2026-11-09T20:34:48.506Z`, 3 filas `LIVE_PROVISIONAL`, explorer v2.0 con
arbitraje entre proveedores), guardada en el QA de SPEC-039 como
`export-2026-11-09-dia-2034Z.json` (sha256 `3d93ca3f…6a24a4`, 2257 bytes), con
**un solo campo cambiado**: el `liveProvider` de UD Las Palmas – CD Eldense pasa
de `"espn"` a `"proveedor-inventado"`. Quedan una fila `"espn"` (CE Sabadell FC
– Real Sociedad B, descanso), una inventada y una `"marca"` (Liga F, fuera de
las cinco competiciones). No tiene `.headers`: no es una captura íntegra.

## Emparejamiento estricto (SPEC-070), 2026-11-08

`export-2026-11-08-emparejamiento.json` **no es byte a byte**: son dos filas
copiadas tal cual (mismo contenido, reserializado con 2 espacios) de la
respuesta real del endpoint desplegado a `?date=2026-11-08` guardada en el QA
de SPEC-039 como `docs/epicas/EPIC-004-fuente-rfef/_qa/SPEC-039/export-2026-11-08-acta.json`
(`exportedAt` `2026-11-09T11:42:38.910Z`, 33 filas, sha256 `25a7abd8…3efc5fc3`,
24539 bytes), con su `exportedAt` y su `date`:

- `70692248`: juvenil (`codGrupo` 33836117, fuera del mapa), Real Oviedo –
  Real Sporting de Gijón, 16:30, `FINISHED` 0-0, **sin**
  `canonicalCompetitionId`. Es la fila que `historico:sync --dry-run` tomó
  por Sporting–Valladolid.
- `70695047`: Segunda (`codGrupo` 33836087), Real Sporting de Gijón – Real
  Valladolid CF, 18:30, `FINISHED` 1-2, 3 goles. La buena.

No tiene `.headers`: no es una captura íntegra.

## Ventana (SPEC-071), 2026-11-10 02:14Z

`export-2026-10-31-celta-fortuna-cordoba.json` es la respuesta **byte a byte**
del endpoint desplegado a `?date=2026-10-31`, pedida por el implementador de
SPEC-071 con el Bearer real (GET de solo lectura; el token no está en ningún
fichero). Cabeceras en `export-2026-10-31-celta-fortuna-cordoba.headers`
(`HTTP/1.1 200 OK`, `Content-Length: 18668`, `Date: Tue, 10 Nov 2026 02:14:39
GMT`, `X-Vercel-Cache: BYPASS`). `exportedAt` `2026-11-10T02:14:39.574Z`, 25
filas, sha256 `8f6f588b…babc26ce`. A diferencia de `export-2026-10-31.json`
(capturado el 11-01), trae los campos de explorer v2 (`canonical*`,
`liveProvider`, `goals`). La fila que importa es `70695028`: Segunda J12, RC
Celta Fortuna – Córdoba CF, `18:30`, `FINISHED` 2-2, 4 goles; el calendario
declarado la tiene el 2026-11-01 a las 16:00Z (relleno), y SPEC-071 CA-1 la
empareja por la ventana de ±3 días.

## Calendario de Segunda RFEF (SPEC-074), 2026-11-10 10:26Z

`calendar-segunda-rfef-g1-2026-27-2026-11-10.json` es la respuesta **byte a
byte** de otro endpoint del explorer desplegado,
`GET /api/export/calendar?competition=segunda-rfef-g1&season=2026-27` (el que
lee `calendario:sync`, ADR-026), pedida por el implementador de SPEC-074 con
el Bearer real (GET de solo lectura; el token no está en ningún fichero).
Cabeceras en el `.headers` de al lado (`HTTP/1.1 200 OK`,
`Content-Length: 51073`, `Date: Tue, 10 Nov 2026 10:26:47 GMT`,
`X-Vercel-Cache: BYPASS`). `exportedAt` `2026-11-10T10:26:48Z`, 18 equipos,
306 partidos, sha256 `1c3f9a6b…c3087ff2`. Trae las filiales con su nombre
nuevo (`alaves-b` «Alavés B», `eibar-b` «Eibar B», `astorga` «Atlético
Astorga») y `racing-ferrol` «Racing Club de Ferrol» para Rayo Cantabria.
`sync-rfef.test.ts` (`src/calendar/`) la sincroniza contra el calendario y el
alias del repo (SPEC-074 CA-1). No es un export de partidos: `alias.test.ts`
la lee con los demás `.json` y no encuentra filas con `codGrupo`.

## Alias

`data/alias/2026-27/rfef.json` resuelve todos los nombres de las cinco
competiciones de los seis ficheros (`npm run alias:rfef -- --export <fichero>`
lista los que faltan: 0 en cada uno; `alias.test.ts` lo exige sobre todos los
`.json` de esta carpeta). `gran peña f.c.` (Tercera, J9 contra Villalbés)
apunta a `celta-c`: el titular confirmó (2026-11-02) que Gran Peña FC es el
Celta C; el nombre que el calendario declarado le da («RC Celta C») se corrige
en `data/calendario/2026-27/tercera-rfef-g1.json` como entrada de EPIC-MANT
(F-SPEC-038-1).
