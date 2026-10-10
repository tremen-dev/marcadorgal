---
id: SPEC-031
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-031 Adaptador rfef: fetch con sesión, parser puro y decodificador cerrado sobre fixtures reales

## Resumen
- Fase: en-progreso (CA-1 y el minuto de CA-5 esperan la serie de campo del 2026-10-11)
- Rama: `ft/SPEC-031-adaptador-rfef`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/fixtures/` (6 `.raw` en bytes ISO-8859-15 + 2 `.html` UTF-8 del sondeo, `sin-cookie-aceptada.html`), `fixtures/README.md`, `fixture-files.ts`. **Parcial: falta la serie de campo** (F-SPEC-031-1) | `src/sources/rfef/fixtures.test.ts` (18): cada fixture = captura del sondeo sin recortar = `TextDecoder("iso-8859-15")` de los bytes; README documenta cada fichero y la tabla de marcas | | ❌ |
| CA-2 | `src/sources/rfef/html.ts`, `decode.ts` (`unpackNtype`, `decodeCell`), `panel.ts` (`readPanel`) | `src/sources/rfef/decode.test.ts` (9): texto plano, `ntype` 8,0,"fa-5"→3, `::after "1"` con señuelo 3, `::before "\\0031"`, `\\0030;display:none`+`0`→0, `-`, «Suspendido»; tabla invertida en el fixture → la salida la sigue | | ❌ |
| CA-3 | `e2e/rfef-oracle.spec.ts` | 8 casos (uno por fixture), 0 discrepancias en las 265 `.resu` en `npm run e2e` | | ❌ |
| CA-4 | `decode.ts`, `panel.ts`, `adapter.ts` (`parse` todo o nada por petición) | `src/sources/rfef/adapter.test.ts` «CA-4» (15): (i) 39 valores y un `10`, (ii) otro cuerpo, (iii) sin definición, (iv) `<b>`, `<img>`, `attr()`, `font-family`, id ausente, (v) 3 dígitos, letra, vacío, (vi) NLogin real y vacío, (vii) `paneles-femenino-fed3`; control positivo `content:"1"`→`"2"` da 0-2 | | ❌ |
| CA-5 | `src/sources/rfef/state.ts` (`kickoffOf`, `rowState`). Minuto siempre `null` (**pendiente de la serie**, F-SPEC-031-2) | `src/sources/rfef/state.test.ts` (12): +99/+100, −11/−10, +109/+110, verano/invierno, 31-dic → «02 - 01», «Suspendido» sin/con marcador, «Aplazado», otro texto, `-` → nada, nunca `scheduled`; `adapter.test.ts`: `-` no aparece, sin `observedAt`, `live` sin minuto | | ❌ |
| CA-6 | `adapter.ts` (`createRfef`, `normalizeName`, `resolveTeam`), `src/model/alias.ts` (`competitions`), `src/model/source.ts` (`SkippedReason`), `fixtures/alias-test.json` | `adapter.test.ts` «CA-6» (i)–(vi); `src/model/alias-rfef.test.ts` (3): `competitions` opcional, `api-football.json` valida, motivos nuevos | | ❌ |
| CA-7 | `adapter.ts` `fetch` (`PORTADA_URL`, `PANEL_URL`) | `adapter.test.ts` «CA-7» (7): (i) 0 llamadas; (ii) portada `redirect: "manual"`, cookie y UA, 1 request con la query, sin cookie en `JSON.stringify`; (iii) `Málaga SÁB.` en bytes Latin-9; (iv) sin cookie, 302, 500, 404 lanzan | | ❌ |
| CA-8 | `src/arch/rfef-boundary.test.ts`; sin cambios en `registry.ts`, `src/ingest/adapters.ts`, `package.json` | `src/arch/rfef-boundary.test.ts` (19): imports, AST sin `eval`/`new Function`/`node:vm`/`Date.now`/`new Date(` (con autocontrol), sin registro; `npm run gates` y `npm run e2e` a 0 | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-031/. Informe HTML opcional: _qa/SPEC-031/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-031-1, F-SPEC-031-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-031-1 (CA-1, pendiente de la serie).** Faltan los fixtures de campo del 2026-10-11 (Segunda/Tercera Federación en juego, juego→final, final→acta cerrada, «Suspendido»/«Aplazado» si los hay), su fila en la tabla de marcas y si el panel trae minuto. Destino: esta spec, tras la serie. Si contradice ADR-017 §4, vuelve al gate.
- **F-SPEC-031-2 (CA-5, minuto).** Hoy un `live` sale con `minute: null` y `addedMinute: null`: ninguna captura del panel trae minuto. Si la serie lo demuestra, hay que decodificarlo con las garantías de CA-3/CA-4. Destino: esta spec.
- **F-SPEC-031-3 (CA-5, formas sin captura).** No hay «Aplazado» ni «Suspendido» con marcador en el sondeo: los casos se derivan de filas reales cambiando la celda en memoria (declarado en el test). El parser acepta `<span class=aplazado>` junto a un marcador, forma no vista. A confirmar con la serie.
- **F-SPEC-031-4 (CA-1).** `paneles-masculino.html` y `paneles-femenino-fed3.html` solo se conservaron como texto UTF-8, sin bytes, cabeceras ni parámetros exactos; su `capturedAt` (20:49Z) es la hora del fichero.
- **F-SPEC-031-5 (riesgo, spec de alta).** Fiel a ADR-017 §3: una fila ilegible de **cualquier** grupo, también Copa o juveniles, tumba la petición entera.
- **F-SPEC-031-6.** Scripts y estilos **fuera** de las celdas se vigilan con lista de prohibidos (no cerrada); dentro de la celda la lista es cerrada. La garantía final es el oráculo de CA-3.
- **F-SPEC-031-7.** Sin `charset` en `content-type`, el fetch decodifica ISO-8859-15 (la spec no lo fija). `biome.json` excluye `src/sources/rfef/fixtures/*.html` y `.gitattributes` marca los `.raw` como binarios.
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

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho sobre el sondeo: CA-2, CA-3, CA-4, CA-6, CA-7, CA-8; CA-5 salvo el minuto; CA-1 salvo la serie.
- Falta (serie `<scratchpad>/campo-2026-10-11/`, 09:30Z–20:00Z): elegir fixtures (`gunzip` de `<TS>-todos.raw.gz` a `.raw` en `src/sources/rfef/fixtures/`, `Date` de `<TS>-todos.headers`), añadirlos a `FIXTURES` en `fixture-files.ts` (el oráculo de CA-3 y el test de CA-1 los cogen solos), completar la tabla de marcas del README, comprobar `parpadea`/`verPartido` frente a ADR-017 §4 y mirar si el panel o la ficha `<TS>-ficha-<acta>.raw.gz` traen minuto. El test de CA-1 «lists every panel of the sondeo» compara con `_qa/sondeo/`: los de campo irán en otra lista.
- Spec en `en-progreso`, no en `en-revision`, hasta cerrar F-SPEC-031-1/-2.
