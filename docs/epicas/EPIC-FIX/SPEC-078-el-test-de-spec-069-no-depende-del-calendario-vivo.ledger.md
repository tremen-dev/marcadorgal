---
id: SPEC-078
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-078 El test de SPEC-069 no depende del calendario vivo

## Resumen
- Fase: borrador
- Rama: `ft/SPEC-078-test-spec069-sin-calendario-vivo`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/fixtures/calendario-2026-27/*.json` (5), `fixtures/alias-2026-27-rfef.json` (copias de 197ee71, blobs idénticos), `fixtures/README.md` §SPEC-078, `explorer.test.ts` (const `FROZEN`) | `explorer.test.ts` › «SPEC-078 … this file reads neither the live calendar nor the live alias» (rojo antes del cambio, verde después) | | 🚧 |
| CA-2 | `explorer.test.ts`: solo el comentario del `it` «CA-2 all its observations come out…» (+3 líneas) | ese mismo caso, aserciones intactas | | 🚧 |
| CA-3 | sin código: demostración abajo | `npx vitest run src/sources/rfef/explorer.test.ts` con `data/` perturbado → 74/74 | | 🚧 |
| CA-4 | `package.json`/`package-lock.json` 0.5.7 → 0.5.8 | `npm run gates` (abajo) | | 🚧 |

### Evidencia del implementador (2026-11-10)
- **CA-1** copias: `git show 197ee71:data/calendario/2026-27/<c>.json > fixtures/calendario-2026-27/<c>.json` y `git show 197ee71:data/alias/2026-27/rfef.json > fixtures/alias-2026-27-rfef.json`; `git hash-object` de cada copia = `git rev-parse 197ee71:<origen>` (6 de 6). Las Palmas–Eldense J13: congelado `2026-11-08T17:30:00Z`, vivo `2026-11-09T19:30:00Z`.
- **CA-3** (a) kickoff de Las Palmas–Eldense J13 en `data/calendario/2026-27/segunda-division.json` → `2027-01-01T12:00:00Z` y borradas de `data/alias/2026-27/rfef.json` 5 entradas usadas por el fixture (`ud las palmas`, `unión deportiva las palmas, s.a.d.`, `ce sabadell`, `ce sabadell fc`, `sabadell`; 183 → 178): `Tests 74 passed (74)`. (b) además `matches: []` en `segunda-division.json` (−2799 líneas): `Tests 74 passed (74)`. Restaurado: `git checkout -- data/calendario/2026-27/segunda-division.json data/alias/2026-27/rfef.json`; `git status --short -- data/` vacío. Con el calendario actual de `main` sin tocar: 74/74.
- **CA-4** `npm run gates` → exit 1 por el único fallo tolerado: `FAIL src/db/test-db.test.ts > SPEC-022 CA-1 … > wins over a .env file in the cwd too` (Windows local); `Test Files 1 failed | 158 passed (159)`, `Tests 1 failed | 2626 passed | 3 skipped`. Typecheck y lint (`Checked 450 files … No fixes applied`) en verde; `npm run build` aparte → exit 0. Cambios solo en `src/sources/rfef/explorer.test.ts`, `src/sources/rfef/fixtures/**`, `package*.json` y docs de la spec.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-078/. Informe HTML opcional: _qa/SPEC-078/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-078-1, F-SPEC-078-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-078-1** (EPIC-MEJORA): otras suites leen `data/calendario/**` vivo (`src/sources/rfef/adapter.test.ts`, `alias.test.ts`, `src/calendar/sync-rfef.test.ts`, `src/social/text.test.ts`, `src/arch/*`). Auditar cuáles deberían congelarlo.
- **F-SPEC-078-2** (EPIC-FIX): el CI del PR del bot (`chore/calendario`, run 42821507457) falla en 1 s por un problema del workflow y no corre los gates. Así entró este rojo en `main`.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-4 implementados en `ft/SPEC-078-test-spec069-sin-calendario-vivo`; spec en `en-revision`. Falta la verificación (sdd-verificador) y el PR. Sin push.
