---
id: SPEC-011
tipo: spec
epica: EPIC-FIX
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-09-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-23, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-09-23, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-09-23, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-09-23, por: sdd-verificador}
---
# SPEC-011 — Petición live= con una sola competición y errores por petición que no tiran el intento

## Problema
Con **una sola competición en ventana** y algún partido ya empezado, el tick
desplegado falla entero y no guarda ni una observación. Son dos defectos
distintos, encadenados:

1. `src/sources/api-football/results.ts:232` construye
   `` get(`live=${leagues.join("-")}`) ``. Las competiciones llegan de
   `src/ingest/tick.ts:178` (`config.competitions.filter((c) => present.has(c))`:
   solo las presentes entre los partidos en ventana), así que con una sola sale
   `live=439`, un id suelto. El proveedor solo acepta ids unidos por guiones o
   la cadena `all`, y responde **200 con `errors`**:
   `{"live":"The Live field does not match the regular expression: [id-id-id...] or string: all."}`.
2. `parse` **lanza en la primera petición que trae `errors`**, así que la
   petición `ids=` de ese mismo intento —que sí había traído el partido
   correcto— se descarta con la rota. Eso convierte «una petición
   desperdiciada» en **cero observaciones**, y es el defecto grave: cualquier
   error del proveedor en **una** de las peticiones tira el intento completo
   aunque las demás traigan datos buenos.

**Evidencia de campo** (ensayo de CA-6 de SPEC-009, 2026-09-22 22:02Z-22:20Z,
contra `dev` y el tick desplegado): último intento `ok` a las 22:07:06Z,
kickoff a las 22:07:21Z, primer fallo a las 22:07:38Z y **23 fallos seguidos**,
todos con ese error literal. El crudo del bucket de un intento fallido tiene
sus dos peticiones: `?live=439` → 200 con `errors`, y `?ids=1612732` → 200 con
el partido dentro, correcta.

**Exposición en la jornada de medición** (39 partidos, ventana de ADR-002 §2,
kickoff −10/+150): **600 de los 4.480 minutos** tienen una sola competición en
ventana con algo ya empezado, y ahí no se guarda nada:

| Franja | Min | Competición |
|---|---|---|
| **vie 25 18:30Z → 21:00Z** | 150 | segunda-division (el partido del viernes, **completo**) |
| sáb 26 11:00Z → 11:50Z | 50 | primera-rfef-g1 |
| sáb 26 13:30Z → 14:20Z | 50 | segunda-division |
| sáb 26 19:00Z → 19:15Z | 15 | primera-rfef-g1 |
| dom 27 13:00Z → 13:20Z | 20 | segunda-division |
| dom 27 18:45Z → 21:30Z | 165 | segunda-division |
| **lun 28 18:30Z → 21:00Z** | 150 | segunda-division (el partido del lunes, **completo**) |

Sin arreglo, los partidos del viernes y del lunes no producen ni una
observación tras su kickoff, no llegan a Decision `finished`, la cobertura se
hunde y el veredicto de CA-9 de SPEC-009 declara la rama **(c1) «ingesta
rota»**, que obliga a **repetir la medición el 2026-10-02/04**. El defecto 2,
además, hace que durante los cuatro días un error puntual del proveedor en una
petición borre el intento entero.

## Usuarios / roles afectados
- sdd-implementador y sdd-verificador de **SPEC-009**: sin esto, su medición
  mide un sistema roto en 600 minutos de 4.480.
- Titular (humano): el plazo es suyo; la ventana abre el viernes a las 18:20Z.
- Público y operador: ninguno (nada se publica todavía, EPIC-003/004).

## Criterios de aceptación
- **CA-1 Ninguna petición lleva `live=` con menos de dos ids de liga.** `results.ts` exporta la función pura `liveQuery(leagues: readonly number[]): string | null`: ids únicos ascendentes unidos por `-` cuando hay **≥ 2**, y `null` con 0 o 1 (las dos formas que el proveedor documenta para el campo son la lista unida por guiones y `all`; el error de campo es la prueba de que un id suelto no es ninguna de las dos). En `fetch`, dado un `ctx` con algún partido cuyo `kickoff <= ctx.now`, cuando `liveQuery(ids de liga de ctx.competitions)` devuelve `null`, entonces **no se emite la petición `live=`** y los `ids=` cubren la ventana completa —el mismo camino que ya funciona en los 10 minutos previos al kickoff (SPEC-005 N-10)— y cuando devuelve una cadena, la petición sale exactamente como hoy. `tick.ts:178` **no cambia** (N-1). Test (`results.test.ts`, `fetch` stub, nunca red): `liveQuery([])` y `liveQuery([439])` → `null`; `liveQuery([439, 141, 439])` → `"live=141-439"`; con dos partidos de **una** competición y kickoff pasado → una sola llamada, `?ids=…`, y ninguna con `live`; con dos competiciones → `?live=141-439` y luego `?ids=…`, como hoy.
- **CA-2 Un cuerpo que no se puede interpretar es salida de `parse`, no excepción.** `ParseResult` (`src/model/source.ts`) gana el cuarto canal, obligatorio: `requestErrors: z.array(z.strictObject({ url: z.url(), error: z.string().min(1) }))`. Dado un `RawCapture` con varias peticiones, cuando una trae `errors` no vacío, o un cuerpo que no es JSON, o que no valida como respuesta de fixtures, entonces `parse` **no lanza**: anota `{url, error}` (el `error` es el `errors` serializado o el mensaje del fallo de interpretación) y sigue con la siguiente petición; los fixtures de las peticiones que sí se interpretaron producen `observations`, `unresolved` y `skipped` igual que hoy (misma razón que N-2 de SPEC-005: una excepción tira la captura entera). Si **ninguna** petición se interpreta, devuelve los tres canales vacíos y una entrada de `requestErrors` por petición. `parse` sigue pura y sigue sin reloj ni red. Test (`results.test.ts`): los tres casos que hoy esperan excepción pasan a esperar `requestErrors` con su `url` y su texto; una captura con dos cuerpos ilegibles → `observations: []` y `requestErrors` de longitud 2; `ParseResult.safeParse` rechaza una `requestErrors` sin `url` y acepta `[]`.
- **CA-3 El invariante que impide la reaparición.** (i) Test generado sobre los **31 subconjuntos no vacíos** de las cinco competiciones de D-3 (`results.test.ts`): con todos los partidos en ventana y kickoff pasado, ninguna URL de la captura casa `/[?&]live=\d+$/`, y en los cinco subconjuntos de una sola competición no hay ninguna petición con `live`. Generado, no escrito a mano: la forma con un id suelto no se puede volver a olvidar porque no hay caso que escribir. (ii) El test que **fijaba el fallo** —`results.test.ts` «omits window matches without a match alias», que esperaba literalmente `"?live=439"`— se reescribe a la forma correcta (solo `?ids=…`), y el ledger anota su diff: el defecto vivió meses porque un test afirmaba la URL que el proveedor rechaza, no porque faltaran fixtures. (iii) El test del subconjunto completo sigue exigiendo `?live=140-141-435-875-439`, para que el arreglo no se convierta en «nunca pedir `live=`».
- **CA-4 Fixture con el cuerpo real del error y regresión de las dos peticiones.** Nuevo `src/sources/api-football/fixtures/errors-live-2026-09-22.json`: el **cuerpo tal cual** de la petición `?live=439` del crudo de esta noche (sin cabeceras, sin la clave del proveedor y sin la clave del objeto del bucket, que va en el ledger, N-5), con su fila en `fixtures/README.md` (comando, fecha, recorte). Test: dado un `RawCapture` de dos peticiones —ese fixture con `url` `…/fixtures?live=439` y `ids-2026-09-21.json` con la suya—, entonces `parse` devuelve las observaciones del segundo (≥ 1, con `finished` y marcador de los ids esperados) **y** un único `requestErrors` cuyo `error` contiene `The Live field does not match the regular expression`. Es el caso que reproduce la noche del 22 sin salir a la red.
- **CA-5 El intento guarda lo bueno y marca el incidente.** En `runAttempt` (`src/ingest/tick.ts`), dado un `parse` con `requestErrors` no vacío y observaciones, cuando se cierra el intento, entonces: (a) el crudo se guardó antes de parsear, como hoy (RN-09, sin cambios); (b) las observaciones se insertan, las alertas `unresolved_team` se abren y `afterInsert` corre en la misma transacción (ADR-008 §4 y §6, sin cambios); (c) la fila de `ingest_attempts` cierra con **`ok = false`** y `observations` = las insertadas, `error` = una línea `api-football: N de M peticiones con error del proveedor: <primer error>` y `details` **completo** (`season`, `matches`, `requests`, `unresolved`, `skipped`, `alerts`, más `requestErrors: N`), de modo que el informe de la jornada puede separar «intento perdido» de «intento parcial» sin dejar de sumar `details->>'requests'` (SPEC-009 CA-4 (a)); (d) `AttemptSummary` gana `requestErrors: number`. **No se abre alerta nueva ni se amplía `AlertKind`**: un error de transporte o de forma de petición no es estado de partido (D-9) y su sitio es `ingest_attempts` (ADR-003); sin migración. Test (`tick.test.ts`, `IngestDb` en memoria): captura de dos peticiones, una con error y otra buena → una fila `ok: false` con `observations > 0`, `raw_ref` no nulo y `details.requestErrors === 1`; captura con todas las peticiones con error → `ok: false`, `observations: 0`, `details.requestErrors === 2`; captura limpia → `ok: true` y `details` sin `requestErrors` o a 0. Test (`salud.test.ts`): una fila así se imprime `FALLO` con su `details` y el veredicto es `REVISAR` (`tick:salud` no cambia: ya es rojo con `ok === false`).
- **CA-6 Presupuesto, frontera y gates.** (a) **Presupuesto (SPEC-005 N-4)**: en las franjas de una sola competición el tick pasa de 2 peticiones (una fatal) a `⌈n/20⌉` = **1** (una competición aporta ≤ 11 partidos de jornada), o sea ≤ 2 peticiones/min con los dos disparadores; en el resto de franjas el recuento no cambia. La cota `1 + ⌈n/20⌉` ≤ 6/min y ~3.000/día sigue siendo cota superior y **no sube en ninguna franja**; el test de CA-3 (i) cuenta las peticiones por subconjunto y el ledger anota el recuento. (b) `git diff main --stat -- src/decide src/ingest/engine.ts` **vacío** (CA-10 de SPEC-009, que se verifica después de que esta rama entre en `main`). (c) Sin migraciones, sin `AlertKind` nuevo, sin dependencias ni scripts nuevos en `package.json`, sin tocar `data/`, `supabase/`, `docs/diseno/` ni el raw store. Ficheros tocados, exactamente: `src/model/source.ts`, `src/sources/api-football/results.ts`, `src/ingest/tick.ts`, sus tests, `salud.test.ts`, el fixture nuevo y `fixtures/README.md` (más `src/arch/source-contract.test.ts` si el adaptador en memoria necesita el canal nuevo). (d) `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm ci && npm run gates` → salida 0; `git grep -qF "$API_FOOTBALL_KEY"` sin coincidencias con el fixture nuevo incluido.

## Entidades y reglas afectadas
Source, SourceAdapter, Raw capture, Observation, Ventana, Intento de ingesta
(`dominio.md`). D-4 (el arreglo vive en la carpeta de la fuente), D-6 y RN-09
(el crudo se sigue guardando antes de parsear: es lo que ha permitido
diagnosticar esto), D-9 (un fallo de transporte no es estado de partido: sin
alerta nueva), D-10. RN-08 (la cadencia y el recuento de peticiones no suben),
RN-10 (`parse` sigue siendo todo-o-nada por partido). ADR-002 §2 (ventana),
ADR-003 (contrato: `requestErrors` es un cuarto canal de salida, del mismo
género que `unresolved` y `skipped`; «los errores de un adaptador se registran
en `ingest_attempts`»), ADR-007 (raw store intacto), ADR-008 §3, §4 y §6 (orden
del intento y enganche del motor intactos). SPEC-005 CA-1, CA-5, CA-6, N-2, N-4,
N-9 y N-10 (se corrigen y amplían, no se contradicen); SPEC-009 CA-4 (a), CA-7,
CA-9 y CA-10.

## Fuera de alcance
- `live=all` con filtrado en casa, y pedir siempre los cinco ids de liga: los
  dos se descartan en N-1, con su razón.
- Mover o cambiar el filtro de competiciones de `tick.ts:178`.
- Reintentar dentro del mismo tick la petición que falló: el tick siguiente
  (30 s) la repite (SPEC-005 N-9).
- Una `AlertKind` nueva para incidentes de transporte, cualquier migración y
  cualquier cambio en `src/decide/` o `src/ingest/engine.ts` (restricción
  dura: CA-6 (b)).
- El informe de SPEC-009 y su veredicto; el resto de EPIC-MANT; el fixture
  `live-2026-09-26.json` de CA-8 de SPEC-009, que se captura en la jornada.
- Cambiar la ventana, la cadencia, el presupuesto o el proveedor.

## Notas para el gate humano
- **H-1 (plazo duro).** Tiene que estar **mergeado en `main` antes del viernes 2026-09-25 a las 18:20Z**, cuando abre la ventana de SPEC-009. Hoy es miércoles 23: la spec está escrita para implementarse y verificarse en un día (tres ficheros de producción, un fixture, ninguna migración). Si no entra, la decisión que queda es medir sabiendo que las franjas de la tabla darán cero y que el veredicto será (c1).
- **N-1 Decisión 1: con una sola competición en ventana no se pide `live=`.** Elegida porque es exactamente lo que ya funcionó en el campo (la petición `ids=` del intento roto trajo el partido correcto) y porque `live=` existe solo para no preguntar id a id (SPEC-005 N-9): con una competición hay ≤ 11 partidos de jornada, así que un único `ids=` de hasta 20 los cubre. **Coste: −1 petición por tick** en esas franjas (≈ 2 ticks/min × 600 min ≈ 1.200 peticiones menos en la jornada), ninguna más en ningún sitio, y el cambio de comportamiento se limita a los 600 minutos que hoy están roto: en los otros 3.880 la captura sale idéntica. Rechazadas: **(a) `live=all` y filtrar en casa** — una petición, pero el cuerpo trae todos los directos del mundo, engorda el raw store y, por CA-7 (ii) de SPEC-005, cada fixture ajeno sale `unresolved unknown_competition`, que es justo lo que abre `unresolved_team` en base; inundaría de alertas la jornada que SPEC-009 CA-4 (c) espera con cero, y exigiría filtrar además en `fetch` o en `parse`, más superficie a dos días de medir. **(b) Pedir siempre los cinco ids de liga** (`live=140-141-435-875-439`): forma válida y siempre ≥ 2, mismo coste en peticiones, pero devuelve directos de competiciones que **no están en ventana**, cuyos partidos sí están en el alias, así que entrarían observaciones de partidos fuera de ventana y con ellas Decisions fuera de ventana: cambiaría el comportamiento de los 4.480 minutos para arreglar 600. **(c) Duplicar el id** (`live=439-439`): inventa una forma que el proveedor no documenta.
- **N-2 Decisión 2: el intento parcial se guarda y se marca `ok = false`.** Lo que no se negocia es que las observaciones de las peticiones buenas se guarden: es el defecto grave. Lo que había que elegir es cómo se cuenta. Elegido **`ok = false` con observaciones insertadas**, porque `ok = true` con un error dentro convertiría `ingest_attempts.ok` en «el tick no se cayó» y escondería un error del proveedor justo en la semana en que más se mira el semáforo (es el mismo género de silencio que M-1, M-6 y O-2 de SPEC-008). **Dónde se anota**: `error` con una línea y `details.requestErrors` con el recuento, ambos en la fila del intento, que es lo que ADR-003 dice. **Alerta: no** (D-9; sin `AlertKind` nueva, sin migración). **`tick:salud`**: no cambia, ya pinta `FALLO` con `details` y el veredicto baja a `REVISAR`. **Consecuencia sobre SPEC-009, que hay que ver antes de aprobar**: su CA-7 cuenta `ingest_attempts … and not ok` y exige explicar cada error, así que los intentos parciales aparecerán ahí y su explicación será «N de M peticiones con error del proveedor; las observaciones de las demás están guardadas»; la cobertura de CA-9 se mide sobre ticks y observaciones, no sobre intentos limpios, así que no baja por esto, y `details->>'requests'` de CA-4 (a) sigue sumando igual. **Sobre los ADRs**: considero que `requestErrors` es un refinamiento del tipo de retorno del contrato, del mismo género que el que ADR-003 ya recibió en N-2 de SPEC-005 (`ParseResult` con `unresolved` y `skipped`), y que el orden del intento de ADR-008 §4 no cambia; **por eso no escribo ningún ADR aquí**. Si el titular prefiere que quede registrado como decisión de contrato —es el segundo refinamiento del mismo tipo y EPIC-004 lo hereda para el webhook—, lo natural es un ADR corto **después** de la jornada, y lo pide él: no bloquea este arreglo.
- **N-3 Decisión 3: el invariante es una propiedad, no otro ejemplo.** El defecto no sobrevivió por falta de fixtures: sobrevivió porque `results.test.ts` **afirmaba** `"?live=439"` (línea 191, el caso «omits window matches without a match alias»), que es la URL exacta que el proveedor rechaza. Un caso más escrito a mano se vuelve a olvidar; por eso CA-3 (i) recorre los 31 subconjuntos de las cinco competiciones y prohíbe la forma, y CA-3 (iii) sigue exigiendo la petición con los cinco ids para que el arreglo no se convierta en «no pedir `live=` nunca».
- **N-4 Lo que no se toca, a propósito:** `src/decide/`, `src/ingest/engine.ts` (CA-10 de SPEC-009 exige su diff vacío y esta rama entra en `main` antes de que se verifique), el raw store, las migraciones, la ventana, la cadencia y el presupuesto.
- **N-5 El fixture lleva cuerpo, no claves.** El crudo de un intento fallido del 2026-09-22 está en el bucket; su clave se anota en el **ledger** como evidencia y **no** entra en el fixture, igual que no entra la clave del proveedor (CA-6 (d) lo comprueba con `git grep`). El fixture es el cuerpo de la respuesta tal cual, que es lo que `parse` necesita ver.

Mirar con lupa: **N-2** (que un intento parcial sea `ok = false` y su efecto en el recuento de `not ok` de SPEC-009 CA-7), **N-1 (b)** (por qué no se piden siempre los cinco ids, que es la alternativa que más tienta), y **H-1** (el plazo: si no entra el viernes, hay que decidir si se mide igual).
