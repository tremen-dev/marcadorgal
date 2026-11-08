---
id: SPEC-063
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-063 Gate de versión en cada PR

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-063-gate-de-version-en-cada-pr`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/version-bump.ts` `checkVersionBump` | `src/lib/version-bump.test.ts` «checkVersionBump (SPEC-063 CA-1)» (sube patch/minor/major, `0.2.9`→`0.2.10`, `0.2.9`→`0.1.10`, inválidos en base y head) | | 🚧 |
| CA-2 | `src/lib/version-bump.ts` `checkLockfile` | `src/lib/version-bump.test.ts` «checkLockfile (SPEC-063 CA-2)» (coherente, raíz desfasada, `packages[""]` desfasado, sin `packages[""]`) | | 🚧 |
| CA-3 | `src/lib/version-bump.ts` `isCalendarOnly` | `src/lib/version-bump.test.ts` «isCalendarOnly (SPEC-063 CA-3)» (calendario, alias, ambos; + `src/x.ts`, + `package.json`, vacía, `data/calendario-old/…`) | | 🚧 |
| CA-4 | `tools/version-gate.mjs` (E/S) + `evaluateGate` en `src/lib/version-bump.ts` | `src/lib/version-bump.test.ts` «evaluateGate (SPEC-063 CA-4 messages)»; ejecuciones locales abajo | | 🚧 |
| CA-5 | `.github/workflows/ci.yml` job `version` | `actionlint` 1.7.7 (docker `rhysd/actionlint:1.7.7 -no-color`) → exit 0 | | 🚧 |
| CA-6 | `CLAUDE.md` viñeta Gates; `.github/pull_request_template.md` | lectura de ambos ficheros | | 🚧 |
| CA-7 | `package.json` + `package-lock.json` 0.2.0→0.2.1 (`npm version patch --no-git-tag-version`) | CLI local exit 0; `npm run gates` exit 0; run del job `version` en la PR: pendiente (tras push) | | 🚧 |

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

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-063/. Informe HTML opcional: _qa/SPEC-063/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-063-1, F-SPEC-063-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-063-1 (pendiente humano, decisión 2026-11-08).** El titular decidió NO marcar el job `version` como required check por ahora. Queda pendiente: ruleset en `main` con `version` obligatorio + bypass para GitHub Actions (bot de `calendario-semanal.yml`) + «Require branches to be up to date». Hasta entonces la carrera entre PR concurrentes solo la detecta el run de `push` a `main`. Configuración de GitHub sin tocar. Destino: acción manual del titular.
- **F-SPEC-063-2.** CA-7 exige el enlace al run verde del job `version` en la PR; solo existe tras el push (lo hace el orquestador). Pendiente de añadir al ledger.
- Nota: `evaluateGate` (pura) concentra los mensajes del CLI para poder testearlos; `tools/version-gate.mjs` solo hace E/S. No amplía alcance.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-7 implementados en `ft/SPEC-063-gate-de-version-en-cada-pr` (sin push). Falta: push + PR, enlazar el run verde del job `version` (F-SPEC-063-2) y verificación. El ruleset de `main` queda para el titular (F-SPEC-063-1).
