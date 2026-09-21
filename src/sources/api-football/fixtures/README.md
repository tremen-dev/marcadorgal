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
| `live-<fecha>.json` | `GET /fixtures?live=140-141-435-875-439` | **pendiente** | — | Primera ventana con partidos de las cinco ligas: viernes 2026-09-25 18:30Z o después (F-SPEC-005-1). Hasta entonces el caso «live resuelto» se deriva en memoria de `ids-2026-09-21.json` y de `live-all-2026-09-21.json` |

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
