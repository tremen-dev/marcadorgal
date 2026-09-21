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
| CA-2 | `src/model/json.ts`, `src/model/index.ts`, `src/ingest/db.ts` (reexporta), `src/decide/types.ts`, `src/decide/thresholds.ts`, `src/decide/index.ts` | `src/decide/types.test.ts` (5 casos, con los dos `@ts-expect-error` de `id`/`version` y el de `unresolved_team`) | | ❌ |
| CA-3 | `src/decide/engine.ts` (`decide`, `transitionAllowed`, `tuple`) | `src/decide/engine.test.ts` → «CA-3 RN-01…» (6), «CA-3 RN-02 transitions» (8), «CA-3 the operator» (1), «CA-3 idempotence (H-1)» (3) | | ❌ |
| CA-4 | `src/decide/engine.ts` (`holdingScore` + bloque RN-03) | `src/decide/engine.test.ts` → «CA-4 RN-03 monotony and the regression alert» (6) | | ❌ |
| CA-5 | `src/decide/engine.ts` (`adjacent`, `disagreementSince` + bloque RN-04) | `src/decide/engine.test.ts` → «CA-5 RN-04 conflict between adjacent sources» (6) | | ❌ |
| CA-6 | `src/decide/engine.ts` (bloques RN-02 forced finish y RN-05) | `src/decide/engine.test.ts` → «CA-6 RN-05 silence» (5) y «CA-6 RN-02 forced finish with a trace (H-3, H-5)» (4) | | ❌ |
| CA-7 | `src/decide/engine.ts` (`settle`) | `src/decide/engine.test.ts` → «CA-7 the derived qualifier (ADR-004)» (6) | | ❌ |
| CA-8 | `src/decide/replay.ts` | `src/decide/replay.test.ts` (16: 5 guionizados + «has finished fixtures of the five competitions» + 10 partidos `FT` reales de `ids-2026-09-21.json`) | | ❌ |
| CA-9 | `src/ingest/engine.ts` (`priorityLookup`, `decideMatches`, `createEngineHook`) | `src/ingest/engine.test.ts` (16 casos con un `tx.sql` falso que registra sentencias) | | ❌ |
| CA-10 | `src/ingest/engine.ts` (`createEngineSweep`), `src/ingest/tick.ts`, `src/app/api/ingest/tick/route.ts`, `tools/ingest-tick.mjs` | `src/ingest/tick.test.ts` → «CA-10 the engine sweep (H-2)» (4) | | ❌ |
| CA-11 | — (es una prueba; ejercita `src/ingest/engine.ts`) | `src/ingest/engine.db.test.ts` (3 casos, todo en transacción con rollback) | | ❌ |
| CA-12 | `src/arch/decide-purity.test.ts` | idem (13 casos) + «CA-12 decide is pure and total» (2) en `src/decide/engine.test.ts` + comprobaciones mecánicas abajo | | ❌ |

## Evidencia recogida por el implementador
<!-- Comprobaciones mecánicas ejecutadas durante la implementación. El veredicto lo da el verificador. -->
- `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN npm run gates` → salida 0; 492 tests en 39 ficheros; `biome check .` sin errores; `next build` con la ruta `ƒ /api/ingest/tick`.
- `npm run test:db` → salida 0; 59 tests en 5 ficheros (`engine.db.test.ts` incluido).
- `supabase db push --dry-run --db-url "$DATABASE_URL"` → `{"upToDate":true,"migrations":[]}`; la migración de CA-1 aplicada a `dev` con `npm run db:push`.
- CA-12 mecánicas: `git diff main --stat -- src/sources` vacío · `grep -rnE "new Date\(|Date\.now\(" src/ingest src/raw src/decide` vacío · `grep -rnE "new Date\(|Date\.now\(|Math\.random\(|crypto\.|fetch\(" src/decide/` vacío · `git diff main -- package.json package-lock.json .env.example` vacío · en `supabase/migrations/` solo `20260921153246_forced_finish_alert.sql` · todos los imports relativos de los ficheros nuevos llevan `.ts` · `src/arch/sources-boundary.test.ts` en verde.
- CA-1 se vio en rojo contra la base antes de la migración (`alerts_kind_check` rechazando `forced_finish`) y en verde después.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-007/. Informe HTML opcional: _qa/SPEC-007/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-007-1, F-SPEC-007-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-007-1 (orden de CA-3 (b): RN-02 transiciones se evalúa como guarda, antes de RN-03).** La letra de CA-3 (b) pone `RN-03 → RN-04 → RN-05 → transiciones RN-02`. Implementado así, una vigente `finished` 2-1 con una observación `live` 2-0 entra por RN-03 y **publica un estado `live`**, que contradice la propia letra de CA-3 (d) («desde `finished` no se vuelve atrás salvo `operator`»). Para que CA-3 (d) y CA-4 sean consistentes, `transitionAllowed` se aplica a la observación ganadora **antes** de RN-03 y RN-04: una transición ilegal descarta la observación y no publica nada (que es exactamente lo que pide CA-3 (d) y N-5). El cierre forzoso de RN-02 sigue primero (H-3) y el orden documentado sigue gobernando **qué regla se registra** en `decision.rule` (RN-02 nunca aparece salvo en el cierre forzoso: CA-6 exige `RN-01` cuando el proveedor cierra a tiempo). Todos los casos enumerados en CA-3..CA-7 pasan con cualquiera de las dos lecturas; la única diferencia es el caso ilegal. Destino: confirmación del arquitecto y redacción definitiva en ADR-009 (R-SPEC-007-1).
- **F-SPEC-007-2 (H-4 pide «el mapa de prioridades» y `EngineInput` no lo expone).** La adyacencia de RN-04 se define sobre «ninguna otra fuente del mapa de prioridades», pero `EngineInput` fija `priority: (sourceId) => number | undefined`, que no se puede enumerar (y la firma está pinchada en CA-2, así que no la he tocado). Implementado: el mapa visible del motor son las prioridades distintas de las fuentes **presentes en `input.observations`**. Por eso el caso «fuentes 10 y 50 con una de 20 en el mapa» de CA-5 lleva una observación (antigua, fuera de la ventana de 5 min) de la fuente de 20. Con una sola fuente hoy no cambia nada (H-4). Destino: o `EngineInput` gana el conjunto de prioridades en una spec futura, o ADR-009 fija esta lectura.
- **F-SPEC-007-3 (`lastObservedAt` sale `null` por el camino del adaptador).** CA-6 pide `lastObservedAt` en las alertas `silence` y `forced_finish`, y el motor lo saca de las observaciones que recibe. Pero CA-9 fija la consulta en `observed_at >= now − SILENCE_MINUTES`, así que un partido en silencio **no tiene ninguna observación en rango** y el detalle queda en `null`. Es coherente (el motor informa de lo que se le dio) y así se ve en `engine.db.test.ts`, pero al operador de EPIC-004 le sería más útil el instante real. Destino: si se quiere el valor real, el adaptador tendría que pedir además `max(observed_at)` por partido — spec d o EPIC-004.
- **F-SPEC-007-4 (el cierre forzoso puede convivir con un `finished` del proveedor).** H-3 y CA-6 (a) evalúan el cierre forzoso por encima de todo «aunque sigan llegando observaciones `live`». Implementado a la letra: si la primera evaluación posterior a kickoff + 120 min trae una observación `finished` del proveedor, se publica igualmente el `finished` con el marcador vigente, `RN-02`, y se abre la `forced_finish`; el marcador real del proveedor entra en la evaluación siguiente por RN-01. Ningún caso de los enumerados lo cubre. No se pierde nada (el rastro es justo lo que quería H-5), pero el panel de EPIC-004 debe saber que una `forced_finish` abierta no implica que la fuente callara.
- **F-SPEC-007-5 (menor, consecuencia de CA-12).** El grep de `new Date(` que CA-12 exige sobre `src/ingest` incluye los ficheros de test, así que el doble de `src/ingest/engine.test.ts` no construye `Date` reales: usa `timestamptz(i) = { toISOString: () => i }`. De paso demuestra que el adaptador solo llama a `toISOString` sobre un `timestamptz`. Sin efecto en el código de producción.

## Cómo retomar (handoff)
Implementación completa de CA-1 a CA-12 en `ft/SPEC-007-motor-de-decisiones-cualificador-y-alertas`, en doce commits (`e4bf0e6`..`1f03c4e`), con `npm run gates` y `npm run test:db` en verde y la migración de CA-1 aplicada a `dev`. Sin push, sin PR: los hace el orquestador tras verificar.

Dónde está cada cosa:
- **Motor puro** en `src/decide/`: `types.ts` (tipos), `thresholds.ts` (los cinco umbrales con su regla al lado), `engine.ts` (`decide`, en el orden operador → cierre forzoso RN-02 → guarda de transiciones → RN-03 → RN-04 → RN-05 → RN-01; ver F-SPEC-007-1), `replay.ts`, `index.ts`. No importa nada más que `../model/` y a sí mismo, y `src/arch/decide-purity.test.ts` lo vigila sobre el árbol real.
- **Adaptador** en `src/ingest/engine.ts`: todo el SQL del motor, las tres consultas, el insert sin `version` ni `id`, la deduplicación por `(kind, match_id)` y el cierre de `silence`. Los dos enganches: `createEngineHook` (va a `afterInsert`) y `createEngineSweep` (va a `sweep`), ambos ya cableados en `src/app/api/ingest/tick/route.ts` y en `tools/ingest-tick.mjs`.
- **Contadores**: `TickSummary.engine` sale **solo del barrido** (el `EngineCounts` del enganche se pierde porque `AfterInsert` devuelve `Promise<void>`, que es lo que fija CA-9). Como el barrido corre después sobre todos los partidos en ventana, lo que el enganche ya decidió sale `null` por idempotencia y no se cuenta dos veces.

Pendiente, y fuera de los CA por la sección «Fuera de alcance»: nada se ha ejercitado contra el proveedor real en ventana (el primer partido es el viernes 2026-09-25); `engine.db.test.ts` siembra su propio partido y hace rollback. El residual **R-SPEC-007-1 (ADR-009)** sigue abierto y ahora tiene tres cosas más que consolidar: F-SPEC-007-1, F-SPEC-007-2 y F-SPEC-007-4.
