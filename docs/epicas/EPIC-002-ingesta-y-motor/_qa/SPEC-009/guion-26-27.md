# Guion de campo — sábado 26 y domingo 27 (SPEC-009)

> Trabajo de campo de CA-8 (sábado) y CA-3 (domingo) dentro de la ventana de
> CA-7. No es una spec ni un ledger: es la lista de lo que hay que hacer, con
> hora, y dónde queda guardado cada cosa. Lo que salga de aquí lo recogen el
> lunes el informe y el ledger.

Horas en **UTC** (`Z`) y, entre paréntesis, hora local de Galicia (UTC+2).

## Punto de partida (viernes 25, 18:49Z)

`npm run tick:salud` → **OK**: pg_cron activo cada 30 s, 120 ejecuciones en la
última hora al 100 %, pg_net todo 200, `girona-albacete` en `live` con
`requests: 1` por intento y **0 alertas**. La ventana de CA-7 está abierta desde
las 18:20Z y el arreglo de SPEC-011 (una sola competición en `live=`) aguanta:
es exactamente el caso que tumbaba el tick el día 22.

## Las dos reglas que no se rompen en los cuatro días (H-2)

1. **Nada de tocar el dato.** Ni `insert`/`update`/`delete` en `observations`,
   `decisions`, `alerts`, ni `npm run ingest:tick` a mano para tapar un hueco,
   ni `npm run calendario:load` (reescribe `matches`). Si se toca, el criterio 5
   de la épica queda **invalidado** y la jornada no vale: hay que repetirla el
   2026-10-02/04. Todo lo de este guion es de **solo lectura** salvo escribir
   ficheros del repo.
2. **Tocar la plataforma se puede, pero se anota.** Reprogramar un job caído,
   corregir una variable en Vercel, despausar Supabase: permitido, **baja el
   veredicto a `válida con reservas`** y hay que escribirlo en la bitácora con
   hora y motivo. No anotarlo es peor que hacerlo.

Corolario: **no se mergea ni se despliega nada** hasta el lunes 21:00Z. Los
commits de este fin de semana son ficheros de datos y documentación en la rama
`ft/SPEC-009-jornada-de-medicion-e-informe`, sin tocar `src/` (salvo el fixture,
que es un `.json` de test).

---

## SÁBADO 26 — capturar el fixture de CA-8

12 partidos, de 11:00Z (13:00) a 16:45Z (18:45).

### T1 · 10:30Z (12:30) — salud de la mañana, 2 min

```sh
node $SCRIPT --salud      # corre tick:salud y anota la fila él solo
```

Se mira: que diga `OK`, que `succeeded` esté al 100 %, que no haya alertas sin
resolver y que `requests` por intento siga bajo. Es lectura pura, no interviene.

**Guardo:** la última línea (`OK` / `REVISAR`) y la hora.
**Dónde:** `_qa/SPEC-009/bitacora-jornada.md`, fila de la tabla.

### T2 · 15:15Z-15:45Z (17:15-17:45) — **la captura, lo único irrepetible del día**

Esa media hora es la única del sábado con las **cuatro competiciones a la vez**
en juego, que es lo que CA-8 pide del fixture:

| Partido | Competición | Desde |
|---|---|---|
| `granada-andorra` | Segunda División | 14:15Z |
| `cultural-leonesa-coria`, `lugo-racing-ferrol` | Primeira Fed. G1 | 14:30Z |
| `amorebieta-ourense-cf` | Segunda Fed. G1 | 15:00Z |
| `atletico-arteixo-alondras` | Terceira Fed. G1 | 15:00Z |

**Automatizado, y en la nube** (ver «Automatización» al final). Antes de salir
de casa, en cualquier momento entre las 09:50Z y las 15:00Z:

```sh
git push -f origin HEAD:captura-ca8
```

Eso arranca el workflow `captura-ca8` en GitHub Actions, que espera a las
15:10Z, pide cada 5 min hasta ver **≥ 4 de las cinco ligas en juego a la vez**,
se queda con la mejor captura de la ventana, escribe el fixture, lo **commitea
en la rama `captura-ca8`**, lo sube como artefacto y deja en el resumen del run
—visible desde el móvil— la fila del README ya redactada y cuántas peticiones
manuales anotar en la bitácora. No depende del portátil.

Plan B local, si se prefiere el portátil despierto y en casa:

```sh
caffeinate -i node $SCRIPT
```

A mano, si se prefiere, el `curl` sigue en el README de fixtures. En ese caso
hay que comprobar a ojo que el fichero trae partidos (`results` > 0 y varios
`status.short` en `1H`/`HT`/`2H`) y anotar la petición en la bitácora.

**Guardo:** el cuerpo de la respuesta tal cual, sin cabeceras ni clave.
**Dónde:** `src/sources/api-football/fixtures/live-2026-09-26.json` (~12-20 KB;
si pasara de 1 MB, se recorta `response` y se ajusta `results`, como dice el
README de fixtures).

### T3 · justo después — documentar el fixture y commitear

1. En `src/sources/api-football/fixtures/README.md`, sustituir la fila
   `live-<fecha>.json` **pendiente** por la real: petición, instante UTC de
   captura, recorte (ninguno) y contenido (cuántos partidos, de qué ligas, qué
   `status.short` traen).
2. Verificar que la clave no viajó al repo:
   ```sh
   set -a; . ./.env; set +a
   git grep -qF "$API_FOOTBALL_KEY" && echo "PARA: la clave está en el repo" || echo "limpio"
   ```
3. Commit en la rama: `docs(SPEC-009): fixture live-2026-09-26 de CA-8`.

**Guardo:** la fila del README y el commit.
**Dónde:** el repo, rama `ft/SPEC-009-jornada-de-medicion-e-informe`.

### T4 · 19:00Z (21:00) o cuando se pueda — encargar el test del fixture

El resto de CA-8 es código y lo hace **sdd-implementador**, no a mano:

- test en `src/sources/api-football/results.test.ts`: el fixture nuevo parsea
  con `parse` sin excepción y produce al menos una `ParsedObservation` `live`
  con `minute`, comprobando los estados tal cual vienen;
- y el **crudo real del raw store**: bajar un objeto del bucket de un partido en
  juego, `gunzipSync`, pasarlo por `parse` y anotar la salida. Es la primera vez
  que el adaptador ve un cuerpo producido por el tick desplegado, y cierra O-3
  de SPEC-007 y F-SPEC-005-1.

Esto no toca la medición (es local y de solo lectura) y puede irse al lunes sin
coste. Lo irrepetible fue T2.

**Guardo:** el test y la evidencia del parseo del crudo.
**Dónde:** el repo, y el ledger de SPEC-009 lo escribe el implementador.

### T5 · 21:30Z (23:30) — salud de la noche, 2 min

Igual que T1 (`node $SCRIPT --salud`). Si el último partido (16:45Z + ~150 min ≈ 19:15Z) ya cerró, a
partir de ahí **no debe haber ni un solo intento** hasta el domingo por la
mañana: ese silencio es la mitad «fuera de ventana» del criterio 2. Si aparecen
intentos de madrugada, no se toca nada: se anota y el lunes lo explica el informe.

---

## DOMINGO 27 — la muestra externa de CA-3 (H-3)

25 partidos, de 10:00Z (12:00) a 19:00Z (21:00). **Es el día importante**: la
franja de 14:00Z a 17:00Z (16:00-19:00 local) es la muestra que decide si se
puede hablar de latencia extremo a extremo.

### T6 · 10:00Z (12:00) — salud de la mañana, 2 min

Igual que T1 (`node $SCRIPT --salud`). Hoy interesa además mirar `requests` por intento: con 18 partidos
solapados por la tarde es cuando más se acerca al presupuesto de ≤ 6/min.

### T7 · antes de las 13:45Z (15:45) — preparar la referencia externa

Decidir **una** fuente externa y dejarla abierta: radio, TV, o la app de la
federación. Da igual cuál sea mientras se anote, pero conviene que sea una sola
y la misma toda la tarde: el número que sale de aquí es
`decided_at − instante de la referencia`, así que si se mezclan fuentes con
retardos distintos el número deja de significar nada.

Tener a mano: reloj en UTC (el móvil en hora local + 2 h mentalmente es fuente
de errores; mejor un reloj puesto en UTC) y el fichero abierto.

### T8 · 14:00Z-17:00Z (16:00-19:00) — **anotar goles, una fila por gol**

**Objetivo: ≥ 12 goles, en ≥ 3 competiciones, y Terceira o Segunda Federación
obligatoria.** El bloque de las **16:00Z (18:00): siete partidos de Terceira a
la vez** es el que hace la muestra — es el nicho del producto y lo que ningún
agregador cubre bien.

Formato de cada fila: `matchId,marcador,instante,fuente`

- `marcador` es **cómo queda el partido tras ese gol** (`1-0`, `1-1`, …).
- `instante` es **cuándo la fuente externa dice el gol**, ISO-8601 UTC con `Z`,
  al segundo si se puede: `2026-09-27T16:23:41Z`.
- `fuente` es texto libre corto y consistente: `radio-galega`, `app-rffg`, …

Con menos de 12 goles no se cae nada: el informe imprime el bloque con su `n` y
etiqueta `peor caso (n=<n>)` en vez de `p95`. Una fila mal escrita tampoco se
pierde nada: el informe la lista como **no casada** con su motivo y se puede
corregir el lunes y regenerar.

**Los `matchId` de la franja, para copiar y pegar** (ya calculados, no hay que
componerlos a mano):

```
14:00Z  primera-rfef-g1-2026-27-j5-mirandes-unionistas
14:00Z  tercera-rfef-g1-2026-27-j4-pontevedra-b-arenteiro
14:15Z  segunda-division-2026-27-j7-mallorca-almeria
15:00Z  segunda-rfef-g1-2026-27-j4-arosa-alaves-b
15:00Z  segunda-rfef-g1-2026-27-j4-bergantinos-portugalete
15:00Z  segunda-rfef-g1-2026-27-j4-coruxo-gernika
15:00Z  segunda-rfef-g1-2026-27-j4-marino-basconia
16:00Z  tercera-rfef-g1-2026-27-j4-antela-somozas
16:00Z  tercera-rfef-g1-2026-27-j4-boiro-villalbes
16:00Z  tercera-rfef-g1-2026-27-j4-celtiga-estradense
16:00Z  tercera-rfef-g1-2026-27-j4-lalin-barco
16:00Z  tercera-rfef-g1-2026-27-j4-montaneros-viveiro
16:00Z  tercera-rfef-g1-2026-27-j4-portonovo-silva
16:00Z  tercera-rfef-g1-2026-27-j4-sarriana-celta-c
16:15Z  primera-rfef-g1-2026-27-j5-merida-logrones
16:15Z  primera-rfef-g1-2026-27-j5-pontevedra-ponferradina
16:30Z  segunda-division-2026-27-j7-burgos-eldense
16:30Z  segunda-division-2026-27-j7-eibar-las-palmas
```

**Guardo:** una fila por gol, bajo la cabecera que ya existe.
**Dónde:** `docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/referencias.csv`.

### T9 · 17:15Z (19:15) — guardar y commitear el CSV

Commit: `docs(SPEC-009): referencias externas de la franja del domingo (CA-3)`.
Mejor commitear el domingo que el lunes a las 22:00 con el informe encima.

### T10 · 21:30Z (23:30) — salud de la noche

Igual que T5. El último partido (`oviedo-sporting`, 19:00Z) cierra sobre las
21:30Z; a partir de ahí, silencio hasta el lunes 18:20Z. **Ese silencio del
domingo por la noche es literalmente lo que mide la mitad «fuera de ventana»
del criterio 2**, así que no hay que hacer nada: solo no tocar.

---

## Resumen: qué queda guardado y dónde

| Qué | Dónde | Cuándo |
|---|---|---|
| Fixture `live=` de las cuatro competiciones | `src/sources/api-football/fixtures/live-2026-09-26.json` | sáb 15:15-15:45Z |
| Fila que lo documenta | `src/sources/api-football/fixtures/README.md` | sáb, justo después |
| Goles referenciados a mano | `docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/referencias.csv` | dom 14:00-17:00Z |
| Salud, incidencias e intervenciones de plataforma | `docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/bitacora-jornada.md` | las dos mañanas y las dos noches |
| Test del fixture y parseo del crudo real | repo + ledger, los escribe sdd-implementador | sáb noche o lunes |

Todo lo demás —observaciones, decisiones, alertas, intentos— **se guarda solo**.
Esa es exactamente la promesa que se está midiendo.

## Para qué sirve esto el lunes y el martes

- **Lunes 28, después de las 21:00Z**: se genera el informe con
  `npm run informe:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z --referencias … --contrastar --salida …`.
  El fixture del sábado no entra en él; el CSV del domingo es el **bloque 4**
  entero (latencia extremo a extremo) y la bitácora es lo que resuelve las tres
  declaraciones pendientes del bloque 9 (F-SPEC-009-1).
- **Martes 29**: la enmienda de CA-9 (a) en el código (N-8), luego V-8 y V-9, y
  el informe regenerado. **Ese** informe es el que lleva el veredicto bueno.

---

## Automatización

### En la nube: `.github/workflows/captura-ca8.yml` (lo principal)

Se dispara **empujando la rama** `captura-ca8`, no por `schedule`. La razón no
es capricho: un workflow programado solo corre desde la rama por omisión, y
empujar a `main` en mitad de la ventana redespliega producción en Vercel — que
es exactamente la intervención sobre la plataforma que H-2 (ii) castiga bajando
el veredicto a `válida con reservas`. Empujar `captura-ca8` no toca `main`, ni
producción, ni el tick.

```sh
git push -f origin HEAD:captura-ca8      # entre las 09:50Z y las 15:00Z del sábado
```

- **Por qué a partir de las 09:50Z**: un job de GitHub dura **6 h** como mucho y
  el job se pasa esperando a la ventana. Si se empuja antes, el script se niega
  a arrancar y lo dice, en vez de morir a las 5 h 59.
- Usa el secreto `API_FOOTBALL_KEY` **que ya existe** en el repo desde el
  2026-09-19 (lo usa `calendario-semanal.yml`): la clave no sale a ningún sitio
  nuevo.
- El fixture se commitea en `captura-ca8`, **nunca** en la rama de la spec, para
  que una captura local y esta no puedan divergir. El sábado por la noche se
  trae con `git checkout captura-ca8 -- src/sources/api-football/fixtures/live-2026-09-26.json`.
- Es **temporal**: se borra al cerrar SPEC-009, junto con la rama.

**Ensayado el viernes 25 a las 19:36Z** con ventana y destino de prueba (run
`36180127367`): esperó los 5 min, pidió en el instante exacto —`HTTP 200 ·
results 1 · ligas [141] · 1×2H`, Girona-Albacete en la segunda parte—, escribió
el fichero, subió el artefacto y el commit de vuelta entró en la rama. El
secreto llegó al job y no apareció en ningún log. Rastro del ensayo borrado
después: artefacto, rama y commit de prueba.

### En local: el script del portátil (plan B)

`$SCRIPT` = `/private/tmp/claude-501/-Users-albertofojo-src-marcadorgal/74978667-03b6-44e2-88d8-70eaee36f05f/scratchpad/captura-ca8.mjs`

Script temporal y **fuera del repo**, como el `ca6-ensayo.mjs` del ensayo de
CA-6. No toca la base de datos: solo pide al proveedor y escribe ficheros.

| Modo | Qué hace |
|---|---|
| `node $SCRIPT` | espera a la ventana, elige la mejor captura, escribe el fixture y anota |
| `node $SCRIPT --ahora` | captura ya, acepta lo que haya |
| `node $SCRIPT --probar` | una petición, no escribe el fixture; comprueba que responde |
| `node $SCRIPT --salud` | corre `tick:salud` y añade su fila a la bitácora |

Opciones: `--desde` / `--hasta` (ISO-8601 `Z`), `--cada <min>`, `--ligas <n>`
(cuántas ligas simultáneas bastan para aceptar; 4 por defecto), `--dest`,
`--forzar` (sustituir un fixture ya escrito).

Salvaguardas: no escribe si `results` es 0 o si el proveedor devuelve `errors`;
no pisa un fixture existente sin `--forzar`; nunca imprime la clave; y cuenta
las peticiones para que la bitácora cuadre con el bloque de peticiones del
informe.

Probado el viernes 25 a las 19:07Z: `HTTP 200 · results 1 · ligas [141] · 1×1H`
(Girona-Albacete en el primer tiempo), y `--salud` escribió su fila solo.
