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
| CA-1 | `.github/workflows/calendario-semanal.yml`: `cron: '0 5 * * 2-6'` + `workflow_dispatch`. Presupuesto: 5 peticiones por ejecución, 25/semana (antes 5) | `src/arch/deploy.test.ts` › "runs every day from Tuesday to Saturday…" (rojo → verde) | | ❌ |
| CA-2 | `.github/workflows/calendario-semanal.yml`, paso «Abrir o actualizar el PR»: `rama="chore/calendario"`; PR abierto (`gh pr list --state open`) → commit encima + `gh pr edit`; sin PR abierto → `git push origin --delete` y rama nueva desde main + `gh pr create`. Sin `--force` | `deploy.test.ts` › "SPEC-015 CA-2 …" (3 casos, rojo → verde). Pendiente de verificación: dos `workflow_dispatch` y `gh pr list` | | ❌ |
| CA-3 | `src/calendar/sync.ts` (`formatSyncDiff(id, diff, now)`, `countUrgent`, `SyncDiff.kickoffs` para `+`/`?`); `tools/calendario-sync.mjs` pone el reloj e imprime `urgentes: N`; título `— N urgentes` en el workflow | `src/calendar/sync.test.ts` › "SPEC-015 CA-3" (eldense-oviedo URGENTE, celta-fortuna-real-sociedad-b sin marca, antela-somozas PASADO, `now = 2026-09-29T11:00:00Z`; bordes de la ventana; `+`/`?`); `cli.test.ts` › "CA-3 the tool puts the clock…"; `deploy.test.ts` › "CA-3 the title…" | | ❌ |
| CA-4 | `src/calendar/sync.ts` (`autoAplicable`); `tools/calendario-sync.mjs` → `GITHUB_OUTPUT auto=si|no`; `.github/workflows/calendario-semanal.yml`: `alias=si|no` en el paso de diff, paso «Fusionar y cargar las reprogramaciones puras» (`gh pr merge "$pr" --merge` + `gh workflow run … -f cargar=si`), `permissions.actions: write` | `sync.test.ts` › "SPEC-015 CA-4 autoAplicable" (9 casos); `cli.test.ts` › "CA-4 only reschedules: auto=si" / "…rename…: auto=no"; `deploy.test.ts` › "CA-4 …" (3 casos). Pendiente de verificación: fila en `calendar_loads` tras una ejecución real | | ❌ |
| CA-5 | Nada que codear: consulta de campo en la jornada 2026-10-09/12 | Pendiente (campo) | | ❌ |
| CA-6 | Ficheros: el workflow, `src/calendar/sync.ts`, `tools/calendario-sync.mjs`, `src/calendar/{sync,cli}.test.ts`, `src/calendar/cli.fake-provider.mjs` (helper de test), `src/arch/deploy.test.ts`. Sin cambios en `src/decide`, `src/ingest`, `supabase/`, `package*.json` | `npm run gates` → exit 0 (734 tests), también con `env -u DATABASE_URL -u API_FOOTBALL_KEY -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u INGEST_TICK_TOKEN` | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

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
