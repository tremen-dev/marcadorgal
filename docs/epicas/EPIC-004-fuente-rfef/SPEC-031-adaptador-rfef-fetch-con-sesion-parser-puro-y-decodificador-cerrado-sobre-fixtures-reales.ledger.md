---
id: SPEC-031
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-031 Adaptador rfef: fetch con sesión, parser puro y decodificador cerrado sobre fixtures reales

## Resumen
- Fase: en-revision (E-1 aplicada; residuales de la serie declarados en F-SPEC-031-1 y F-SPEC-031-3)
- Rama: `ft/SPEC-031-adaptador-rfef`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/fixtures/`: sondeo GET (6 `.raw` ISO-8859-15 + 2 `.html` UTF-8, «GET, posible caché»), `sin-cookie-aceptada.html`; serie POST: 3 `campo-post-…-todos.raw.gz` (15:00:15Z, 15:02:24Z, 15:35:05Z) y `campo-post-2026-10-11T15-12-22Z-todos-vacio.raw` (0 B); `fixtures/README.md` (peticiones, `requestBody`, `Date`, tabla de marcas POST con «Última actualización», bloqueo por IP); `fixture-files.ts`. Residual F-SPEC-031-1 | `src/sources/rfef/fixtures.test.ts` (26): sondeo = captura sin recortar = `TextDecoder("iso-8859-15")` de los bytes; README marca «GET, posible caché»; POST con `requestBody` en README; dos POST consecutivos con bytes distintos; vacío real de 0 B documentado; tabla de marcas POST | | ❌ |
| CA-2 | `src/sources/rfef/html.ts`, `decode.ts` (`unpackNtype`, `decodeCell`), `panel.ts` (`readPanel`) | `src/sources/rfef/decode.test.ts` (9): texto plano, `ntype` 8,0,"fa-5"→3, `::after "1"` con señuelo 3, `::before "\\0031"`, `\\0030;display:none`+`0`→0, `-`, «Suspendido»; tabla invertida en el fixture → la salida la sigue | | ❌ |
| CA-3 | `e2e/rfef-oracle.spec.ts` (`.raw.gz` descomprimido y servido con su charset) | 11 casos (uno por fixture), 0 discrepancias en las 444 `.resu` (240 del sondeo + 3×68 de la serie POST) en `npm run e2e` | | ❌ |
| CA-4 | `decode.ts`, `panel.ts`, `adapter.ts` (`parse` todo o nada por petición; `empty body` antes de leer el panel) | `adapter.test.ts` «CA-4» (16): (i) 39 valores y un `10`, (ii) otro cuerpo, (iii) sin definición, (iv) `<b>`, `<img>`, `attr()`, `font-family`, id ausente, (v) 3 dígitos, letra, vacío, (vi) NLogin real → `not a panel` y vacío real de la serie → `empty body` (E-1), (vii) `paneles-femenino-fed3`; control positivo `content:"1"`→`"2"` da 0-2 | | ❌ |
| CA-5 | `src/sources/rfef/state.ts` (`kickoffOf`, `rowState`); `live` con `minute: null` y `addedMinute: null` (el panel no trae minuto) | `state.test.ts` (18): bordes +99/+100, −11/−10, +109/+110, verano/invierno, 31-dic → «02 - 01», «Suspendido» sin/con marcador, «Aplazado», otro texto, `-` → nada, nunca `scheduled`; sobre la serie POST: Segunda Fed. a k+0 sin enlace → `live`, Tercera a k+5 → `live`, Primera Fed. `verPartidoEnJuego` k+65 → `live` sin minuto, Tercera sin acta k+270 → `finished`, `verPartido` → `finished`, ninguna fila `ambiguous_state`; `adapter.test.ts`: `-` no aparece, sin `observedAt` | | ❌ |
| CA-6 | `adapter.ts` (`createRfef`, `normalizeName`, `resolveTeam`), `src/model/alias.ts` (`competitions`), `src/model/source.ts` (`SkippedReason`; `RawRequest.method`/`requestBody` opcionales, E-1), `fixtures/alias-test.json` | `adapter.test.ts` «CA-6» (i)–(vi) y todos los fixtures (sondeo y POST) sin `requestErrors`; `src/model/alias-rfef.test.ts` (4): `competitions` opcional, `api-football.json` valida, motivos nuevos, `RawRequest` con `method`/`requestBody` opcionales y una captura serializada antes del cambio que valida igual | | ❌ |
| CA-7 | `adapter.ts` `fetch` (`PORTADA_URL`, `PANEL_URL` sin query, `PANEL_QUERY` en el cuerpo del POST, E-1) | `adapter.test.ts` «CA-7» (8): (i) 0 llamadas; (ii) portada GET `redirect: "manual"`; POST con `Content-Type: application/x-www-form-urlencoded`, cookie y UA, cuerpo = query; 1 request con `url` sin `?`, `method: "POST"`, `requestBody` = query; sin cookie en `JSON.stringify`; (iii) `Málaga SÁB.` en bytes Latin-9; (iv) sin cookie, 302, 500, 404 lanzan; 200 vacío (fixture real) no lanza, `body: ""` y `parse` → `empty body` | | ❌ |
| CA-8 | `src/arch/rfef-boundary.test.ts`; sin cambios en `registry.ts`, `src/ingest/adapters.ts`, `package.json` | `src/arch/rfef-boundary.test.ts` (19): imports, AST sin `eval`/`new Function`/`node:vm`/`Date.now`/`new Date(` (con autocontrol), sin registro; `npm run gates` y `npm run e2e` a 0 | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-031/. Informe HTML opcional: _qa/SPEC-031/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-031-1, F-SPEC-031-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-031-1 (CA-1, residual de la serie).** La serie POST (`<scratchpad>/campo-2026-10-11-post/`) solo tiene datos en 10 vueltas, de 15:00:15Z a 15:07:47Z y de 15:26:27Z a 15:35:05Z. Las demás son `200` vacíos por el bloqueo por IP (abajo). Por eso **no hay**: (a) paso de juego a final (ningún partido en juego llegó al final en ese intervalo, y ninguna ficha POST dijo «(Final de partido)»); (b) paso de final a acta cerrada en Segunda/Tercera Fed. (en Tercera, además, el panel no enseña nunca enlace de acta: Montañeros–Gran Peña a k+305 y los del sábado a k+1.400 siguen sin enlace); (c) «Suspendido» o «Aplazado» del domingo (el único «Suspendido» real es Rayo–Athletic, del sábado). Tampoco hay dos POST de la **misma** vuelta: los dos de la misma query con bytes distintos son de vueltas consecutivas (15:00:15Z y 15:02:24Z). Motivo: el bloqueo. Destino: la spec de alta, cuando haya acceso autorizado.
- **F-SPEC-031-2 (CA-5, minuto; entrada para la spec del motor/alta).** El panel **no** trae minuto en ninguna vuelta POST: `live` sale con `minute: null`. La ficha `NFG_CmpPartidoEnJuego` por POST sí trae el texto del último evento. Literal, en `<TS>-ficha-70695435.raw.gz` de 15:07:47Z (`Date: Sun, 11 Oct 2026 15:09:55 GMT`, 668.327 B): `<span class=ult_act_txt> Última actualización: 17:06 h. (Minuto 33) </span>`. Otras formas vistas: `(Minuto 32)`, `(Inicio de partido)` (Coruxo–Compostela, fijo en «17:00 h.» de 15:07Z a 15:35Z) y `(Final 1ª parte)` (Pontevedra–Mérida «17:23 h.» y Ponferradina–Avilés «17:25 h.», de 15:26Z a 15:35Z, ya en la segunda parte). Es el minuto **del último evento**, no el minuto en curso (ADR-018). Las fichas de 15:00:15Z fueron GET y no cuentan.
- **F-SPEC-031-3 (CA-5, formas sin captura).** No hay «Aplazado» ni «Suspendido» con marcador reales, ni en el sondeo ni en la serie. Los casos salen de filas reales cambiando la celda en memoria, y el test lo dice. El parser acepta `<span class=aplazado>` junto a un marcador, una forma que no se ha visto nunca. Residual, por el mismo motivo que F-1.
- **F-SPEC-031-9 (hecho nuevo: bloqueo por IP).** La RFEF bloquea por IP tras unas 5 vueltas (~10 min) de consultas automáticas. Durante el bloqueo responde `200` con `Content-Length: 0` y sin `Content-Type` a todo, con bloqueos crecientes (8 → 16 → 30 → 50 → 76 → más de 80 min). Los vacíos de la serie son ese bloqueo, no fallos de red; uno real es el fixture de `empty body`. El titular decidió cerrar SPEC-031 y pausar el alta hasta tener acceso autorizado.
- **F-SPEC-031-10 (contraste con ADR-017 §4).** Sobre 339 lecturas de filas con marcador de las cinco competiciones en las 10 vueltas POST salen 250 `finished`, 79 `live`, 10 `suspended_without_score` y **0 `ambiguous_state`**. Toda fila con `parpadea` cae en `[k−10, k+110)`, y toda fila sin `parpadea` lleva `verPartido` o está por encima de k+100. La serie **no contradice** la tabla, pero tampoco prueba los bordes +100/+110, porque no hubo ningún final. Coruxo–Compostela pasa de sin enlace (k+0) a `verPartidoEnJuego` (k+2). El caso de Real Madrid–Villarreal a +167 queda en el test como regla, no como evidencia (E-1).
- **F-SPEC-031-4 (CA-1).** `paneles-masculino.html` y `paneles-femenino-fed3.html` solo se conservaron como texto UTF-8, sin bytes, cabeceras ni parámetros exactos; su `capturedAt` (20:49Z) es la hora del fichero.
- **F-SPEC-031-5 (riesgo, spec de alta).** Fiel a ADR-017 §3: una fila ilegible de **cualquier** grupo, también Copa o juveniles, tumba la petición entera.
- **F-SPEC-031-6.** Scripts y estilos **fuera** de las celdas se vigilan con lista de prohibidos (no cerrada); dentro de la celda la lista es cerrada. La garantía final es el oráculo de CA-3.
- **F-SPEC-031-7.** Sin `charset` en `content-type`, el fetch decodifica ISO-8859-15 (la spec no lo fija). El vacío real del bloqueo no trae `Content-Type`. `biome.json` excluye `src/sources/rfef/fixtures/*.html`, y `.gitattributes` marca `.raw` y `.raw.gz` como binarios.
- **F-SPEC-031-8 (proceso).** En `state.ts` y `adapter.ts` el test se escribió antes, pero no se ejecutó en rojo antes de escribir el código; se compensó con mutaciones que lo ponen en rojo (evidencia abajo).

### Evidencia del implementador (2026-10-11)
| Comando | Salida |
|---|---|
| `npx vitest run src/sources/rfef src/model src/arch/rfef-boundary.test.ts` | todo verde (rfef 71, model 79, arch 19) |
| `npm run gates` | exit 0 — `Test Files 93 passed (93)`, `Tests 1594 passed (1594)`, `✓ Compiled successfully` (1 aviso previo de Biome en `src/arch/deploy.test.ts`) |
| `npm run e2e` | exit 0 — `144 passed`, entre ellos los 8 `CA-3 oracle: …` |
| Sabotaje de CA-3: `decode.ts` sin respetar `display:none` del pseudo | oráculo en rojo en 5 de 8 fixtures; restaurado |
| Sabotaje de CA-5: `+100`→`+101` y `>=`→`>` en `−10` | 2 tests en rojo; restaurado |
| Sabotaje de CA-6/CA-7/CA-4(vii): sin chequeo de jornada / sin `redirect: "manual"` / sin chequeo de `codgrupo` | 1 test en rojo cada uno; restaurado |
| Sabotaje de CA-8: `Date.now()` en `state.ts` | test de arquitectura en rojo; restaurado |
| `git diff b7e82d3 --stat -- package.json package-lock.json` | vacío: sin dependencias nuevas |

### Evidencia de la enmienda E-1 (2026-10-11)
| Comando | Salida |
|---|---|
| `npx vitest run src/sources/rfef/adapter.test.ts` antes del cambio | 3 en rojo: `(vi) … empty body`, `(ii) … one POST …`, `(iv) a 200 with an empty body …` |
| `npx vitest run src/model/alias-rfef.test.ts` antes del cambio | 1 en rojo: `RawRequest gains optional method and requestBody` |
| `npx vitest run src/sources/rfef/fixtures.test.ts` con el README antiguo | 7 en rojo; verde tras reescribirlo |
| Por fichero: `fixtures` 26, `decode` 9, `state` 18, `adapter` 34, `alias-rfef` + `rfef-boundary` 23 | todo verde |
| `readPanel` + `rowState` sobre las 20 respuestas POST con datos (10 `todos` y 10 `enjuego`) | 0 errores de formato; 339 lecturas en `todos`: 250 `finished`, 79 `live`, 10 `suspended_without_score`, 0 `ambiguous_state` |
| `npm run gates` | exit 0 — `Test Files 93 passed (93)`, `Tests 1611 passed (1611)`, `✓ Compiled successfully` (1 aviso previo de Biome) |
| `npm run e2e` | exit 0 — `147 passed`, entre ellos los 11 `CA-3 oracle: …` (3 `campo-post-…`) |
| Peticiones a `marcadores.rfef.es` en esta sesión | ninguna |

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1..CA-8 con la enmienda E-1 (POST, `method`/`requestBody`, `empty body`). Residuales explícitos: F-SPEC-031-1 (no hubo final, ni acta cerrada en Segunda/Tercera, ni «Suspendido»/«Aplazado» del domingo, por el bloqueo por IP), F-SPEC-031-2 (minuto: solo en la ficha, entrada para la spec del motor/alta) y F-SPEC-031-3.
- Fuera de esta spec (E-1): el detector de respuesta rancia (ADR-018 §4) va en la spec de alta. La condición de ADR-018 §5 (que no se repita ningún md5 en la serie POST) no se puede cerrar del todo: la serie solo tiene 10 vueltas con datos. En ellas, los 10 md5 de `todos` y los 10 de `enjuego` son todos distintos.
- Para añadir fixtures nuevos: copiar el `.raw.gz` a `src/sources/rfef/fixtures/`, añadirlo a `FIXTURES` en `fixture-files.ts` (el oráculo y CA-1 lo recogen solos) y documentarlo en el README.
- Spec en `en-revision`.
