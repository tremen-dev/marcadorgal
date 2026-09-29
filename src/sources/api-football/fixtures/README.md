# Fixtures de API-Football

Respuestas crudas de `https://v3.football.api-sports.io`, capturadas con la
cabecera `x-apisports-key` (nunca en el repo) y el `User-Agent` indicado. El
cuerpo se guarda tal cual, sin cabeceras de respuesta ni clave; si se recorta
`response`, se ajusta `results` al recuento recortado. Los tests corren contra
estos ficheros, nunca contra la red.

## Calendario (SPEC-004)

`GET /fixtures?league=<id>&season=2024` (plan Free: solo temporadas 2021-2024),
2026-09-21, `User-Agent: marcador.gal (calendario; https://marcador.gal)`.

| Fichero | Liga | Recorte |
|---|---|---|
| `fixtures-439-2024.json` | 439 Tercera División RFEF - Group 1 (18 equipos) | `Group 1 - 1`, `Group 1 - 2`, `Group 1 - 3` (27 partidos) |
| `fixtures-141-2024.json` | 141 Segunda División (22 equipos) | `Regular Season - 1`, `Regular Season - 2` (22 partidos) + `Promotion Play-offs - final` (ronda no regular) |

La temporada 2024 estaba terminada en la captura: todos los partidos son `FT`
(o `AET`), así que no hay ningún `PST`/`TBD` real; el test deriva ese caso de
un partido real cambiando `status.short` en memoria.

## Resultados (SPEC-005 CA-7)

Plan Pro, `User-Agent: marcador.gal (ingesta; https://marcador.gal)`.

| Fichero | Petición | Captura (UTC) | Recorte | Contenido |
|---|---|---|---|---|
| `ids-2026-09-21.json` | `GET /fixtures?ids=1569926-1569935-1569941-1570389-1570397-1570399-1570753-1570754-1570759-1572049-1572050-1572057-1612726-1612727-1612732` | 2026-09-21T12:42:48Z | ninguno (15 partidos, `results: 15`; el proveedor incluye `events`, `lineups`, `statistics` y `players`, que el adaptador ignora) | 10 `FT` de la jornada anterior de las cinco ligas (140, 141, 435, 875, 439; tres con `extra` real: 1570753 `90+5`, 1570754 `90+7`, 1572050 `90+5`), 4 `NS` de la jornada siguiente (141, 435, 875, 439) y 1570389 Levante - Athletic Club (`primera-division-2026-27-j6-levante-athletic-club`), que era `TBD` en el calendario y el proveedor ya da como `PST` |
| `live-all-2026-09-21.json` | `GET /fixtures?live=all` | 2026-09-21T12:51:12Z | ninguno (`results: 9`) | 9 partidos en juego en ligas ajenas (ninguna de las cinco): 3 `1H`, 4 `HT` (tres con `extra` real del primer tiempo: `45+3`, `45+3`, `45+6`), 2 `2H` en el añadido (`90+1`, `90+2`). No había `ET` ni `P` en juego en ese momento |
| `errors-live-2026-09-22.json` | `GET /fixtures?live=439` | 2026-09-22T22:07:38Z (intento fallido del ensayo de CA-6 de SPEC-009) | ninguno (`results: 0`, `response: []`) | Cuerpo de un **200 con `errors`**: `live` = «The Live field does not match the regular expression: [id-id-id...] or string: all.». Es la respuesta al id de liga suelto que producía `live=${leagues.join("-")}` con una sola competición en ventana, y el caso que reproduce la noche del 22 sin salir a la red (SPEC-011 CA-4). **Procedencia:** el valor de `errors` es el error literal registrado en los 23 intentos fallidos seguidos de esa noche; el sobre (`get`, `parameters`, `results`, `paging`, `response`) es el de este mismo endpoint, idéntico al de los dos ficheros de arriba. El objeto crudo del bucket del que sale está anotado en el ledger de SPEC-011 (N-5: la clave va al ledger, nunca al fixture) |
| `live-2026-09-26.json` | `GET /fixtures?live=140-141-435-875-439` | 2026-09-26T15:10:00Z (captura de CA-8 de SPEC-009, automatizada en GitHub Actions; run 36235253961) | ninguno (`results: 5`, `errors: []`) | **Primera respuesta con partidos de las cinco ligas realmente en juego**, y por tanto el cierre de F-SPEC-005-1. 5 partidos de **cuatro** de las cinco ligas —Primera División no jugaba esa jornada (H-1 de SPEC-009)—: 435 Cultural Leonesa 2-0 Coria (`1H` 37'), 435 Lugo 1-0 Racing Ferrol (`1H` 37'), 875 Amorebieta 0-0 Ourense CF (`1H` 10'), 439 Atlético Arteixo 0-1 Alondras (`1H` 10') y 141 Granada 0-2 Andorra (`HT` 45'). Cuatro `1H` con `elapsed` y un `HT`: el caso «live resuelto con `minute`» deja de derivarse en memoria |

## Jornada medida (SPEC-012 CA-3)

Crudo del raw store (ADR-007), no una petición nueva: las capturas que el tick
guardó en `raw/api-football/2026-09-25/` y que citan las `observations` del
partido, descargadas en solo lectura el 2026-09-29. Cada captura es el sobre
`RawCapture` tal cual lo guardó el almacén (`sourceId`, `capturedAt`,
`requests[]` con `url`, `status`, `contentType` y `body`; sin cabeceras ni
clave), descomprimido del `.json.gz` y comparado byte a byte con el objeto del
bucket. Van juntas en un array JSON ordenado por `capturedAt` y comprimido con
brotli (9 458 962 → 21 706 bytes): los cuerpos traen `events`, `lineups`,
`statistics` y `players`, y en claro serían 9,5 MB.

| Fichero | Petición | Captura (UTC) | Recorte | Contenido |
|---|---|---|---|---|
| `girona-albacete-2026-09-25.json.br` | `GET /fixtures?ids=1569941` (una por captura) | 2026-09-25T18:20:00.877Z → 20:23:06.436Z (247 capturas, cada ~30 s; ventana completa del partido) | ninguno (`results: 1` en las 247) | Girona 2-0 Albacete, 141 Segunda División, J7. La fuente da `live 2-1` de 19:45:04Z a 19:45:34Z (2 capturas) y vuelve a `2-0`; cierra `FT 2-0`. Es el caso de RN-03 de SPEC-009 N-9: el motor de la jornada (812c805) publica `finished 2-1`, el de ADR-010 §1 `finished 2-0` (`src/decide/replay.test.ts`) |

Comando (la clave de servicio sale de `.env`; solo `GET`, nada se escribe):

```sh
set -a; . ./.env; set +a
# por cada raw_ref de las observations del partido (raw/<key>):
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/raw/<key>" | gunzip
# y se juntan en un array por capturedAt, comprimido con
# zlib.brotliCompressSync (calidad 11, ventana 24).
```

Para leerlo: `zcat` no sirve; `node -e 'process.stdout.write(require("zlib").brotliDecompressSync(require("fs").readFileSync(process.argv[1])))' <fichero>`.
Antes de commitear, además de `git grep`, se busca la clave en el contenido
descomprimido: el binario no la mostraría aunque estuviera.

Comando de captura (la clave sale de `.env`, H-1):

```sh
set -a; . ./.env; set +a
UA="marcador.gal (ingesta; https://marcador.gal)"
curl -s -H "x-apisports-key: $API_FOOTBALL_KEY" -H "User-Agent: $UA" \
  "https://v3.football.api-sports.io/fixtures?ids=<ids unidos por ->" > ids-<fecha>.json
curl -s -H "x-apisports-key: $API_FOOTBALL_KEY" -H "User-Agent: $UA" \
  "https://v3.football.api-sports.io/fixtures?live=all" > live-all-<fecha>.json
curl -s -H "x-apisports-key: $API_FOOTBALL_KEY" -H "User-Agent: $UA" \
  "https://v3.football.api-sports.io/fixtures?live=140-141-435-875-439" > live-<fecha>.json
```

Antes de commitear: `git grep -qF "$API_FOOTBALL_KEY"` debe salir sin
coincidencias.
