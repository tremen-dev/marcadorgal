---
id: SPEC-080
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-080 El test de test-db usa el separador de PATH de la plataforma

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-080-test-db-path-delimiter-windows`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/db/test-db.test.ts:211`: `PATH` con `path.delimiter`; aserciones y escenario intactos (diff de 1 línea, c035996) | `src/db/test-db.test.ts` › «SPEC-022 CA-1 … › wins over a .env file in the cwd too» | | ❌ |
| CA-2 | (lo da CA-1) | Windows antes: 1 failed / 10 passed (11), `expected 1 to be +0` → `_qa/SPEC-080/ca2-antes-windows.txt`; después: 11 passed (11) → `_qa/SPEC-080/ca2-despues-windows.txt`. Run CI Linux: pendiente del PR | | ❌ |
| CA-3 | Sin otros `:` fijos: el grep solo da las líneas 43, 167 y 211, todas con `path.delimiter`; a 5d94776 solo la 211 llevaba `:` | `git grep` de la spec (HEAD y 5d94776) + búsqueda de `}:${` en src/tools/scripts (exit 1, sin coincidencias) → `_qa/SPEC-080/ca3-git-grep.txt` | | ❌ |
| CA-4 | `package.json`/`package-lock.json` 0.8.1 → 0.8.2 (`npm version patch --no-git-tag-version`); diff vs origin/main: solo el test, package*.json y docs | `version-gate` ok → `_qa/SPEC-080/ca4-version-gate.txt`; tsc exit 0 → `_qa/SPEC-080/ca4-typecheck.txt`; biome exit 0 (471 ficheros) → `_qa/SPEC-080/ca4-lint.txt`; vitest completo Windows: 167 files, 2789 passed / 3 skipped / 0 failed → `_qa/SPEC-080/ca4-vitest-completo-windows.txt`. `next build` no corre en el worktree (junction de node_modules + Turbopack): lo cubre `gates` en el CI del PR | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-080/. Informe HTML opcional: _qa/SPEC-080/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-080-1, F-SPEC-080-2… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho (2026-11-10, sdd-implementador): fix de 1 línea en `src/db/test-db.test.ts:211`, versión 0.8.2, evidencia Windows en `_qa/SPEC-080/`. Spec en `en-revision`.
- Diagnóstico confirmado: antes 1 fallo, después 0, sin tocar código de producción.
- Falta: push + PR (orquestador), anotar el id del run de CI Linux (`gates`) en CA-2/CA-4, verificación.
- No cubierto en local: `next build` (junction + Turbopack en el worktree); `npm run gates` completo solo en CI.
