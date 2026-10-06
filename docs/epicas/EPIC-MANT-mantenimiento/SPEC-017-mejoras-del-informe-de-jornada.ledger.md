---
id: SPEC-017
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-017 Mejoras del informe de jornada

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-017-mejoras-del-informe-de-jornada`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/contraste.ts` (`etiquetaContraste`, `storeCapture` antes de `parse`); `src/ingest/informe.ts` (`lineaPeticionesContraste`); `tools/informe-jornada.mjs` | `contraste.test.ts` «SPEC-017 CA-1 guarda el crudo antes de parsear», «SPEC-017 CA-1 sin crudo guardado no hay contraste», «la etiqueta no lleva ':'…»; `informe.test.ts` «SPEC-017 CA-1 el raw_ref va en la misma línea que las peticiones» | ✅ `contraste.test.ts` nombres exactos de la spec; orden `put:…` → `parse` aserto sobre log compartido; put que lanza → `rejects` y sin `parse`; `tools/informe-jornada.mjs` propaga a `exitCode = 1` | ✅ |
| CA-2 | `src/ingest/contraste.ts` (`guardado`, `recontrastar`, relectura); `src/ingest/informe-db.ts` (`contrasteGuardado`); `src/ingest/informe.ts` (`contrasteCapturas`, `contrasteAusente`); `tools/informe-jornada.mjs` (`--recontrastar`) | `contraste.test.ts` «SPEC-017 CA-2 releer no pide», «SPEC-017 CA-2 --recontrastar pide y guarda otro», «SPEC-017 CA-2 captura ilegible: sin contraste y sin petición»; `informe.test.ts` «SPEC-017 CA-2 la línea dice de dónde sale el contraste», «SPEC-017 CA-2 un contraste ilegible no existe…»; `informe.db.test.ts` «SPEC-017 CA-2 encuentra el contraste por su etiqueta» | ✅ 0 llamadas a `fetch` al releer, filas iguales; `--recontrastar` 2 objetos y otro `rawRef`; ilegible → `filas: null`, 0 peticiones, sin `parse`; línea literal de la spec; `contrasteGuardado` elige el más reciente por `created_at` (8/8 en `informe.db.test.ts`) | ✅ |
| CA-3 | `src/ingest/informe.ts` (bloque 6, `sinSenal.sinDirecto`) | `informe.test.ts` «SPEC-017 CA-3 (i)…(v)»; campo: ver «Evidencia de campo CA-3» | ✅ (i)–(v) en verde; campo: 5 = los 5 del hallazgo 1 (abajo) | ✅ |
| CA-4 | `src/ingest/informe.ts` (`ventanaEfectiva`, `InformeMatch.rule`, dos líneas del bloque 1); `src/ingest/informe-db.ts` (`rule` de la Decision de `board.decision_id`) | `informe.test.ts` «SPEC-017 CA-4 (i)/(ii)/(iii)», «…las dos líneas del bloque 1 lo dicen, sin crecer»; `informe.db.test.ts` «SPEC-017 CA-4 trae la regla de la Decision de board» | ✅ mismo criterio que `isInWindow` (`window.ts:28`, `rule !== "RN-02"`); (i) 320/320 y 0 tras el cierre, (ii) cierre a +135, (iii) sin cambio; línea del bloque 1 sin crecer | ✅ |
| CA-5 | `src/ingest/informe-db.ts` (`informeCron`, última consulta, no lanza); `src/ingest/informe.ts` (`InformeCron`, `cobertura.pgCron`, línea del bloque 1) | `informe.test.ts` «SPEC-017 CA-5 todas las horas cubiertas: 0», «…una hora sin ejecución: listada», «…sin datos: la línea lo dice», «…no entra en el veredicto»; `informe.db.test.ts` «SPEC-017 CA-5 lee cron.job_run_details» | ✅ consulta en `try/catch`, última; tests de 0 / hora listada / sin datos (vacío, error, no consultado) / veredicto igual; DB: fila sembrada con rollback; campo: `8952 ejecuciones (succeeded 8952)` | ✅ |
| CA-6 | sin cambios en `constants.ts`, `src/decide`, `engine.ts`, `window.ts`, migraciones ni `package.json` | `informe.test.ts` «y con todos los ejes acotados saturados a la vez, incluido el cubo de N-8, también cabe» (ahora con `sinDirecto`, `cronCasiMudo`, `capturasMixtas`): 144 líneas ≤ 145; `npm run gates` → 0; `npm run test:db` | ✅ fronteras y techo; `gates` → 0. ⚠️ `test:db` con timeout por defecto → timeouts de 5 s que también da `origin/main`; 82/82 con `--testTimeout=30000` | ⚠️ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-10-06, sdd-verificador.** CA-1..CA-5 ✅; CA-6 ⚠️ (salvedad aceptada: `test:db` rojo solo por timeouts de 5 s que también da la base, ver evidencia). Ninguna verificación pidió al proveedor.

### Evidencia del verificador
- `npm run gates` → `EXIT 0` (tsc limpio; biome «Checked 156 files»; vitest `51 passed (51)`, `814 passed (814)`; `next build` «Compiled successfully»).
- `git diff origin/main --stat` → 9 ficheros: ledger, spec, `src/ingest/{contraste,informe,informe-db}.ts` y sus tests, `tools/informe-jornada.mjs`. `git diff origin/main --stat -- docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/ src/decide src/ingest/engine.ts src/ingest/window.ts src/ingest/constants.ts package.json package-lock.json supabase/` → vacío. `INFORME_MAX_LINEAS = 145`, `INFORME_FILAS_MOSTRADAS = 5` sin cambiar.
- `npm run test:db` (rama, «Remote database is up to date») → exit 1: `8 failed | 74 passed (82)`, los 8 `Error: Test timed out in 5000ms.`; segunda pasada `4 failed | 78 passed (82)` (calendar, engine ×2, reconciliacion), todos timeouts. `npx vitest run --config vitest.db.config.mts --testTimeout=30000` → `10 passed (10)`, `82 passed (82)`. `informe.db.test.ts` solo → `8 passed (8)`.
- Base: worktree aparte en `origin/main` ccd1b0a, `npx vitest run --config vitest.db.config.mts` → `4 failed | 75 passed (79)` y luego `9 failed | 70 passed (79)`, todos `Test timed out in 5000ms` (incluidos tests de `informe.db.test.ts` de SPEC-009). Adjudicación: no lo introduce esta rama; es latencia del pooler remoto (F-SPEC-017-4). Arreglarlo exigiría tocar `vitest.db.config.mts`, fuera de las fronteras de CA-6.
- Campo CA-3/CA-5 (solo lectura, sin `--contrastar` ni `--recontrastar`): `node tools/informe-jornada.mjs 2026-09-25T18:20Z 2026-09-28T21:00Z` → `EXIT 0`, 101 líneas:
  ```
  ticks: 2732 de 3134 esperados (87 %)   ← cobertura de CA-9
  pg_cron (cron.job_run_details): 8952 ejecuciones (succeeded 8952) · horas de ventana sin ninguna ejecución: 0
  sin ninguna observación en juego: 5 — tercera-rfef-g1-2026-27-j4-sarriana-celta-c, tercera-rfef-g1-2026-27-j4-montaneros-viveiro, segunda-rfef-g1-2026-27-j4-arosa-alaves-b, tercera-rfef-g1-2026-27-j4-boiro-villalbes, tercera-rfef-g1-2026-27-j4-portonovo-silva
  veredicto: sin veredicto
  ```
  Coincide con `hallazgos-jornada.md` §1 (l. 34–35: `arosa-alaves-b`; `boiro-villalbes`, `montaneros-viveiro`, `portonovo-silva`, `sarriana-celta-c`).
- Observación (no bloquea, **F-SPEC-017-5**): en `tools/informe-jornada.mjs`, si con varias temporadas una se pide y otra no se puede releer, `contraste = null` y el bloque 8 solo imprime el motivo: las peticiones hechas en esa ejecución no salen en el informe (el crudo sí queda guardado). Caso raro, solo tras una ejecución a medias. Destino: EPIC-MANT.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-017/. Informe HTML opcional: _qa/SPEC-017/informe.html -->
n-a: sin UI; la evidencia es la salida de texto del generador (arriba).

## Evidencia de campo CA-3 (implementador)
`node tools/informe-jornada.mjs 2026-09-25T18:20Z 2026-09-28T21:00Z` (sin `--contrastar`, a stdout, 2026-10-06, exit 0):
```
ticks: 2732 de 3134 esperados (87 %)   ← cobertura de CA-9
intentos dentro de la ventana de ADR-002 §2 pero tras el cierre de todo partido: 1
horas de ventana sin ejecuciones: 1 — 2026-09-26T19Z
pg_cron (cron.job_run_details): 8952 ejecuciones (succeeded 8952) · horas de ventana sin ninguna ejecución: 0
sin ninguna observación en juego: 5 — tercera-rfef-g1-2026-27-j4-sarriana-celta-c, tercera-rfef-g1-2026-27-j4-montaneros-viveiro, segunda-rfef-g1-2026-27-j4-arosa-alaves-b, tercera-rfef-g1-2026-27-j4-boiro-villalbes, tercera-rfef-g1-2026-27-j4-portonovo-silva
veredicto: sin veredicto
```
Los cinco son los del hallazgo 1 (`_qa/SPEC-009/hallazgos-jornada.md`). Vigentes `finished` en la ventana: RN-01 27, RN-02 10, RN-12 2.

## Gates (implementador, 2026-10-06)
- `npm run gates` → exit 0 (biome 156 ficheros sin cambios; vitest 51 ficheros, 814 tests; `next build` compila).
- `npm run test:db` (contra `dev`, «Remote database is up to date») → exit 1: 79/82, 3 timeouts de 5 s en `engine.db.test.ts` (2) y `reconciliacion.db.test.ts` (1), ficheros que esta spec no toca. **Fallan igual en `origin/main` (ccd1b0a)** en un worktree aparte. Con `npx vitest run --config vitest.db.config.mts --testTimeout=30000` → 10 ficheros, **82/82**. `informe.db.test.ts` → 8/8 con el timeout por defecto.

## Salvedades / follow-ups
<!-- IDs F-SPEC-017-1, F-SPEC-017-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-017-1** (para el humano, consecuencia de H-3): sobre la base de hoy, la misma ventana con el código de `origin/main` (ccd1b0a, worktree aparte) da `ticks: 2731 de 3074 esperados (89 %)` y 2 «tras el cierre»; con CA-4, `2732 de 3134 (87 %)` y 1. Las 10 vigentes RN-02 (cierres forzosos y correcciones de SPEC-012, N-2) alargan su ventana a +150, y esa jornada se muestreó antes de SPEC-013, cuando el tick salía en el forzoso. No se regenera el informe medido (fuera de alcance). Destino: SPEC-014 CA-8 (criterio `forced_finish`) corrige la parte de las correcciones.
- **F-SPEC-017-2**: `--contrastar` sigue exigiendo `API_FOOTBALL_KEY` aunque relea (el adaptador la pide al construirse); además ahora exige `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` para el raw store. Destino: EPIC-MANT si molesta.
- **F-SPEC-017-4**: `test:db` tiene 3 tests de SPEC-007/SPEC-013 que pasan de 5 s contra `dev` (latencia del pooler remoto); ya estaban así en `main`. Destino: EPIC-MANT (subir `testTimeout` en `vitest.db.config.mts` o acelerar esos tests).
- **F-SPEC-017-3**: el comentario de `INFORME_MAX_LINEAS` en `constants.ts` dice 142 líneas de techo; ahora mide 144. No se toca (CA-6: constantes existentes intactas). Destino: documentalista o la próxima spec que toque `constants.ts`.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho CA-1..CA-6 en `ft/SPEC-017-mejoras-del-informe-de-jornada` (sin push). Spec en `en-revision`.
- Siguiente: sdd-verificador. Ninguna prueba pide al proveedor; CA-1/CA-2 de campo serían la jornada del 2026-10-09/12 (primer `--contrastar` guarda, el segundo relee con 0 peticiones).
- Cuando entre SPEC-014 CA-8: `informe-db.ts` trae `forced_finish` y `ventanaEfectiva` usa la marca, con el caso (iv) de N-2.
