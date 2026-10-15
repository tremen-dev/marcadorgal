---
id: SPEC-035
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-035 Motor serializado por partido

## Resumen
- Fase: en-progreso <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-035-motor-serializado-por-partido`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/engine.ts` (`decideMatches`: primera consulta `… order by id for no key update`) | `src/ingest/engine.db.test.ts` «SPEC-035 CA-1 …» (conexiones A/B reales; B espera en `pg_stat_activity.wait_event_type = 'Lock'`; sin el arreglo: 23505) | `npm run test:db` 201/201 (`_qa/SPEC-035/2026-10-15-verif-test-db.txt`). Sin `for no key update` (mutación temporal, restaurada): 4 SPEC-035 en rojo, 23505 `decisions_match_id_version_key` (`2026-10-15-verif-sin-cerrojo.txt`). El test comprueba espera real (`wait_event_type='Lock'`), `decisions: 0` y 1 fila | ✅ |
| CA-2 | `src/ingest/engine.ts` (mismo cerrojo) | `engine.db.test.ts` «SPEC-035 CA-2 …» (sin el arreglo: 23505) | En verde con el cerrojo; en rojo sin él (23505, mismo fichero). La última versión es 1-0 min 12 y no hay versión >1 con 0-0 | ✅ |
| CA-3 | `src/ingest/engine.ts` (`no key update`, `order by id`) | `engine.db.test.ts` «SPEC-035 CA-3 …»: tres casos (afterInsert m2 ∥ barrido m1-m3; al revés, con `lock_timeout 2s`; `insertObservations` de m1 con `lock_timeout 2s`). Con `for update` fallan los dos últimos por `lock timeout` | Los 3 casos del test pasan; con `for update` fallan los 2 últimos por `lock timeout` (`2026-10-15-verif-for-update.txt`). **Pero** el cerrojo nuevo choca con el upsert de `src/calendar/load.ts` (`on conflict (id) do update set kickoff`, `no key update` en orden de fichero): 40P01 reproducido 3/3 con `decideMatches` real (`repro-calendario-load.mjs`, `2026-10-15-verif-repro-calendario-load.txt`). Ver V-1 | ❌ |
| CA-4 | sin cambios de aserciones (`git diff 7b130b0 -- src` solo añade, salvo 2 imports de `engine.db.test.ts`) | `npm run test` 1745/1745; `npm run test:db` 201/201 (incluye `engine*.db`, `reconciliacion*.db`, `replay-jornada.db`) | `npm run gates` exit 0, 101 ficheros/1745 tests (`2026-10-15-verif-gates.txt`); `test:db` 20/201. `git diff origin/main...HEAD -- src` solo quita 2 imports, la consulta cambiada y el `rango:` movido (F-1). Replay: `replay-jornada*.ts` no llama a `decideMatches` (motor puro), así que el cerrojo no puede cambiar sus Decisions; tests en verde (F-3) | ✅ |
| CA-5 | `src/ingest/informe.ts` (`motorDe`, `tuplaPublicada`, `Informe.motor`, línea en bloque 3); `src/ingest/informe-db.ts` (minute, added_minute, half_time, qualifier) | `informe.test.ts` «SPEC-035 CA-5 …» (3 casos); `informe.db.test.ts` «SPEC-035 CA-5 …» | 3 casos de `informe.test.ts` y 1 de `informe.db.test.ts` en verde; la tupla de `informe.ts` es la de `src/decide/engine.ts:67`. Formato en una línea (F-1, aceptado). Residual: la Verif. tras desplegar (primera jornada, 0 · 0) queda pendiente | ⚠️ |
| CA-6 | solo `src/ingest/{engine,informe,informe-db}.ts` y tests | `git diff main -- src/decide src/model src/sources supabase/migrations` vacío; `npm run gates` exit 0 | `git diff origin/main...HEAD --name-only` fuera de `docs/`: solo los 6 ficheros de `src/ingest/` permitidos; `-- src/decide src/model src/sources supabase/migrations` vacío (0 líneas); sin grants ni cambios en `package*.json`. Solo Supabase local | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**RED — 2026-10-15 (sdd-verificador).** Gates y `test:db` en verde y los tests
de concurrencia discriminan (rojo sin cerrojo y con `for update`). Falla CA-3
fuera de sus dos casos enumerados:

- **V-1 (CA-3, `src/ingest/engine.ts:262-263` × `src/calendar/load.ts:90-91`).**
  `calendario:load` (cada push a `main` en `data/calendario/**` y tras la
  fusión automática de SPEC-015) hace `insert into matches … on conflict (id)
  do update set kickoff`, que toma `no key update` en todas las filas de la
  competición en orden de fichero, no de id. Choca con el cerrojo nuevo:
  afterInsert en m2 abierto + barrido m1..m3 (bloqueado en m2, con m1) +
  upsert (m3, m1) → `40P01 deadlock detected` (3/3,
  `_qa/SPEC-035/repro-calendario-load.mjs`). Antes no había choque (FK =
  `key share`). La víctima no está fijada: si es un `afterInsert` con ≥ 2
  partidos, deshace sus Observations (daño b). Además el upsert frena al
  `afterInsert` mientras dure su transacción. ADR-019 §1 y H-1 no contemplan
  a `calendar/load.ts` como escritor de `matches`. Arreglarlo sale de CA-6:
  vuelve a sdd-arquitecto (p. ej. que `loadSeason` tome el mismo cerrojo
  `order by id` antes del upsert, o upsert en orden de id).
- **V-2 (ADR-019 §2, `src/ingest/replay-jornada-db.ts:92`).**
  `aplicarCorrecciones` (`replay:jornada --aplicar`) inserta Decisions con
  `insertDecision` fuera de `decideMatches` y sin cerrojo; §2 nombra «las
  herramientas de reconciliación». Previo a la rama y fuera de CA-6; no
  bloquea por sí solo, pero entra en la misma revisión de alcance.

Decisiones sobre los follow-ups: **F-1 aceptado** (CA-5 pide los dos textos y
la lista, no dos líneas; las aserciones previas siguen intactas). **F-2
aceptado** como follow-up a EPIC-MEJORA. **F-3 cerrado**: el replay usa el
motor puro, no `decideMatches`, y `replay-jornada*.test.ts` pasa; no hace
falta leer producción.

Base local al terminar: 0 matches/teams/decisions/observations/alerts/attempts.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-035/. Informe HTML opcional: _qa/SPEC-035/informe.html -->
n-a (sin UI). Salidas de comando en `_qa/SPEC-035/2026-10-15-verif-*.txt`.

## Salvedades / follow-ups
<!-- IDs F-SPEC-035-1, F-SPEC-035-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-035-1 (CA-5, formato): las dos cuentas van en **una** línea
  («Decisiones gemelas: N[ — muestra] · `decided_at` invertido: N[ — muestra]»)
  y el `rango:` del bloque 4 sube a la línea de sus estadísticos. Motivo: el
  techo de CA-10 (`INFORME_MAX_LINEAS = 145`) estaba lleno (145/145 en
  «todos los ejes saturados»); con dos líneas daba 147. Aserciones previas
  intactas (todas `toContain`). Destino: verificador, por si el titular
  prefiere dos líneas y subir el tope (toca `constants.ts`, fuera de CA-6).
- F-SPEC-035-2 (CA-5): se comparan versiones consecutivas dentro de la
  ventana; si la anterior cae fuera (`decided_at < desde`), ese par no se
  cuenta. Destino: EPIC-MEJORA si alguna vez importa.
- F-SPEC-035-3 (CA-4, replay): «el replay de jornada da las mismas Decisions»
  se cubre con `replay-jornada.test.ts` / `replay-jornada.db.test.ts` en
  verde; no se ejecutó `npm run replay:jornada` contra datos reales porque
  lee producción (CA-6: nada contra producción). Destino: verificador.
- Nota de tests: los de SPEC-035 confirman filas (una transacción que espera
  solo ve lo confirmado); el `afterAll` las borra con
  `session_replication_role = replica` y retira los equipos `test-home` /
  `test-away` si nadie más los usa. `test:db` dos veces seguidas en verde y la
  base local queda con 0 matches/teams/decisions/observations.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho CA-1..CA-6 en `ft/SPEC-035-motor-serializado-por-partido` (commits
  `03befbc` CA-1..3, `e8661d3` CA-5, más el del ledger). Sin push.
- Evidencia: `npm run gates` exit 0 (1745 tests, build OK);
  `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db`
  → 20 ficheros, 201 tests en verde.
- Rojo comprobado: sin el cerrojo, CA-1/CA-2/CA-3(1-2) fallan con 23505
  `decisions_match_id_version_key`; con `for update`, CA-3(2-3) fallan con
  `lock timeout`.
- Falta: verificación (sdd-verificador) y, tras desplegar, la línea de CA-5
  en la primera jornada (debe dar 0 gemelas).
