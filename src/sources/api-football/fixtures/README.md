# Fixtures de API-Football (calendario)

Respuestas crudas de `GET https://v3.football.api-sports.io/fixtures?league=<id>&season=2024`
(plan Free: solo temporadas 2021-2024), capturadas el 2026-09-21 con la cabecera
`x-apisports-key` y `User-Agent: marcador.gal (calendario; https://marcador.gal)`.
El cuerpo se guarda tal cual (sin cabeceras de respuesta ni clave), recortando
`response` a las jornadas indicadas y ajustando `results` al recuento recortado.

| Fichero | Liga | Recorte |
|---|---|---|
| `fixtures-439-2024.json` | 439 Tercera División RFEF - Group 1 (18 equipos) | `Group 1 - 1`, `Group 1 - 2`, `Group 1 - 3` (27 partidos) |
| `fixtures-141-2024.json` | 141 Segunda División (22 equipos) | `Regular Season - 1`, `Regular Season - 2` (22 partidos) + `Promotion Play-offs - final` (ronda no regular) |

La temporada 2024 estaba terminada en la captura: todos los partidos son `FT`
(o `AET`), así que no hay ningún `PST`/`TBD` real; el test deriva ese caso de
un partido real cambiando `status.short` en memoria.

Comando de captura (sin la clave en el repo):

```sh
set -a; . ./.env; set +a
curl -s -H "x-apisports-key: $API_FOOTBALL_KEY" \
  -H "User-Agent: marcador.gal (calendario; https://marcador.gal)" \
  "https://v3.football.api-sports.io/fixtures?league=439&season=2024"
```
