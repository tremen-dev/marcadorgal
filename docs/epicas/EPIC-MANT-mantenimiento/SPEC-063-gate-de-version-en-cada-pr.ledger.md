---
id: SPEC-063
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-063 Gate de versión en cada PR

## Resumen
- Fase: hecho <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-063-gate-de-version-en-cada-pr`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/version-bump.ts` `checkVersionBump` | `src/lib/version-bump.test.ts` «checkVersionBump (SPEC-063 CA-1)» (sube patch/minor/major, `0.2.9`→`0.2.10`, `0.2.9`→`0.1.10`, inválidos en base y head) | Vitest local 40/40; módulo sin imports (puro); cubre todos los casos que lista el CA (también `01.2.3`, `0.2`, `v0.2.1`, vacía, en base y head) | ✅ |
| CA-2 | `src/lib/version-bump.ts` `checkLockfile` | `src/lib/version-bump.test.ts` «checkLockfile (SPEC-063 CA-2)» (coherente, raíz desfasada, `packages[""]` desfasado, sin `packages[""]`) | Vitest 40/40; CLI esc. 3 (raíz) y 3b (`packages[""]`) exit=1 nombrando el campo; 3c coherente exit=0 | ✅ |
| CA-3 | `src/lib/version-bump.ts` `isCalendarOnly` | `src/lib/version-bump.test.ts` «isCalendarOnly (SPEC-063 CA-3)» (calendario, alias, ambos; + `src/x.ts`, + `package.json`, vacía, `data/calendario-old/…`) | Vitest 40/40; CLI esc. 2 (calendario) y 2b (+alias) exit=0, 2c (+`package.json`) exit=1. Ver F-SPEC-063-3 (renombrados) | ✅ |
| CA-4 | `tools/version-gate.mjs` (E/S) + `evaluateGate` en `src/lib/version-bump.ts` | `src/lib/version-bump.test.ts` «evaluateGate (SPEC-063 CA-4 messages)»; ejecuciones locales abajo | Re-ejecutada por el verificador (escenarios 1–8 en el veredicto): sin bump exit=1 con base, head y ambas líneas `npm version`; con bump exit=0; solo calendario exit=0; lock incoherente exit=1 | ✅ |
| CA-5 | `.github/workflows/ci.yml` job `version` | `actionlint` 1.7.7 (docker `rhysd/actionlint:1.7.7 -no-color`) → exit 0 | Lectura de `ci.yml`: `fetch-depth: 0`, `.nvmrc`, `timeout-minutes: 5`, base `origin/${{ github.base_ref }}` en PR y `${{ github.event.before }}` en push; sin `continue-on-error`/`\|\| true`. `actionlint` 1.7.7 re-ejecutado → exit 0. `calendario-semanal.yml` intacto | ✅ |
| CA-6 | `CLAUDE.md` viñeta Gates; `.github/pull_request_template.md` | lectura de ambos ficheros | Leídos: viñeta Gates con patch/minor/major, comando y exención; plantilla con la casilla de versión | ✅ |
| CA-7 | `package.json` + `package-lock.json` 0.2.0→0.2.1 (`npm version patch --no-git-tag-version`) | CLI local exit 0; `npm run gates` exit 0; run del job `version` en la PR: pendiente (tras push) | 0.2.1 en los tres campos; CLI `--base origin/main` exit=0; `npm run gates` en Docker sobre 3a25b65 exit=0. Run del job `version` en la PR: pendiente (F-SPEC-063-2) | ⚠️ |

## Evidencia del implementador (CA-4, CA-5, CA-7)
- Sin bump (`ft/SPEC-063` antes del bump): `node tools/version-gate.mjs --base origin/main` → exit=1
  `version-gate: falla — la versión head 0.2.0 no es mayor que la base 0.2.0 (base 0.2.0, head 0.2.0).` + líneas `npm version patch|minor --no-git-tag-version`.
- Con bump (a11cf7d): mismo comando → exit=0 `version-gate: ok — 0.2.0 → 0.2.1, package-lock.json coherente.`
- Solo calendario (worktree detached sobre origin/main + commit en `data/calendario/2026-27/primera-division.json`): → exit=0 `version-gate: exento (solo cambian data/calendario/** o data/alias/**; 1 ficheros).`
- Lock incoherente (mismo worktree, `package.json` a 0.2.1 sin lock): → exit=1 `version-gate: falla — package-lock.json incoherente: version es «0.2.0» y package.json dice 0.2.1.`
- `actionlint` 1.7.7 sobre `.github/workflows/` (4 ficheros) → exit=0, sin salida.
- `npm run gates` en Docker `mcr.microsoft.com/playwright:v1.63.0-noble` sobre `git -c core.autocrlf=false archive HEAD` (a11cf7d): tsc ok; biome 392 ficheros sin errores; vitest 140 ficheros, 2204 passed / 3 skipped; `next build` ok; exit=0.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN con salvedad — 2026-11-09 (sdd-verificador).** CA-1..CA-6 ✅; CA-7 ⚠️ solo por el enlace al run verde del job `version` en la PR, que no existe hasta el push (F-SPEC-063-2). Evidencia propia sobre 3a25b65:
- `npx vitest run src/lib/version-bump.test.ts` → 1 fichero, 40 passed.
- `npm run gates` en Docker `mcr.microsoft.com/playwright:v1.63.0-noble` (Node 24.20.0) sobre `git -c core.autocrlf=false archive HEAD` → Test Files 140 passed, Tests 2204 passed / 3 skipped, `Compiled successfully`, exit=0.
- `docker run rhysd/actionlint:1.7.7 -no-color` sobre `.github/workflows/` (4 ficheros) → exit=0.
- En la rama: `node tools/version-gate.mjs --base origin/main` → exit=0 `ok — 0.2.0 → 0.2.1, package-lock.json coherente.`
- Worktree detached sobre origin/main (37a9772), un commit por escenario, CLI de la rama: (1) `src/` sin bump → exit=1 `la versión head 0.2.0 no es mayor que la base 0.2.0` + líneas patch/minor; (2) solo `data/calendario/` → exit=0 `exento … 1 ficheros`; (2b) calendario+alias → exit=0; (2c) calendario+`package.json` sin bump → exit=1; (3) `package.json` 0.2.1 sin lock → exit=1 `version es «0.2.0»`; (3b) solo raíz del lock → exit=1 `packages[""].version es «0.2.0»`; (3c) coherente → exit=0; (4) 0.1.9 → exit=1; (5) `0.3.0-rc.1` → exit=1 `no es MAJOR.MINOR.PATCH`; (6) renombrado `src/lib/…`→`data/calendario/moved.ts` → exit=0 (F-SPEC-063-3); (7) `--base <sha previo>` (semántica push) → exit=0; (8) `--base 0000…` → exit=1 `no se pudo leer la base`; ref inexistente → exit=1; sin `--base` → exit=2.
- CI: en `pull_request` el checkout es el merge ref y `fetch-depth: 0` trae `origin/<base>`; en `push` a main `event.before` es el main previo. El bot no dispara `ci` (PR y fusión con `GITHUB_TOKEN`); si un humano fusiona su PR, el run de `push` sale exento por diff. `calendario-semanal.yml` no cambia.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-063/. Informe HTML opcional: _qa/SPEC-063/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-063-1, F-SPEC-063-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-063-1 (pendiente humano, decisión 2026-11-08).** El titular decidió NO marcar el job `version` como required check por ahora. Queda pendiente: ruleset en `main` con `version` obligatorio + bypass para GitHub Actions (bot de `calendario-semanal.yml`) + «Require branches to be up to date». Hasta entonces la carrera entre PR concurrentes solo la detecta el run de `push` a `main`. Configuración de GitHub sin tocar. Destino: acción manual del titular.
- **F-SPEC-063-2.** CA-7 exige el enlace al run verde del job `version` en la PR; solo existe tras el push (lo hace el orquestador). Pendiente de añadir al ledger.
- **F-SPEC-063-3 (verificador, menor).** `git diff --name-only` detecta renombrados por defecto y lista solo el destino: mover `src/lib/X.ts` a `data/calendario/` sale exento (escenario 6, exit=0). Cumple la letra de CA-4 pero no la intención de CA-3 («todas las rutas cambiadas»). Arreglo propuesto: `--no-renames` en `tools/version-gate.mjs:27` (y en el guard de fusión de `calendario-semanal.yml`). Destino: EPIC-MANT, enmienda o spec futura por sdd-arquitecto.
- Nota: `evaluateGate` (pura) concentra los mensajes del CLI para poder testearlos; `tools/version-gate.mjs` solo hace E/S. No amplía alcance.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-7 implementados en `ft/SPEC-063-gate-de-version-en-cada-pr` (sin push). Falta: push + PR, enlazar el run verde del job `version` (F-SPEC-063-2) y verificación. El ruleset de `main` queda para el titular (F-SPEC-063-1).
