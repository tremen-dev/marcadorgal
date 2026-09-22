---
id: SPEC-011
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-011 Petición live= con una sola competición y errores por petición que no tiran el intento

## Resumen
- Fase: en-progreso (implementación de sdd-implementador el 2026-09-23; spec aprobada por Alberto Fojo el 2026-09-23)
- Rama: `ft/EPIC-FIX-live-una-sola-competicion` (ya creada desde `origin/main` en `e0a88dc`; la spec se escribió sobre ella y no sobre `ft/SPEC-011-…`)
- Plazo: **mergeada en `main` antes del viernes 2026-09-25 18:20Z** (H-1)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 `live=` nunca con menos de dos ids | `src/sources/api-football/results.ts` (`liveQuery` nueva, exportada; `fetch` solo emite `live=` cuando devuelve cadena) | `src/sources/api-football/results.test.ts` → `SPEC-011 CA-1 liveQuery` (4 casos) + reescritura de «omits window matches without a match alias…» y de «sends the key and the user agent on every request…» | | 🚧 |
| CA-2 `parse` total: `requestErrors` | `src/model/source.ts` (`RequestError` + cuarto canal obligatorio en `ParseResult`), `src/sources/api-football/results.ts` (`parse` con `try/catch` por petición y `messageOf` local) | `src/model/source.test.ts` → «ParseResult requires requestErrors, accepts [] and rejects an entry without url»; `src/sources/api-football/results.test.ts` → «records a body with non-empty errors…», «records a body that is not JSON or not a fixtures response…», «keeps the observations of the good requests when one request is broken», «with every request unreadable gives three empty channels and one requestError each» | | 🚧 |
| CA-3 invariante sobre los 31 subconjuntos | (test; el arreglo que fija es el de CA-1) | `src/sources/api-football/results.test.ts` → `SPEC-011 CA-3 no capture ever carries a live= with a single id` (1 caso de cobertura + 31 generados con `it.each` + «(iii) the full subset still asks the five league ids»); reescrituras de CA-3 (ii) en `results.test.ts:191` y en `src/arch/source-contract.test.ts:209` | | 🚧 |
| CA-4 fixture del error real y regresión | `src/sources/api-football/fixtures/errors-live-2026-09-22.json` (nuevo) + su fila en `fixtures/README.md` | `src/sources/api-football/results.test.ts` → `SPEC-011 CA-4 the failed attempt of 2026-09-22` («the fixture is the body of a 200 that carries errors and no fixture», «parse keeps the observations of the ids= request and records the live= one») | | ⚠️ |
| CA-5 intento parcial: se guarda y `ok = false` | `src/ingest/tick.ts` (`AttemptSummary.requestErrors`, `oneLine`, cierre del intento con `ok` calculado, `error` de una línea y `details.requestErrors`) | `src/ingest/tick.test.ts` → `SPEC-011 CA-5 a partial attempt` (4 casos: parcial, `afterInsert`+alertas en la misma transacción, todas las peticiones rotas, captura limpia); `src/ingest/salud.test.ts` → «a partial attempt is printed FALLO with its details and the verdict is REVISAR» | | 🚧 |
| CA-6 presupuesto, frontera y gates | ningún fichero de producción propio: es la comprobación del conjunto (ver «Presupuesto y cierre de CA-6») | el recuento de peticiones por subconjunto lo cuenta el test de CA-3 (i) (`expect(urls).toHaveLength((subset.length === 1 ? 0 : 1) + idsRequests)`); (b), (c) y (d) son comandos, con su salida abajo | | ⚠️ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-011/. Informe HTML opcional: _qa/SPEC-011/informe.html -->

## Rojos de TDD (escribe sdd-implementador)
<!-- Salida real de cada test en rojo antes de su arreglo, copiada tal cual. -->

### CA-1 — `npx vitest run src/sources/api-football/results.test.ts`

Rojo 1, con los tests de CA-1 escritos y `results.ts` todavía sin tocar. El
tercer fallo **es el defecto de campo**: la URL que sale con una sola
competición en ventana es `?live=141`, un id suelto.

```
 FAIL  src/sources/api-football/results.test.ts > SPEC-011 CA-1 liveQuery > is null with no league and with a single one: neither is a form the provider accepts
TypeError: liveQuery is not a function
 ❯ src/sources/api-football/results.test.ts:233:12
    233|     expect(liveQuery([])).toBeNull();
       |            ^

 FAIL  src/sources/api-football/results.test.ts > SPEC-011 CA-1 liveQuery > joins unique league ids ascending from two on
TypeError: liveQuery is not a function
 ❯ src/sources/api-football/results.test.ts:238:12
    238|     expect(liveQuery([439, 141, 439])).toBe("live=141-439");
       |            ^

 FAIL  src/sources/api-football/results.test.ts > SPEC-011 CA-1 liveQuery > asks no live= with a single competition in window and a kickoff already past: ids= covers it
AssertionError: expected [ '?live=141', '?ids=1569871-1569872' ] to deeply equal [ '?ids=1569871-1569872' ]

- Expected
+ Received

  [
+   "?live=141",
    "?ids=1569871-1569872",
  ]

 Test Files  1 failed (1)
      Tests  3 failed | 49 passed (52)
```

Rojo 2, con `liveQuery` ya implementada: los cuatro casos de CA-1 pasan y se
caen **dos tests que existían y afirmaban la forma rota**. El primero es el de
CA-3 (ii), la pieza más instructiva del arreglo (línea 191, `"?live=439"`); el
segundo la afirmaba de rebote, al contar dos peticiones con una sola
competición en ventana.

```
 FAIL  src/sources/api-football/results.test.ts > CA-5 createApiFootballResults > omits window matches without a match alias
AssertionError: expected [ '?ids=1612732' ] to deeply equal [ '?live=439', '?ids=1612732' ]

- Expected
+ Received

  [
-   "?live=439",
    "?ids=1612732",
  ]

 ❯ src/sources/api-football/results.test.ts:190:30
    190|     expect(calls.map(query)).toEqual([
       |                              ^
    191|       "?live=439",
    192|       `?ids=${fixtureIdOf.get(known.id)}`,

 FAIL  src/sources/api-football/results.test.ts > CA-5 createApiFootballResults > sends the key and the user agent on every request and keeps the key out of the capture
AssertionError: expected [ { …(2) } ] to have a length of 2 but got 1

- Expected
+ Received

- 2
+ 1

 ❯ src/sources/api-football/results.test.ts:204:19
    204|     expect(calls).toHaveLength(2);
       |                   ^

 Test Files  1 failed (1)
      Tests  2 failed | 50 passed (52)
```

Reescritura de los dos (CA-3 (ii)):

- «omits window matches without a match alias» pasa a llamarse «… and with its
  single competition asks no live=» y afirma `[?ids=1612732]` como única
  petición, más `expect(c.url).not.toContain("live=")` sobre cada llamada. El
  caso conserva su propósito original (un partido en ventana sin alias no entra
  en `ids=`) y deja de afirmar la URL que el proveedor rechaza.
- «sends the key and the user agent on every request…» toma ahora **dos**
  competiciones (`segunda-rfef-g1` + `primera-rfef-g1`) en vez de dos partidos
  de una sola, para que la captura siga teniendo una petición `live=` y el caso
  siga comprobando que la clave y el `User-Agent` viajan también en ésa. Con
  una sola competición ya no hay `live=` que comprobar.

### CA-2 — `npx vitest run src/model/source.test.ts src/sources/api-football/results.test.ts`

Rojo con los tests de CA-2 escritos y `ParseResult` / `parse` todavía sin
tocar. Los tres fallos del final son los tres casos que **hoy esperaban
excepción** y que la esperaban porque `parse` era todo-o-nada por captura.

```
 FAIL  src/model/source.test.ts > CA-1 SourceAdapter contract types > ParseResult accepts a valid result
AssertionError: expected false to be true // Object.is equality
 ❯ src/model/source.test.ts:106:51
    106|     expect(ParseResult.safeParse(result).success).toBe(true);
       |                                                   ^

 FAIL  src/model/source.test.ts > CA-1 SourceAdapter contract types > ParseResult requires requestErrors, accepts [] and rejects an entry without url
AssertionError: expected true to be false // Object.is equality
 ❯ src/model/source.test.ts:121:52
    121|     expect(ParseResult.safeParse(without).success).toBe(false);
       |                                                    ^

 FAIL  src/sources/api-football/results.test.ts > CA-6 parse is pure > yields a valid ParseResult over the real ids fixture
AssertionError: expected undefined to deeply equal []

- Expected:
[]

+ Received:
undefined

 ❯ src/sources/api-football/results.test.ts:370:34
    370|     expect(result.requestErrors).toEqual([]);
       |                                  ^

 FAIL  src/sources/api-football/results.test.ts > CA-6 parse is pure > records a body with non-empty errors as a requestError instead of throwing
Error: api-football returned errors: {"rateLimit":"Too many requests"}
 ❯ Object.parse src/sources/api-football/results.ts:224:17
    224|           throw new Error(
       |                 ^

 FAIL  src/sources/api-football/results.test.ts > CA-6 parse is pure > records a body that is not JSON or not a fixtures response as a requestError
SyntaxError: Unexpected token '<', "<html>" is not valid JSON
 ❯ Object.parse src/sources/api-football/results.ts:222:46
    222|         const body = ProviderBody.parse(JSON.parse(request.body));
       |                                              ^

 FAIL  src/sources/api-football/results.test.ts > CA-6 parse is pure > keeps the observations of the good requests when one request is broken
Error: api-football returned errors: {"live":"nope"}
 ❯ Object.parse src/sources/api-football/results.ts:224:17
    224|           throw new Error(
       |                 ^

 FAIL  src/sources/api-football/results.test.ts > CA-6 parse is pure > with every request unreadable gives three empty channels and one requestError each
SyntaxError: Unexpected token '<', "<html>" is not valid JSON
 ❯ Object.parse src/sources/api-football/results.ts:222:46

 Test Files  2 failed (2)
      Tests  7 failed | 61 passed (68)
```

Con el canal obligatorio, `npm run typecheck` señaló los sitios que construyen
un `ParseResult` a mano y que no lo declaran (rojo de compilación, también real):

```
src/arch/source-contract.test.ts(79,3): error TS2322: … Property 'requestErrors' is missing …
src/arch/source-contract.test.ts(120,16): error TS2741: Property 'requestErrors' is missing …
src/ingest/adapters.test.ts(9,7): error TS2741: Property 'requestErrors' is missing …
src/ingest/tick.test.ts(64,7): error TS2741: Property 'requestErrors' is missing …
```

**Un tercer test afirmaba la URL rota, y no está en la spec.**
`src/arch/source-contract.test.ts:209` exigía
`expect(calls.some((u) => u.includes("live=141"))).toBe(true)`: el driver del
contrato conduce una sola competición en ventana, así que afirmaba el mismo id
suelto que la línea 191 de `results.test.ts`. Rojo real:

```
 FAIL  src/arch/source-contract.test.ts > CA-8 two sources behind SourceAdapter > drives api-football and memory to a valid ParseResult with the same match, and never calls the unregistered one
AssertionError: expected false to be true // Object.is equality
 ❯ src/arch/source-contract.test.ts:209:55
    209|     expect(calls.some((u) => u.includes("live=141"))).toBe(true);
       |                                                       ^
```

Reescrito a `expect(calls.some((u) => u.includes("live="))).toBe(false)` con su
comentario. Es la segunda aparición del mismo defecto afirmado como verdad: la
forma rota estaba fijada en dos tests, no en uno.

### CA-3 — `npx vitest run src/sources/api-football/results.test.ts -t "CA-3"`

El arreglo de CA-1 ya estaba dentro, así que para ver el rojo de verdad se
restauró el `results.ts` de antes del arreglo
(`git show 59aa8ff:src/sources/api-football/results.ts`), se corrió el
invariante contra él y se volvió a poner el arreglado (`git diff --stat` de ese
fichero, vacío después). Caen **exactamente los cinco subconjuntos de una sola
competición** y pasan los otros 26: el invariante distingue el defecto, no
cualquier cambio.

```
 ❯ src/sources/api-football/results.test.ts (87 tests | 5 failed | 54 skipped) 22ms
   ❯ SPEC-011 CA-3 no capture ever carries a live= with a single id
     × primera-division 12ms
     × segunda-division 1ms
     × primera-rfef-g1 0ms
     × segunda-rfef-g1 0ms
     × tercera-rfef-g1 0ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/sources/api-football/results.test.ts > SPEC-011 CA-3 no capture ever carries a live= with a single id > primera-division
AssertionError: expected 'https://v3.football.api-sports.io/fix…' not to match /[?&]live=\d+$/

- Expected:
/[?&]live=\d+$/

+ Received:
"https://v3.football.api-sports.io/fixtures?live=140"

 ❯ src/sources/api-football/results.test.ts:731:25
    731|         expect(url).not.toMatch(BARE_LIVE);
       |                         ^

 FAIL  src/sources/api-football/results.test.ts > SPEC-011 CA-3 no capture ever carries a live= with a single id > segunda-division
AssertionError: expected 'https://v3.football.api-sports.io/fix…' not to match /[?&]live=\d+$/

- Expected:
/[?&]live=\d+$/

+ Received:
"https://v3.football.api-sports.io/fixtures?live=141"

 Test Files  1 failed (1)
      Tests  5 failed | 28 passed | 54 skipped (87)
```

Con el arreglo dentro, `results.test.ts` entero: **87 passed (87)**.

### CA-4 — `npx vitest run src/sources/api-football/results.test.ts`

Rojo con el test escrito y el fixture todavía sin crear:

```
⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/sources/api-football/results.test.ts [ src/sources/api-football/results.test.ts ]
Error: ENOENT: no such file or directory, open '/Users/albertofojo/src/marcadorgal-fix/src/sources/api-football/fixtures/errors-live-2026-09-22.json'
 ❯ readJson src/sources/api-football/results.test.ts:16:14
     16|   JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
       |              ^
 ❯ src/sources/api-football/results.test.ts:702:25

 Test Files  1 failed (1)
      Tests  no tests
```

Con el fixture dentro: **89 passed (89)** en ese fichero.

### CA-5 — `npx vitest run src/ingest/tick.test.ts src/ingest/salud.test.ts`

Rojo con los cuatro casos escritos y `tick.ts` sin tocar. Lo que dice el
diff es exactamente el silencio que N-2 quería evitar: hoy un intento con una
petición rota del proveedor se cierra **`ok: true`** y no hay dónde contar el
incidente.

```
 ❯ src/ingest/tick.test.ts (24 tests | 4 failed) 16ms
   ❯ SPEC-011 CA-5 a partial attempt
     × saves the observations of the good request, closes ok false and counts the incident 5ms
     × runs afterInsert and opens the alerts of a partial attempt, in the same transaction 1ms
     × with every request broken closes ok false with no observation and the full count 0ms
     × a clean capture is still ok true, with the count at zero 0ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ingest/tick.test.ts > SPEC-011 CA-5 a partial attempt > saves the observations of the good request, closes ok false and counts the incident
AssertionError: expected { sourceId: 'primera-source', …(10) } to match object { ok: false, requests: 2, …(2) }
(8 matching properties omitted from actual)

- Expected
+ Received

  {
    "observations": 1,
-   "ok": false,
-   "requestErrors": 1,
+   "ok": true,
    "requests": 2,
  }

 ❯ src/ingest/tick.test.ts:695:21

 FAIL  src/ingest/tick.test.ts > SPEC-011 CA-5 a partial attempt > runs afterInsert and opens the alerts of a partial attempt, in the same transaction
AssertionError: expected { sourceId: 'primera-source', …(10) } to match object { ok: false, alerts: 1, …(1) }

- Expected
+ Received

  {
    "alerts": 1,
-   "ok": false,
-   "requestErrors": 1,
+   "ok": true,
  }

 ❯ src/ingest/tick.test.ts:756:33

 FAIL  src/ingest/tick.test.ts > SPEC-011 CA-5 a partial attempt > with every request broken closes ok false with no observation and the full count
AssertionError: expected { sourceId: 'primera-source', …(10) } to match object { ok: false, observations: +0, …(1) }

- Expected
+ Received

  {
    "observations": 0,
-   "ok": false,
-   "requestErrors": 2,
+   "ok": true,
  }

 ❯ src/ingest/tick.test.ts:788:33

 Test Files  1 failed | 1 passed (2)
      Tests  4 failed | 39 passed (43)
```

Nótese que **`salud.test.ts` pasó en verde desde el primer momento**, con el
caso nuevo del intento parcial incluido: `tick:salud` no necesitaba cambio,
como decía N-2 (ya pinta `FALLO` con `details` y baja el veredicto a `REVISAR`
en cuanto `ok === false`). El caso nuevo es la prueba de que sigue siendo así
con la fila nueva, no un arreglo.

La línea de `error` que se guarda, tal cual la afirma el test:

```
primera-source: 1 de 2 peticiones con error del proveedor: api-football returned errors: {"live":"The Live field does not match the regular expression: [id-id-id...] or string: all."}
```

## Presupuesto y cierre de CA-6 (escribe sdd-implementador)

### (a) Presupuesto de peticiones, medido sobre los 31 subconjuntos

Recuento real, sacado del propio test de CA-3 (i) con dos partidos por
competición (`process.stdout.write` temporal, retirado después; el test afirma
el mismo número con `toHaveLength`):

| Competiciones en ventana | Subconjuntos | Partidos | Peticiones por tick | Forma |
|---|---|---|---|---|
| 1 | 5 | 2 | **1** | `?ids=…` |
| 2 | 10 | 4 | 2 | `?live=140-141` + `?ids=…` |
| 3 | 10 | 6 | 2 | `?live=…` + `?ids=…` |
| 4 | 5 | 8 | 2 | `?live=…` + `?ids=…` |
| 5 | 1 | 10 | 2 | `?live=140-141-435-439-875` + `?ids=…` |

Contraste con **N-4 de SPEC-005** (cota `1 + ⌈n/20⌉` por tick, ≤ 6/min y
≈ 3.000/día de jornada, con 300/min y 7.500/día del plan Pro):

- La cota **no sube en ninguna franja**. El arreglo solo puede **quitar** el
  término `1` del `live=` (cuando hay menos de dos ligas); nunca lo añade, y no
  toca el término `⌈n/20⌉`. Con los ~25 partidos del sábado sigue siendo
  `1 + 2 = 3` por tick → 6/min con los dos disparadores de ADR-002 §1.
- En las franjas de una sola competición el tick pasa de **2 peticiones (una de
  ellas fatal, 0 observaciones)** a **1 petición útil**. Con cadencia de 30 s
  son 2 ticks/min: de 4 a 2 peticiones/min en esas franjas.
- Ahorro en la jornada de medición: 600 min × 2 ticks/min × 1 petición ≈
  **1.200 peticiones menos**, y ninguna más en ningún sitio. En los otros 3.880
  minutos la captura sale idéntica.
- `requestErrors` **no añade ninguna petición**: no hay reintento dentro del
  mismo tick (fuera de alcance; el siguiente tick repite a los 30 s, SPEC-005
  N-9).

### (b) Frontera dura: `src/decide/` y `src/ingest/engine.ts` intactos

```
$ git diff origin/main --stat -- src/decide src/ingest/engine.ts
$ (sin salida)
```

### (c) Sin migraciones, sin dependencias, sin scripts, sin datos, sin diseño

```
$ git diff origin/main --stat -- package.json package-lock.json supabase data docs/diseno tools
$ (sin salida)

$ git diff origin/main -- src/model/vocab.ts
$ (sin salida)   ← AlertKind no cambia
```

Ficheros tocados por la implementación (`docs/` aparte; `docs/tablero.md` y el
`.md` de la spec vienen del commit de la arquitecta `59aa8ff`, no de aquí):

| Fichero | Previsto en CA-6 (c) |
|---|---|
| `src/model/source.ts` | sí |
| `src/sources/api-football/results.ts` | sí |
| `src/ingest/tick.ts` | sí |
| `src/model/source.test.ts` | sí («sus tests») |
| `src/sources/api-football/results.test.ts` | sí |
| `src/ingest/tick.test.ts` | sí |
| `src/ingest/salud.test.ts` | sí |
| `src/sources/api-football/fixtures/errors-live-2026-09-22.json` | sí |
| `src/sources/api-football/fixtures/README.md` | sí |
| `src/arch/source-contract.test.ts` | sí (contemplado: «si el adaptador en memoria necesita el canal nuevo») |
| `src/ingest/adapters.test.ts` | **no** — una línea, `requestErrors: []`, obligada por el canal nuevo (F-SPEC-011-4) |

### (d) Gates y secretos

```
$ env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL \
      -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm run gates
…
> biome check .
Checked 135 files in 39ms. No fixes applied.

> vitest run
 Test Files  44 passed (44)
      Tests  596 passed (596)

> next build
▲ Next.js 16.3.5 (Turbopack)
✓ Compiled successfully in 990ms
  Running TypeScript ...
  Finished TypeScript in 1251ms ...
✓ Generating static pages using 6 workers (4/4) in 176ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/ingest/tick
└ ○ /es

GATES EXIT=0
```

`git grep -qF "$API_FOOTBALL_KEY"` **no lo he podido correr**: el worktree no
tiene `.env.local` y la clave no está en mi entorno (misma causa que en
«Evidencia de campo»). Queda para el verificador o el humano, que sí la tienen.
En su lugar, comprobaciones equivalentes sobre el fixture nuevo, todas sin
coincidencias:

```
$ git grep -n "apisports-key" -- src/sources/api-football/fixtures/
src/sources/api-football/fixtures/README.md:4:…`x-apisports-key` (nunca en el repo)…
src/sources/api-football/fixtures/README.md:39,41,43: curl -s -H "x-apisports-key: $API_FOOTBALL_KEY" …
  ← solo prosa y el comando con la variable, ya estaban; nada en los .json

$ git grep -nE "[0-9a-f]{32}" -- src/sources/api-football/fixtures/errors-live-2026-09-22.json
$ (sin salida)

$ git grep -nE "raw/" -- src/sources/api-football/fixtures/errors-live-2026-09-22.json
$ (sin salida)   ← la clave del objeto del bucket no entra en el fixture (N-5)
```

El fichero entero cabe aquí, así que se puede revisar de un vistazo:

```json
{
  "get": "fixtures",
  "parameters": { "live": "439" },
  "errors": {
    "live": "The Live field does not match the regular expression: [id-id-id...] or string: all."
  },
  "results": 0,
  "paging": { "current": 1, "total": 1 },
  "response": []
}
```

## Evidencia de campo del fallo (2026-09-22, ensayo de CA-6 de SPEC-009)
<!-- N-5: la clave del objeto del bucket va aquí, nunca en el fixture. -->

**Frontera medida** (contra `dev` y el tick desplegado, 22:02Z-22:20Z), tal y
como llegó en el encargo del orquestador:

| Hito | Instante (UTC) |
|---|---|
| último intento `ok` | 2026-09-22T22:07:06Z |
| kickoff del partido en ventana | 2026-09-22T22:07:21Z |
| primer intento fallido | 2026-09-22T22:07:38Z |
| último de la serie | 2026-09-22T22:18:39Z (**23 fallos seguidos**) |

Error literal del proveedor en los 23, en la petición `live=439`:

```
api-football returned errors: {"live":"The Live field does not match the regular expression: [id-id-id...] or string: all."}
```

Las dos peticiones del crudo de un intento fallido:

```
https://v3.football.api-sports.io/fixtures?live=439      → 200 con "errors":{"live":"..."}
https://v3.football.api-sports.io/fixtures?ids=1612732   → 200 con el partido dentro, correcta
```

**Clave del objeto del bucket: PENDIENTE — no la he podido sacar.** Este
worktree no tiene `.env.local` (un worktree de git no arrastra ficheros no
versionados) y el entorno del implementador no trae `DATABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` ni `API_FOOTBALL_KEY`, así que no he podido
consultar `ingest_attempts` por las filas `not ok` del 2026-09-22 entre
22:07:38Z y 22:18:39Z ni bajar el objeto del bucket. El checkout principal, que
sí tiene el `.env.local`, está excluido por el encargo. Queda para el humano o
para el verificador: anotar aquí la clave del objeto y los identificadores de
esas filas. **Consecuencia sobre el fixture de CA-4**, dicha sin adornos: el
valor de `errors` es el error literal de campo (el de arriba, byte a byte), y el
sobre del cuerpo (`get`, `parameters`, `results`, `paging`, `response`) está
reconstruido con la forma que tiene este mismo endpoint en los dos fixtures
reales del repo (`ids-2026-09-21.json`, `live-all-2026-09-21.json`). Es lo que
`parse` necesita ver y el test reproduce la noche del 22, pero **no es el
objeto descargado del bucket**; si el titular quiere el cuerpo exacto, basta
sustituir el fichero por el objeto y el test sigue valiendo sin tocarlo (ver
F-SPEC-011-1).

## Salvedades / follow-ups

- **F-SPEC-011-1 — el fixture de CA-4 no viene del bucket, sino del error
  literal de campo dentro del sobre reconstruido del endpoint.** Sin
  credenciales no he podido bajar el objeto (ver «Evidencia de campo»). *Modo de
  fallo si no se atiende:* si el cuerpo real trae algún campo que no esperamos
  —otra forma de `errors`, un `paging` distinto— el fixture no lo refleja y
  `parse` no está probado contra él; el riesgo es bajo porque `hasErrors` solo
  mira `errors` y la rama que importa es «`errors` no vacío», que sí está fijada
  byte a byte. *Destino:* sustituir el fichero por el objeto del bucket (y
  anotar su clave aquí) antes o después de la jornada, sin tocar el test.
- **F-SPEC-011-2 — ADR corto del cuarto canal de `ParseResult`, después de la
  jornada.** Residual acordado en la decisión 3 del titular: `requestErrors` es
  el segundo refinamiento del tipo de retorno de ADR-003 (el primero fue
  `unresolved`/`skipped` en N-2 de SPEC-005) y EPIC-004 lo hereda para el
  webhook. *Modo de fallo si no se atiende:* el contrato de ADR-003 queda
  descrito solo en specs y la próxima fuente (o el `ingest` del push) puede
  volver a lanzar excepciones por captura, que es el defecto que esta spec
  arregla. *Destino:* ADR corto tras la jornada de SPEC-009, como ADR-009. **No
  he escrito ningún ADR** (decisión 3).
- **F-SPEC-011-3 — la spec escribe los cinco ids de liga en orden de
  competición, no ascendente.** CA-3 (iii) pide literalmente
  `?live=140-141-435-875-439`, y CA-1 pide «ids únicos **ascendentes**»; 875
  (Segunda RFEF) es mayor que 439 (Tercera RFEF), así que la forma ascendente,
  que es la que el código ya emitía antes de este arreglo y que no he cambiado,
  es `?live=140-141-435-439-875`. El test de CA-3 (iii) afirma esta última. Es
  una errata del texto de la spec (y la misma que arrastra el comando de
  captura de `fixtures/README.md`), no un cambio de comportamiento. *Modo de
  fallo si no se atiende:* ninguno en ejecución; solo confunde a quien compare
  la spec con el test. *Destino:* que la arquitecta corrija el literal de la
  spec y del README cuando pase por aquí.
- **F-SPEC-011-4 — dos ficheros de test fuera de la lista de CA-6 (c).** El
  canal obligatorio obliga a declararlo en todo sitio que construya un
  `ParseResult` a mano: además de los previstos, `src/ingest/adapters.test.ts`
  (una línea, `requestErrors: []`) y `src/arch/source-contract.test.ts` (el
  adaptador en memoria, el huérfano y la aserción de `live=141`, que era el
  tercer test que afirmaba la URL rota). CA-6 (c) contempla
  `source-contract.test.ts`; `adapters.test.ts` no estaba previsto. Ningún
  fichero de producción fuera de los tres de la spec. *Destino:* nada que hacer,
  queda dicho para que el verificador no lo lea como alcance colado.

## Cómo retomar (handoff)

**Estado:** los seis CA implementados con su test, en la rama
`ft/EPIC-FIX-live-una-sola-competicion` del worktree
`/Users/albertofojo/src/marcadorgal-fix`, seis commits por delante de
`origin/main` (`e0a88dc`), **sin push, sin PR y sin merge** (no es mío). Spec en
`en-revision`. `npm run gates` en verde con el entorno vaciado (exit 0, 596
tests). `npm ci` hace falta si se retoma en un worktree limpio.

**Commits, uno por CA:**

| Commit | Qué entra |
|---|---|
| `3969a03` | CA-1 `liveQuery` + reescritura de los dos tests que afirmaban la URL rota, más el cambio de estado de EPIC-FIX y SPEC-011 que llegó sin commitear |
| `5aa6c78` | CA-2 `requestErrors` en `ParseResult` y `parse` por petición; tercer test que afirmaba `live=141` reescrito |
| `7647da6` | CA-3 invariante generado sobre los 31 subconjuntos |
| `6a6065d` | CA-4 fixture del error del proveedor y regresión de las dos peticiones |
| `dbd1267` | CA-5 intento parcial en `tick.ts` y su caso en `salud.test.ts` |
| (este) | CA-6 y cierre del ledger |

**Lo que falta, y es del verificador o del humano:**

1. **La clave del objeto del bucket del intento fallido del 2026-09-22 y los
   identificadores de las filas de `ingest_attempts`** de la frontera
   22:07:06Z / 22:07:38Z / 23 fallos. Sin credenciales no los he podido sacar
   (ver «Evidencia de campo» y F-SPEC-011-1). Con ellos, el fixture de CA-4 se
   puede sustituir por el cuerpo descargado sin tocar el test.
2. **`git grep -qF "$API_FOOTBALL_KEY"`** con la clave real en el entorno, que
   es la comprobación literal de CA-6 (d).
3. Las columnas **Verif.** y **Estado** de la matriz, el **veredicto** y la
   **evidencia visual** (aquí no hay UI que capturar: el arreglo es de ingesta).

**Dónde mirar primero si algo huele raro:** `src/sources/api-football/results.ts`
(`liveQuery` y el `try/catch` por petición de `parse`) y el bloque de cierre de
`runAttempt` en `src/ingest/tick.ts`. La restricción dura se comprueba con
`git diff origin/main --stat -- src/decide src/ingest/engine.ts`, que tiene que
seguir vacía cuando esta rama entre en `main`: CA-10 de SPEC-009 se verifica
después.

**Plazo:** la ventana de SPEC-009 abre el viernes 2026-09-25 18:20Z y esto tiene
que estar mergeado antes (H-1). Al cerrar esto es miércoles 23: hay sitio para
una ronda de verificación con findings.
