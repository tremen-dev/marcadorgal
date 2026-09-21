# REVISAR — borrador 2026-27 (H-2 de SPEC-004)

Generado por `npm run calendario:sync -- 2026-27` el 2026-09-21 con los nombres del
proveedor tal cual (API-Football). Nada de esto está revisado: los nombres canónicos
de la federación (D-2: ni traducidos, ni abreviados) y los ids slug definitivos los
fija el humano editando `data/calendario/2026-27/<competición>.json` y
`data/alias/2026-27/api-football.json` antes de `npm run calendario:load`.

Cambiar un `id` de equipo exige tocar `teams`, `matches` (home/away) y el `teamId` del
alias; `npm test` (src/calendar/data.test.ts) detecta incoherencias. Borrar este
fichero cuando la revisión esté hecha y anotada en el ledger.

## Competiciones pendientes de nombre canónico (N-10)

| Fichero | `name` actual | Equipos | Jornadas |
|---|---|---|---|
| `primera-division.json` | Primera División | 20 | 38 |
| `segunda-division.json` | Segunda División | 22 | 42 |
| `primera-rfef-g1.json` | Primera RFEF Grupo 1 | 20 | 38 |
| `segunda-rfef-g1.json` | Segunda RFEF Grupo 1 | 18 | 34 |
| `tercera-rfef-g1.json` | Tercera RFEF Grupo 1 | 18 | 34 |

## Equipos pendientes de nombre canónico e id definitivo

Columnas: id propuesto (slug del nombre del proveedor), `name` actual (= nombre del proveedor), id externo en API-Football.

### primera-division (20)

| id propuesto | name actual | externalId |
|---|---|---|
| `alaves` | Alaves | 542 |
| `athletic-club` | Athletic Club | 531 |
| `atletico-madrid` | Atletico Madrid | 530 |
| `barcelona` | Barcelona | 529 |
| `celta-vigo` | Celta Vigo | 538 |
| `deportivo-la-coruna` | Deportivo La Coruna | 544 |
| `elche` | Elche | 797 |
| `espanyol` | Espanyol | 540 |
| `getafe` | Getafe | 546 |
| `levante` | Levante | 539 |
| `malaga` | Malaga | 535 |
| `osasuna` | Osasuna | 727 |
| `racing-santander` | Racing Santander | 4665 |
| `rayo-vallecano` | Rayo Vallecano | 728 |
| `real-betis` | Real Betis | 543 |
| `real-madrid` | Real Madrid | 541 |
| `real-sociedad` | Real Sociedad | 548 |
| `sevilla` | Sevilla | 536 |
| `valencia` | Valencia | 532 |
| `villarreal` | Villarreal | 533 |

### segunda-division (22)

| id propuesto | name actual | externalId |
|---|---|---|
| `ad-ceuta-fc` | AD Ceuta FC | 10139 |
| `albacete` | Albacete | 722 |
| `almeria` | Almeria | 723 |
| `burgos` | Burgos | 9580 |
| `cadiz` | Cadiz | 724 |
| `castellon` | Castellón | 5254 |
| `celta-de-vigo-ii` | Celta de Vigo II | 9571 |
| `cordoba` | Cordoba | 713 |
| `eibar` | Eibar | 545 |
| `eldense` | Eldense | 9692 |
| `fc-andorra` | FC Andorra | 8157 |
| `girona` | Girona | 547 |
| `granada-cf` | Granada CF | 715 |
| `las-palmas` | Las Palmas | 534 |
| `leganes` | Leganes | 537 |
| `mallorca` | Mallorca | 798 |
| `oviedo` | Oviedo | 718 |
| `real-sociedad-ii` | Real Sociedad II | 9585 |
| `sabadell` | Sabadell | 9593 |
| `sporting-gijon` | Sporting Gijon | 731 |
| `tenerife` | Tenerife | 719 |
| `valladolid` | Valladolid | 720 |

### primera-rfef-g1 (20)

| id propuesto | name actual | externalId |
|---|---|---|
| `arenas-getxo` | Arenas Getxo | 9578 |
| `athletic-club-ii` | Athletic Club II | 9579 |
| `barakaldo` | Barakaldo | 5251 |
| `cacereno` | Cacereño | 9384 |
| `cd-coria` | CD Coria | 9827 |
| `cultural-leonesa` | Cultural Leonesa | 725 |
| `deportivo-la-coruna-ii` | Deportivo La Coruña II | 9610 |
| `extremadura-1924` | Extremadura 1924 | 24612 |
| `lugo` | Lugo | 716 |
| `merida-ad` | Mérida AD | 10140 |
| `mirandes` | Mirandes | 799 |
| `ponferradina` | Ponferradina | 4907 |
| `pontevedra` | Pontevedra | 9407 |
| `racing-ferrol` | Racing Ferrol | 9409 |
| `real-aviles` | Real Avilés | 9632 |
| `real-union` | Real Unión | 9586 |
| `ud-logrones` | UD Logroñés | 5280 |
| `ud-ourense` | UD Ourense | 9617 |
| `unionistas-de-salamanca` | Unionistas de Salamanca | 5281 |
| `zamora` | Zamora | 9418 |

### segunda-rfef-g1 (18)

| id propuesto | name actual | externalId |
|---|---|---|
| `amorebieta` | Amorebieta | 9380 |
| `arosa` | Arosa | 9605 |
| `atletico-astorga` | Atlético Astorga | 9723 |
| `basconia` | Basconia | 9656 |
| `bergantinos` | Bergantiños | 9383 |
| `compostela` | Compostela | 5256 |
| `coruxo` | Coruxo | 9385 |
| `deportivo-alaves-ii` | Deportivo Alavés II | 9582 |
| `eibar-ii` | Eibar II | 24572 |
| `gernika` | Gernika | 5263 |
| `gimnastica-torrelavega` | Gimnástica Torrelavega | 5264 |
| `llanera` | Llanera | 9627 |
| `marino-de-luanco` | Marino de Luanco | 9401 |
| `ourense-cf` | Ourense CF | 9612 |
| `portugalete` | Portugalete | 9408 |
| `racing-santander-ii` | Racing Santander II | 9643 |
| `real-oviedo-ii` | Real Oviedo II | 9576 |
| `sestao-river` | Sestao River | 9413 |

### tercera-rfef-g1 (18)

| id propuesto | name actual | externalId |
|---|---|---|
| `alondras` | Alondras | 9603 |
| `antela` | Antela | 28094 |
| `arenteiro` | Arenteiro | 9604 |
| `atletico-arteixo` | Atlético Arteixo | 19650 |
| `barco` | Barco | 9608 |
| `boiro` | Boiro | 22566 |
| `celta-de-vigo-iii` | Celta de Vigo III | 20255 |
| `celtiga` | Celtiga | 26533 |
| `coruna` | Coruña | 26534 |
| `estradense` | Estradense | 9611 |
| `lalin` | Lalin | 28095 |
| `pontevedra-ii` | Pontevedra II | 22129 |
| `portonovo-sd` | Portonovo SD | 28096 |
| `sarriana` | Sarriana | 22130 |
| `silva` | Silva | 9615 |
| `somozas` | Somozas | 9616 |
| `villalbes` | Villalbés | 9618 |
| `viveiro` | Viveiro | 15307 |

## Avisos del sync

- Partidos con hora sin confirmar (TBD/PST) en el proveedor: `primera-division-2026-27-j6-levante-athletic-club` (la fecha del JSON es la que dio el proveedor; el próximo sync la corrige).
- Rondas ignoradas: ninguna en las cinco competiciones.
