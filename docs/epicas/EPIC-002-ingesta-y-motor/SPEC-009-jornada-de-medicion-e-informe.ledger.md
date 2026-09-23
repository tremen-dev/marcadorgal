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
- Tercera vuelta (2026-09-22): V-6 y V-7 arreglados, cada uno con su test en rojo
  medido antes del arreglo, más la corrección de evidencia de V-4 (D-10).
- 3ª ronda de verificación de código (2026-09-22): **RED parcial**. V-6 y la
  evidencia de V-4 cerrados; V-7 medio cerrado — **V-8**: el tope de 145 se pasa
  (150-153) con listas todas acotadas. Ninguno de los dos findings es «antes del
  lunes»: se arreglan el martes y el informe se regenera. El ciclo de código se
  agota aquí; el gate humano decide.
- Ensayo de CA-6 (2026-09-22 22:02Z-22:20Z, adelantado con autorización del
  titular): **las cinco comprobaciones (i)-(v) en verde** y **R-SPEC-006-1
  cerrado**; kickoff restaurado y contrastado contra el calendario declarado (0
  discrepancias en 1834 partidos). Y el ensayo hizo su trabajo: destapó
  **F-SPEC-009-8** y **F-SPEC-009-9**, que dejan a CA-7 sin observaciones en 600
  de los 4480 min de su ventana —viernes y lunes completos— y **piden arreglo
  antes del viernes 18:20Z**. Detalle y salidas en «Evidencia visual → ensayo de
  CA-6».
- Rama: `ft/SPEC-009-jornada-de-medicion-e-informe`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/informe.ts` (puro: `percentil`, `estadisticos`, `etiquetaP95`, `parseReferencias`, `secretosDelEntorno`, `redact` de mayor a menor longitud, `BLOQUES`, `informeJornada`) · `tools/informe-jornada.mjs` (cáscara) · `package.json` script `informe:jornada` | `src/ingest/informe.test.ts`: percentil n=1/n=2/n=100 · `etiquetaP95` · los nueve bloques y su orden · informe vacío sin lanzar (7 de 9 bloques dicen por qué) · ningún valor de `.env` en la salida · primera línea derivada de los partidos · firma del comando (5 casos por `spawnSync` sin `.env`) · **V-5** «ningún valor del entorno se escapa» (los cinco valores de `.env` que el verificador nombró, en `ingest_attempts.error` y en `alerts.details`; `LANG`/`CI` no se tocan) | `informe.ts` sin reloj, red ni db; cáscara como cáscara; nueve bloques en orden y los vacíos dicen por qué; primera línea **derivada** de los partidos, probada sobre tres ventanas (25-28 sep → «cuatro de las cinco», 9-12 oct → «cinco», solo 9 oct → «una»). **2ª ronda (2026-09-22): V-5 cerrado**, comprobado por el verificador en las dos direcciones sobre el entorno real de `npm run`: plantados los **8 valores no vacíos de `.env`** en `ingest_attempts.error` y en `alerts.details` → **15 `[secreto]`, 0 escapes**; y de los **60 valores del entorno de ≥ 8 caracteres**, **0 redacciones espurias** sobre un informe realista. El valor más corto de `.env` mide **16** caracteres, el doble del umbral: bien calibrado. `SUPABASE_ACCESS_TOKEN` está vacío en `.env` (nada que perder). Informe real sobre `dev`: exit 0, 126 líneas, 0 redacciones. **3ª ronda (2026-09-22): sin regresión tras el recorte de prosa.** Los nueve bloques siguen en orden y los siete vacíos siguen diciendo por qué; cada estadístico sigue llevando su `n`; la primera línea sigue **derivada** de los partidos (informe real sobre `dev`: «Se midieron cuatro de las cinco competiciones de D-3», 39 partidos). De los **50 valores del entorno de ≥ 8 caracteres** y los **9 no vacíos de `.env`** (el más corto, 16 caracteres), **0 aparecen** en la salida real y **0 redacciones** espurias. | ✅ |
| CA-2 | `src/ingest/informe.ts` (`cadenciaDe` —huecos entre observaciones **más el silencio final de cada partido**, V-2—, `ventanaEfectiva`, `latenciaInternaDe`, techo propio; el bloque 3 dice que el 0-0 del estreno cuenta) · `src/ingest/informe-db.ts` (`informeFilas`) | `src/ingest/informe.db.test.ts` «tres observaciones a 30, 30 y 120 s y dos Decisions» (con el hueco final, `final: true`) · `informe.test.ts` «CA-2 (a)» y «CA-2 (b)» (huecos que no cruzan de partido, Decision que no cambia marcador, techo propio, el 0-0 del estreno) · **V-2** «el silencio final cuenta» (4 casos: cadencia, hueco largo marcado, lista de sin señal, y un partido muestreado hasta su cierre que no inventa ningún hueco) | `npm run test:db` exit 0 (8 ficheros, 71 tests) y **cero filas residuales en `dev`** contadas por el verificador antes y después (julio 2027, ids `test-*`, teams/competitions de prueba: 0; `matches` 1834 → 1834). La salida real dice «captura → publicación» con esas palabras. **2ª ronda: V-2 cerrado, y por el camino de las consultas reales**: el caso de `informe.db.test.ts` **falla contra el código anterior** (árbol HEAD con `informe.ts` de `f8e8037^` → `expected { n: 3, mediana: 30000, … } to match object { n: 4, … }`). Sobre 39 partidos con el tick muerto a los 30 min: **39 huecos finales** y **39 de 39** partidos en la lista de sin señal; recíproco comprobado (muestreo completo hasta el cierre → `maximo: 30 s`, cero huecos largos): el arreglo no inventa huecos. **Observación**: la primera Decision con marcador (0-0 al empezar) cuenta como «cambia el marcador» y el bloque 3 lo dice. **3ª ronda: las afirmaciones que la spec pide con esas palabras siguen impresas**, medidas sobre la salida real y no leídas del diff: «captura → publicación», «No es latencia extremo a extremo y nadie debe leerlo así», «observed_at = capturedAt (SPEC-006 CA-7)», el 0-0 del estreno y el techo propio. `npm run test:db` exit **0** (8 ficheros, 71 tests) y **0 filas residuales en `dev`**: 16 conteos idénticos antes y después (`observations`/`decisions`/`alerts`/`ingest_attempts` en 0, `matches` 1834, ids `test*` y ventana de julio 2027 en 0). | ✅ |
| CA-3 | `src/ingest/informe.ts` (`parseReferencias`, `latenciaExternaDe`) · `docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/referencias.csv` (cabecera, sin filas) | `informe.db.test.ts` «de tres filas casa una y las otras dos quedan listadas con su motivo» · `informe.test.ts` «CA-3 referencias externas» (fichero vacío, fila mal formada, `peor caso (n=1)`, rango, objetivo de `vision.md` en segundos) | Frontera n=20 ejercitada a mano: con n=12 imprime `peor caso (n=12)` y «el p95 de vision.md no se contrasta con n=12»; con n=20 imprime `p95` y `p95 < 90 s → cumple`. Contraste en segundos contra los 45 s, con caso recíproco a 100 s; la aserción `"mediana < 45 s → cumple"` no casa dentro de `"→ NO cumple"`. `referencias.csv` con solo cabecera: informe generado exit 0. Filas no casadas listadas con su motivo y **nunca** recortadas. **2ª ronda**: sin regresión (gates 613 tests en verde; una fila mal formada o un `matchId` mal escrito el domingo se arregla editando el CSV y regenerando, nada se pierde). **3ª ronda**: la línea del tamaño esperable sigue entera («tamaño esperable: los 39 partidos de la ventana dan del orden de 98 goles» + «H-3: domingo 27, 14:00Z-17:00Z»), igual que `peor caso (n=12)`, el `rango: [...]` y el contraste con los 45 s de `vision.md`. Sin regresión (633 tests en verde). | ✅ |
| CA-4 | `src/ingest/informe.ts` (bloques 5, 6 y 7; el hueco de un partido incluye su silencio final, V-2; el bloque 7 acotado con `primerasFilas`, V-4) · `src/ingest/informe-db.ts` (`details->>'requests'`, `alerts`) | `informe.db.test.ts` «un partido sin observaciones y dos alertas de distinto kind» y «las peticiones salen de details->>'requests'» · `informe.test.ts` «CA-4» (total/día/pico, presupuesto EXCEDE, `unresolved_team` y `conflict` en cero) · **V-2** «el partido aparece en la lista de partidos sin señal de CA-4 (b)» | `grep -rn _http_response src tools`: ninguna consulta del informe lo toca; las peticiones salen de `details->>'requests'` (verificado en `test:db`). Bloque 7 lista cada alerta con `details` y `explicación:` vacía. **2ª ronda: V-2 cerrado.** El bloque 6 (b) ya ve el silencio final: en la jornada del tick muerto imprime `con al menos un hueco > 15 min: 39` y lista los 39 con su hueco mayor, donde antes imprimía 0. Un partido sin ninguna observación sigue saliendo solo por `sin ninguna observación`, que es lo correcto (no se le inventa un hueco). **3ª ronda: la letra de (b) y de (c) no se cumple con cinco filas — y no se cumplía con diez.** Medido con 27 partidos con hueco largo y 39 alertas: (b) imprime `con al menos un hueco > 15 min: 27`, su desglose por competición y **5** filas con su hueco mayor + `… y 22 más`; las otras 22 no llevan hueco ninguno. (c) imprime **2** alertas con sus `details` y su `explicación:` + `… y 37 más, explicadas por kind`. Es F-SPEC-009-3/-4 y no un defecto nuevo (a diez eran 10 de 27 y 5 de 39), pero es una **salvedad**, y una salvedad no es ✅: además CA-9 (a) lee «cada alerta abierta tiene explicación» y con dos huecos eso se declara por `kind`. F-SPEC-009-3 sigue diciendo «a diez filas» cuando ya son cinco. | ⚠️ |
| CA-5 | `src/sources/api-football/results.ts` (`apiFootballByIds`, **sin tocar en la 3ª vuelta**) · `src/ingest/contraste.ts` (devuelve el `motivo` del silencio: `skipped` con su `reason`, `unresolved` con la suya, el fixture que no vino, el partido sin alias, V-6) · `src/ingest/informe.ts` (bloque 8: coincidentes, **estados no-`finished` que el proveedor confirma** con su raw_ref y su hueco de explicación, V-3; **partidos sin respuesta del proveedor** en su propia línea con su motivo, su raw_ref y su explicación, V-6; y discrepancias) | `informe.db.test.ts` «dos partidos en board, uno coincidente y uno no» con `fetch` doble (una sola petición `ids=101-102`) · `informe.test.ts` «CA-5» (peticiones del contraste aparte, bloque vacío sin `--contrastar`) · **V-3** «un estado no-finished acordado no es discrepancia» (4 casos) · **V-6** `contraste.test.ts` «el silencio del proveedor vuelve con su motivo» (6 casos sobre el adaptador **de verdad**: `unsupported_status`, `missing_score`, `unknown_team`, fixture ausente de la respuesta, partido sin alias, y el recíproco de que un partido contestado no lleva motivo) + «ABD, AWD y WO no son estados sin mapear» · `informe.test.ts` «CA-5 el silencio del proveedor no es discrepancia» (5 casos: su propia línea con motivo y raw_ref, no dispara (c2) y baja a reservas, la cuenta «N de N» intacta, un silencio sin motivo lo dice, y el recíproco de que dos lados diciendo cosas distintas sigue siendo (c2)) | Maquinaria verificada en `test:db` con `fetch` doble (una sola petición `ids=101-102`, ≤ 20 por petición); la url base y la cabecera `x-apisports-key` se quedan dentro de `src/sources/api-football/`. `--contrastar` sobre ventana vacía: bloque «0 de 0» sin ninguna petición. **No se ha llamado al proveedor de verdad** a propósito (RN-08). **2ª ronda: V-3 cerrado**, comprobado en las dos direcciones por el verificador: 39 aplazados que board y proveedor dicen igual → `acordadosNoFinished: 39`, `discrepancias: 0`, veredicto `válida con reservas` y **no** (c2); los dos diciendo cosas distintas → `discrepancias: 39` → `no válida (c2)`. **Finding V-6 (nuevo)**: un partido del que el proveedor **no contesta** se imprime como discrepancia y dispara (c2) — detalle abajo. **3ª ronda: V-6 cerrado, y contra el adaptador de verdad.** Las **cuatro rutas reales** llegan al informe con su motivo —`missing_score`, `unresolved`, fixture ausente de la respuesta y partido sin alias— más `unsupported_status` con un código **nuevo**; los 9 casos **fallan contra el código anterior** (`expected undefined to be 'el adaptador lo descartó: …'` ×5 en `contraste.test.ts`; `expected [ { matchId: 'mudo', …(3) } ] to deeply equal []` y `- "rama": "c2" / + null` en `informe.test.ts`). Jornada **sana** con un silencio: `sinRespuesta 1`, `discrepancias 0`, cobertura `5550/5550 = 100 %`, veredicto **`válida con reservas`** y **no** (c2); la cuenta de CA-5 intacta («38 de 39 partidos con `finished` y marcador coincidente»). Recíproco: el proveedor contesta otra cosa → `no válida (c2)`. **El ejemplo de V-6 queda adjudicado a favor del implementador** (abajo). | ⚠️ |
| CA-6 | **Ensayo ejecutado el 2026-09-22 de 22:02Z a 22:20Z** sobre `dev` con el tick desplegado, siguiendo el guion de «Cómo retomar» **sin cambiarlo** (autorización de Alberto Fojo de esa noche para adelantarlo y para el único `update matches set kickoff`). Sin código nuevo: lo que se prueba es el camino desplegado (pg_cron → Vercel → `src/ingest/tick.ts` → `src/raw/store.ts` → `src/sources/api-football/results.ts`). Partido **`tercera-rfef-g1-2026-27-j4-atletico-arteixo-alondras`** (Terceira Federación · Grupo 1, J4), kickoff real **`2026-09-26T15:00:00Z`**, movido a `now() + 5 min` (`2026-09-22T22:07:21.200Z`) y restaurado con `npm run calendario:load -- 2026-27`. Script del paso 2 del guion (`ca6-ensayo.mjs`, temporal, borrado; `git status` limpio). | Las cinco comprobaciones **(i) a (v) del CA, las cinco en verde**, con comando y salida real en «Evidencia visual → ensayo de CA-6». Anotado lo que quedó (RN-07, N-5): **10 `observations`** `scheduled` sin marcador, **1 `decision`** (v1, `scheduled`, `provisional`, RN-01, 1 observación citada), **0 `alerts`**; 33 `ingest_attempts` y 56 peticiones al proveedor. El ensayo además **destapó dos defectos del camino desplegado que no son de las cinco comprobaciones y que dejan a CA-7 sin observaciones en 600 de los 4480 min de su ventana**: **F-SPEC-009-8** y **F-SPEC-009-9**. | No se juzga en esta ronda: campo, **miércoles 2026-09-23**. El guion de «Cómo retomar» es **byte a byte idéntico** al de la 1ª ronda (`diff` contra `0b2ddf0`) y no depende de ninguno de los siete commits de esta vuelta. **3ª ronda**: el guion de «Cómo retomar» sigue **byte a byte** el de la 1ª ronda — mismo sha (`c863a897`, 148 líneas) que en `0b2ddf0` y en `d3cbf81`. | ❌ |
| CA-7 | — trabajo de campo, **viernes 2026-09-25 18:20Z → lunes 2026-09-28 21:00Z**. El informe ya calcula sus números (cobertura, horas sin ejecuciones, intentos fuera de ventana, intentos fallidos). | — | No se juzga en esta ronda: campo, **viernes 25 18:20Z → lunes 28 21:00Z**. De su maquinaria sí: el **criterio 2 no se ha relajado** — una sola fila de `ingest_attempts` fuera de la ventana de ADR-002 §2 de todo partido sigue saliendo (`intentos fuera de la ventana de todo partido: 1   ← criterio 2`), y las dos ventanas están separadas a propósito (ver abajo). | ❌ |
| CA-8 | — trabajo de campo, el fixture `live-<fecha>.json` se captura **durante la jornada** (sábado 2026-09-26). | — | No se juzga en esta ronda: campo, **sábado 2026-09-26**. | ❌ |
| CA-9 | `src/ingest/informe.ts` (`veredictoDe`, umbrales en `src/ingest/constants.ts`; `ventanaEfectiva` + `union` + `dentroDe`: numerador y denominador de la cobertura sobre el mismo span, V-1; el acuerdo no-`finished` como reserva nombrada, V-3) — el veredicto **real** se escribe con los números de la jornada, **lunes 2026-09-28**. | `informe.test.ts` «CA-9 veredicto»: válida, válida con reservas, c1 por cobertura, c1 por competición muda, c2 por marcadores, intervención sobre el dato vs sobre la plataforma, declaraciones pendientes · **V-1** «cobertura sobre la ventana efectiva de cada partido» (3 casos: muestreo perfecto → 100 % y `válida`, la línea que dice sobre qué ventana se calcula, y un partido que nunca cerró cuenta su ventana entera sin pasar del 100 %) | Solo la **maquinaria**, nunca el resultado de campo. **V-1 cerrado y el invariante de las dos direcciones comprobado por el verificador** sobre los 39 partidos de la jornada: muestreo perfecto → `5550 / 5550 = 100 %` y veredicto `válida`, igual con cierre en +100 (`5540/5540`), +105 y +120 (`5580/5580`); tick caído 4 h → 91,4 % `válida con reservas`; 8 h → 82,7 %; 12 h → 74,1 % `no válida (c1)`. Los tests nuevos **fallan contra el código anterior** (`expected 900 to be 690`; y con muestreo perfecto el informe imprimía `veredicto: no válida (c1) · cobertura de ticks 77 %`). Umbrales 0,95 / 0,80 en `constants.ts`, los que fija CA-9. **Divergencia de V-1 adjudicada a favor del implementador** (abajo). El veredicto real se escribe el **lunes 2026-09-28**. **3ª ronda**: el silencio del proveedor entra como **reserva nombrada** («N partido(s) sin respuesta del proveedor, con su motivo y su explicación») y nunca como rama (c2) — medido por mí, no leído. El veredicto real se escribe el **lunes 2026-09-28**. | ❌ |
| CA-10 | `package.json` (solo el script `informe:jornada`, sin dependencias nuevas, sin migraciones) · `src/ingest/informe.ts` (`primerasFilas` y `primerasContadas`: una lista gasta como mucho las **cinco** líneas de `INFORME_FILAS_MOSTRADAS`, y una cuenta que ya dice 0 no gasta además un «(ninguno)»; el desglose por competición del bloque 1 se quitó porque ya está en la primera línea del informe; ninguna línea en blanco bajo los títulos, V-7) · `src/ingest/constants.ts` (`INFORME_FILAS_MOSTRADAS` de 10 a **5**; `INFORME_MAX_LINEAS` sigue en 145, dos páginas de 72 líneas, ahora con el techo medido) — el informe `_qa/SPEC-009/informe-jornada-2026-09-28.md` se genera **el lunes 2026-09-28**. | Gates y `test:db` en verde (evidencia abajo); `informe.test.ts` «CA-10 el informe cabe en dos páginas» (recorte de listas), **V-4** «cabe en dos páginas, medido en líneas» y **V-7** «el tope se cumple por construcción, no por fixture»: **los cinco escenarios de la tabla del verificador medidos uno a uno** (137 / 100 / 126 / 104 / 95 líneas contra 145), más **el techo** —cinco competiciones, las ocho listas acotadas saturadas a la vez, tick muerto, alerta por partido y silencios del proveedor: **137**— y **el máximo de lo no acotado** —49 discrepancias en cinco competiciones: **126**—, más el recíproco de que el informe saturado sigue diciendo cada cuenta y su desglose | Corrido por el verificador el 2026-09-22: `npm run gates` exit **0** (biome 139 ficheros, 45 test files / **613 tests**); `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm run gates` exit **0**; `npm run test:db` exit **0** y **0 filas residuales en `dev`**. `git diff main --stat -- src/decide src/ingest/engine.ts` **vacío**; `… -- src/ingest/tick.ts src/ingest/db.ts src/ingest/window.ts src/raw src/app/api supabase` **vacío**; 0 migraciones; 0 cambios en `package-lock.json`; `constants.ts` **56 adiciones y 0 borrados**; `package.json` solo `informe:jornada`; `git grep -qF` sin coincidencias ni para `$API_FOOTBALL_KEY` ni para `$INGEST_TICK_TOKEN`; `apiFootballByIds` solo lo usan la cáscara y su test, nunca el tick. **V-4 medio cerrado**: ya existe test que **mide líneas**, pero el tope no se cumple — **finding V-7**: **190 líneas** con todas las listas acotadas saturadas y **cero** filas de las que no se recortan. Parte de campo (el fichero del informe) abierta hasta el lunes. **3ª ronda: V-7 medio cerrado — finding V-8.** Los **ocho escenarios** del implementador reproducidos uno a uno con generador propio y **coinciden**: 137 / 137 / 126 / 126 / 104 / 95 / 100 y 71 el vacío; el escenario de las **190 líneas de la 2ª ronda ya no existe** (mide **143**). Pero el tope **sigue calibrado contra un fixture**: tres ejes solo acotados lo pasan con cero discrepancias y cero referencias no casadas (detalle abajo). Regresión: `npm run gates` exit **0** (biome 140 ficheros, 46 test files / **633 tests**) y con los cinco secretos desenchufados exit **0**; `git diff main --stat` **vacío** en `src/decide`, `src/ingest/engine.ts`, `tick.ts`, `db.ts`, `window.ts`, `src/raw`, `src/app/api` y `supabase`; **0** migraciones, **0** cambios en `package-lock.json`, `package.json` solo `informe:jornada`; `git grep -nF` sin coincidencias para los cinco valores de `.env`; el camino del informe **sin una sola escritura** (`insert`/`update`/`delete` a cero en `informe.ts`, `informe-db.ts`, `contraste.ts` y la cáscara); `apiFootballByIds` solo la cáscara y su test. Informe real sobre `dev`: exit 0, **91 líneas**. | ⚠️ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### RED parcial — 2026-09-22 · 3ª ronda de CÓDIGO previa a la jornada

**Esto no es el veredicto de la spec.** Tercera y última iteración del ciclo de
código. Juzga solo lo que tocó la tercera vuelta (V-6, V-7, la evidencia de V-4)
más la regresión y la **maquinaria** de CA-9. **CA-6, CA-7 y CA-8 siguen ❌**:
ensayo el miércoles 23, ventana del viernes 25 18:20Z al lunes 28 21:00Z, fixture
el sábado 26. **No se emite GREEN y la spec no se mueve de `en-progreso`.**

**Ningún finding de esta ronda obliga a tocar nada antes del lunes.** El informe
se recalcula entero desde filas append-only y crudo de 30 días, y el camino del
informe es de **solo lectura**: la medición de campo puede correr tal cual está.

- **V-6: cerrado.** Contra el **adaptador de verdad**, no un doble. Las cuatro
  rutas reales llegan al informe con su motivo, `raw_ref` y hueco de explicación;
  el silencio tiene su propio cubo, baja a `válida con reservas` y **no** dispara
  (c2); la cuenta «N de N partidos con `finished` y marcador coincidente» se
  imprime intacta. Los 9 casos nuevos fallan contra el código anterior.
- **V-4: la evidencia queda corregida y la corrección es cierta.** Reconstruido
  `77f8323` con `informe.ts` y `constants.ts` de `77f8323^` y ejecutado: el rojo
  real es `AssertionError: expected '# Informe de la jornada · 2026-09-25 …' to
  contain '… y 34 más, explicadas por kind'`, en `informe.test.ts:1392`, y la
  aserción del conteo (1393) no llega a ejecutarse. El informe de ese árbol mide
  **204** líneas, así que el RED era real: solo su evidencia escrita no lo era.
- **Las tres aserciones que cambiaron de número son aritmética del cap, no
  medición rebajada.** 12 − 5 = 7, 30 − 5 = 25 y 39 − ⌊5/2⌋ = 37, y en los tres
  casos la aserción de la **cuenta de cabecera** sigue en pie palabra por palabra
  (`sin ninguna observación: 12`, `huecos > 90 s: 30`, `abiertas en la ventana:
  39`), igual que el desglose por competición. Comprobado en el diff y en rojo:
  contra el código anterior los tres fallan (`to contain '… y 7 más'`, `'… y 25
  más'`, `'… y 37 más, explicadas por kind'`).
- **El recorte de prosa no se ha comido ninguna afirmación que la spec pida.**
  Recorridas una por una contra la salida real del comando, no contra la tabla
  del implementador: **siguen** «captura → publicación», «No es latencia extremo
  a extremo y nadie debe leerlo así», «observed_at = capturedAt», el 0-0 del
  estreno, la línea del tamaño esperable con los 39 partidos y H-3, la línea de
  la ventana sobre la que se calcula la cobertura, `peor caso (n=<n>)` con n<20,
  la `n` junto a cada estadístico, la primera línea con cuántas competiciones y
  cuáles derivada de los partidos, los **nueve bloques en orden** con los vacíos
  diciendo por qué, las **tres** líneas de cuenta del bloque 8, el `← criterio 2`
  y la salvedad de H-1 con R-SPEC-009-1. **No falta ninguna.**

**V-8 (nuevo). El tope de las dos páginas sigue calibrado contra un fixture: se
cumple en el techo que el implementador midió, y no por construcción.** Los ocho
escenarios de su tabla los reproduje uno a uno con generador propio y salen
clavados (137 / 137 / 126 / 126 / 104 / 95 / 100 / 71), y el escenario de las 190
líneas ya no existe: mide **143**. Pero su generador no puede expresar tres cosas
que una jornada sí, y las tres pasan de 145 **sin una sola discrepancia y sin una
sola referencia no casada**, o sea con listas todas acotadas:

| escenario, todo acotado | líneas |
|---|---|
| el techo declarado + 6 estados no-`finished` acordados a la vez que los 10 silencios | **150** |
| el techo declarado + esos 6 acordados + los **cinco** `AlertKind` reales | **153** |
| el escenario de las 190 líneas de la 2ª ronda, con 5 `AlertKind` en vez de 2 | **146** |
| cuatro competiciones: tick muerto, 39 alertas, 6 acordados, 6 silencios, 15 fallidos, 12 mudos | **150** |

Tres ejes, ninguno exótico: (i) `AlertKind` tiene **cinco** valores
(`src/model/vocab.ts`) y la lista `porKind` del bloque 7 **no está acotada**, así
que cuesta hasta cinco líneas y el fixture solo usa dos; (ii) los dos cubos
nuevos del bloque 8 —acordados no-`finished` y sin respuesta— cuestan **siete
líneas cada uno** y el generador los hace mutuamente excluyentes porque ata
`status` y `proveedorStatus` a la vez para los 39 partidos, cuando una jornada
con seis aplazamientos acordados y seis partidos que el proveedor no contesta es
perfectamente corriente; (iii) esos siete y siete se suman a los mudos y los
fallidos. Reproducción exacta: el escenario del test «el techo de todo lo que
puede crecer a la vez», con `status` y `proveedorStatus` a `postponed` para seis
de los partidos en vez de para ninguno. Y el informe que se sale sigue siendo el
de la jornada mala, que es el que decide si se repite.

De paso, y de la misma familia: 145 se cuenta en líneas **lógicas**, y en el
techo de 137 hay 18 líneas de más de 90 caracteres (la primera llega a **249**).
A 90 columnas ese informe imprime **156** líneas. «Dos páginas» medido en líneas
lógicas es un proxy optimista; no es un finding aparte, es el mismo número.

**La adjudicación que me tocaba, sin ambigüedad: tiene razón el implementador y
se equivocaba la 2ª ronda.** `ABD`, `AWD` y `WO` **están** en el mapa de
`src/sources/api-football/results.ts` y devuelven observación — medido contra el
adaptador de verdad, los 19 códigos uno a uno:

```
ABD → suspended 3-0 · AWD → finished 3-0 · WO → finished 3-0   (skipped: [])
XX / NUEVO → skipped: unsupported_status
ABD/AWD/WO/FT con goals null → skipped: missing_score
```

Los 19 códigos documentados están los 19 en el mapa, y la ruta de
`unsupported_status` solo la abre un código **nuevo** del proveedor.
`git diff d3cbf81 -- src/sources` está **vacío** y el `STATUS` de `results.ts` no
se ha tocado en toda la rama (`git diff main -- src/sources` son solo las 45
líneas de `apiFootballByIds`). **No hay agujero del adaptador que llevar al
arquitecto antes de la jornada.** El único matiz: un `ABD`/`AWD`/`WO` que llegue
con `goals: null` cae en `missing_score`, que es una de las cuatro rutas y vuelve
con su motivo — está cubierto, no es un agujero.

**Los dos findings, clasificados.**

| # | finding | cuándo |
|---|---|---|
| **V-8** | el tope de 145 se pasa con listas todas acotadas (150-153) | **el martes y se regenera**: es longitud de un fichero que se recalcula entero desde filas append-only; no toca captura ni motor; el arreglo es acotar `porKind` y el gasto del bloque 8, o volver a argumentar el tope |
| **V-9** | la letra de CA-4 (b) «cada uno con su competición y su hueco mayor» se cumple para **5** de 27, y la de (c) para **2** de 39 alertas | **el martes y se regenera** en el código; **antes del lunes** solo la mitad documental: F-SPEC-009-3 sigue diciendo «a diez filas» y quien escriba las explicaciones el lunes tiene que saber que el informe le ofrece **dos** huecos, no diez |

**Nada más es «antes del lunes».** Regresión completa en verde: `gates` exit 0
(46 ficheros, 633 tests) y también con los cinco secretos desenchufados;
`test:db` exit 0 con **0 filas residuales en `dev`** contadas por mí antes y
después; `git diff main` vacío en motor y en todo el camino de captura; sin
migraciones, sin dependencias, sin clave filtrada; el guion del ensayo de CA-6
**byte a byte** el de la 1ª ronda (sha `c863a897`, 148 líneas).

**¿Está el código listo para que el informe del lunes sostenga una decisión de
producto? Sí, con una condición y una advertencia.** Los números que la decisión
lee —cobertura y su ventana, cadencia con su silencio final, latencia interna
dicha como «captura → publicación», peticiones contra el presupuesto, partidos
sin señal, alertas por `kind`, las tres cuentas del contraste y el veredicto con
su rama— están todos, con su `n`, derivados de los datos y no de constantes, y
ninguno de ellos se pierde con el recorte: lo único que se recorta es la
**muestra** de cada lista. La condición es documental: que F-SPEC-009-3 diga
cinco y que quien escriba las explicaciones el lunes cuente con dos huecos. La
advertencia es V-8: si la jornada sale mal, el informe pasará de dos páginas —y
se regenera el martes sin perder un solo dato.

### RED parcial — 2026-09-22 · 2ª ronda de CÓDIGO previa a la jornada

**Esto no es el veredicto de la spec.** Segunda de las tres iteraciones del ciclo.
Juzga solo CA-1 a CA-5 y la mitad mecánica de CA-10, más la **maquinaria** (nunca
el resultado de campo) de CA-9. **CA-6, CA-7 y CA-8 siguen ❌** y son trabajo con
fecha: ensayo el miércoles 23, ventana del viernes 25 18:20Z al lunes 28 21:00Z,
fixture el sábado 26. **No se emite GREEN ni se mueve la spec de `en-progreso`**:
la spec dice que no hay GREEN antes del lunes 2026-09-28.

**Los cinco findings de la 1ª ronda están cerrados.** Los cinco tests nuevos los
reconstruí yo en copias del árbol (`git archive <commit>` + los ficheros de
código de `<commit>^`, sin tocar la rama) y **fallan contra el código anterior**:
V-1 `expected 900 to be 690` (y con muestreo perfecto `veredicto: no válida (c1)
· cobertura de ticks 77 %`), V-2 tres casos (`{ n: 3 } to match { n: 4 }`, huecos
largos y lista de sin señal vacías), V-3 tres casos (`{ matchId: 'aplazado' } to
deeply equal []`), V-4 `to contain '… y 34 más, explicadas por kind'`, V-5
`TypeError: secretosDelEntorno is not a function`. El caso de base de datos
también falla por el camino de las consultas reales. Ninguno puede pasar por
casualidad: todos llevan su recíproco (el partido cerrado que **no** inventa
hueco, los dos lados diciendo cosas distintas que **sí** es (c2), el informe que
**no** se recorta cuando cabe).

**Dos cosas nuevas, ninguna sobre la captura.** Como en la ronda anterior, no se
ha tocado un solo fichero del camino de ingesta (`git diff main` vacío en
`src/decide`, `src/ingest/engine.ts`, `tick.ts`, `db.ts`, `window.ts`, `src/raw`,
`src/app/api`, `supabase`) y todo el camino del informe es de **solo lectura**
(ni un `insert`, `update` o `delete` en `informe.ts`, `informe-db.ts`,
`contraste.ts` ni la cáscara), así que nada de esto puede estropear la jornada.

- **V-6. Un partido del que el proveedor no contesta se imprime como
  discrepancia y dispara la rama (c2).** Hermano de V-3, y sobrevivió a su
  arreglo. En `src/ingest/contraste.ts` un partido que no aparece en
  `parsed.observations` vuelve con `proveedor: null`, y el bloque 8 de
  `informe.ts` lo mete en `discrepancias` porque `acuerdo` compara
  `"finished" !== "sin respuesta"`. Medido sobre una jornada **sana**: 39
  partidos `finished`, cobertura `5550/5550 = 100 %`, 38 coincidentes y **uno sin
  respuesta** → `discrepancias: 1` → `veredicto: no válida (c2) — motor
  equivocado`, con la razón «1 partido(s) con marcador que no cuadra con el
  proveedor». **La ruta es real y no hace falta que falte el alias** (el alias de
  2026-27 tiene las 1.834 entradas): `parse` manda a
  `skipped('unsupported_status')` cualquier `status.short` que el mapa de
  `src/sources/api-football/results.ts` no conoce —`ABD`, `AWD`, `WO`, y en
  Tercera y Segunda RFEF eso pasa—, `contrastarMarcadores` solo lee
  `parsed.observations` y **descarta `parsed.skipped` entero**, así que el informe
  no puede ni decir por qué. Reproducción: llamar a `informeJornada` con una fila
  de `contraste` con `proveedor: null` y todo lo demás coincidente. Arreglo del
  mismo tamaño que el de V-3: una tercera línea en el bloque 8 («partidos sin
  respuesta del proveedor: N», con su explicación obligatoria y su reserva, nunca
  (c2)), y que `contrastarMarcadores` devuelva `parsed.skipped` con su `reason`
  para que el informe lo imprima. No es discrepancia: es la ausencia de respuesta,
  y CA-5 pide comparar `status` y `score` **del proveedor**, no su silencio.
- **V-7. El tope de CA-10 no se cumple: la suma de los recortes ya se sale.** V-4
  cerró la mitad importante —el bloque 7 se acota y **hay test que mide
  líneas**—, pero 145 se calibró contra un fixture en el que casi todas las
  listas están vacías. Con **todas** las listas acotadas saturadas (12 partidos
  mudos, 15 intentos fallidos, 15 horas sin ejecuciones, 39 alertas, 6 estados
  acordados) y **cero** filas de las que no se recortan —cero discrepancias, cero
  referencias no casadas—: **190 líneas**, 45 por encima del tope, y el veredicto
  de ese informe es `no válida (c1)`, o sea que el informe que decide si se repite
  una semana es justo el que se sale. Otros dos casos, con todo lo demás en el
  camino feliz: **156** líneas con 39 aplazamientos acordados (un fin de semana
  de aviso rojo en Galicia) y **167** con 39 discrepancias. Siete listas a diez
  líneas cada una son setenta líneas de listas sobre unas setenta y cinco de
  prosa fija: el presupuesto no cabe en 145 por construcción. Y el test
  `INFORME_MAX_LINEAS <= 150` cierra la salida fácil, así que el arreglo es
  recortar de verdad (bajar `INFORME_FILAS_MOSTRADAS`, o fijar el gasto por
  bloque) o volver a argumentar el tope. Que las discrepancias y las referencias
  no casadas **no** se recorten (F-SPEC-009-3) me parece bien y no es esto: una
  lista de trabajo puede ocupar lo que ocupe. Lo que no vale es declarar un tope
  que el camino normal de una jornada mala incumple.

**La divergencia de V-1, adjudicada a favor del implementador.** El fallback
correcto es el **final de la ventana**, no `kickoff + FORCED_FINISH_MINUTES`.
Comprobado en el código y no en el razonamiento: `isInWindow`
(`src/ingest/window.ts`) sale de la ventana por `status === "finished"` y por
nada más, y el cierre forzoso de RN-02 (`src/decide/engine.ts`) exige
`current.status === "live"`, así que un partido **aplazado o suspendido** de
verdad se muestrea hasta `kickoff + 150` y recortar su denominador a 120 dejaría
sus intentos en el numerador sobre un denominador corto. Su test lo fija con
número: `ticksEsperados = 320` y `porcentaje = 1` para un `postponed`, que con el
fallback en 120 daría 123 %. Y `FORCED_FINISH_MINUTES` se sigue importando para
la línea que el informe imprime, así que no hay ningún 120 repetido.

**El invariante de las dos direcciones, medido por mí** sobre los 39 partidos:
muestreo perfecto → `5550/5550 = 100 %` y `válida`, igual con cierre en +100
(`5540/5540`), +105 y +120 (`5580/5580`); caída del tick de 4 h → 91,4 %
(`válida con reservas`), 8 h → 82,7 %, 12 h → 74,1 % (`no válida (c1)`).
Numerador y denominador miden el mismo span.

**Las dos ventanas siguen separadas y el criterio 2 no se ha relajado.**
Comprobado con un partido y tres instantes: un intento dentro de la ventana
efectiva cuenta en el numerador; uno dentro de la de ADR-002 §2 pero tras el
cierre no cuenta ni en el numerador ni como «fuera de ventana», y sale en su
línea propia; uno fuera de toda ventana da
`intentos fuera de la ventana de todo partido: 1   ← criterio 2`. Una sola fila
basta.

**Los seis fixtures retocados: ninguna aserción se ha debilitado.** Revisado el
diff caso por caso. Los seis añaden `decidedAt` en la última observación, que es
un escenario coherente (el tick deja de muestrear cuando el partido cierra) y
deja el silencio final en cero, así que **todas** las aserciones anteriores
siguen palabra por palabra: «cada estadístico lleva su n» sigue exigiendo
`mediana: 30.0 s (n=2)`; la cadencia sigue exigiendo `n: 3, mediana: 30 s,
maximo: 120 s` y `huecosLargos` con **un** elemento por `toEqual`, que es además
la prueba de que un partido cerrado no inventa hueco; «los huecos no cruzan de
partido» sigue en `n: 0`; el techo propio sigue en `34 s`; la lista de sin señal
sigue exigiendo exactamente un partido mudo y un hueco de 30 min; y el recorte de
listas sigue exigiendo `huecos > 90 s: 30` y `… y 20 más`. Ninguno de los seis
era el caso que el arreglo tenía que cambiar —para eso están los cuatro casos
nuevos de V-2, con su recíproco— y el de base de datos se **reforzó** (n=4, el
hueco final con `final: true`, `huecos > 90 s: 2`) sin perder nada de lo anterior.
No veo ningún fixture ajustado para que el test pasara en vez de arreglar el
código.

**Lo que miré y aguanta.** (i) La cobertura cuenta **filas** de
`ingest_attempts`, no ranuras de 30 s, así que en aritmética podría pasar del
100 % y tapar un hueco: no puede con los disparadores de hoy. `cron.job_run_details`
medido ahora mismo da 80 ejecuciones en 40 min con huecos de **30,013 a 30,051 s**
y un solo job, y la guarda de 25 s de `openAttempt` contra un periodo de 60 s
admite como mucho **2 filas por minuto** en cualquier fase de Vercel Cron (tres
huecos de ≥ 25 s no caben en 60 s), que es exactamente lo esperado. Queda dicho
para que nadie añada un tercer disparador ni baje el intervalo de pg_cron sin
volver aquí. (ii) `horasSinEjecuciones` solo mira las horas en punto que caen
dentro de la ventana efectiva, así que la primera y la última hora parciales no
se comprueban: infra-detecta, nunca inventa. (iii) El contraste **parsea sin
guardar el crudo** del proveedor (`contrastarMarcadores` no llama a `storeCapture`).
No publica nada, así que D-6 no está en juego, pero la evidencia de una
discrepancia —que es lo que sostiene la rama (c2)— cita solo *nuestro* `raw_ref`
y no los bytes de ellos. Para sdd-arquitecto, no es mío de arreglar.
(iv) La salida en rojo que el ledger apunta para V-4 (`expected 204 to be less
than or equal to 145`) **no es la que ese test produce**: la aserción
`toContain("… y 34 más")` falla antes y la del conteo no llega a ejecutarse. El
RED es real; su evidencia escrita, no. El ledger es evidencia (D-10).

**Lo irrepetible.** Nada de lo que devuelvo hoy cuesta una semana si se descubre
el lunes por la noche: el informe se recalcula entero desde filas append-only y
crudo con 30 días de vida, el camino de captura está intacto y de solo lectura, y
V-6 cae en la rama (c2), que por definición no se repite. Lo único que no se
puede volver a capturar es lo que pase en el campo —y `referencias.csv`, que lo
escribe una persona el domingo; ahí todos los modos de fallo que probé (campos de
más por una coma, `matchId` mal escrito, marcador que nunca se publicó) salen
listados con su motivo y se arreglan editando el fichero y regenerando.

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

Sin interfaz: SPEC-009 no pinta nada (Playwright no aplica). La evidencia son
comandos y su salida.

Comandos y salida real de la **3ª ronda** (2026-09-22, rama
`ft/SPEC-009-jornada-de-medicion-e-informe`, `ed93756`, corridos por sdd-verificador):

| Comprobación | Comando | Salida |
|---|---|---|
| gates | `npm run gates` | exit **0** · biome 140 ficheros · 46 test files, **633 tests** |
| gates sin los cinco secretos | `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm run gates` | exit **0** · 46 test files, 633 tests |
| test:db | `npm run test:db` | exit **0** · `{"upToDate":true,…,"migrations":[]}` · 8 test files, 71 tests |
| los tests de base de datos revierten | 16 conteos propios sobre `dev` antes y después de `test:db` | idénticos: `observations`/`decisions`/`alerts`/`ingest_attempts` **0 → 0**, ids `test*` y ventana de julio 2027 **0 → 0**, `matches` **1834 → 1834** |
| motor y camino de captura intactos | `git diff main --stat -- src/decide src/ingest/engine.ts` y `… -- src/ingest/tick.ts src/ingest/db.ts src/ingest/window.ts src/raw src/app/api supabase` | **vacío** los dos |
| `src/sources` sin tocar en esta vuelta | `git diff d3cbf81 --stat -- src/sources` | **vacío** |
| sin migraciones ni dependencias | `git diff main --stat -- supabase/migrations package-lock.json` · `git diff main -- package.json` | **0 líneas** · solo `+ "informe:jornada"` |
| la clave sin filtrar | `git grep -nF` de los 5 valores de `.env` (32/64/41/109/40 caracteres) | sin coincidencias, los cinco |
| el informe no escribe | `grep -niE "\b(insert\|update\|delete\|truncate\|drop)\b"` en `informe.ts`, `informe-db.ts`, `contraste.ts` y la cáscara | **ninguna** |
| guion del ensayo de CA-6 | `shasum` de la sección contra `0b2ddf0` y `d3cbf81` | **idéntico**, `c863a897`, 148 líneas |
| informe real | `npm run informe:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z --referencias …/referencias.csv` | exit **0** · **91 líneas** · `partidos en la ventana: 39` · `ticks: 0 de 3050 esperados (0 %)` · `veredicto: no válida (c1)`, que es lo que debe decir hoy · de los **50** valores del entorno de ≥ 8 caracteres y los **9** de `.env`, **0** aparecen y **0** redacciones espurias |
| adjudicación del mapa de estados | `parse` del adaptador de verdad sobre los 19 códigos + `XX`/`NUEVO` + los mismos con `goals: null` | `ABD`→`suspended`, `AWD`/`WO`→`finished`, `skipped: []`; solo `XX`/`NUEVO` dan `unsupported_status` |
| V-6 en rojo contra el código anterior | `git archive d6ecbcc` + `contraste.ts`/`informe.ts` de `d6ecbcc^` | **9 tests en rojo** (5 en `contraste.test.ts`, 4 en `informe.test.ts`), 72 en verde |
| V-7 en rojo contra el código anterior | `git archive d22c146` + `informe.ts`/`constants.ts` de `d22c146^` | **8 tests en rojo**: `expected 208/210/162/153/174 to be less than or equal to 145` y los tres `to contain '… y 7/25/37 más'` |
| V-4, el rojo real | `git archive 77f8323` + `informe.ts`/`constants.ts` de `77f8323^`, ese `it` solo | `AssertionError: expected '# Informe de la jornada · 2026-09-25 …' to contain '… y 34 más, explicadas por kind'` (`informe.test.ts:1392`); el informe de ese árbol, **204 líneas** |

Comandos y salida real de la **2ª ronda** (2026-09-22, rama
`ft/SPEC-009-jornada-de-medicion-e-informe`, corridos por sdd-verificador):

| Comprobación | Comando | Salida |
|---|---|---|
| gates | `npm run gates` | exit **0** · biome 139 ficheros · 45 test files, **613 tests** |
| gates sin los cinco secretos | `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm run gates` | exit **0** · 45 test files, 613 tests |
| test:db | `npm run test:db` | exit **0** · `{"upToDate":true,…,"migrations":[]}` · 8 test files, 71 tests, 60,5 s |
| los tests de base de datos revierten | conteo propio antes y después de `test:db` sobre `dev` | julio 2027, ids `test-*`, teams/competitions de prueba, observations/decisions/attempts/alerts: **0 → 0**; `matches` **1834 → 1834** |
| motor intacto | `git diff main --stat -- src/decide src/ingest/engine.ts` | **vacío** |
| camino de captura intacto | `git diff main --stat -- src/ingest/tick.ts src/ingest/db.ts src/ingest/window.ts src/raw src/app/api supabase` | **vacío** |
| el informe es de solo lectura | `grep -niE "insert \|update \|delete \|upsert\|truncate" src/ingest/informe.ts src/ingest/informe-db.ts src/ingest/contraste.ts tools/informe-jornada.mjs` | **ninguna** |
| migraciones y lock | `git diff main --name-only -- supabase/migrations \| wc -l` · ídem `package-lock.json` | **0** y **0** |
| `constants.ts` solo adiciones | `git diff main --numstat -- src/ingest/constants.ts` | `56  0` |
| `package.json` | `git diff main -- package.json` | una línea: `"informe:jornada": "node tools/informe-jornada.mjs"` |
| secretos no filtrados | `git grep -qF "$API_FOOTBALL_KEY"` y `git grep -qF "$INGEST_TICK_TOKEN"` | sin coincidencias las dos |
| el contraste no entra en el tick | `grep -rn apiFootballByIds src tools` | solo `tools/informe-jornada.mjs` y `informe.db.test.ts` |
| guion de CA-6 sin tocar | `diff` del bloque contra `0b2ddf0` | **idéntico** |
| V-1 en rojo antes del arreglo | árbol `31ffa89` con `informe.ts`/`constants.ts` de `31ffa89^` | 2 tests fallan · `AssertionError: expected 900 to be 690` · el informe imprimía `veredicto: no válida (c1)` y `cobertura de ticks 77 % por debajo del 80 %` con muestreo **perfecto** |
| V-2 en rojo | ídem con `f8e8037^` | 3 tests · `{ n: 3, mediana: 30000, … } to match object { n: 4, … }` · `expected [] to deeply equal [ {…} ]` (huecos largos y sin señal) |
| V-3 en rojo | ídem con `040bf26^` | 3 tests · `expected [ { matchId: 'aplazado', … } ] to deeply equal []` · `veredicto` c2 donde debía ser `válida con reservas` |
| V-4 en rojo | ídem con `77f8323^` (y con el constante nuevo, para aislar) | `expected '# Informe de la jornada…' to contain '… y 34 más, explicadas por kind'`. **Las dos aserciones de conteo pasaban** con el código viejo: la salida que el ledger apunta (`expected 204 …`) no es la de este test |
| V-5 en rojo | ídem con `75feeca^` | 2 tests · `TypeError: secretosDelEntorno is not a function` |
| el caso de base de datos en rojo | árbol HEAD con `informe.ts` de `f8e8037^`, `vitest --config vitest.db.config.mts` | `expected { n: 3, mediana: 30000, … } to match object { n: 4, mediana: 30000, … }`: el silencio final también sale por las consultas reales |
| V-1, invariante de las dos direcciones | `informeJornada` sobre 39 partidos, muestreo a 30 s, cierre +105 | `5550/5550 = 100 %` → `veredicto: válida`; cierre +100 `5540/5540`, +120 `5580/5580`, los tres al 100 % |
| V-1, la cobertura baja de verdad | la misma jornada con el tick caído un bloque contiguo | 4 h → `5070/5550 = 91,4 %` `válida con reservas` · 8 h → `82,7 %` · 12 h → `4110/5550 = 74,1 %` `no válida (c1)` |
| V-2, el tick muerto se ve | la misma jornada con el tick muerto a los 30 min | cadencia `maximo: 5.130 s`, **39 huecos finales**, `con al menos un hueco > 15 min: 39`, cobertura 42,2 % → `no válida (c1)` |
| V-3, las dos direcciones | 39 partidos que board y proveedor dicen `postponed` / los mismos en desacuerdo | `acordadosNoFinished: 39, discrepancias: 0` → `válida con reservas`; en desacuerdo `discrepancias: 39` → `no válida (c2)` |
| criterio 2, las dos ventanas | un partido (`kickoff+10`, cierre `+115`) y un intento en el minuto 50 / 130 / 200 | `{real:1, fuera:0}` · `{real:0, fuera:0}` (y su línea propia de «tras el cierre») · `{real:0, fuera:1}` → `intentos fuera de la ventana de todo partido: 1   ← criterio 2` |
| V-5, las dos direcciones | los 8 valores no vacíos de `.env` plantados en `ingest_attempts.error` y `alerts.details`, con el entorno de `npm run` | **15 `[secreto]`, 0 escapes**; y de los **60 valores del entorno de ≥ 8 caracteres**, **0 redacciones espurias** |
| V-5, calibración del umbral | longitud de cada valor de `.env` | 9 valores no vacíos, el más corto de **16** caracteres (`INFORME_SECRET_MIN_LENGTH` = 8); `SUPABASE_ACCESS_TOKEN` vacío |
| **V-7**, el tope de CA-10 | informe con todas las listas acotadas saturadas y cero filas sin acotar | **190 líneas** contra el tope de 145 · 156 con 39 aplazamientos acordados · 167 con 39 discrepancias · 146 con solo el tick muerto |
| **V-6**, el proveedor que no contesta | jornada sana (39 `finished`, cobertura 100 %, 38 coincidentes) con una fila de contraste `proveedor: null` | `discrepancias: 1` → `veredicto: no válida (c2)`, «1 partido(s) con marcador que no cuadra con el proveedor» |
| la cobertura no puede pasar del 100 % hoy | `cron.job_run_details` de los últimos 40 min + simulación de la guarda de 25 s contra los dos disparadores | 80 ejecuciones, huecos **30,013–30,051 s**, un solo job; máximo **2,004 filas/min** en la peor fase de Vercel Cron, contra 2 esperadas |
| el comando corre de verdad | `npm run informe:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z --referencias docs/…/referencias.csv` | exit 0 · **126 líneas** · primera línea «Se midieron **cuatro** de las cinco competiciones de D-3: … (10 partidos), Segunda División (11 partidos), … (9), … (9)» y «Sin partidos en la ventana: primera-division» · `ticks: 0 de 3050 esperados (0 %)` y `veredicto: no válida (c1)`, que es lo que debe decir hoy (los 39 partidos están `scheduled`, así que la ventana efectiva es la entera) · **0 redacciones** |

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

### Ensayo de CA-6 — ejecutado el 2026-09-22 22:02Z-22:20Z (sdd-implementador)

Partido movido: **`tercera-rfef-g1-2026-27-j4-atletico-arteixo-alondras`**, Terceira
Federación · Grupo 1, J4, kickoff real **`2026-09-26T15:00:00Z`** → `2026-09-22T22:07:21.200Z`.
Estado de partida medido antes de tocar nada: `tick:salud` **OK**, pg_cron cada 30 s con 200,
y `observations`/`decisions`/`alerts`/`ingest_attempts` **a cero**, `matches` 1834: toda fila
que aparece es del ensayo.

| Comprobación | Comando | Salida |
|---|---|---|
| en ventana antes de esperar | `npm run ingest:tick -- --dry-run` | `partidos en ventana: 1` · `2026-09-22T22:07:21.200Z tercera-rfef-g1 …atletico-arteixo-alondras [scheduled]` · `peticiones que haría: …/fixtures?ids=1612732` |
| **(i)** intento `ok` con `raw_ref` | script del paso 2 del guion, tal cual | `(i)  OK   2026-09-22T22:03:38.318Z raw/api-football/2026-09-22/2026-09-22T22-03-38.318Z-d610aef4-….json.gz {"alerts":0,"season":"2026-27","matches":1,"skipped":0,"requests":1,"unresolved":0}` |
| **(ii)** el objeto está en el bucket y `gunzipSync` lo parsea | idem | `(ii) OK   2026-09-22T22:03:38.318Z 1 petición(es) https://v3.football.api-sports.io/fixtures?ids=1612732` |
| **(iii)** observación con ese `raw_ref` — **el alias viajó** | idem | `(iii) OK  1 observación(es) tercera-rfef-g1-2026-27-j4-atletico-arteixo-alondras` · `skipped: 0` y `unresolved: 0` en el intento: **no fue `missing_score`**, un `scheduled` sin marcador produce observación como dice N-5 |
| **(iv)** 2ª invocación antes de 25 s → `cadence` | dos POST seguidos a `INGEST_TICK_URL`, la 1ª apuntada al final de la ventana de cadencia | 1ª `22:18:05.589Z` → `[{"sourceId":"api-football","ok":false,"requests":2}]` (**sin `skipped`**: la cadencia la dejó correr) · 2ª `22:18:07.969Z` → `[{"sourceId":"api-football","skipped":"cadence","ok":false,"requests":0}]` |
| **(v)** dos ticks con `started_at` ≥ 25 s | `lag(started_at)` sobre `ingest_attempts` de los últimos 30 min | 31 huecos · **0 por debajo de 25 s** · mínimo **00:00:26.788** · máximo 00:00:32.927 |
| pg_cron, de paso | `select status, count(*) … from cron.job_run_details where start_time >= now() - interval '30 minutes' group by status` | `succeeded 60` entre 21:48:37Z y 22:18:09Z, uno cada 30 s |
| kickoff restaurado | `npm run calendario:load -- 2026-27` | `tercera-rfef-g1: {"inserted":0,"updated":1,"unchanged":305}`, las otras cuatro competiciones `updated: 0`: se tocó **una** fila, la del ensayo |
| y restaurado **al valor declarado** | lectura del partido + `data/calendario/2026-27/tercera-rfef-g1.json` | db `2026-09-26T15:00:00.000Z` = fichero `2026-09-26T15:00:00Z` · contraste de **los 1834 partidos** de 2026-27 db↔ficheros: **0 kickoffs discrepantes, 0 filas sobrantes, 0 declaraciones sin fila** |
| el tick vuelve a estar quieto | `max(started_at)` de `ingest_attempts` tras restaurar | último intento `22:18:39.107Z` y nada después: fuera de ventana no se pide nada |
| filas que quedaron (RN-07, **no se borran**) | conteos por `match_id` | `observations 10` (todas `scheduled`, `home_score`/`away_score`/`minute` nulos, `source_id` api-football, de 22:02:38Z a 22:07:06Z) · `decisions 1` (v1, `scheduled`, `qualifier provisional`, `rule RN-01`, 1 observación citada) · `alerts 0` |
| coste del ensayo | `sum((details->>'requests')::int)` | 33 intentos (**10 `ok`**, 23 fallidos por F-SPEC-009-8) y **56 peticiones** al proveedor |
| **el defecto que destapó el ensayo** | `error` y `details` de los intentos, y el crudo del bucket de uno fallido | frontera exacta en el kickoff: último `ok` **22:07:06Z** (`requests: 1`, `ids=1612732`), primer fallo **22:07:38Z** (`requests: 2`) con `api-football returned errors: {"live":"The Live field does not match the regular expression: [id-id-id...] or string: all."}`; el crudo enseña las dos peticiones: `…/fixtures?live=439` con `errors` y **`…/fixtures?ids=1612732` con el partido dentro, correcta y descartada** |
| exposición de CA-7 al defecto | ventana de ADR-002 §2 (kickoff −10/+150) sobre los 39 partidos de la jornada, minuto a minuto | **600 de los 4480 min** de la ventana de CA-7 tienen **una sola competición** en ventana con algo ya empezado → todo tick falla: viernes 25 18:30Z-21:00Z (150 min, Segunda), sábado 26 11:00Z-11:50Z y 13:30Z-14:20Z y 19:00Z-19:15Z, domingo 27 13:00Z-13:20Z y **18:45Z-21:30Z (165 min)**, **lunes 28 18:30Z-21:00Z (150 min, Segunda)** |

Con (i) a (v) en verde, **R-SPEC-006-1 queda cerrado**: el camino completo
—pg_cron, pg_net, Vercel, el trazado del alias (`outputFileTracingIncludes`,
ADR-008 §8), el raw store y el motor— ha corrido de verdad y ha dejado filas
verdaderas. Lo que el ensayo añade, y era justo su razón de ser, es que ese
camino **solo está probado antes del kickoff**: F-SPEC-009-8 y F-SPEC-009-9.

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
- **F-SPEC-009-3 — las listas largas del informe se recortan a cinco filas.** Con
  su cuenta y su desglose por competición; las discrepancias del contraste y las
  referencias no casadas **nunca** se recortan. Es la única forma de cumplir a la
  vez «cada uno con su competición y su hueco mayor» (CA-4 (b)) y «cabe en dos
  páginas» (CA-10): una jornada en la que nada corriera lista 39 partidos sin
  señal. Modo de fallo: quien necesite la lista completa tiene que volver a la
  base de datos. Decidido por el implementador, no por la spec.
- **F-SPEC-009-4 — el bloque 7 imprime DOS alertas y cuenta el resto** (eran
  cinco; V-7 bajó `INFORME_FILAS_MOSTRADAS` de diez a cinco y una alerta cuesta
  dos líneas: su fila y el hueco de su explicación). Lo que se acota es el gasto
  en líneas, no el número de filas. Modo de fallo: con más de dos alertas, la
  explicación a mano de las no listadas hay que escribirla **por `kind`** (la
  cuenta agrupada que el bloque imprime arriba), no una por una. Para 39
  `forced_finish` eso es lo que se iba a hacer igual. Alternativa descartada:
  imprimirlas todas y salirse de las dos páginas de CA-10. Lo mismo vale para
  los dos cubos nuevos del bloque 8 (estados no-`finished` acordados y partidos
  sin respuesta), que también cuestan dos líneas por fila.
- **F-SPEC-009-5 — el hueco del principio de un partido no se mide.** V-2 cierra
  el silencio **final** (de la última observación al cierre de la ventana). El
  simétrico —de la apertura de la ventana a la primera observación— no se mide
  como hueco: un partido que solo se observa al final sale con su hueco final en
  cero. Lo caza la cobertura (esos ticks faltan del numerador) y lo cazaría el
  bloque 6 si no hubiera ninguna observación, pero no la cadencia. Decidido así
  para no estirar más la letra de CA-2 (a) («huecos entre `observed_at`
  consecutivos»), que ya se estira con el final porque CA-2 (a) exige delatar un
  job caído. Destino: sdd-arquitecto, si la jornada lo hace visible.
- **F-SPEC-009-6 — un `status.short` que el proveedor estrene sale como «sin
  respuesta», no como estado nuevo.** Los 19 códigos que API-Football documenta
  están los 19 en el mapa de `src/sources/api-football/results.ts` (`ABD`, `AWD`
  y `WO` incluidos, contra lo que decía el finding V-6), así que hoy la ruta de
  `unsupported_status` solo la abre un código que el proveedor añada. Cuando eso
  pase, el partido aparece en el bloque 8 bajo «partidos sin respuesta del
  proveedor» con `motivo: el adaptador lo descartó: unsupported_status
  (status.short XX)`, lo cual es exacto pero no es un mapeo. Modo de fallo: si
  nadie lee el motivo, un código nuevo se confunde con un silencio de red.
  Destino: **sdd-arquitecto** — mapear un estado nuevo es SPEC-005 y su ADR, no
  esta spec, que solo tenía que dejar de tratar el silencio como discrepancia.
- **F-SPEC-009-7 — nueve de las líneas que V-7 recortó son maquetación.** El
  informe ya no imprime una línea en blanco **debajo** de cada título (sí encima,
  así que los bloques siguen separados). En Markdown se renderiza igual y en el
  recuento de líneas valen nueve, pero no son contenido recortado y no deben
  contarse como tal: el recorte de verdad son las cinco filas por lista y la
  prosa que se repetía. Queda escrito para que el tope de 145 no se lea como más
  holgado de lo que es. Decidido por el implementador, no por la spec.
- **F-SPEC-009-8 — `live=` con UNA sola liga lo rechaza el proveedor, y tumba el
  tick entero.** Destapado por el ensayo de CA-6 (evidencia arriba).
  `src/sources/api-football/results.ts:232` pide
  `` get(`live=${leagues.join("-")}`) `` en cuanto algún partido de la ventana ha
  pasado su kickoff. Con una sola competición en ventana eso es `live=439`, y
  API-Football responde **200** con
  `errors: {live: "The Live field does not match the regular expression: [id-id-id...] or string: all."}`;
  el campo exige ids unidos por guiones o la cadena `all`, y un id suelto no le
  vale. Medido: con el partido del ensayo, **cero** intentos `ok` desde el kickoff
  (último `ok` 22:07:06Z, kickoff 22:07:21Z) y **cero** observaciones nuevas, 23
  intentos fallidos seguidos. Impacto en CA-7, calculado sobre la ventana de
  ADR-002 §2 y los 39 partidos: **600 de 4480 min** con una sola competición y
  algo ya empezado, y ahí entran **el partido del viernes y el del lunes
  completos** (Segunda, 150 min cada uno) y el bloque del domingo por la noche
  (165 min). Sin arreglo, esos partidos no tienen ni una observación después del
  kickoff y CA-7 no puede salir. **Bloquea la jornada del viernes 18:20Z.**
  Destino: **sdd-arquitecto** — el mapa de ligas y la forma de la petición son
  SPEC-005, y arreglarlo toca `src/sources/api-football/results.ts`, que esta spec
  tiene fuera de alcance y el verificador comprueba intacto. No lo he tocado.
- **F-SPEC-009-9 — un `errors` en cualquiera de las peticiones tira toda la
  captura, incluida la parte buena.** `parse` en
  `src/sources/api-football/results.ts` recorre `raw.requests` y lanza en la
  primera que traiga `errors`, así que el `…/fixtures?ids=1612732` que **sí** vino
  con el partido dentro —está en el crudo del bucket, se ve en la evidencia— se
  descarta junto con el `live=` roto. Es lo que convierte F-SPEC-009-8 de «una
  petición desperdiciada» en «ninguna observación». Modo de fallo más allá del
  ensayo: cualquier error del proveedor en la llamada `live=` (cuota, un
  parámetro nuevo, un 200 con `errors` transitorio) ciega el tick entero en vez de
  degradar a lo que `ids=` ya trajo. Destino: **sdd-arquitecto**, con
  F-SPEC-009-8; la decisión de si una petición con `errors` es fatal o se anota y
  se sigue es de SPEC-005 y su ADR, no mía.
- **Nota operativa del ensayo (no es defecto).** `npm run tick:salud` dice
  **`REVISAR: el tick no está sano`** mientras los 23 intentos fallidos del ensayo
  siguen dentro de su ventana de 10 min (`SALUD_RECENT_MINUTES`); se despeja solo
  al envejecer, medido: vuelve a **`OK`** a las **22:28:44Z** (último fallo
  22:18:39Z) y lo dice en claro, «10 problema(s) en la última hora, ninguno en los
  últimos 10 min». Y el paso 3 del guion («si la primera ya sale `cadence`, esperar
  30 s y repetir») funciona pero por sorteo: con pg_cron cada 30 s y una guarda de
  25 s solo hay ~5 s de cada 30 en los que una invocación a mano no sale
  `cadence`, así que conviene apuntarla a ~26 s del último `started_at` en vez de
  repetir a ciegas. El guion **no se ha cambiado**.
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
| V-4 dos páginas | `77f8323` | `informe.test.ts` «CA-10 el informe cabe en dos páginas, medido en líneas» | **Corregido (D-10, 3ª vuelta).** La salida que se apuntó aquí (`expected 204 to be less than or equal to 145`) **no es la que ese test produce**: el `toContain("… y 34 más, explicadas por kind")` falla antes y la aserción del conteo no llega a ejecutarse. La salida real es `AssertionError: expected '# Informe de la jornada · 2026-09-25 …' to contain '… y 34 más, explicadas por kind'`. El RED era real (el informe medía 204 líneas y así se midió a mano); su evidencia escrita, no. |
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

### Tercera vuelta: V-6, V-7 y la evidencia de V-4 (2026-09-22)

Dos commits sobre `d3cbf81`, ninguno fuera de `src/ingest/`. `src/sources/` no se
ha tocado en esta vuelta (`git diff d3cbf81 -- src/sources` vacío). Sin PR y sin
merge.

| Finding | Commit | Test que lo fija | Salida en rojo antes del arreglo, corrida y copiada |
|---|---|---|---|
| V-6 silencio del proveedor | `d6ecbcc` | `contraste.test.ts` «el silencio del proveedor vuelve con su motivo» (5 de 7 en rojo) y `informe.test.ts` «CA-5 el silencio del proveedor no es discrepancia» (4 de 5 en rojo) | `contraste.test.ts`: `AssertionError: expected undefined to be 'el adaptador lo descartó: unsupported_status (status.short NUEVO)'` (y lo mismo para `missing_score`, `unknown_team`, el fixture ausente y el partido sin alias). `informe.test.ts`: `AssertionError: expected [ { matchId: 'mudo', …(3) } ] to deeply equal []` —la discrepancia inventada, con `proveedor: { status: "sin respuesta", marcador: "sin marcador" }`— y `AssertionError: expected { Object (valor, rama, ...) } to match object { valor: 'válida con reservas', …(1) }` con `- "rama": null / + "rama": "c2"` |
| V-7 tope de dos páginas | `d22c146` | `informe.test.ts` «CA-10 el tope se cumple por construcción, no por fixture» (4 de 8 en rojo) | `AssertionError: expected 208 to be less than or equal to 145` (listas saturadas), `expected 210 to be less than or equal to 145` (el techo con cinco competiciones), `expected 162 …` (39 discrepancias) y `expected 153 …` (solo el tick muerto) |
| V-4, evidencia (D-10) | — | — | La línea de la 2ª vuelta queda corregida en su sitio: el rojo real es `to contain '… y 34 más, explicadas por kind'`, no `expected 204 to be less than or equal to 145`. Comprobado leyendo el orden de las aserciones del test. |

**V-6, y dónde el finding se equivoca.** El bug es real y está arreglado: un
partido del que el proveedor no contesta tiene ahora su propia línea en el bloque
8, con su motivo, su `raw_ref` y su hueco de explicación, y baja el veredicto a
`válida con reservas` sin tocar la rama (c2). Pero el ejemplo del finding no se
sostiene: **`ABD`, `AWD` y `WO` están en el mapa de estados** de
`src/sources/api-football/results.ts` (`ABD` → `suspended`, `AWD` y `WO` →
`finished`) y devuelven observación, no `skipped('unsupported_status')`. Medido
sobre el adaptador de verdad:

```
ABD    obs: {"status":"suspended","score":{"home":1,"away":0}} | skipped: []
AWD    obs: {"status":"finished", "score":{"home":1,"away":0}} | skipped: []
WO     obs: {"status":"finished", "score":{"home":1,"away":0}} | skipped: []
XX     obs: null | skipped: [{"status":"XX","reason":"unsupported_status"}]
FT sin goles  obs: null | skipped: [{"status":"FT","reason":"missing_score"}]
respuesta vacía  obs: 0  skipped: 0  unresolved: 0
```

Los 19 códigos que documenta API-Football están los 19 en el mapa, así que la
ruta de `unsupported_status` solo la abre un código **nuevo** del proveedor. Las
rutas que sí pasan hoy son cuatro, y las cuatro vuelven con su motivo:
`missing_score` (un partido cerrado sin goles), `unresolved` (un equipo o un
alias que no resuelve), el fixture que **no viene** en la respuesta, y el partido
sin alias de fixture al que no se preguntó. `contrastarMarcadores` ya no descarta
`parsed.skipped` ni `parsed.unresolved`. **Mapear estados nuevos sigue siendo
SPEC-005 y su ADR, no esta spec**, y el informe tampoco lo necesita: le basta
decir por qué un partido no vino.

**V-7, y el número honesto de «dos páginas».** El finding acierta: 145 estaba
calibrado contra un fixture con casi todas las listas vacías. Medido antes del
arreglo, con la línea de V-6 ya dentro:

| escenario | antes | después |
|---|---|---|
| las ocho listas acotadas saturadas, cero discrepancias | 208 | **137** |
| el techo: cinco competiciones y todo lo acotado saturado a la vez | 210 | **137** |
| 39 discrepancias | 162 | **126** |
| 49 discrepancias en cinco competiciones (máximo de lo no acotado) | — | **126** |
| solo el tick muerto | 153 | **104** |
| 39 aplazamientos acordados, resto camino feliz | 138 | **100** |
| camino feliz con 39 alertas | 141 | **95** |
| informe vacío | 102 | **75** |

Tres recortes, y conviene que se lean por separado porque no valen lo mismo:

1. **`INFORME_FILAS_MOSTRADAS` de diez a cinco.** Las cuentas de cabecera y el
   desglose por competición siguen intactos; lo que se recorta es la muestra. Es
   una de las dos opciones que el finding ofrecía.
2. **La prosa que se repetía.** El desglose por competición del bloque 1 ya
   estaba, con sus partidos, en la primera línea del informe (CA-1); el
   «(ninguno)» debajo de una cuenta que ya dice 0; la explicación de un cubo del
   bloque 8 cuando ese cubo está vacío; el «por día» en una línea en vez de
   cinco; y unas cuantas frases dichas dos veces. Ninguna afirmación que la spec
   pida con esas palabras se ha perdido: siguen ahí «captura → publicación», «No
   es latencia extremo a extremo», «observed_at = capturedAt», el 0-0 del
   estreno, la línea del tamaño esperable y la ventana sobre la que se calcula
   la cobertura, y sus tests lo siguen exigiendo.
3. **La línea en blanco bajo cada título.** Nueve líneas. En Markdown se
   renderiza igual, pero **es maquetación y no contenido**, y queda dicho aquí
   para que nadie cuente esas nueve como si fueran recorte de verdad.

**Respuesta a la pregunta que el finding deja abierta: dos páginas SÍ es un tope
honesto, y no hacen falta tres.** El informe no cabía porque se repetía, no
porque midiera demasiado. Con el techo en 137 sobre un tope de 145 quedan ocho
líneas de holgura, y el techo está **medido** (un escenario que satura a la vez
las ocho listas acotadas, las cinco competiciones, el tick muerto, una alerta por
partido y los silencios del proveedor), no supuesto: nada de lo que el informe
imprime crece sin tope salvo las discrepancias y las referencias no casadas, que
F-SPEC-009-3 deja crecer a propósito y cuyo máximo real —49 discrepancias— también
está medido. `INFORME_MAX_LINEAS` no se ha movido de 145.

**Cierre de esta vuelta (2026-09-22, rama `ft/SPEC-009-jornada-de-medicion-e-informe`):**

| Comprobación | Salida |
|---|---|
| `npm run gates` | exit **0** · biome 140 ficheros · **46 test files, 633 tests** |
| `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm run gates` | exit **0** · 46 test files, 633 tests |
| `npm run test:db` | exit **0** · `{"upToDate":true,…,"migrations":[]}` · **8 test files, 71 tests** |
| `git diff main --stat -- src/decide src/ingest/engine.ts` | **vacío** |
| `git diff main --stat -- src/ingest/tick.ts src/ingest/db.ts src/ingest/window.ts src/raw src/app/api supabase` | **vacío** (camino de captura intacto) |
| `git diff d3cbf81 --stat -- src/sources` | **vacío** (`results.ts` no se ha tocado en esta vuelta) |
| `git grep -qF "$API_FOOTBALL_KEY"` y `"$INGEST_TICK_TOKEN"` (con `.env` cargado) | sin coincidencias |
| `npm run informe:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z --referencias …/referencias.csv` | exit 0 · **91 líneas** (eran 126) · `ticks: 0 de 3050 esperados (0 %)` y `veredicto: no válida (c1)`, que es lo que debe decir hoy · de los valores del entorno de ≥ 8 caracteres, **0 aparecen** en la salida y **0 redacciones** espurias |

Lo que queda sigue siendo lo mismo, y el guion de CA-6 de abajo **no se ha
tocado**: CA-6 mañana miércoles 23, CA-7 y CA-8 durante la jornada, CA-9 y el
informe de CA-10 el lunes 28. Al generar el informe del lunes, una cosa nueva que
mirar: el bloque 8 tiene ahora **tres** líneas de cuenta —coincidentes, estados
no-`finished` acordados y partidos sin respuesta—, y la explicación a mano de las
dos últimas es obligatoria igual que la de las alertas.


### Decisión humana (2026-09-22): congelar código hasta el martes

Alberto Fojo decidió congelar la iteración de implementación aquí. El ciclo de 
verificación se agotó con tres rondas (siete findings arreglados: V-1..V-7) y la 
tercera devolvió dos findings abiertos, ambos clasificados para martes 2026-09-29:

| Finding | Qué queda | Regeneración |
|---|---|---|
| **V-8** | El tope de 145 líneas se pasa con listas todas acotadas (150-153) | martes, después de generar el informe de la jornada |
| **V-9** | Documentación: F-SPEC-009-3 y F-SPEC-009-4 requieren revisión | martes, después de generar el informe de la jornada |

El informe se recalcula entero desde filas append-only (30 días de retención) y su 
camino es de **solo lectura**: la medición de campo puede correr tal cual está.

**Añadido el 2026-09-23 — la enmienda de CA-9 (a) tiene consecuencia de código.** Alberto
Fojo enmendó hoy la letra de CA-9 (a) (spec, **N-8**): un `postponed` en el que `board` y
el proveedor coinciden es cierre legítimo y **no** baja el veredicto. `veredictoDe` de
`src/ingest/informe.ts` mete hoy todo estado no-`finished` acordado en un solo cubo
(`acordadosNoFinished`), así que hay que **partirlo en dos** —`postponed` acordado, que no
baja; `suspended`/`scheduled`/`live` acordados, que siguen bajando a `válida con reservas`—.
Se suma a la cola del **martes 29** y va **antes** de regenerar el informe, porque cambia el
veredicto y no solo su maquetación. La ventana de incoherencia del lunes está en N-8 de la
spec: no es un RED.

**Hito por hito hasta el lunes 28:**

- **miércoles 23**: ensayo de CA-6, guion byte a byte idéntico al de la 1ª ronda.
- **viernes 25 18:20Z → lunes 28 21:00Z**: ventana de CA-7, sin intervención sobre el dato (H-2 (i)).
- **sábado 26**: fixture `live-2026-09-26.json` de CA-8.
- **domingo 27, 14:00Z-17:00Z**: filas de `referencias.csv` a mano (H-3).
- **lunes 28**: informe de CA-10 en `_qa/SPEC-009/informe-jornada-2026-09-28.md`; veredicto de CA-9 con sus tres declaraciones (F-SPEC-009-1); paso de la spec a `en-revision`.
- **martes 29**: la consecuencia de código de la enmienda de CA-9 (a) (N-8) **primero**, luego V-8 y V-9, y el informe regenerado.

### Avisos operativos para el lunes

**Alerta 1: explicaciones de alertas en el bloque 7.**
El bloque 7 del informe ofrece **dos** huecos de `explicación:` bajo las alertas 
(con dos alertas mostradas de `INFORME_FILAS_MOSTRADAS = 5` dividido entre 2 líneas por alerta). 
Cuando se escriba el informe el lunes con 39 alertas plausibles, las explicaciones 
faltantes se declaran **por `kind`** (la cuenta agrupada que el bloque imprime), no una por una. 
Esto es F-SPEC-009-4 y está documentado, pero quien escriba el informe debe saberlo antes 
de sentarse.

**Alerta 2: merge de PR #14 (SPEC-010) antes del lunes.**
Cuando se mergee `ft/EPIC-MANT-salud-running-y-medir-directo` (PR #14), ambas ramas 
tocan `src/ingest/constants.ts` de forma aditiva. Traer `main` a esta rama el miércoles 
23 resuelve mejor el solape que hacerlo el lunes a las 22:00 con la jornada ya capturada.


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

### El ensayo, ya corrido (2026-09-22 22:02Z-22:20Z)

El guion de arriba se ejecutó tal cual, **sin cambiarlo ni una línea**, adelantado
al martes por la noche con autorización del titular (una escritura: el
`update matches set kickoff` de un partido, restaurado después). Salidas en
«Evidencia visual → ensayo de CA-6»; filas que quedaron: 10 `observations`, 1
`decision`, 0 `alerts`. Los pasos 0 a 6 salieron como estaban escritos; lo único
que hubo que afinar fue apuntar la invocación del paso 3 al final de la ventana de
cadencia (nota operativa en «Salvedades»). No hay psql en la máquina: las consultas
SQL del guion se corrieron con un `postgres.js` de una línea sobre
`src/db/connect.ts`, que es lo que ya usa el propio guion en su paso 2.

**Lo que queda por delante y no estaba previsto:** F-SPEC-009-8 y F-SPEC-009-9
bloquean CA-7 tal como está desplegado. Hay miércoles y jueves; el arreglo toca
`src/sources/api-football/results.ts`, o sea SPEC-005, y no es de esta spec: la
decisión es del gate humano y del arquitecto. Si no se arregla, la ventana del
viernes arranca sabiendo que el partido del viernes y el del lunes no van a
producir ni una observación después del kickoff.

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
