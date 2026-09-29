---
id: SPEC-015
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-015 El calendario declarado llega tarde a la jornada

## Resumen
- Fase: en-revision <!-- la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-015-el-calendario-declarado-llega-tarde-a-la-jornada`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `.github/workflows/calendario-semanal.yml`: `cron: '0 5 * * 2-6'` + `workflow_dispatch`. Presupuesto: 5 peticiones por ejecución, 25/semana (antes 5) | `src/arch/deploy.test.ts` › "runs every day from Tuesday to Saturday…" (rojo → verde) | `calendario-semanal.yml`: `cron: '0 5 * * 2-6'` y `workflow_dispatch` leídos; test afirma el valor exacto; gates verdes | ✅ |
| CA-2 | `.github/workflows/calendario-semanal.yml`, paso «Abrir o actualizar el PR»: `rama="chore/calendario"`; PR abierto (`gh pr list --state open`) → commit encima + `gh pr edit`; sin PR abierto → `git push origin --delete` y rama nueva desde main + `gh pr create`. Sin `--force` | `deploy.test.ts` › "SPEC-015 CA-2 …" (3 casos, rojo → verde). Pendiente de verificación: dos `workflow_dispatch` y `gh pr list` | Leído el paso: rama fija, PR abierto → commit encima + `gh pr edit "$abierto"`; sin PR → borra y rehace desde main; sin `--force`. Tests no vacíos. **Pendiente tras el merge:** dos `workflow_dispatch` seguidos y `gh pr list --head chore/calendario --state open` con un único PR | ⚠️ |
| CA-3 | `src/calendar/sync.ts` (`formatSyncDiff(id, diff, now)`, `countUrgent`, `SyncDiff.kickoffs` para `+`/`?`); `tools/calendario-sync.mjs` pone el reloj e imprime `urgentes: N`; título `— N urgentes` en el workflow | `src/calendar/sync.test.ts` › "SPEC-015 CA-3" (eldense-oviedo URGENTE, celta-fortuna-real-sociedad-b sin marca, antela-somozas PASADO, `now = 2026-09-29T11:00:00Z`; bordes de la ventana; `+`/`?`); `cli.test.ts` › "CA-3 the tool puts the clock…"; `deploy.test.ts` › "CA-3 the title…" | Casos del test cotejados con el diff de 845c390 (PR #19). Flujo real sin red: `node --import src/calendar/cli.fake-provider.mjs tools/calendario-sync.mjs 2026-27 --dry-run` sobre los datos previos a #19 con `FAKE_PROVIDER_KICKOFFS` = los 55 `~` del cuerpo de #19 → Segunda J8 11 × `URGENTE`, J9/J10 sin marca, antela-somozas / montaneros-viveiro / sarriana-celta-c / extremadura-zamora `PASADO`; `urgentes: 11`; `GITHUB_OUTPUT` `urgentes=11` | ✅ |
| CA-4 | `src/calendar/sync.ts` (`autoAplicable`); `tools/calendario-sync.mjs` → `GITHUB_OUTPUT auto=si|no`; `.github/workflows/calendario-semanal.yml`: `alias=si|no` en el paso de diff, paso «Fusionar y cargar las reprogramaciones puras» (`gh pr merge "$pr" --merge` + `gh workflow run … -f cargar=si`), `permissions.actions: write` | `sync.test.ts` › "SPEC-015 CA-4 autoAplicable" (9 casos); `cli.test.ts` › "CA-4 only reschedules: auto=si" / "…rename…: auto=no"; `deploy.test.ts` › "CA-4 …" (3 casos). Pendiente de verificación: fila en `calendar_loads` tras una ejecución real | `autoAplicable` pura, 9 casos; la misma ejecución sin red de CA-3 (solo `rescheduled`) → `auto-aplicable: si`, `auto=si`. F-SPEC-015-1 juzgado fiel a H-1 (ver veredicto). **Pendiente tras el merge:** ejecución real con reprogramaciones → fusión propia + `load`, y consulta de `calendar_loads` con la fila nueva | ⚠️ |
| CA-5 | Nada que codear: consulta de campo en la jornada 2026-10-09/12 | Pendiente (campo) | No juzgable hasta la jornada 2026-10-09/12 | ❌ |
| CA-6 | Ficheros: el workflow, `src/calendar/sync.ts`, `tools/calendario-sync.mjs`, `src/calendar/{sync,cli}.test.ts`, `src/calendar/cli.fake-provider.mjs` (helper de test), `src/arch/deploy.test.ts`. Sin cambios en `src/decide`, `src/ingest`, `supabase/`, `package*.json` | `npm run gates` → exit 0 (734 tests), también con `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN` | Rama: `npm run gates` (mismos `env -u`) → exit 0, 46 ficheros / 734 tests. Árbol fusionado temporal rama + `origin/main` (`git merge-tree`, sin conflicto): typecheck, biome y 751 tests verdes (build no evaluable ahí: `node_modules` enlazado). `git diff --name-only 91e8227 HEAD` sin `src/decide`, `src/ingest`, `supabase/`, `package*.json` | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN parcial — 2026-09-29, sdd-verificador.** CA-1, CA-3, CA-6 ✅. CA-2 y CA-4 ⚠️: código y tests correctos; su verificación real solo es posible con el workflow en `main`. CA-5 ❌ hasta la jornada 2026-10-09/12. La spec queda en `en-revision`; no pasa a `hecho`.

- **Integración con `main`:** la rama nace en 91e8227; `main` recibió #19 (solo `data/calendario/**`) y #20 (SPEC-012). Sin ficheros comunes y `git merge-tree` sin conflicto. No hace falta rebase.
- **F-SPEC-015-1, fiel a H-1 (b).** (1) El chequeo de alias en el workflow es necesario, no una rebaja: `syncCalendar` escribe `aliases.matches` sin dejar rastro en el diff, así que una función pura sobre los diffs no puede ver `data/alias/**`. La condición total `auto=si ∧ alias=no` es la de CA-4. (2) Pedir al menos una reprogramación cumple «todo lo demás espera»: un cambio de ficheros sin diff no es una reprogramación pura. (3) Negarse si la rama difiere de `main` fuera de `data/calendario/**` es conservador y falla hacia el humano. Salvedad: con un PR abierto sobre un `main` que ha avanzado en código, el paso se niega aunque haya reprogramaciones puras (lo que sale en la lista son los ficheros de `main`, no de la rama).
- **Observación (spec, no implementación):** un partido `PST` al que el proveedor cambia la fecha entra como `rescheduled` y se fusiona solo, porque CA-4 dice que `unconfirmed` no cuenta. Es la enmienda a H-5 tal como se escribió.

**Queda tras el merge:** CA-2, con dos `workflow_dispatch` y `gh pr list --head chore/calendario --state open`. CA-4, con una ejecución real con reprogramaciones: PR fusionado por el bot, `load` lanzado y la fila nueva en `calendar_loads`. CA-5, en campo. Hasta entonces no se transiciona.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-015/. Informe HTML opcional: _qa/SPEC-015/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-015-1, F-SPEC-015-2… con destino (spec futura o EPIC-MEJORA). -->
- **Protección de `main` (CA-4), comprobada en solo lectura el 2026-09-29:** `gh api repos/tremen-dev/marcadorgal/branches/main` → `protected: false`, `required_status_checks.enforcement_level: off`; `…/branches/main/protection` → 404 «Branch not protected»; `…/rules/branches/main` → `[]`; `…/rulesets` → `[]`; `actions/permissions/workflow` → `default_workflow_permissions: read` (el job declara los suyos). Nada impide la fusión con `GITHUB_TOKEN`. Ojo: un PR abierto con `GITHUB_TOKEN` no dispara `ci.yml`; si algún día `main` exige checks, CA-4 se rompe.
- **F-SPEC-015-1 (alcance de `autoAplicable`).** La firma de la spec es `autoAplicable(diffs)`, pura sobre los diffs; la condición «`data/alias/**` no cambia» la comprueba el workflow (`alias=no`, `git status --porcelain data/alias`). Además, `autoAplicable` exige al menos una reprogramación (un cambio de ficheros sin nada en el diff espera al humano), y el paso de fusión se niega si la rama difiere de `origin/main` en algo fuera de `data/calendario/**` (un commit humano en la rama no se fusiona solo). Destino: que el verificador lo valide contra H-1.
- **F-SPEC-015-2 (`SyncDiff.kickoffs`).** Para marcar líneas `+` y `?` hacía falta su kickoff; se añade al diff (solo añadidos y ausentes). Sin impacto fuera de `src/calendar`.
- **F-SPEC-015-3 (concurrencia).** Dos syncs a la vez (schedule + `workflow_dispatch`) pueden chocar en el push; el push sin `--force` falla y el job cae, sin pérdida. Un `concurrency:` lo evitaría → EPIC-MANT.
- Simulación local de los pasos del PR y de la fusión (bash sobre un `origin` desnudo y un `gh` falso, fuera del repo): día 1 reprogramación → PR #1 fusionado + `gh workflow run … -f cargar=si`; día 2 cambio con alias → rama borrada y rehecha desde main, PR #2; día 3 → `gh pr edit 2`, un solo PR abierto; alias en la rama → «trae más que el calendario; espera al humano». No sustituye la verificación de CA-2/CA-4 con `workflow_dispatch` real.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1 a CA-4 y CA-6 en código y tests; rama `ft/SPEC-015-el-calendario-declarado-llega-tarde-a-la-jornada`.
- Falta (verificador / titular, tras fusionar a `main`, porque `workflow_dispatch` corre el workflow de la rama por defecto): CA-2 con dos `workflow_dispatch` seguidos y `gh pr list --head chore/calendario`; CA-4 con una ejecución real con reprogramaciones y la consulta de `calendar_loads`. Cuidado: el PR #19 vive en `chore/calendario-2026-09-29`, no en la rama fija; si sigue abierto al desplegar, la primera ejecución abrirá otro PR sobre `chore/calendario` (y, si solo hay reprogramaciones, lo fusionará). Conviene fusionar o cerrar #19 antes.
- CA-5: consulta de campo en la jornada 2026-10-09/12.
