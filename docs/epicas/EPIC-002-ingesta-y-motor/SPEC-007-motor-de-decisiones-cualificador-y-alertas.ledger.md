---
id: SPEC-007
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-007 Motor de decisiones, cualificador y alertas

## Resumen
- Fase: en-revisión (implementación completa, pendiente de verificación)
- Rama: `ft/SPEC-007-motor-de-decisiones-cualificador-y-alertas`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `supabase/migrations/20260921153246_forced_finish_alert.sql`, `src/model/vocab.ts` | `src/db/schema.db.test.ts` → «SPEC-007 CA-1 the forced_finish alert kind» (4 casos: acepta con `match_id`, `23514` sin partido, `23514` con `kind` inventado, `unresolved_team` sigue sin partido) + `src/model/model.test.ts` → «AlertKind has the five kinds» | | ❌ |
| CA-2 | `src/model/json.ts`, `src/model/index.ts`, `src/ingest/db.ts` (reexporta), `src/decide/types.ts` (con `LastHeard` y `EngineInput.lastHeard`, N-9), `src/decide/thresholds.ts`, `src/decide/index.ts` | `src/decide/types.test.ts` (5 casos, con los dos `@ts-expect-error` de `id`/`version` y el de `unresolved_team`); `lastHeard` lo ejercitan CA-6 y CA-9 | | ❌ |
| CA-3 | `src/decide/engine.ts` (`decide`, `transitionAllowed`, `tuple`); el orden implementado es el de la letra corregida (N-8): `operator` → cierre forzoso RN-02 → RN-05 → guarda de legalidad → RN-03 → RN-04 → RN-01 | `src/decide/engine.test.ts` → «CA-3 RN-01…» (6), «CA-3 RN-02 transitions» (8), «CA-3 the operator» (1), «CA-3 idempotence (H-1)» (3) | | ❌ |
| CA-4 | `src/decide/engine.ts` (`holdingScore` + bloque RN-03) | `src/decide/engine.test.ts` → «CA-4 RN-03 monotony and the regression alert» (6) | | ❌ |
| CA-5 | `src/decide/engine.ts` (`adjacent`, `disagreementSince` + bloque RN-04) | `src/decide/engine.test.ts` → «CA-5 RN-04 conflict between adjacent sources» (6) | | ❌ |
| CA-6 | `src/decide/engine.ts` (bloques RN-02 forced finish y RN-05; `lastObservedAt`/`lastStatus` salen de `lastHeard` con recaída en la observación más reciente) | `src/decide/engine.test.ts` → «CA-6 RN-05 silence» (6, con el `lastHeard` de hace 20 min) y «CA-6 RN-02 forced finish with a trace (H-3, H-5)» (6, con el `lastHeard` de hace 40 min y el caso sin `lastHeard` → `null`) | | ❌ |
| CA-7 | `src/decide/engine.ts` (`settle`) | `src/decide/engine.test.ts` → «CA-7 the derived qualifier (ADR-004)» (6) | | ❌ |
| CA-8 | `src/decide/replay.ts` (**no pasa `lastHeard`**, N-9; sin cambios de comportamiento en la segunda vuelta) | `src/decide/replay.test.ts` (16: 5 guionizados + «has finished fixtures of the five competitions» + 10 partidos `FT` reales de `ids-2026-09-21.json`) | | ❌ |
| CA-9 | `src/ingest/engine.ts` (`priorityLookup`, `decideMatches` con las **cuatro** consultas, `createEngineHook`) | `src/ingest/engine.test.ts` (18 casos con un `tx.sql` falso que registra sentencias; «CA-9 the four queries» comprueba que la cuarta no lleva cota de tiempo y que solo salen cuatro sentencias, y dos casos nuevos siguen el `lastHeard` del doble hasta los `details` de la alerta) | | ❌ |
| CA-10 | `src/ingest/engine.ts` (`createEngineSweep`), `src/ingest/tick.ts`, `src/app/api/ingest/tick/route.ts`, `tools/ingest-tick.mjs` | `src/ingest/tick.test.ts` → «CA-10 the engine sweep (H-2)» (4) | | ❌ |
| CA-11 | — (es una prueba; ejercita `src/ingest/engine.ts`) | `src/ingest/engine.db.test.ts` (3 casos, todo en transacción con rollback; el cierre forzoso comprueba `details->>'lastObservedAt'` = `observed_at` de la tercera observación, 121 min vieja y fuera de la ventana) | | ❌ |
| CA-12 | `src/arch/decide-purity.test.ts` | idem (13 casos) + «CA-12 decide is pure and total» (2) en `src/decide/engine.test.ts` + comprobaciones mecánicas abajo | | ❌ |

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

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-007/. Informe HTML opcional: _qa/SPEC-007/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-007-1, F-SPEC-007-2… con destino (spec futura o EPIC-MEJORA). -->
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
