---
id: SPEC-021
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-021 Descanso dentro de live: del adaptador a la fila

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-021-descanso-dentro-de-live-del-adaptador-a-la-fila`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/model/state.ts` (`HalfTime`, `isHalfTime`) | `src/model/model.test.ts` «SPEC-021 CA-1: halfTime lives only in the live branch» | `vitest` 1105/1105; caso leído: cuatro ramas no `live` rechazan `halfTime`, `MatchStatus.options` con 5 | ✅ |
| CA-2 | `src/sources/api-football/results.ts` (`HALF_TIME` = HT, BT) | `results.test.ts`: tabla 1H/HT/2H/ET/BT/P/LIVE; «SPEC-021 CA-2: the HT fixture is the only one…» (live-2026-09-26); «SPEC-021 CA-2 girona-albacete…» (247 capturas) | caso HT/BT→true, resto false; `live-2026-09-26.json` (4×1H false, Granada-Andorra true) y 247 capturas `.br` comprobadas por `short`; `results.ts` solo importa `src/model` | ✅ |
| CA-3 | `src/decide/engine.ts` (`stateOf`, `tuple`, RN-05) | `engine.test.ts` «SPEC-021 CA-3 half-time in the published tuple»; `replay.test.ts` «SPEC-021 CA-3 half-time in the replay of girona-albacete» | replay Girona: 1 entrada 19:18:03Z, salida 19:34:34Z, 0 `sen_sinal`/alertas dentro, final `finished 2-0` RN-01; tabla RN-05/RN-03/RN-02; `git diff origin/main -- src/decide/fixtures` vacío | ✅ |
| CA-4 | `supabase/migrations/20261008120000_spec021_half_time.sql` | `src/db/schema.db.test.ts` «SPEC-021 CA-4…»; `src/db/web.db.test.ts` columnas (half_time última), fila sin Decision, «SPEC-021 CA-4 web.xornada carries half_time»; inventario ADR-015 §3 en verde | `test:db` local 158/158; check `half_time = false or status = 'live'` en ambas; vista = SPEC-020 + `half_time` al final (diff de cuerpo); grants tras migrar: `web_reader:SELECT` + `postgres`; suite de `origin/main` contra la base migrada: ingesta y lector en verde (solo fallan sus 2 asertos de lista exacta de columnas, esperado) | ✅ |
| CA-5 | `src/ingest/db.ts`, `src/ingest/engine.ts`, `src/ingest/replay-jornada-db.ts` | `src/ingest/db.db.test.ts` «SPEC-021 CA-5: stores half_time…»; `src/ingest/engine.db.test.ts` «SPEC-021 CA-5 half_time round trip»; `engine.test.ts` (valores del insert) | `db.db.test.ts` y `engine.db.test.ts` ida y vuelta en verde; `select` de Decision vigente y observaciones leen `half_time` | ✅ |
| CA-6 | `src/model/public.ts`, `src/board/row.ts`, `tools/e2e-db-seed.mjs` | `public.test.ts` «SPEC-021 CA-6…»; `row.test.ts` «SPEC-021 CA-6 half_time to halfTime» (sin clave → omitida + console.error); `reader.db.test.ts` semilla `t-live-half-time`; `http.test.ts` «SPEC-021 CA-6: returns halfTime…»; `e2e/xornada.db.spec.ts` «SPEC-021 /api/board carries halfTime…» | `public.test.ts` estricto; `row.test.ts` sin clave → omitida + `console.error`; `reader.db.test.ts`; `/api/board` local: `tercera-rfef-g1-…-arteixo-somozas` `halfTime: true`, resto `live` `false` | ✅ |
| CA-7 | `src/xornada/view.ts`, `src/xornada/demo.ts`, `src/components/xornada/MatchRow.tsx`, `src/i18n/{gl,es}.ts` | `view.test.ts` «SPEC-021 CA-7 half-time in the view»; `demo.test.ts`; `i18n.test.ts`; `e2e/xornada.spec.ts` «SPEC-021 CA-7 half-time row at 360/390px» (gl y es) | Playwright propio 360/390 gl/es en `/demo/xornada`, `/`, `/es`: margen «Descanso» sin `'` ni punto (innerHTML solo texto), `data-status=live`, píldora cuenta (Segunda 3 = 2 descanso + 1), ember/rojo `sen_sinal`, sin overflow ni scroll horizontal, sin `DESC` | ✅ |
| CA-8 | — | `npm run gates` exit 0 (1105 tests); `npm run e2e` 38 passed; `npm run e2e:db` 7 passed, 1 skipped (capturas); `test:db` local 158 passed; sin dependencias nuevas; `git diff 075ac90 -- src/decide/fixtures package.json package-lock.json` vacío | `gates` exit 0 (1105); `e2e` 38 passed; `e2e:db` 7 passed 1 skipped (×2); `test:db` 158; sin deps; sin hex ni `font:` en el diff | ✅ |
| CA-9 | pendiente (tras N-1) | ver «Cómo retomar» | no verificable antes de N-1 y de una jornada real | ❌ pendiente |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN condicionado — 2026-10-08.** CA-1..CA-8 ✅ con evidencia propia; CA-9 ❌ pendiente de N-1 y de una jornada real: la spec queda en `en-revision` hasta recogerla.
- N-1 correcto y seguro: la suite de `origin/main` corre contra la base local migrada (insert sin `half_time` → `false`; lector por nombre ignora la columna; `create or replace view` conserva owner y grants). Añadir antes del paso 2 `npm run db:push -- --dry-run` y comprobar que solo lista `20261008120000_spec021_half_time.sql`.
- F-SPEC-021-3 (preexistente, fuera de alcance; destino EPIC-MEJORA): `npm run test:db` con `DATABASE_URL` local sigue leyendo `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del `.env` (producción): `src/raw/store.db.test.ts` crea y borra `test/<uuid>.json.gz` en el bucket remoto. En esta verificación ocurrió una vez (put, get, remove; el test confirma el borrado).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-021/. Informe HTML opcional: _qa/SPEC-021/informe.html -->
| CA | Captura (sobre `/demo/xornada`, sección Segunda División) |
|---|---|
| CA-7 | `_qa/SPEC-021/descanso-gl-360.png`, `descanso-gl-390.png`, `descanso-es-360.png`, `descanso-es-390.png` |

Generadas con `QA_CAPTURE_DIR=$PWD/docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-021 npm run e2e`.

| CA | Captura del verificador (Playwright propio; `/` y `/es` sobre la base local sembrada) |
|---|---|
| CA-7 | `_qa/SPEC-021/verif-demo-gl-360.png`, `verif-demo-gl-390.png`, `verif-demo-es-360.png`, `verif-demo-es-390.png` |
| CA-6, CA-7 | `_qa/SPEC-021/verif-home-gl-360.png`, `verif-home-gl-390.png`, `verif-home-es-360.png`, `verif-home-es-390.png` (fila Arteixo-Somozas «Descanso»; gl y es idénticas píxel a píxel porque la zona capturada no tiene texto traducible) |

## Salvedades / follow-ups
<!-- IDs F-SPEC-021-1, F-SPEC-021-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-021-1 — La columna `half_time` va al final del `insert into decisions` de `src/ingest/engine.ts` (no junto a `added_minute`) para no reindexar los asertos posicionales de `engine.test.ts`. Cosmético; destino: EPIC-MEJORA si se reordena.
- F-SPEC-021-2 — `tools/e2e-db-seed.mjs` siembra el partido en descanso en un bloque aparte e idempotente (`current[STATES.length]`), para que una base local sembrada antes de SPEC-021 también lo tenga. Sin destino: informativo.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-8 implementados en `ft/SPEC-021-descanso-dentro-de-live-del-adaptador-a-la-fila` (sin push). Falta verificación y CA-9.

**N-1 — procedimiento del titular (migración ANTES del merge).** Solo él, desde la rama:
1. Con GREEN del verificador y `test:db` local en verde.
2. `npm run db:push` (aplica solo `20261008120000_spec021_half_time.sql`; aditiva, con default; `create or replace view` conserva owner y grants de `web.xornada`).
3. Comprobaciones de solo lectura contra producción:
   ```sql
   select table_name, column_name, data_type, is_nullable, column_default
     from information_schema.columns
    where table_schema = 'public' and column_name = 'half_time';           -- 2 filas, boolean, NO, false
   select conname from pg_constraint
    where conname in ('observations_half_time_check', 'decisions_half_time_check'); -- 2 filas
   select column_name from information_schema.columns
    where table_schema = 'web' and table_name = 'xornada'
    order by ordinal_position desc limit 1;                                  -- half_time
   select grantee, privilege_type from information_schema.role_table_grants
    where table_schema = 'web' and table_name = 'xornada';                   -- web_reader SELECT (y postgres)
   select started_at, finished_at, error from ingest_attempts
    order by started_at desc limit 5;                                        -- ticks posteriores sin error
   ```
   y `curl -s -o /dev/null -w '%{http_code}\n' https://<dominio>/api/board` → 200 con los mismos partidos que antes (el lector desplegado ignora la columna nueva).
4. Merge y despliegue.
5. CA-9.

**CA-9 — cómo recogerla** (jornada siguiente al despliegue, con un partido en `HT`):
- `select match_id, version, status, minute, half_time, decided_at from decisions where half_time order by decided_at desc limit 5;` → al menos una fila `live` real.
- `curl -s https://<dominio>/api/board | jq '.matches[] | select(.halfTime == true)'` → el mismo partido con `halfTime: true`.
- Captura de `/` con la fila «Descanso» en `_qa/SPEC-021/ca9-descanso-produccion.png`.
