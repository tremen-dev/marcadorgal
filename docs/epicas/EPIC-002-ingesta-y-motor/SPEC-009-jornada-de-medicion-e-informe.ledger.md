---
id: SPEC-009
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-009 Jornada de medicion e informe

## Resumen
- Fase: en-progreso — la mitad de código está hecha; CA-6 a CA-9 son trabajo de
  campo con fecha y no se pueden cerrar antes del lunes 2026-09-28.
- Segunda vuelta (2026-09-22): los cinco findings de la ronda RED arreglados, cada
  uno con su test en rojo antes del arreglo. Detalle y salidas en «Cómo retomar».
- Rama: `ft/SPEC-009-jornada-de-medicion-e-informe`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/informe.ts` (puro: `percentil`, `estadisticos`, `etiquetaP95`, `parseReferencias`, `secretosDelEntorno`, `redact` de mayor a menor longitud, `BLOQUES`, `informeJornada`) · `tools/informe-jornada.mjs` (cáscara) · `package.json` script `informe:jornada` | `src/ingest/informe.test.ts`: percentil n=1/n=2/n=100 · `etiquetaP95` · los nueve bloques y su orden · informe vacío sin lanzar (7 de 9 bloques dicen por qué) · ningún valor de `.env` en la salida · primera línea derivada de los partidos · firma del comando (5 casos por `spawnSync` sin `.env`) · **V-5** «ningún valor del entorno se escapa» (los cinco valores de `.env` que el verificador nombró, en `ingest_attempts.error` y en `alerts.details`; `LANG`/`CI` no se tocan) | Comando corrido sobre **tres ventanas distintas**: 25-28 sep → «cuatro de las cinco», 9-12 oct → «cinco de las cinco», solo 9 oct → «una de las cinco»: la primera línea se deriva de los partidos, no de una constante. 117 líneas, nueve bloques en orden, los siete vacíos dicen por qué. `informe.ts` sin reloj, red ni db. **Salvedad V-5**: la lista `secrets` de la cáscara omite `DATABASE_PASSWORD`, `SUPABASE_ACCESS_TOKEN` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, que sí están en `.env`. | ⚠️ |
| CA-2 | `src/ingest/informe.ts` (`cadenciaDe` —huecos entre observaciones **más el silencio final de cada partido**, V-2—, `ventanaEfectiva`, `latenciaInternaDe`, techo propio; el bloque 3 dice que el 0-0 del estreno cuenta) · `src/ingest/informe-db.ts` (`informeFilas`) | `src/ingest/informe.db.test.ts` «tres observaciones a 30, 30 y 120 s y dos Decisions» (con el hueco final, `final: true`) · `informe.test.ts` «CA-2 (a)» y «CA-2 (b)» (huecos que no cruzan de partido, Decision que no cambia marcador, techo propio, el 0-0 del estreno) · **V-2** «el silencio final cuenta» (4 casos: cadencia, hueco largo marcado, lista de sin señal, y un partido muestreado hasta su cierre que no inventa ningún hueco) | `npm run test:db` exit 0 (8 ficheros, 71 tests) y **cero filas residuales en `dev`** comprobadas a mano tras el rollback (matches/teams/competitions/observations/attempts/alerts de la ventana de julio 2027 y de los ids `test-*`: 0). La salida real dice «captura → publicación» con esas palabras. **Observación**: la primera Decision con marcador (0-0 al empezar) cuenta como «cambia el marcador», así que la muestra incluye ~39 estrenos además de los goles. | ✅ |
| CA-3 | `src/ingest/informe.ts` (`parseReferencias`, `latenciaExternaDe`) · `docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/referencias.csv` (cabecera, sin filas) | `informe.db.test.ts` «de tres filas casa una y las otras dos quedan listadas con su motivo» · `informe.test.ts` «CA-3 referencias externas» (fichero vacío, fila mal formada, `peor caso (n=1)`, rango, objetivo de `vision.md` en segundos) | Frontera n=20 ejercitada a mano: con n=12 imprime `peor caso (n=12): 21.0 s` y «el p95 de vision.md no se contrasta con n=12»; con n=20 imprime `p95: 28.0 s` y `p95 < 90 s → cumple`. Contraste en segundos contra los 45 s, y el test no puede pasar por casualidad: la aserción es `"mediana < 45 s → cumple"`, que **no** casa dentro de `"→ NO cumple"`, y hay caso recíproco a 100 s. `referencias.csv` con solo cabecera: informe generado exit 0. Filas no casadas listadas con motivo y **nunca** recortadas. | ✅ |
| CA-4 | `src/ingest/informe.ts` (bloques 5, 6 y 7; el hueco de un partido incluye su silencio final, V-2; el bloque 7 acotado con `primerasFilas`, V-4) · `src/ingest/informe-db.ts` (`details->>'requests'`, `alerts`) | `informe.db.test.ts` «un partido sin observaciones y dos alertas de distinto kind» y «las peticiones salen de details->>'requests'» · `informe.test.ts` «CA-4» (total/día/pico, presupuesto EXCEDE, `unresolved_team` y `conflict` en cero) · **V-2** «el partido aparece en la lista de partidos sin señal de CA-4 (b)» | `grep -rn _http_response src tools`: ninguna consulta del informe lo toca; las peticiones salen de `details->>'requests'` (verificado en `test:db`). Bloque 7 lista cada alerta con `details` y `explicación:` vacía. **Finding V-2**: el bloque 6 (b) es ciego al silencio final — un partido con observaciones a 0/30/60/90 s y luego **dos horas y media mudo** sale `sin ninguna observación: 0` y `con al menos un hueco > 15 min: 0`, y el bloque 2 le pone mediana y p95 de 30.0 s. Solo se miden huecos *entre* observaciones, nunca el que va de la última al final de la ventana del partido. | ⚠️ |
| CA-5 | `src/sources/api-football/results.ts` (`apiFootballByIds`) · `src/ingest/contraste.ts` · `src/ingest/informe.ts` (bloque 8: coincidentes, **estados no-`finished` que el proveedor confirma** con su raw_ref y su hueco de explicación, y discrepancias, V-3) | `informe.db.test.ts` «dos partidos en board, uno coincidente y uno no» con `fetch` doble (una sola petición `ids=101-102`) · `informe.test.ts` «CA-5» (peticiones del contraste aparte, bloque vacío sin `--contrastar`) · **V-3** «un estado no-finished acordado no es discrepancia» (4 casos: contado aparte con raw_ref, no dispara (c2) y baja a reservas, la cuenta «N de N» intacta, y los dos diciendo cosas distintas sigue siendo (c2)) | Maquinaria verificada en `test:db` con `fetch` doble (una sola petición `ids=101-102`, ≤ 20 por petición) y la url base y la cabecera `x-apisports-key` se quedan dentro de `src/sources/api-football/` (frontera limpia: `src/sources/*` solo importa de `../../model`). `--contrastar` sobre una ventana vacía: bloque «0 de 0» sin ninguna petición. **No se ha llamado al proveedor de verdad** a propósito: RN-08 reserva esa tanda al final de la jornada. **Finding V-3**: `coinciden` exige `status === "finished"`, así que un partido **aplazado o suspendido en el que board y proveedor dicen exactamente lo mismo** se imprime como discrepancia con los dos valores idénticos y, con cobertura sana, empuja el veredicto a `no válida (c2) — motor equivocado`. | ⚠️ |
| CA-6 | — trabajo de campo, **miércoles 2026-09-23** con el tick desplegado. Guion ejecutable en «Cómo retomar». | — | | ❌ |
| CA-7 | — trabajo de campo, **viernes 2026-09-25 18:20Z → lunes 2026-09-28 21:00Z**. El informe ya calcula sus números (cobertura, horas sin ejecuciones, intentos fuera de ventana, intentos fallidos). | — | | ❌ |
| CA-8 | — trabajo de campo, el fixture `live-<fecha>.json` se captura **durante la jornada** (sábado 2026-09-26). | — | | ❌ |
| CA-9 | `src/ingest/informe.ts` (`veredictoDe`, umbrales en `src/ingest/constants.ts`; `ventanaEfectiva` + `union` + `dentroDe`: numerador y denominador de la cobertura sobre el mismo span, V-1; el acuerdo no-`finished` como reserva nombrada, V-3) — el veredicto **real** se escribe con los números de la jornada, **lunes 2026-09-28**. | `informe.test.ts` «CA-9 veredicto»: válida, válida con reservas, c1 por cobertura, c1 por competición muda, c2 por marcadores, intervención sobre el dato vs sobre la plataforma, declaraciones pendientes · **V-1** «cobertura sobre la ventana efectiva de cada partido» (3 casos: muestreo perfecto → 100 % y `válida`, la línea que dice sobre qué ventana se calcula, y un partido que nunca cerró cuenta su ventana entera sin pasar del 100 %) | | ❌ |
| CA-10 | `package.json` (solo el script `informe:jornada`, sin dependencias nuevas, sin migraciones) · `src/ingest/informe.ts` (`primerasFilas`: una lista gasta como mucho las diez líneas de `INFORME_FILAS_MOSTRADAS`, así que el bloque 7 imprime cinco alertas y cuenta el resto) · `src/ingest/constants.ts` (`INFORME_MAX_LINEAS` = 145, dos páginas de 72 líneas) — el informe `_qa/SPEC-009/informe-jornada-2026-09-28.md` se genera **el lunes 2026-09-28**. | Gates y `test:db` en verde (evidencia abajo); `informe.test.ts` «CA-10 el informe cabe en dos páginas» (recorte de listas) y **V-4** «cabe en dos páginas, medido en líneas» (jornada realista de 39 partidos con 8 y con 39 alertas, e informe vacío: 133/133/124 líneas contra el tope de 145) | Corridos por el verificador el 2026-09-22: `npm run gates` exit 0 (biome 139 ficheros, 45 test files / 596 tests); `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm run gates` exit 0; `npm run test:db` exit 0 (`{"upToDate":true,…,"migrations":[]}`, 8 ficheros / 71 tests). `git diff main --stat -- src/decide src/ingest/engine.ts` **vacío**; 0 migraciones; 0 cambios en `package-lock.json`; `git diff main -- package.json` = solo `informe:jornada`; `git grep -qF "$API_FOOTBALL_KEY"` sin coincidencias; `src/ingest/constants.ts` **solo adiciones** (ninguna línea del núcleo de ingesta cambiada) y ningún fichero del camino de captura tocado. **Finding V-4**: «dos páginas» no está acotado — el bloque 7 imprime 2 líneas por alerta sin tope; 117 líneas hoy, 145 con jornada realista y 8 alertas, **207 con 39 alertas**. El test homónimo no mide la longitud. Parte de campo (el fichero del informe) abierta hasta el lunes. | ⚠️ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### RED parcial — 2026-09-22 · ronda de CÓDIGO previa a la jornada

**Esto no es el veredicto de la spec.** Es una ronda **parcial y anticipada** que
juzga solo CA-1 a CA-5 y la parte de CA-10 comprobable hoy. **CA-6, CA-7, CA-8 y
CA-9 siguen abiertos** (❌ sin empezar) y son trabajo de campo con fecha: el
ensayo es el miércoles 23, la ventana medida va del viernes 25 18:20Z al lunes 28
21:00Z, el fixture de CA-8 se captura durante la jornada y el veredicto real de
CA-9 se escribe el lunes 28 con los números reales. **No se puede emitir GREEN ni
mover la spec a `hecho` antes del 2026-09-28**; la spec queda en `en-progreso`.

Lo mecánico está verde y corrido por el verificador (ver la tabla de CA-10). Lo
que devuelve la ronda son cinco findings sobre la **aritmética que va a leer el
informe del lunes**. Ninguno pone en riesgo la captura —no se ha tocado un solo
fichero del camino de ingesta y todo se recalcula sobre lo guardado—, pero V-1 y
V-3 harían que el informe **diagnosticara mal** una jornada sana.

- **V-1 (el importante). El denominador de la cobertura hace imposible el
  veredicto `válida`.** `ticksEsperados` (`src/ingest/informe.ts`) cuenta la
  ventana de cada partido hasta `kickoff + WINDOW_AFTER_MINUTES` (150 min), pero
  el tick real deja de muestrear un partido en cuanto tiene Decision vigente
  `finished` (`isInWindow`, `src/ingest/window.ts`), y el motor fuerza el cierre
  en `kickoff + FORCED_FINISH_MINUTES` = **120 min** (`src/decide/thresholds.ts`).
  Los 30 min finales de cada partido se cuentan como esperados y **no se pueden
  muestrear nunca**. Medido sobre los kickoffs reales de la ventana del
  2026-09-25/28 (39 partidos, unión de ventanas recortada a `[desde, hasta]`,
  divisor 30 s): denominador **3.050** ticks; techo máximo alcanzable
  (`kickoff+120`) **2.760** → **90,5 %**; con cierres normales (`kickoff+105/115`)
  **84,6 % / 88,5 %**. Es decir: con un tick **perfecto** el informe imprimirá
  «válida con reservas», y si los partidos cierran pronto (`kickoff+100` → 82,6 %)
  se queda a dos puntos del acantilado del 80 % que dispara la rama **(c1)
  «ingesta rota, se repite la medición el 2026-10-02/04»**. Los umbrales de CA-9
  se fijaron antes de medir; el numerador y el denominador tienen que medir lo
  mismo. El informe ya tiene el dato para arreglarlo sin migración: `board`
  entrega `status` y `decidedAt` por partido.
- **V-2. El bloque 6 (b) y la cadencia son ciegos al silencio final.** Solo se
  miden huecos *entre* observaciones consecutivas, nunca el que va de la última
  observación al final de la ventana del partido. Un partido muestreado 90 s y
  luego **dos horas y media mudo** sale con `sin ninguna observación: 0`, `con al
  menos un hueco > 15 min: 0` y cadencia mediana y p95 de 30,0 s. Es justo el
  caso que CA-2 (a) dice delatar («lo que delata un job caído») y que CA-4 (b)
  dice listar.
- **V-3. Un estado no-`finished` acordado por las dos partes se imprime como
  discrepancia y dispara la rama (c2).** El bloque 8 exige
  `nuestro.status === "finished"` para contar un partido como coincidente, así
  que un partido `postponed` (o `suspended`) en el que board y el proveedor dicen
  **exactamente lo mismo** aparece como `board: postponed sin marcador · proveedor:
  postponed sin marcador` bajo «discrepancias», y `veredictoDe` lo lee como
  «motor equivocado» → `no válida (c2)`. CA-7 contempla expresamente «o el estado
  que el proveedor confirme, con su alerta explicada»: la maquinaria no tiene
  forma de expresarlo.
- **V-4. «Cabe en dos páginas» no está acotado.** El bloque 7 imprime dos líneas
  por alerta sin tope (las listas largas del resto sí se recortan a diez). 117
  líneas en la salida real de hoy, 145 con una jornada realista y 8 alertas,
  **207 con 39 alertas** (un `forced_finish` por partido es un escenario
  plausible). El test «CA-10 el informe cabe en dos páginas» comprueba el recorte
  de otras listas pero **no mide la longitud del informe**.
- **V-5. La lista de secretos de la cáscara no cubre `.env`.**
  `tools/informe-jornada.mjs` redacta `API_FOOTBALL_KEY`, `DATABASE_URL`,
  `INGEST_TICK_TOKEN`, `CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY`, pero `.env`
  también tiene `DATABASE_PASSWORD`, `SUPABASE_ACCESS_TOKEN` y
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. CA-1 pide que **ningún** valor de `.env`
  aparezca en la salida, y el informe imprime `error` de `ingest_attempts` y
  `details` de `alerts` tal cual.

Verde sin reservas en esta ronda: la pureza de `src/ingest/informe.ts`, la
cáscara como cáscara, los nueve bloques en orden con los vacíos explicados, la
primera línea **derivada** (probada sobre tres ventanas distintas), el origen de
las peticiones en `details->>'requests'`, la etiqueta `peor caso (n=<n>)` en la
frontera n=20, el contraste con los 45 s en segundos, las filas no casadas del
CSV con su motivo y sin recorte, la frontera de módulo, y los tests de base de
datos que siembran y **revierten sin dejar una fila** en `dev`.

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
- **F-SPEC-009-4 — el bloque 7 imprime cinco alertas y cuenta el resto.** Lo que
  se acota es el gasto en líneas (las diez de `INFORME_FILAS_MOSTRADAS`) y una
  alerta cuesta dos: su fila y el hueco de su explicación. Modo de fallo: con más
  de cinco alertas, la explicación a mano de las no listadas hay que escribirla
  **por `kind`** (la cuenta agrupada que el bloque imprime arriba), no una por
  una. Para 39 `forced_finish` eso es lo que se iba a hacer igual; para cinco
  `kind` distintos con una alerta cada uno no hay recorte. Alternativa
  descartada: imprimirlas todas y salirse de las dos páginas de CA-10.
- **F-SPEC-009-5 — el hueco del principio de un partido no se mide.** V-2 cierra
  el silencio **final** (de la última observación al cierre de la ventana). El
  simétrico —de la apertura de la ventana a la primera observación— no se mide
  como hueco: un partido que solo se observa al final sale con su hueco final en
  cero. Lo caza la cobertura (esos ticks faltan del numerador) y lo cazaría el
  bloque 6 si no hubiera ninguna observación, pero no la cadencia. Decidido así
  para no estirar más la letra de CA-2 (a) («huecos entre `observed_at`
  consecutivos»), que ya se estira con el final porque CA-2 (a) exige delatar un
  job caído. Destino: sdd-arquitecto, si la jornada lo hace visible.
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

### Segunda vuelta: los cinco findings de la ronda RED (2026-09-22)

Los cinco arreglados, cada uno con su test escrito **antes** y en rojo. Siete
commits nuevos sobre `a9e329a`, ninguno fuera de `src/ingest/` y
`tools/informe-jornada.mjs`. Sin PR y sin merge.

| Finding | Commit | Test que lo fija | Salida en rojo antes del arreglo |
|---|---|---|---|
| V-1 cobertura | `31ffa89` | `informe.test.ts` «CA-9 cobertura sobre la ventana efectiva de cada partido» | `AssertionError: expected 900 to be 690`, y con muestreo **perfecto** el informe imprimía `veredicto: no válida (c1)` · `- cobertura de ticks 77 % por debajo del 80 %` |
| V-2 silencio final | `f8e8037` | `informe.test.ts` «CA-2 (a)/CA-4 (b) el silencio final cuenta» | `cadencia: expected { n: 3, maximo: 30000 } to match { n: 4, maximo: 9510000 }`; `huecosLargos: expected [] to deeply equal [ {…} ]`; `sinSenal.conHuecoLargo: expected [] to deeply equal [ {…} ]` |
| V-3 no-`finished` acordado | `040bf26` | `informe.test.ts` «CA-5/CA-7 un estado no-finished acordado no es discrepancia» | `veredicto: expected { rama: "c2", valor: "no válida" } to match { rama: null, valor: "válida con reservas" }`; `discrepancias: expected [ { matchId: "aplazado", … } ] to deeply equal []` |
| V-4 dos páginas | `77f8323` | `informe.test.ts` «CA-10 el informe cabe en dos páginas, medido en líneas» | `AssertionError: expected 204 to be less than or equal to 145` (jornada realista con 39 alertas) |
| V-5 secretos | `75feeca` | `informe.test.ts` «CA-1 ningún valor del entorno se escapa» | `TypeError: secretosDelEntorno is not a function` (la función no existía; la lista de cinco nombres vivía en la cáscara) |
| observación del 0-0 | `092bee2` | `informe.test.ts` «dice que el 0-0 del estreno cuenta como cambio de marcador» | el informe no decía nada del estreno: `expected … to contain "La primera Decision con marcador de cada partido…"` |
| fixture de `test:db` | `a644b20` | `informe.db.test.ts` (mismo caso, con `final: true`) | `expected { n: 4, maximo: 8820000 } to match { n: 3, maximo: 120000 }`: el hueco final también sale por el camino de las consultas reales |

**V-1 sobre los kickoffs reales de la ventana**, con los cuatro cierres que el
verificador midió (`informeFilas` contra `dev`, cierre simulado, muestreo
perfecto a 30 s):

```
cierre kickoff+100: esperados 2520, reales 2520, 100 % → válida   (antes 82,6 % → válida con reservas)
cierre kickoff+105: esperados 2580, reales 2580, 100 % → válida   (antes 84,6 %)
cierre kickoff+115: esperados 2700, reales 2700, 100 % → válida   (antes 88,5 %)
cierre kickoff+120: esperados 2760, reales 2760, 100 % → válida   (antes 90,5 %, el techo)
```

**Dónde diverjo del finding, y por qué.** V-1 pedía recortar el span en
`kickoff + FORCED_FINISH_MINUTES` cuando un partido no tiene Decision `finished`.
El span se recorta en el `decidedAt` de la Decision `finished`, sí, pero el
fallback es el final de la ventana (`kickoff + 150`) y no los 120: el cierre
forzoso de RN-02 solo dispara desde `live` (`src/decide/engine.ts`, `current.status
=== "live"`) e `isInWindow` solo sale de la ventana por `finished`, así que un
partido **aplazado o suspendido** se muestrea de verdad hasta el final de la
ventana. Con el fallback en 120 sus intentos seguirían contando en el numerador
sobre un denominador recortado y la cobertura podía pasar del 100 % —justo en el
caso de V-3—. `FORCED_FINISH_MINUTES` se importa igual: es el número que el
informe imprime al decir sobre qué ventana calcula la cobertura, así que no hay
ningún 120 repetido. Comprobado con un test propio («un partido que nunca cerró
cuenta su ventana entera, y la cobertura no pasa del 100 %»).

**Dos ventanas, a propósito.** La cobertura y las «horas de ventana sin
ejecuciones» se miran sobre la ventana **efectiva** (tight: lo que el tick
muestrea de verdad); los «intentos fuera de la ventana de todo partido» del
criterio 2 se siguen mirando sobre la de ADR-002 §2 (wide: lo que el tick podría
muestrear legítimamente). Cada una conservadora en la dirección que importa, y
el informe imprime además `intentos dentro de la ventana de ADR-002 §2 pero tras
el cierre de todo partido`, que es la franja entre las dos: si no sale 0, hay
algo que mirar.

**V-3 y la letra de la spec.** No hizo falta tocar la spec. CA-7 autoriza el
estado que el proveedor confirme y CA-9 (a) exige todos los partidos `finished`
para `válida`: se cumplen las dos a la vez contando el acuerdo no-`finished`
aparte (no es discrepancia, no es la rama (c2)) y bajando el veredicto a `válida
con reservas` con su razón nombrada, que es lo que CA-9 (b) describe. Si el
arquitecto prefiere que un aplazamiento acordado deje el veredicto en `válida`,
eso **sí** es cambio de letra en CA-9 (a) y no es mío.

**Cierre de esta vuelta (2026-09-22, rama `ft/SPEC-009-jornada-de-medicion-e-informe`):**

| Comprobación | Salida |
|---|---|
| `npm run gates` | exit **0** · biome 139 ficheros · **45 test files, 613 tests** |
| `npm run test:db` | exit **0** · `{"upToDate":true,…,"migrations":[]}` · **8 test files, 71 tests** |
| `git diff main --stat -- src/decide src/ingest/engine.ts` | **vacío** |
| `git diff main --stat -- src/ingest/tick.ts src/ingest/db.ts src/ingest/window.ts src/raw src/app/api supabase` | **vacío** (camino de captura intacto) |
| `git grep -qF "$API_FOOTBALL_KEY"` (con `.env` cargado, clave de 32 caracteres) | sin coincidencias |
| `npm run informe:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z --referencias …/referencias.csv` | exit 0 · **126 líneas** · `ticks: 0 de 3050 esperados (0 %)` y `veredicto: no válida (c1)`, que es lo que debe decir hoy (la jornada aún no ha ocurrido y los 39 partidos están `scheduled`, así que el denominador es la ventana entera) · ningún valor de los 10 que hay en `.env` aparece en la salida |

Lo que queda, sin cambios respecto a la primera vuelta: CA-6 mañana (el guion de
abajo no se ha tocado y el verificador confirma que no depende de estos
findings), CA-7 y CA-8 durante la jornada, CA-9 y el informe de CA-10 el lunes.
Al generar el informe del lunes, dos cosas nuevas que mirar: el bloque 1 dice
sobre qué ventana calcula la cobertura (si alguien discute el número, está ahí) y
el bloque 8 tiene una línea propia para los estados no-`finished` acordados, cuya
explicación es obligatoria igual que la de las alertas.

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
