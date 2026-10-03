---
id: SPEC-013
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-013 Reconciliación del marcador después del cierre forzoso

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-013-reconciliacion-del-marcador-despues-del-cierre-forzoso`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `docs/fundacion/reglas.md` RN-12 (74c11b2, fuera del implementador: F-SPEC-013-1) | `src/arch/reglas-rn12.test.ts` (5): RN-12 = cita de ADR-010 §2, en la sección de `Decision.rule`, `DecisionRule` ⊆ esa sección, RN-08 literal; rojo 2/5 en bb36c05, verde tras 74c11b2 | `reglas-rn12.test.ts` 5/5 dentro de gates; diff de `reglas.md` contra el merge-base de SPEC-012: RN-12 añadida en la sección de `Decision.rule`, RN-08 sin tocar (el cambio de RN-03 es de cf866f9, ajeno) | ✅ |
| CA-2 | `supabase/migrations/20260929081827_rn12_decision_rule.sql` · `src/model/vocab.ts` · 0078427 | `src/ingest/engine.db.test.ts` › «SPEC-013 CA-2» (inserta RN-12; RN-99 → 23514) · `src/model/model.test.ts` › DecisionRule; rojo antes de la migración | migración leída (solo `decisions_rule_check`); en `dev`: `20260929081827` en `schema_migrations`, check con `RN-12` (`pg_get_constraintdef`), `db:push` «up to date»; tests en `test:db` 79/79 | ✅ |
| CA-3 | `src/ingest/window.ts` (`rule` en `WindowInput`) · `src/ingest/db.ts` (`windowMatches` lee `decisions.rule` por `board.decision_id`) · ada3052 | `src/ingest/window.test.ts` › «SPEC-013 CA-3» (i)–(iv); `src/ingest/db.db.test.ts` › «at +125, a finished by …» (RN-02 dentro; RN-01, RN-12 fuera), rojo sin el cambio | `window.ts:28` `finished && rule !== "RN-02"` → fuera; tests (i)–(iv) y `db.db.test` (3 casos) verdes; `now` sigue por parámetro | ✅ |
| CA-4 | `src/decide/engine.ts` (bloque RN-12 antes de RN-05) · 15bfda2 | `src/decide/engine.test.ts` › «SPEC-013 CA-4» (i)–(v) + mismo marcador; rojo 4/6 antes · `src/ingest/engine.db.test.ts` › «SPEC-013 CA-4 RN-12 through the database» | bloque RN-12 en `engine.ts:292-304` tras RN-02 y antes de RN-05; tests (i)–(v) con aserciones concretas + `engine.db.test` verdes | ✅ |
| CA-5 | Lectura preparada abajo («CA-5: lectura para el 2026-10-05») | Pendiente de campo (H-2), jornada 2026-10-02/04 | no juzgado (H-2): de campo, jornada 2026-10-02/04 | 🚧 |
| CA-6 | `src/ingest/reconciliacion.ts` · `tools/reconciliar-cierre.mjs` · script `reconciliar:cierre` · 568b2d0, 0a8df89 | `src/ingest/reconciliacion.test.ts` (6) · `src/ingest/reconciliacion.db.test.ts` (1, rollback, +1 Decision RN-12) · ejecución real: 3.er intento, `decisions` +2 RN-12 (3-1, 3-5), contraste 39/39 (abajo; F-SPEC-013-2 cerrado) | solo lectura en `dev`: v108 `finished` 3-1 y 3-5 `confirmado` RN-12, `observation_ids` → `raw_ref` `…09-11-36.152Z-SPEC-013-CA-6-{1569939,1570756}` (3.er intento); `decisions` RN-12 = 2; las 2 `forced_finish` abiertas; 7 Decisions desde 2026-09-28T21:00Z = las 7 discrepancias del informe, todas iguales al proveedor → 39/39 `finished`, sin peticiones. Salvedad: tres ejecuciones, no una (autorizadas por el titular); ensayo en seco no ejecutado por el verificador (permiso denegado), negativa comprobada por código (`plan()` antes de capturar) + test «never asks anything…» + board en RN-12 | ⚠️ |
| CA-7 | Una migración; `package.json` solo `reconciliar:cierre`; lock sin cambios | `npm run gates` exit 0 (50 ficheros, 745 tests), también sin env; `npm run test:db` exit 0 (10, 79). Presupuesto de la jornada: pendiente de campo con CA-5 | `npm run gates` exit 0 (50 ficheros, 745 tests); `npm run test:db` exit 0 (10, 79), filas antes = después (3358/9345/17/2766); 1 migración; `package.json` solo el script; lock sin cambios. Presupuesto: pendiente de campo con CA-5 | 🚧 |

## Evidencia CA-6 — excepción escrita (2026-09-29)

**Excepción**, no regla: ventana vencida, RN-12 pide ventana abierta. Autorizada por **Alberto Fojo** (H-1, 2026-09-29) para una ejecución; tras el fallo del 1.er intento, 2.ª autorizada (opción b de F-SPEC-013-2) y 3.ª autorizada «como la última». Solo `ceuta-real-sociedad-b` (fixture 1569939) y `merida-logrones` (1570756), por `ids=` con el camino de `contraste.ts`, crudo antes de parsear. Antes de cada una: ensayo en seco y `replay:jornada` en seco → `39 partidos, 0 divergen`.

| Intento | `now` | Quién | Peticiones al proveedor | Crudo (`raw_ref`) | Escrito |
|---|---|---|---|---|---|
| 1.º | 08:27:59.958Z | implementador | 2 (`ids=1569939`, `ids=1570756`), 200 | `raw/api-football/2026-09-29/2026-09-29T08-28-00.700Z-SPEC-013-CA-6-1569939.json.gz` (FT 3-1, sha256 `d250f9b0ee440af6…`) · `raw/api-football/2026-09-29/2026-09-29T08-28-01.934Z-SPEC-013-CA-6-1570756.json.gz` (FT 3-5, `060ac1c74405142a…`) | observations +2 (`c29ab562-…`, `98945fc9-…`), decisions +0: bug de reloj (captura posterior a `now`), corregido en 0a8df89 |
| 2.º | 08:41:35.724Z | titular (`!`) | 1 (`ids=1569939`); `storage responded 429` en el `put`, antes de parsear | ninguno: las claves `…08-41-35.724Z-SPEC-013-CA-6-{1569939,1570756}.json.gz` no existen en el bucket | nada (3356 / 9343 / 17 / 2766). El 429 coincidió con la descarga del raw store para ADR-011 |
| 3.º | 09:11:36.152Z | titular (`!`) | 2 (`ids=1569939`, `ids=1570756`), 200 | `raw/api-football/2026-09-29/2026-09-29T09-11-36.152Z-SPEC-013-CA-6-1569939.json.gz` (FT 3-1, 4 628 B gz, sha256 `1cafe318a974bb2d…`) · `raw/api-football/2026-09-29/2026-09-29T09-11-36.152Z-SPEC-013-CA-6-1570756.json.gz` (FT 3-5, 1 385 B gz, `a1361ae7f16c6bcc…`) | observations +2, **decisions +2 RN-12** |

- Total de peticiones al proveedor de CA-6: **5**. Ninguna fila en `ingest_attempts` (2766 antes y después de los tres).
- 3.er intento, conteos antes → después: `decisions` 3356 → **3358 (+2)** · `observations` 9343 → 9345 (+2) · `alerts` 17 (17 abiertas) → 17 (17 abiertas) · `ingest_attempts` 2766 → 2766.
- Comprobado por el implementador en solo lectura: `ceuta-real-sociedad-b` v108 `finished` **3-1** `confirmado` RN-12, `observation_ids` = [`d22a251e-86b1-46db-af85-0e8d8b0b1aeb`] (observación del 3.er `raw_ref`); `merida-logrones` v108 `finished` **3-5** `confirmado` RN-12, [`bf50e210-04ac-47df-98ba-59133cfbccab`]; `decided_at` 09:11:36.152Z. Las dos alertas `forced_finish` siguen abiertas. Los cuatro crudos guardados, releídos del bucket: 0 apariciones de `API_FOOTBALL_KEY`. Nada se borró: las observaciones del 1.er intento se quedan como evidencia (RN-07).
- **Contraste final: 39 de 39**, sin más peticiones. Los 39 partidos de la ventana están `finished` en `board`. Desde el informe (2026-09-28T21:00Z) solo hay 7 Decisions nuevas en esos partidos: las 5 de SPEC-012 (iguales al proveedor del bloque 8: 2-0, 1-0, 1-1, 1-0, 1-0) y las 2 RN-12 (iguales al proveedor: 3-1, 3-5, del bloque 8 y de la captura de hoy). Los otros 32 coincidían y no se han movido.

## CA-5: lectura para el 2026-10-05 (una consulta, solo lectura)

```sql
with ff as (select match_id, opened_at from alerts
  where kind = 'forced_finish' and opened_at >= :desde and opened_at < :hasta),
rec as (select ff.match_id, ff.opened_at, min(d.decided_at) as rn12_at
  from ff left join decisions d on d.match_id = ff.match_id and d.rule = 'RN-12'
    and d.decided_at <= ff.opened_at + interval '30 minutes'
  group by ff.match_id, ff.opened_at)
select count(*) as cierres_forzosos, count(rn12_at) as con_rn12_en_30min,
  percentile_cont(0.5) within group (order by extract(epoch from rn12_at - opened_at)) as mediana_s,
  max(extract(epoch from rn12_at - opened_at)) as max_s
from rec;
```

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN parcial a falta de CA-5 — 2026-09-29.** Spec sigue en `en-revision` (H-2): no pasa a `hecho` hasta leer CA-5 y el presupuesto de CA-7 tras la jornada 2026-10-02/04.
- Comparado contra el merge-base con SPEC-012 (`93c2b87c`). Ajeno a SPEC-013 y no juzgado: cf866f9 (RN-03 por peso), 85a5c76, bed748e, fa97f52 (medición, ADR-011, SPEC-014); solo docs, sin código.
- Conteos en `dev` (solo lectura): `decisions` 3358 · `observations` 9345 · `alerts` 17 (17 abiertas) · `ingest_attempts` 2766; idénticos antes y después de `npm run test:db`.
- Contraste 39/39: los 39 partidos con kickoff 2026-09-25..28 están `finished`; los 7 discrepantes del informe (§8) coinciden hoy con el proveedor.
- Observaciones no bloqueantes: (a) RN-12, `isInWindow` y la guarda de `reconciliar:cierre` identifican el cierre forzoso por `rule = 'RN-02'`; los 5 `finished` de SPEC-012 también son RN-02 (ya en F-SPEC-013-5), así que el día que un replay escriba dentro de +150 se leerán como cierre forzoso. (b) `npm run reconciliar:cierre` en seco no lo ejecutó el verificador (permiso denegado por el harness); la negativa queda por código, test y estado de `board`.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-013/. Informe HTML opcional: _qa/SPEC-013/informe.html -->
n-a: SPEC-013 no tiene UI.

## Salvedades / follow-ups
<!-- IDs F-SPEC-013-1, F-SPEC-013-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-013-1 — CA-1 bloqueado al implementador por protege-verdad — CERRADO en 74c11b2.** El texto que aplicó el titular coincide con la cita de ADR-010 §2 y con la nota `*Añadida el 2026-09-29 por ADR-010 §2.*`; `reglas-rn12.test.ts` 5/5.
- **F-SPEC-013-2 — CA-6: el 1.er intento no publicó — CERRADO el 2026-09-29.** Causa: la captura se selló después del `now` del motor (`age >= 0` la dejó fuera); corregido en 0a8df89 con test que lo reproduce. Decisión del titular: opción (b), volver a correr el script corregido. 2.º intento perdido por un 429 de Storage (nada escrito); 3.º intento correcto: +2 RN-12, contraste 39/39. Detalle en «Evidencia CA-6».
- **F-SPEC-013-3 — Lectura de «`finished` confirmado» en CA-4 (iv) (destino: sdd-arquitecto).** En el motor, «confirmado» es el **cualificador**: un `finished confirmado` (RN-12, o RN-01 confirmado) no admite nada salvo el operador. Un `finished` RN-01 `provisional` sigue aceptando otro `finished` por RN-01, como hoy (se conserva el test de SPEC-007 «does publish a finished with a higher score (RN-01)»). En producción es inalcanzable: ese `finished` saca al partido de la ventana (CA-3). En la ventana, «confirmado» es «no RN-02».
- **F-SPEC-013-4 — Cobertura del informe de SPEC-009 con la prórroga (destino: quien lea CA-5/CA-7 el 2026-10-05).** `ventanaEfectiva` (`src/ingest/informe.ts`) cierra en el `decided_at` del `finished` vigente: los ticks de +120 a +150 de un cierre forzoso saldrán como «tras el cierre», no como cobertura. El criterio 2 (ventana declarada) no cambia. No se toca: regenerar o cambiar el informe está fuera de alcance.
- **F-SPEC-013-5 — Las correcciones de SPEC-012 son RN-02.** `replay:jornada --aplicar` escribe `finished` RN-02: con CA-3, un partido así dentro de +150 volvería a estar en ventana. Hoy da igual (ventanas vencidas).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1 (titular, 74c11b2), CA-2, CA-3, CA-4, CA-6 (código, tests y ejecución: 3.er intento, 39/39). `npm run gates` exit 0 (también sin env), `npm run test:db` exit 0.
- **No volver a ejecutar `reconciliar:cierre`**: la vigente de los dos es RN-12, la guarda lo rechaza sin pedir nada.
- Pendiente de campo: CA-5 y el presupuesto de CA-7 (jornada 2026-10-02/04; lectura arriba).
- Spec en `en-revision`; no llega a `hecho` antes de leer CA-5 (H-2).
