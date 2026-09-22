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
| CA-3 invariante sobre los 31 subconjuntos | | | | ❌ |
| CA-4 fixture del error real y regresión | | | | ❌ |
| CA-5 intento parcial: se guarda y `ok = false` | | | | ❌ |
| CA-6 presupuesto, frontera y gates | | | | ❌ |

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

## Evidencia de campo del fallo (2026-09-22, ensayo de CA-6 de SPEC-009)
<!-- Rellenar con la clave del objeto del bucket del intento fallido del que sale el fixture de CA-4 (N-5: la clave va aquí, nunca en el fixture), y con los identificadores de las filas de ingest_attempts de la frontera 22:07:06Z ok / 22:07:38Z primer fallo / 23 fallos seguidos. -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-011-1, F-SPEC-011-2… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
