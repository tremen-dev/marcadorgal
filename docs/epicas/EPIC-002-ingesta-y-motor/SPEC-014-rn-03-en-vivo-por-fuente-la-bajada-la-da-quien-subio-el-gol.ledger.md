---
id: SPEC-014
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-014 RN-03 en vivo por fuente: la bajada la da quien subió el gol

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-014-rn-03-en-vivo-por-fuente-la-bajada-la-da-quien-subio-el-gol`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | Letra: commit `ce9ea96` (sdd-arquitecto). Implementador: solo tests | `src/arch/reglas-rn03.test.ts` (cita de ADR-011 §1 = RN-03; notas ADR-010 y ADR-011; FOUNDATION; ADR-010 §1 no reescrito + línea fechada; RN-06 con RN-12; ADR-010 §3 una línea CA-9); `src/arch/reglas-rn02.test.ts` «keeps RN-02 in the order of RN-06 (ADR-011 H-3)» | `git diff origin/main` de reglas.md/FOUNDATION/ADR-010/ADR-011 leído: RN-03 = cita ADR-011 §1, dos notas fechadas, ADR-010 §1 intacto + línea fechada, §3 una línea CA-9, RN-06 con RN-12 (H-3 resuelto en ADR-011). Tests arch en verde (gates) | ✅ |
| CA-2 | `supabase/migrations/20261006184649_spec014_decision_owner_and_forced_finish.sql`; `src/model/entities.ts` (`ScoredBy`, `Decision.scoredBy`, `Decision.forcedFinish`) | `src/model/model.test.ts` «SPEC-014 CA-2 CA-8…» (con y sin dueño); `src/ingest/engine.db.test.ts` «SPEC-014 CA-2 CA-8 owners and mark through the database» | Migración: 3 `add column` nulas, ningún update. `model.test.ts` y `engine.db.test.ts` verdes (test:db local 87/87) | ✅ |
| CA-3 | `src/decide/engine.ts` (`ownersOf`, RN-03 por lado, `LEGACY_OWNER`) | `src/decide/engine.test.ts` «SPEC-014 CA-3» (i)–(v) + mezcla por lado; (vi) bloques SPEC-012 CA-2 y SPEC-013 CA-4 en verde (solo `forcedFinish: true` en `forced()`, campos nuevos en un `toEqual`, `heldScore`) | Casos (i)–(v) leídos y verdes. Test SPEC-007 «never mixes sides» reescrito a 2-2: lo exige ADR-011 §2 («retiene ese lado») y CA-3 (iii) (1-1 → 1-0, mezcla por letra); no es debilitamiento. (vi): bloques SPEC-012/013 solo ganan `forcedFinish: true`, `heldScore` y campos nuevos en `toEqual`; ninguna expectativa de marcador/regla cambiada | ✅ |
| CA-4 | `src/decide/engine.ts`; `src/ingest/engine.ts` (`DecisionRow`, `toDecision`, `insertDecision`, select) | `engine.test.ts` «SPEC-014 CA-4»; `src/ingest/engine.test.ts` «SPEC-014 CA-4 CA-8 the adapter…»; `engine.db.test.ts` (RN-03 del operador conserva dueño) | `ownersOf` compara con el vigente lado a lado; tests de sube/baja/no cambia/retención/nulo verdes; adaptador lee y escribe las 3 columnas (`engine.test.ts`, `engine.db.test.ts`) | ✅ |
| CA-5 | `src/decide/fixtures/engine-11a7159.ts` (motor de main congelado) | `src/decide/replay.test.ts` «SPEC-014 CA-5»: main `live 2-1`, ADR-011 `live 2-0` desde 19:46:04.616Z, sin `regression` | Motor congelado = `git show origin/main:src/decide/engine.ts` salvo cabecera y ruta de import (diff). Test exige `{"live 2-1"}` con main y `{"live 2-0"}` desde 19:46:04.616Z con ADR-011, sin `regression` | ✅ |
| CA-6 | `src/ingest/replay-jornada.ts` (`liveTicks`); `tools/replay-jornada.mjs` (dos motores, `read only` + `statement_timeout 120s`, conteo antes/después) | `src/ingest/replay-jornada.test.ts` «SPEC-014 CA-6»; ejecución real abajo | Reejecutado 2026-10-06 sin `--aplicar` (dev, read only, <15 s): 738 → 0 en 8 → 0 partidos, mismo desglose; `decisions 6700 → 6700`. 5 falsas comprobadas en la fuente: lugo 0-0 14:54:04–14:56:04Z (4) y eibar 3-1 18:15:31Z (1). Desviación −9 explicada arriba | ✅ |
| CA-7 | — | `npm run gates` → 0 (860 tests); `npm run test:db` → 87/87 contra Supabase local (ver F-SPEC-014-4); `package.json` sin cambios; una migración | `npm run gates` → EXIT 0, 860/860; `DATABASE_URL=…127.0.0.1:54322 npm run test:db` → 87/87, db:push contra local («up to date»); `package.json` sin diff; 1 migración; `src/decide` solo importa model/thresholds/types | ✅ |
| CA-8 | `engine.ts` (solo el cierre forzoso `true`; RN-12 por `forcedFinish === true`); `src/ingest/window.ts` (sin `rule`); `src/ingest/db.ts`; `src/ingest/reconciliacion.ts` + `tools/reconciliar-cierre.mjs`; `replay-jornada.ts` (corrección `false`); SPEC-017 N-2: `src/ingest/informe.ts` (`ventanaEfectiva`) + `informe-db.ts` | `engine.test.ts` «SPEC-014 CA-8»; `window.test.ts` «SPEC-014 CA-8 CA-9…»; `reconciliacion.test.ts` «refuses a finished RN-02 whose mark is false/null»; `replay-jornada.test.ts` «SPEC-014 CA-8…»; `engine.db.test.ts` (ida y vuelta true/false/null); `db.db.test.ts` windowMatches por marca; `replay-jornada.db.test.ts` (`forced_finish: false`); `informe.test.ts` «SPEC-017 CA-4 (iv)» (false y null cierran en `decided_at`); `informe.db.test.ts` «SPEC-017 CA-4 la marca…» | grep: único `forcedFinish: true` en la rama del cierre forzoso (`engine.ts:342`); `draft()` pone `false` siempre (RN-01 postponed/suspended de SPEC-016 incluidas, `toEqual` con `false`); `isInWindow` sin `rule`; RN-12, ventana, reconciliación e informe por `=== true`. SPEC-017 N-2 y CA-4 (iv) verdes | ✅ |
| CA-9 | `engine.ts`, `window.ts` (cualquier `finished` sin marca cierra) | `engine.test.ts` «SPEC-014 CA-9» (i)(ii); test SPEC-007 «does publish a finished with a higher score (RN-01)» en verde; `window.test.ts` | `window.ts`: cualquier `finished` sin marca fuera; tests (i)(ii) y SPEC-007 RN-01 verdes; línea en ADR-010 §3 | ✅ |
| CA-10 | `engine.ts` (`details.score` publicado, `details.heldScore` vigente) | `engine.test.ts` «SPEC-014 CA-10»; `replay.test.ts` y `engine.db.test.ts` con `heldScore` | `details.score` = publicado, `heldScore` = vigente; dos casos verdes; ninguna escritura sobre alertas abiertas | ✅ |

### CA-6, ejecución real (2026-10-06, sin `--aplicar`, base `dev`, solo lectura, 10 s)
`npm run replay:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z` → 39 partidos, 9331 observaciones; «Ticks live con el marcador publicado distinto del de la fuente: **738** (main, 11a7159) → **0** (ADR-011), en 8 → 0 partidos»; «decisions 6700 → 6700». Por partido (main → ADR-011): barakaldo-aviles 47→0, lugo-racing-ferrol 70→0, mirandes-unionistas 207→0, burgos-eldense 167→0, celta-fortuna-sabadell 63→0, ceuta-real-sociedad-b 21→0, eibar-las-palmas 89→0, girona-albacete 74→0. Bajada falsa publicada con ADR-011: lugo 0-0 14:54:04–14:56:04Z (4 ticks) y eibar 3-1 18:15:31Z (1 tick) = **5**. Desviación: 738 = 733 reales + 5 falsas, frente a 742 + 5 de la medición (−9: lugo fila 4 66 vs 72, girona, celta y burgos −1). El replay cuenta solo ticks con lo publicado en `live`; la medición comparó `board` real con la fuente, que incluye ticks tras el cierre forzoso (lugo, +120) y un tick de borde.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-10-06, sdd-verificador.** CA-1..CA-10 ✅. Evidencia: `npm run gates` EXIT 0 (51 ficheros, 860 tests, build OK); `npm run test:db` contra Supabase local (127.0.0.1:54322, migración aplicada en local, nunca en `dev`) 10 ficheros, 87/87; `npm run replay:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z` sin `--aplicar` → 738 → 0, `decisions 6700 → 6700`.
Tests preexistentes modificados (`git diff origin/main -- '*.test.ts'`), juzgados uno a uno: el único cambio de comportamiento esperado es SPEC-007 «never mixes sides» (2-1 → 2-2) y el CA-11 de `engine.db.test.ts` (la retirada de la misma fuente pasa a RN-01 sin alerta; la retención se prueba aparte con gol del operador). Ambos los exige la letra de ADR-011 §1–§2 y SPEC-014 CA-3 (i)/(iii). El resto son traducciones de `rule` a la marca (CA-8), `heldScore` (CA-10) y campos nuevos en `toEqual`: no se debilita ninguna aserción.
Observaciones no bloqueantes:
- **V-1 (baja)** Comentario obsoleto en `src/decide/engine.ts` (`holdingScore`): «Sides are never mixed.» ya no es cierto tras ADR-011 §2. Destino: limpieza en la próxima spec que toque `engine.ts`.
- **V-2 (info, previo a esta spec)** El replay de la jornada diverge en `merida-logrones` (board 3-5, replay 3-4) y `ceuta-real-sociedad-b` (3-1 vs 2-1), igual con el motor de main: los finales reconciliados por `reconciliar:cierre` no están en la lectura del replay. `replay:jornada --aplicar` sobre este rango bajaría esos dos finales correctos. No usar `--aplicar` en este rango.
- Código fuera de `src/`: solo `tools/replay-jornada.mjs` (importa el motor congelado de `src/decide/fixtures`, con precedentes `engine-0a40046.ts` y `engine-812c805.ts`; ningún código de producción lo importa). Aceptable.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-014/. Informe HTML opcional: _qa/SPEC-014/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-014-1, F-SPEC-014-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-014-1 Migración sin aplicar en `dev`.** El código lee `decisions.forced_finish` y los dueños (tick, ventana, informe, reconciliación): aplicar `npm run db:push` **antes** del despliegue o el tick falla. Destino: titular, al fusionar.
- **F-SPEC-014-2 RN-03 por lado cambia un test de SPEC-007.** «never mixes sides: 1-2 against 2-1 holds 2-1» pasa a publicar 2-2 (RN-03, con alerta) porque ADR-011 §2 retiene solo el lado que baja. Duda para el titular si quería conservar «no mezclar».
- **F-SPEC-014-3 Dueño sin prioridad conocida.** Si el dueño no está en el registro de la competición, solo lo baja él mismo (no se puede probar «más peso»). Hoy no ocurre: api-football está registrada.
- **F-SPEC-014-4 `test:db` no corrió contra `dev`** (`db:push` escribiría la migración). Corrió contra Supabase local (Docker) con SSL activado a mano y `segunda-division` sembrada en local, porque `reconciliacion.db.test.ts` depende de datos de `dev` (previo a esta spec). Destino: el verificador, tras aplicar F-SPEC-014-1.
- **F-SPEC-014-5** `DecisionDraft.scoredBy/forcedFinish` son opcionales en el tipo solo por los motores congelados de `src/decide/fixtures`; `decide()` los pone siempre (tests de CA-4 y CA-8). `tools/replay-jornada.mjs` importa `engine-11a7159.ts` (herramienta, no producción).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Rama `ft/SPEC-014-rn-03-en-vivo-por-fuente-la-bajada-la-da-quien-subio-el-gol`, sin push. CA-1..CA-10 implementados y con test; spec en `en-revision`.
- Falta: verificación; aplicar la migración en `dev` (F-SPEC-014-1) y `npm run test:db` allí. Base local: `supabase start -x gotrue,realtime,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`, SSL activado en el contenedor (`createSql` exige `ssl: require`) y `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db`.
