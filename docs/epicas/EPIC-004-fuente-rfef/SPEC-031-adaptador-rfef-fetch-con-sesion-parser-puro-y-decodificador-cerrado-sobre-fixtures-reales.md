---
id: SPEC-031
tipo: spec
epica: EPIC-004
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-10-10, por: sdd-arquitecto}
---
# SPEC-031 — Adaptador rfef: fetch con sesión, parser puro y decodificador cerrado sobre fixtures reales

## Problema
Para que la RFEF entre con prioridad 50, primero hay que leerla bien. El
marcador llega ofuscado (ADR-017 §3), y con 50 un dígito falso se publica
`confirmado`. Esta spec construye `src/sources/rfef/` (fetch, parse y
resolveTeam) y lo prueba contra capturas reales y contra un navegador. **No** lo
registra: no habrá ninguna petición desde producción hasta la spec de alta.

## Usuarios / roles afectados
- Espectador: no ve nada todavía. Titular: decide sobre las capturas (H-4).

## Criterios de aceptación
- **CA-1 Fixtures reales.** `src/sources/rfef/fixtures/` lleva las capturas de
  `EPIC-004/_qa/sondeo/` (paneles del 2026-10-10, 20:49Z a 21:47Z), sin recortar,
  como texto igual a `TextDecoder("iso-8859-15")` de los bytes. Un README indica
  petición, `Date` del servidor y procedencia. Lleva además ≥ 1 captura de
  `federacion=3` con un partido de Segunda o Tercera Federación **en juego** (H-4).
  Sin ella, CA-1 queda ⚠️ y la spec no cierra. Si esa captura contradice la tabla
  de ADR-017 §4 (p. ej., Tercera en juego sin `parpadea`), PARA y vuelve al gate.
- **CA-2 Decodificador.** Hay un caso por técnica con celdas reales copiadas de
  los fixtures: texto plano; `ntype` (`ntype("idh1286541",8,0,"fa-5")` → `3`, con
  señuelo `5`); `::after{content:"1"}` con señuelo; `::before{content:"\0031"}`;
  `::before{content:"\0030";display:none}` + texto `0` → `0`. La tabla sale del
  script de **esa** respuesta. Si se cambian a la vez la tabla del fixture y el
  esperado, la salida sigue al fixture: no hay tabla en el código.
- **CA-3 Oráculo de navegador.** Test de Playwright (Chromium, toda la red abortada
  salvo el fixture, reglas `.fa-0..9::before` de FA 6.5.1 en línea, JS activo).
  Para **cada** `.resu` de **cada** fixture, el texto visible coincide con lo que el
  parser lee de esa fila (`1-0`, `Suspendido`, `-`). Texto visible = recorrido con
  `getComputedStyle`, que incluye `::before`/`::after` y excluye lo que está en
  `display:none`. 0 discrepancias. Corre en `npm run e2e` (CI).
- **CA-4 Falla visible, nunca un dígito.** Cada mutación de un fixture real es un
  caso y da `requestErrors` con el motivo y **cero** observaciones de esa petición,
  sin excepción: (i) tabla de 39 valores o con un `10`; (ii) función desempaquetada
  con otro cuerpo; (iii) `ntype` llamado sin definirse; (iv) forma desconocida en
  una celda (`<b>`, `<img>`, `content:attr()`, `font-family`, regla sobre un id
  ausente); (v) un lado que no es `^\d{1,2}$`; (vi) cuerpo de `NLogin` o vacío;
  (vii) panel sin ningún `codgrupo` del mapa. Control positivo: cambiar un dígito
  de un `content` cambia la salida.
- **CA-5 Estados (ADR-017 §4).** Un caso por fila de la tabla, sobre filas reales
  y con `capturedAt` variable, bordes incluidos: +99/+100 para `finished`;
  −11/−10 y +109/+110 para `live`. El kickoff se pasa de Europe/Madrid a UTC en
  horario de verano y de invierno, y el año se infiere en el cambio de año
  (captura del 31-dic, fila «02 - 01»). Un `live` lleva `minute` y
  `addedMinute` `null` y no lleva `halfTime`. Nunca hay `scheduled`. Una fila
  `-` no aparece ni en `observations`, ni en `skipped`, ni en `unresolved`. Sin
  `observedAt`.
- **CA-6 Identidad (ADR-017 §2).** Con un `alias-test.json` de fixtures y el
  calendario declarado real de 2026-27: (i) Fabril–Racing Ferrol con acta →
  `finished` 0-1 con el `MatchId` declarado; (ii) Copa y juveniles no producen
  nada; (iii) equipo sin alias → `unknown_team` con nombres externos; (iv) par
  sin partido → `unknown_match`; (v) jornada ≠ `round` → `inconsistent_alias`;
  (vi) `pontevedra c.f. "B"` y `Pontevedra C.F. "B"` resuelven igual. En el modelo,
  `AliasFile.competitions` es opcional y `SkippedReason` gana `ambiguous_state`;
  `api-football.json` sigue validando.
- **CA-7 Fetch.** Con `fetch` doble: (i) ventana vacía → 0 llamadas. (ii) GET a la
  portada con `redirect: "manual"`, `JSESSIONID` tomada de `set-cookie`, y un GET a
  la URL de ADR-017 §1 con `Cookie` y el `User-Agent` del contexto; `requests` tiene
  1 elemento con la query en `url` y la cookie no aparece en `JSON.stringify(capture)`.
  (iii) Los bytes ISO-8859-15 (`Málaga`, `SÁB.`) se decodifican bien según el
  `charset`. (iv) Sin cookie, o con un 3xx o un no-2xx en la petición de datos,
  lanza (error del intento, ADR-003).
- **CA-8 Fronteras y gates.** `src/sources/rfef/` solo importa de `src/model`. Un
  test de arquitectura prohíbe ahí `eval`, `new Function`, `node:vm`, `Date.now`
  y `new Date(`. Sin dependencias nuevas. Sin entrada en `registry.ts` ni en
  `ADAPTERS`. `npm run gates` y `npm run e2e` → 0.

## Entidades y reglas afectadas
Source, SourceAdapter, Alias, Raw capture (`dominio.md`); RN-08, RN-09, RN-10;
D-4, D-6, D-9; ADR-003, ADR-007 §6, ADR-008 §8, ADR-017.

## Fuera de alcance
- El alias completo de los ~98 equipos, el registro con prioridad 50, la carga del
  calendario por el núcleo y el alta en el tick: son las specs siguientes.
- Minuto y RN-04 entre bandas (ADR-017 H-1 y H-2): spec del motor.
- Latencia y cobertura en una jornada real.

## Notas para el gate humano
- Se decide junto con ADR-017 y sus H-1..H-4. Lo que pide esta spec es H-4: la
  captura de campo es la que valida `parpadea`.
- El oráculo de CA-3 es la garantía de «nunca un dígito equivocado»: lo que el
  parser lee de un fixture es lo que un navegador pinta, celda a celda.
- Numeración: SPEC-031 y ADR-017 salen de este worktree. Si otra rama los usa
  antes del merge, se renumeran.
