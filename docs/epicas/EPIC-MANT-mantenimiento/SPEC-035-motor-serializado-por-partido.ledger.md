---
id: SPEC-035
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-035 Motor serializado por partido

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-035-motor-serializado-por-partido`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/engine.ts` (`decideMatches`: primera consulta `… order by id for no key update`) | `src/ingest/engine.db.test.ts` «SPEC-035 CA-1 …» (conexiones A/B reales; B espera en `pg_stat_activity.wait_event_type = 'Lock'`; sin el arreglo: 23505) | | |
| CA-2 | `src/ingest/engine.ts` (mismo cerrojo) | `engine.db.test.ts` «SPEC-035 CA-2 …» (sin el arreglo: 23505) | | |
| CA-3 | `src/ingest/engine.ts` (`no key update`, `order by id`) | `engine.db.test.ts` «SPEC-035 CA-3 …»: tres casos (afterInsert m2 ∥ barrido m1-m3; al revés, con `lock_timeout 2s`; `insertObservations` de m1 con `lock_timeout 2s`). Con `for update` fallan los dos últimos por `lock timeout` | | |
| CA-4 | sin cambios de aserciones (`git diff 7b130b0 -- src` solo añade, salvo 2 imports de `engine.db.test.ts`) | `npm run test` 1745/1745; `npm run test:db` 201/201 (incluye `engine*.db`, `reconciliacion*.db`, `replay-jornada.db`) | | |
| CA-5 | `src/ingest/informe.ts` (`motorDe`, `tuplaPublicada`, `Informe.motor`, línea en bloque 3); `src/ingest/informe-db.ts` (minute, added_minute, half_time, qualifier) | `informe.test.ts` «SPEC-035 CA-5 …» (3 casos); `informe.db.test.ts` «SPEC-035 CA-5 …» | | |
| CA-6 | solo `src/ingest/{engine,informe,informe-db}.ts` y tests | `git diff main -- src/decide src/model src/sources supabase/migrations` vacío; `npm run gates` exit 0 | | |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-035/. Informe HTML opcional: _qa/SPEC-035/informe.html -->

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
