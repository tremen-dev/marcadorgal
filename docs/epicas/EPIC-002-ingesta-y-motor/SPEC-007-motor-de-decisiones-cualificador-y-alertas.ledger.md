---
id: SPEC-007
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-007 Motor de decisiones, cualificador y alertas

## Resumen
- Fase: hecho (verificada GREEN por sdd-verificador, 2026-09-21)
- Rama: `ft/SPEC-007-motor-de-decisiones-cualificador-y-alertas`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `supabase/migrations/20260921153246_forced_finish_alert.sql`, `src/model/vocab.ts` | `src/db/schema.db.test.ts` → «SPEC-007 CA-1 the forced_finish alert kind» (4 casos: acepta con `match_id`, `23514` sin partido, `23514` con `kind` inventado, `unresolved_team` sigue sin partido) + `src/model/model.test.ts` → «AlertKind has the five kinds» | Migración leída: el `drop`/`add` de `alerts_kind_check` enumera los cinco tipos y no toca `alerts_check`. `supabase db push --dry-run --db-url "$DATABASE_URL"` → `{"upToDate":true,"migrations":[]}` (aplicada a `dev`). Los cuatro casos de `schema.db.test.ts` corren contra la base real en `npm run test:db` (verde). `AlertKind.options` = los cinco en el orden de N-7. | ✅ |
| CA-2 | `src/model/json.ts`, `src/model/index.ts`, `src/ingest/db.ts` (reexporta), `src/decide/types.ts` (con `LastHeard` y `EngineInput.lastHeard`, N-9), `src/decide/thresholds.ts`, `src/decide/index.ts` | `src/decide/types.test.ts` (5 casos, con los dos `@ts-expect-error` de `id`/`version` y el de `unresolved_team`); `lastHeard` lo ejercitan CA-6 y CA-9 | Leídos `types.ts` y `thresholds.ts`: `EngineInput` lleva `lastHeard?: LastHeard | null`, `DecisionDraft` no tiene `id` ni `version`, `AlertDraft` excluye `unresolved_team`. Los dos `@ts-expect-error` son reales (los valida `tsc --noEmit` del gate, no una aserción de runtime). Los cinco umbrales comparados con `toEqual`: 5/3/15/120/15. `Json`/`Details` viven en `src/model/json.ts` y `src/ingest/db.ts` los reexporta. | ✅ |
| CA-3 | `src/decide/engine.ts` (`decide`, `transitionAllowed`, `tuple`); el orden implementado es el de la letra corregida (N-8): `operator` → cierre forzoso RN-02 → RN-05 → guarda de legalidad → RN-03 → RN-04 → RN-01 | `src/decide/engine.test.ts` → «CA-3 RN-01…» (6), «CA-3 RN-02 transitions» (8), «CA-3 the operator» (1), «CA-3 idempotence (H-1)» (3) | Orden del código leído línea a línea contra CA-3 (b) vigente: `operator` (L240) → cierre forzoso RN-02 (L250) → RN-05 (L278) → guarda `transitionAllowed` (L306) → RN-03 (L321) → RN-04 (L348) → RN-01 (L380). **Coincide** (F-SPEC-007-1 cerrado de verdad). Probado a mano el punto de (d) que ningún test cubre: vigente `finished` 2-1, ganadora de prioridad 20 con `live` ilegal y una de 10 con `finished` 3-1 legal → `decision: null`, `open: []` (no se promueve la de menor prioridad). Idempotencia y `decidedAt` verificados en los tests. | ✅ |
| CA-4 | `src/decide/engine.ts` (`holdingScore` + bloque RN-03) | `src/decide/engine.test.ts` → «CA-4 RN-03 monotony and the regression alert» (6) | Leído el bloque RN-03: `holdingScore` conserva estado y minuto propuestos con el marcador vigente y no mezcla lados. Los seis casos del CA existen y comparan `open` con `toEqual` (detalles completos), no `toBeTruthy`. El caso `operator` y los dos «sin marcador» confirman las exclusiones. | ✅ |
| CA-5 | `src/decide/engine.ts` (`adjacent`, `disagreementSince` + bloque RN-04) | `src/decide/engine.test.ts` → «CA-5 RN-04 conflict between adjacent sources» (6) | Leídos `adjacent` y `disagreementSince`. La adyacencia se calcula sobre las prioridades de la `timeline` completa (N-8/F-SPEC-007-2), por eso el caso 10-50 mete una observación vieja de la de 20 y sale «no adyacente». Los dos lados de la gracia (4 min → alerta con `since`; 2 min → publica) y el reencuentro están cubiertos con `toEqual` sobre los `details`. `RN-04` no está en `DecisionRule` (`src/model/vocab.ts`). | ✅ |
| CA-6 | `src/decide/engine.ts` (bloques RN-02 forced finish y RN-05; `lastObservedAt`/`lastStatus` salen de `lastHeard` con recaída en la observación más reciente) | `src/decide/engine.test.ts` → «CA-6 RN-05 silence» (6, con el `lastHeard` de hace 20 min) y «CA-6 RN-02 forced finish with a trace (H-3, H-5)» (6, con el `lastHeard` de hace 40 min y el caso sin `lastHeard` → `null`) | **Lo sustantivo de H-5 (iii) comprobado a mano**: todo `RN-02` sale acompañado de `open: ['forced_finish']` y nunca de `resolve: ['forced_finish']`. Sondas propias: `+120` exacto publica y alerta; `+119.9` no; con el `finished` real del proveedor en el mismo tick sigue publicando `RN-02` + alerta (N-10); con `operator` delante no se dispara; con la vigente `suspended` tampoco. `resolve` solo contiene `'silence'` en todo el fichero. F-SPEC-007-3: `lastObservedAt`/`lastStatus` salen de `lastHeard` y el test de 40 min de antigüedad lo demuestra en los tres niveles. | ✅ |
| CA-7 | `src/decide/engine.ts` (`settle`) | `src/decide/engine.test.ts` → «CA-7 the derived qualifier (ADR-004)» (6) | Leída `settle`: `confirmado` por prioridad ≥ 50 o por una segunda fuente **distinta** que coincide en `status` y marcador, citando las dos. El caso «coinciden en marcador pero no en estado» sale `provisional` con un solo id. El caso `sen_sinal` parsea contra `Decision` de zod, así que no es tautológico. | ✅ |
| CA-8 | `src/decide/replay.ts` (**no pasa `lastHeard`**, N-9; sin cambios de comportamiento en la segunda vuelta) | `src/decide/replay.test.ts` (16: 5 guionizados + «has finished fixtures of the five competitions» + 10 partidos `FT` reales de `ids-2026-09-21.json`) | `replay.ts` no pasa `lastHeard` (N-9). Determinismo y orden probados con `toEqual` sobre el log entero. El hueco de 20 min y el `+121` insertan `RN-05` y `RN-02` con sus alertas. Los diez partidos `FT` salen del **parseo real** de `ids-2026-09-21.json` con el adaptador real y el fichero de alias real, y el test comprueba que son de las cinco competiciones. Salvedad de frontera registrada abajo (no bloqueante). | ✅ |
| CA-9 | `src/ingest/engine.ts` (`priorityLookup`, `decideMatches` con las **cuatro** consultas, `createEngineHook`) | `src/ingest/engine.test.ts` (18 casos con un `tx.sql` falso que registra sentencias; «CA-9 the four queries» comprueba que la cuarta no lleva cota de tiempo y que solo salen cuatro sentencias, y dos casos nuevos siguen el `lastHeard` del doble hasta los `details` de la alerta) | Leído `decideMatches`: las cuatro consultas, la tercera con `observed_at >= now − 15 min` y la cuarta `distinct on (match_id)` **sin cota**. El doble registra el SQL y afirma `calls` = 4 y `not.toContain("observed_at >= ?")` en la cuarta. El `insert into decisions` se compara con `toEqual` sobre los diez valores y no lleva `version` ni `id`. Dedup por `(kind, match_id)` con caso explícito de `forced_finish`. `priorityLookup` verificado en las cinco competiciones, `operator` = 100 y desconocida = `undefined`. Ningún `Date` sale: el doble solo expone `toISOString`. | ✅ |
| CA-10 | `src/ingest/engine.ts` (`createEngineSweep`), `src/ingest/tick.ts`, `src/app/api/ingest/tick/route.ts`, `tools/ingest-tick.mjs` | `src/ingest/tick.test.ts` → «CA-10 the engine sweep (H-2)» (4) | `runTick` L107 (`if (matches.length === 0) return summary`) cubre «solo si `inWindow > 0`», y los cuatro tests de `tick.test.ts` cubren ventana vacía, contadores, fallo aislado y orden (`commit` antes de `sweep`). `createEngineSweep` **no lo ejercita ningún test**, así que lo sondé yo con un `db` falso: abre exactamente **1** transacción, emite 4 sentencias y devuelve `{matches:2,...}` con los dos partidos. Cableado confirmado en `route.ts` y `tools/ingest-tick.mjs`. | ✅ |
| CA-11 | — (es una prueba; ejercita `src/ingest/engine.ts`) | `src/ingest/engine.db.test.ts` (3 casos, todo en transacción con rollback; el cierre forzoso comprueba `details->>'lastObservedAt'` = `observed_at` de la tercera observación, 121 min vieja y fuera de la ventana) | `npm run test:db` corrido por mí: **59 tests en 5 ficheros, salida 0**, 46,37 s. El caso largo comprueba contra la base real `version` 1/2/3, `board.observed_at`, la alerta `regression` con sus `details`, la no duplicación, y `details->>'lastObservedAt'` = el `observed_at` de la tercera observación (121 min vieja, fuera de la ventana de 15): la prueba directa de la cuarta consulta. `update decisions` → `09000`. | ✅ |
| CA-12 | `src/arch/decide-purity.test.ts` | idem (13 casos) + «CA-12 decide is pure and total» (2) en `src/decide/engine.test.ts` + comprobaciones mecánicas abajo | Leído `decide-purity.test.ts`: usa `ts.preProcessFile` sobre el **árbol real** (8 ficheros), tiene casos negativos que demuestran que el detector flaggea (`postgres`, `node:fs`, `next/server`, `@/db`, `../ingest`, `../sources`, `import()` dinámico) y el grep de reloj/azar/red alcanza también a los tests. No es complaciente. Reproducidas todas las mecánicas del CA: `git diff main --stat -- src/sources` vacío; `grep -rnE "new Date\(|Date\.now\(" src/ingest src/raw src/decide` vacío; el grep de los cinco patrones en `src/decide/` vacío; `package.json`/`package-lock.json`/`.env.example` sin cambios; una sola migración; imports relativos con `.ts`. `npm run gates` corrido por mí: **497 tests en 39 ficheros, biome limpio, build con `ƒ /api/ingest/tick`, salida 0**. | ✅ |

## Evidencia recogida por el implementador
<!-- Comprobaciones mecánicas ejecutadas durante la implementación. El veredicto lo da el verificador. -->
- `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm run gates` → salida 0; **497 tests en 39 ficheros** (492 antes de `lastHeard`); `biome check .` sin errores; `next build` con la ruta `ƒ /api/ingest/tick`.
- `npm run test:db` → salida 0; 59 tests en 5 ficheros (`engine.db.test.ts` incluido).
- `supabase db push --dry-run --db-url "$DATABASE_URL"` → `{"upToDate":true,"migrations":[]}`; la migración de CA-1 aplicada a `dev` con `npm run db:push`.
- CA-12 mecánicas: `git diff main --stat -- src/sources` vacío · `grep -rnE "new Date\(|Date\.now\(" src/ingest src/raw src/decide` vacío · `grep -rnE "new Date\(|Date\.now\(|Math\.random\(|crypto\.|fetch\(" src/decide/` vacío · `git diff main -- package.json package-lock.json .env.example` vacío · en `supabase/migrations/` solo `20260921153246_forced_finish_alert.sql` · todos los imports relativos de los ficheros nuevos llevan `.ts` · `src/arch/sources-boundary.test.ts` en verde.
- CA-1 se vio en rojo contra la base antes de la migración (`alerts_kind_check` rechazando `forced_finish`) y en verde después.
- Segunda vuelta (`lastHeard`, tras `3dd851f`): los cinco casos nuevos de CA-6/CA-9 se vieron en rojo antes de implementar y en verde después; `npm run gates` y `npm run test:db` repetidos enteros al terminar.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-09-21, sdd-verificador.** Los doce CA cumplen contra la spec de
disco (la corregida en `3dd851f`). Gates y `test:db` corridos por mí, no
copiados: `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL
-u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm run gates` → salida 0,
**497 tests en 39 ficheros**, `biome check .` limpio, `next build` con la ruta
`ƒ /api/ingest/tick`; `npm run test:db` → salida 0, **59 tests en 5 ficheros**
(46,37 s); `supabase db push --dry-run --db-url "$DATABASE_URL"` →
`{"upToDate":true,"dryRun":true,"migrations":[]}`.

Lo que fui a buscar y encontré:
- **H-5 (iii), el punto que el titular rechazó explícitamente**: no hay ni un
  camino por el que se publique un `finished` de RN-02 sin abrir
  `forced_finish`. El `open.push` es incondicional y precede al `return`, y
  lo confirmé con sondas propias en el límite exacto (+120 sí, +119,9 no),
  con `operator` delante, con la vigente `suspended` y con el `finished` real
  del proveedor llegando en el mismo tick (N-10). La alerta **no se
  auto-resuelve**: `resolve` solo contiene `'silence'` en todo `engine.ts`, y
  `resolveAlerts` solo cierra lo que venga en `resolve`.
- **F-SPEC-007-1 cerrado de verdad**: el orden del código
  (`operator` → RN-02 forzoso → RN-05 → guarda de legalidad → RN-03 → RN-04 →
  RN-01) coincide punto por punto con CA-3 (b) vigente. Verifiqué además el
  extremo de (d) que ningún test cubre —ganadora ilegal de prioridad 20 con
  una legal de 10 detrás— y sale `null` sin promover a la de menor prioridad.
- **F-SPEC-007-3 cerrado de verdad**: `lastObservedAt`/`lastStatus` llevan la
  última observación real aunque sea de horas antes, probado en motor puro,
  con doble de `tx.sql` y **contra la base** (observación de 121 min, fuera de
  la ventana de 15, apareciendo en los `details` de la alerta).
- **Tests no complacientes**: los casos enumerados en los CA existen y
  comparan estructuras completas con `toEqual` (no `toBeTruthy` ni conteos);
  el test de arquitectura corre sobre el árbol real y tiene casos negativos
  que demuestran que el detector detecta; no hay `.skip`, `.only` ni
  aserciones tautológicas. Lo único sin test propio era `createEngineSweep`,
  y lo sondé yo mismo (1 transacción, 4 sentencias, los dos partidos).

**Sin findings.** Tres observaciones no bloqueantes quedan abajo.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-007/. Informe HTML opcional: _qa/SPEC-007/informe.html -->
**n-a.** SPEC-007 no toca UI (lo dice «Fuera de alcance»): no hay DOM que
mirar con Playwright ni token de diseño que comprobar. La evidencia es
textual: salida de `npm run gates`, de `npm run test:db`, del `--dry-run` de
las migraciones y de las sondas propias descritas arriba.

## Salvedades / follow-ups
<!-- IDs F-SPEC-007-1, F-SPEC-007-2… con destino (spec futura o EPIC-MEJORA). -->
### Observaciones del verificador (no bloqueantes, ningún CA incumplido)
- **O-1 — `createEngineSweep` sin test propio.** La lista de tests de CA-10
  solo pide los cuatro casos de `tick.test.ts` con un `sweep` falso, así que
  el CA se cumple a la letra; pero la propiedad «abre **una** `db.transaction`»
  no la afirma ninguna prueba del repo. La verifiqué a mano con un `db` doble
  (1 transacción, 4 sentencias, los dos partidos en ventana). Candidato a test
  de la spec d, cuando el barrido corra en ventana real.
- **O-2 — la valla de pureza no cubre los `*.test.ts`.** Es exactamente lo que
  CA-12 pide («excluidos los `*.test.ts`»), y por eso `src/decide/replay.test.ts`
  puede importar `node:fs` y `../sources/api-football/results.ts` —cosa que
  CA-8 además exige, para parsear el fixture real—. Queda dicho que la valla
  protege el código de producción, no el árbol entero: un import impuro
  introducido desde un test no lo detendría. No es un incumplimiento.
- **O-3 — nada ejercitado contra el proveedor real.** No hay partidos en
  ventana hasta el viernes 2026-09-25, así que el motor no ha visto una
  jornada: `engine.db.test.ts` siembra su partido y hace rollback. Es
  residual heredado con destino a la spec d (jornada de medición), no un CA
  incumplido: la spec lo pone en «Fuera de alcance».

Los cinco hallazgos se abrieron en la primera vuelta y **los cinco están
cerrados** tras la revisión de la spec (`3dd851f`, 2026-09-21). **No hay
ninguno nuevo abierto.**

- **F-SPEC-007-1 — CERRADO en la spec (N-8), sin cambios de código.** Abierto porque la letra de CA-3 (b) ponía `RN-03` antes que las transiciones de RN-02, y así una vigente `finished` 2-1 con una observación ganadora `live` 2-0 se habría publicado como `live`, justo lo que CA-3 (d) prohíbe y al revés del caso enumerado. Implementé la legalidad de transición como **guarda sobre la observación ganadora**, antes de RN-03/RN-04. El arquitecto confirma que la letra estaba mal y no el comportamiento. Releída la nueva CA-3 (b)/(d) contra el código: el orden implementado (`operator` → cierre forzoso RN-02 → RN-05 → guarda de legalidad → RN-03 → RN-04 → RN-01) coincide punto por punto, incluidos «la guarda se aplica solo a la observación ganadora», «no se promueve en su lugar ninguna fuente de menor prioridad» y «no se abre alerta».
- **F-SPEC-007-2 — CERRADO como letra (N-8), sin cambios de código.** Abierto porque H-4 habla de «el mapa de prioridades» y `EngineInput` solo expone `priority` como función, que no se puede enumerar. La adyacencia se calcula sobre las prioridades distintas de las fuentes presentes en `observations`; por eso el caso «10 y 50 con una de 20 en el mapa» de CA-5 lleva una observación antigua de la fuente de 20. La spec adopta esa lectura. Con el registro de hoy es el mismo conjunto.
- **F-SPEC-007-3 — APROBADO por Alberto Fojo e IMPLEMENTADO** (spec N-9; código `9125796` y `5b99aa9`). Abierto porque `lastObservedAt` y `lastStatus` salían `null` justo en el caso de silencio, que es su razón de ser y el escenario que motivó la corrección de H-5 (iii). Hecho: `EngineInput` gana `lastHeard` (opcional, de cualquier antigüedad, sin efecto sobre qué Decision se produce), `decideMatches` añade una cuarta consulta `distinct on (match_id)` **sin cota de tiempo** servida por `observations_match_observed_idx`, y el replay **no** lo pasa. Probado en los tres niveles: motor puro (CA-6), doble de `tx.sql` (CA-9) y base real (CA-11, con la observación de 121 minutos fuera de la ventana).
- **F-SPEC-007-4 — CERRADO como letra (N-10), sin cambios de código.** Abierto porque el cierre forzoso se evalúa por encima de todo (H-3), así que si el tick que cruza kickoff + 120 min trae ya el `finished` real de la fuente, se publica igualmente el `RN-02` y se abre una `forced_finish` que, vista a posteriori, sobraba. Se acepta: es la dirección segura según H-5, la deduplicación impide que se repita y el operador la cierra en EPIC-004. Queda anotado para ADR-009.
- **F-SPEC-007-5 — CERRADO como letra (N-11), sin cambios de código.** Abierto porque el grep de `new Date(` de CA-12 alcanza también a los tests, así que el doble de `src/ingest/engine.test.ts` usa `timestamptz(i) = { toISOString: () => i }` en vez de `Date` reales. La spec lo declara propiedad deseada, no efecto colateral: de paso demuestra que el adaptador solo llama a `toISOString` sobre un `timestamptz`.

## Cómo retomar (handoff)
Implementación completa de CA-1 a CA-12 en `ft/SPEC-007-motor-de-decisiones-cualificador-y-alertas`, en catorce commits (`e4bf0e6`..`5b99aa9`, con la spec `3dd851f` en medio), con `npm run gates` y `npm run test:db` en verde y la migración de CA-1 aplicada a `dev`. Sin push, sin PR: los hace el orquestador tras verificar.

Dónde está cada cosa:
- **Motor puro** en `src/decide/`: `types.ts` (tipos), `thresholds.ts` (los cinco umbrales con su regla al lado), `engine.ts` (`decide`, en el orden de CA-3 (b): `operator` → cierre forzoso RN-02 → RN-05 silencio → guarda de legalidad de transición → RN-03 → RN-04 → RN-01), `replay.ts`, `index.ts`. No importa nada más que `../model/` y a sí mismo, y `src/arch/decide-purity.test.ts` lo vigila sobre el árbol real.
- **Adaptador** en `src/ingest/engine.ts`: todo el SQL del motor, las cuatro consultas (la de `lastHeard` sin cota de tiempo, N-9), el insert sin `version` ni `id`, la deduplicación por `(kind, match_id)` y el cierre de `silence`. Los dos enganches: `createEngineHook` (va a `afterInsert`) y `createEngineSweep` (va a `sweep`), ambos ya cableados en `src/app/api/ingest/tick/route.ts` y en `tools/ingest-tick.mjs`.
- **Contadores**: `TickSummary.engine` sale **solo del barrido** (el `EngineCounts` del enganche se pierde porque `AfterInsert` devuelve `Promise<void>`, que es lo que fija CA-9). Como el barrido corre después sobre todos los partidos en ventana, lo que el enganche ya decidió sale `null` por idempotencia y no se cuenta dos veces.

Pendiente, y fuera de los CA por la sección «Fuera de alcance»: nada se ha ejercitado contra el proveedor real en ventana (el primer partido es el viernes 2026-09-25); `engine.db.test.ts` siembra su propio partido y hace rollback. El residual **R-SPEC-007-1 (ADR-009)** sigue abierto; la spec ya absorbió las cuatro precisiones como N-8..N-11 y son lo que ADR-009 tiene que consolidar junto a H-1..H-6.

Sobre `lastHeard` (segunda vuelta): entra por la cuarta consulta de `decideMatches`, es opcional y **no cambia ninguna Decision** —solo los `details` de `silence` y `forced_finish`—, y el replay no lo pasa a propósito. El test largo de `engine.db.test.ts` lleva `timeout` de 30 s: seis pasadas del motor contra la base remota, ahora con cuatro consultas cada una, se comían los 5 s por defecto.
