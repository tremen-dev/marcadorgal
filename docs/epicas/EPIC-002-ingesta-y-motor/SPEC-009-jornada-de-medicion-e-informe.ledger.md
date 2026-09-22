---
id: SPEC-009
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-009 Jornada de medicion e informe

## Resumen
- Fase: en-progreso — la mitad de código está hecha; CA-6 a CA-9 son trabajo de
  campo con fecha y no se pueden cerrar antes del lunes 2026-09-28.
- Rama: `ft/SPEC-009-jornada-de-medicion-e-informe`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/informe.ts` (puro: `percentil`, `estadisticos`, `etiquetaP95`, `parseReferencias`, `BLOQUES`, `informeJornada`) · `tools/informe-jornada.mjs` (cáscara) · `package.json` script `informe:jornada` | `src/ingest/informe.test.ts`: percentil n=1/n=2/n=100 · `etiquetaP95` · los nueve bloques y su orden · informe vacío sin lanzar (7 de 9 bloques dicen por qué) · ningún valor de `.env` en la salida · primera línea derivada de los partidos · firma del comando (5 casos por `spawnSync` sin `.env`) | | ❌ |
| CA-2 | `src/ingest/informe.ts` (`cadenciaDe`, `latenciaInternaDe`, techo propio) · `src/ingest/informe-db.ts` (`informeFilas`) | `src/ingest/informe.db.test.ts` «tres observaciones a 30, 30 y 120 s y dos Decisions» · `informe.test.ts` «CA-2 (a)» y «CA-2 (b)» (huecos que no cruzan de partido, Decision que no cambia marcador, techo propio) | | ❌ |
| CA-3 | `src/ingest/informe.ts` (`parseReferencias`, `latenciaExternaDe`) · `docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/referencias.csv` (cabecera, sin filas) | `informe.db.test.ts` «de tres filas casa una y las otras dos quedan listadas con su motivo» · `informe.test.ts` «CA-3 referencias externas» (fichero vacío, fila mal formada, `peor caso (n=1)`, rango, objetivo de `vision.md` en segundos) | | ❌ |
| CA-4 | `src/ingest/informe.ts` (bloques 5, 6 y 7) · `src/ingest/informe-db.ts` (`details->>'requests'`, `alerts`) | `informe.db.test.ts` «un partido sin observaciones y dos alertas de distinto kind» y «las peticiones salen de details->>'requests'» · `informe.test.ts` «CA-4» (total/día/pico, presupuesto EXCEDE, `unresolved_team` y `conflict` en cero) | | ❌ |
| CA-5 | `src/sources/api-football/results.ts` (`apiFootballByIds`) · `src/ingest/contraste.ts` · `src/ingest/informe.ts` (bloque 8) | `informe.db.test.ts` «dos partidos en board, uno coincidente y uno no» con `fetch` doble (una sola petición `ids=101-102`) · `informe.test.ts` «CA-5» (peticiones del contraste aparte, bloque vacío sin `--contrastar`) | | ❌ |
| CA-6 | — trabajo de campo, **miércoles 2026-09-23** con el tick desplegado. Guion ejecutable en «Cómo retomar». | — | | ❌ |
| CA-7 | — trabajo de campo, **viernes 2026-09-25 18:20Z → lunes 2026-09-28 21:00Z**. El informe ya calcula sus números (cobertura, horas sin ejecuciones, intentos fuera de ventana, intentos fallidos). | — | | ❌ |
| CA-8 | — trabajo de campo, el fixture `live-<fecha>.json` se captura **durante la jornada** (sábado 2026-09-26). | — | | ❌ |
| CA-9 | `src/ingest/informe.ts` (`veredictoDe`, umbrales en `src/ingest/constants.ts`) — el veredicto **real** se escribe con los números de la jornada, **lunes 2026-09-28**. | `informe.test.ts` «CA-9 veredicto»: válida, válida con reservas, c1 por cobertura, c1 por competición muda, c2 por marcadores, intervención sobre el dato vs sobre la plataforma, declaraciones pendientes | | ❌ |
| CA-10 | `package.json` (solo el script `informe:jornada`, sin dependencias nuevas, sin migraciones) — el informe `_qa/SPEC-009/informe-jornada-2026-09-28.md` se genera **el lunes 2026-09-28**. | Gates y `test:db` en verde (evidencia abajo); `informe.test.ts` «CA-10 el informe cabe en dos páginas» | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-009/. Informe HTML opcional: _qa/SPEC-009/informe.html -->

Comandos y salida real (2026-09-22, rama `ft/SPEC-009-jornada-de-medicion-e-informe`):

| Comprobación | Comando | Salida |
|---|---|---|
| gates | `npm run gates` | exit 0 · biome 139 ficheros · 45 test files, 596 tests |
| gates sin secretos | `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm run gates` | exit 0 · 45 test files, 596 tests |
| test:db | `npm run test:db` | exit 0 · `{"upToDate":true,…,"migrations":[]}` · 8 test files, 71 tests |
| motor intacto | `git diff main --stat -- src/decide src/ingest/engine.ts` | vacío |
| clave no filtrada | `git grep -qF "$API_FOOTBALL_KEY"` | sin coincidencias |
| migraciones | `git diff main --name-only -- supabase/migrations \| wc -l` | 0 |
| `package.json` | `git diff main -- package.json` | una línea: `"informe:jornada": "node tools/informe-jornada.mjs"` |
| el guion de CA-6 arranca | el script del paso 2 de «Cómo retomar», tal cual | importa, conecta y las consultas parsean; corta en `(i) FALLA: ningún intento ok con raw_ref`, que es lo correcto hoy (ningún partido en ventana) |
| pg_cron vivo, y criterio 2 de paso | `select status, count(*) … from cron.job_run_details where start_time >= now() - interval '25 minutes' group by status` y el mismo rango sobre `ingest_attempts` | `succeeded 50` en 25 min (uno cada 30 s) y **cero** filas de `ingest_attempts`: el tick corre y no pide nada fuera de ventana |
| el comando corre de verdad | `npm run informe:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z --referencias docs/…/referencias.csv` | 113 líneas; primera línea **«Se midieron cuatro de las cinco competiciones de D-3: Primeira Federación · Grupo 1 (10 partidos), Segunda División (11), Segunda Federación · Grupo 1 (9), Terceira Federación · Grupo 1 (9)»** y «Sin partidos en la ventana: primera-division», los 39 partidos, todo lo demás vacío y `veredicto: no válida (c1)` — la jornada aún no ha ocurrido, que es exactamente lo que debe decir hoy |

## Salvedades / follow-ups
- **F-SPEC-009-1 — las tres declaraciones de CA-9 no tienen entrada por CLI.** Las
  dos intervenciones de H-2 y el «cada alerta tiene explicación» de CA-4 (c) no
  se pueden derivar de ninguna consulta. `veredictoDe` las acepta como
  `declaraciones` y, mientras nadie las declare, el informe imprime el veredicto
  **medido** y lista las tres como «declaraciones pendientes». Modo de fallo: si
  alguien lee el veredicto sin leer esa lista, puede tomar por `válida` una
  jornada con una intervención sobre el dato, que según H-2 (i) la invalida. Es
  por eso que la lista se imprime siempre y en el mismo bloque. Destino: el
  veredicto definitivo lo escribe el verificador en este ledger el 2026-09-28
  con las tres declaraciones resueltas; si esto se repite en más specs,
  EPIC-MEJORA (banderas `--intervencion-dato`, `--intervencion-plataforma`).
- **F-SPEC-009-2 — la explicación a mano de cada alerta se escribe sobre el
  informe generado.** El bloque 7 imprime `explicación:` vacío debajo de cada
  alerta, para que la persona la complete en el fichero. Modo de fallo: si el
  informe se regenera después de escribirlas, se pierden. Mitigación operativa:
  generar con `--salida` una sola vez y escribir las explicaciones después.
- **F-SPEC-009-3 — las listas largas del informe se recortan a diez filas.** Con
  su cuenta y su desglose por competición; las discrepancias del contraste y las
  referencias no casadas **nunca** se recortan. Es la única forma de cumplir a la
  vez «cada uno con su competición y su hueco mayor» (CA-4 (b)) y «cabe en dos
  páginas» (CA-10): una jornada en la que nada corriera lista 39 partidos sin
  señal. Modo de fallo: quien necesite la lista completa tiene que volver a la
  base de datos. Decidido por el implementador, no por la spec.
- **Inconsistencia documental (no mía de arreglar).** CA-1 de esta spec y CA-3 de
  SPEC-008 citan `src/ingest/cli.ts` como el patrón a seguir, y ese fichero **no
  existe** ni ha existido. El patrón real es un módulo puro (`src/ingest/cron.ts`,
  `src/ingest/salud.ts`) más su cáscara `.mjs`, y es el que se ha seguido:
  `src/ingest/informe.ts` + `src/ingest/informe-db.ts` + `tools/informe-jornada.mjs`.
  Destino: sdd-arquitecto, al cerrar la épica.

## Cómo retomar (handoff)

Hecho hoy (2026-09-22): CA-1 a CA-5 con sus tests, la parte de CA-10 que se puede
cumplir sin la jornada, y `referencias.csv` creado vacío. Tres commits en la rama:
`301930d` (generador puro), `b0a0169` (consultas y contraste), `a9e329a` (comando
y CSV). Sin PR y sin merge: eso es del humano.

Lo que falta es trabajo de campo con fecha: CA-6 mañana, CA-7 y CA-8 durante la
jornada, CA-9 y el informe de CA-10 el lunes por la noche.

### Guion del ensayo de CA-6 — miércoles 2026-09-23

Precondición: el tick desplegado (SPEC-008) y `.env` con `DATABASE_URL`,
`INGEST_TICK_URL`, `INGEST_TICK_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY`. Todo se hace en **dev**. El ensayo deja filas
reales en `observations`/`decisions` y **no se borran** (RN-07, N-5).

**0. Elegir el partido y anotar su kickoff de verdad.**

```sql
select id, kickoff from matches
 where competition_id = 'tercera-rfef-g1' and season = '2026-27' and round = 4
 order by kickoff limit 1;
```

**1. Moverlo a cinco minutos de ahora** (sustituir `<ID>` por el de arriba):

```sql
update matches set kickoff = now() + interval '5 minutes' where id = '<ID>';
```

Comprobar que entra en ventana antes de esperar: `npm run ingest:tick -- --dry-run`
debe listar ese partido. Dejar correr el tick desplegado **~15 min** sin tocar nada.

**2. Comprobaciones (i), (ii) y (iii)** — un script temporal en la raíz del repo
(necesita el cwd del repo para `process.loadEnvFile()`); no se commitea:

```bash
cat > ca6-ensayo.mjs <<'EOF'
import { gunzipSync } from "node:zlib";
import { createSql } from "./src/db/connect.ts";
import { rawStoreEnv } from "./src/raw/env.ts";
import { createStorageRawStore } from "./src/raw/store.ts";
process.loadEnvFile();
const sql = createSql(process.env);
// (i) una fila ok con raw_ref no nulo
const [a] = await sql`select id, started_at, raw_ref, observations, details
  from ingest_attempts
  where ok and raw_ref is not null and started_at >= now() - interval '25 minutes'
  order by started_at desc limit 1`;
if (a === undefined) throw new Error("(i) FALLA: ningún intento ok con raw_ref");
console.log("(i)  OK  ", a.started_at.toISOString(), a.raw_ref, JSON.stringify(a.details));
// (ii) el objeto existe en el bucket y gunzipSync lo parsea
const store = createStorageRawStore({ ...rawStoreEnv(process.env), fetch });
const bytes = await store.get(a.raw_ref.replace(/^raw\//, ""));
if (bytes === null) throw new Error("(ii) FALLA: no hay objeto para ese raw_ref");
const capture = JSON.parse(gunzipSync(bytes).toString("utf8"));
console.log("(ii) OK  ", capture.capturedAt, `${capture.requests.length} petición(es)`,
  capture.requests.map((r) => r.url).join(" "));
// (iii) al menos una observación con ese raw_ref: el alias viajó en el despliegue
const [o] = await sql`select count(*)::int as n, min(match_id) as match_id
  from observations where raw_ref = ${a.raw_ref}`;
if (o.n === 0) throw new Error("(iii) FALLA: ninguna observación con ese raw_ref");
console.log("(iii) OK ", `${o.n} observación(es)`, o.match_id);
await sql.end();
EOF
node ca6-ensayo.mjs && rm ca6-ensayo.mjs
```

Si (iii) falla y (i) y (ii) pasan, lo que no viajó es el alias
(`outputFileTracingIncludes`, ADR-008 §8): mirar `error` en el intento.

**3. Comprobación (iv): una segunda invocación antes de 25 s devuelve
`skipped: 'cadence'`.** Dos llamadas seguidas, sin esperar entre ellas:

```bash
set -a; . ./.env; set +a
for i in 1 2; do
  echo "--- invocación $i"
  curl -s -X POST "$INGEST_TICK_URL" -H "Authorization: Bearer $INGEST_TICK_TOKEN" \
    | jq -c '[.attempts[] | {sourceId, skipped, ok, requests: .requests}]'
done
```

La primera debe traer `{"skipped":null,"ok":true,...}` y la segunda
`{"skipped":"cadence","ok":false,...}` (25 s = 30 − `CADENCE_JITTER_SECONDS`,
`src/ingest/constants.ts`). Si la primera ya sale `cadence`, es que pg_cron
acaba de disparar: esperar 30 s y repetir.

**4. Comprobación (v): dos ticks consecutivos con `started_at` separados ≥ 25 s.**

```sql
select started_at,
       started_at - lag(started_at) over (order by started_at) as hueco
  from ingest_attempts
 where started_at >= now() - interval '25 minutes'
 order by started_at;
```

Ningún `hueco` por debajo de `00:00:25`. Y la vitalidad de pg_cron, de paso:

```sql
select status, count(*)::int, min(start_time), max(start_time)
  from cron.job_run_details
 where start_time >= now() - interval '25 minutes'
 group by status;
```

**5. Devolver el `kickoff` a su sitio** y comprobar que volvió:

```bash
npm run calendario:load -- 2026-27
```

```sql
select id, kickoff from matches where id = '<ID>';
```

**6. Anotar en este ledger las filas que quedaron** (RN-07: no se borran):

```sql
select 'observations' as tabla, count(*)::int as n from observations where match_id = '<ID>'
union all select 'decisions', count(*)::int from decisions where match_id = '<ID>'
union all select 'alerts', count(*)::int from alerts where match_id = '<ID>';
```

Con (i) a (v) en verde, **R-SPEC-006-1 queda cerrado**.

### Después del ensayo

- **CA-8, durante la jornada (sábado 26).** Capturar
  `GET /fixtures?live=140-141-435-875-439` con partidos en juego y guardarlo como
  `src/sources/api-football/fixtures/live-2026-09-26.json` (cuerpo tal cual, sin
  cabeceras ni clave), con su fila en `fixtures/README.md`. Test nuevo en
  `results.test.ts`. El crudo real del raw store se pasa por `parse` con el mismo
  script del paso 2 de arriba, que ya descomprime y parsea el `capture`: basta
  añadirle `adapter.parse(capture)`.
- **CA-7, lunes 28.** Los números salen del propio informe (bloque 1: cobertura,
  horas de ventana sin ejecuciones, intentos fuera de la ventana de todo partido,
  intentos fallidos) más `cron.job_run_details`, nunca `net._http_response` (N-2).
- **CA-9 y CA-10, lunes 28 por la noche.**

  ```bash
  npm run informe:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z \
    --referencias docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/referencias.csv \
    --contrastar \
    --salida docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/informe-jornada-2026-09-28.md
  ```

  Después: escribir a mano la explicación de cada alerta en el bloque 7 (el
  informe deja `explicación:` vacío debajo de cada una) y resolver en este ledger
  las tres declaraciones pendientes que el bloque 9 lista (F-SPEC-009-1).
- **`referencias.csv`** lo rellena una persona el **domingo 27 entre 14:00Z y
  17:00Z** (H-3), una fila por gol: `matchId,marcador,instante,fuente`, con el
  instante en ISO-8601 UTC con `Z`. Objetivo: ≥ 12 goles en ≥ 3 competiciones,
  con Tercera RFEF G1 o Segunda RFEF G1 obligatoria; el bloque de las 16:00Z
  (siete partidos de Tercera a la vez) es el que hace la muestra. Con el fichero
  vacío el informe se genera igual y el bloque 4 sale con n = 0.
