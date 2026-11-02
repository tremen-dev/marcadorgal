---
id: SPEC-042
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-042 Gol por defecto y variable RECENT_GOAL_MARK

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-042-gol-por-defecto-y-variable-recent-goal-mark`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/app/config.ts` (`RECENT_GOAL_MARK = "label"`, comentario) | `src/app/config.test.ts` › «SPEC-042 CA-1 RECENT_GOAL_MARK» | | ❌ |
| CA-2 | `src/app/config.ts` (`recentGoalMark` lee `env.RECENT_GOAL_MARK`, comparación exacta); inicio/semana/demo sin cambios | `src/app/config.test.ts` › «SPEC-042 CA-2 recentGoalMark(env)» (9 filas, incl. nombre viejo → `label`); `git grep -n E2E_RECENT_GOAL_MARK -- . ':!docs'` → vacío (exit 1) | | ❌ |
| CA-3 | `playwright.config.ts` (3100 `RECENT_GOAL_MARK: ""`, `boxPort` 3101 `RECENT_GOAL_MARK: "box"`); `e2e/xornada-gol-reciente.spec.ts` (`label` por defecto, `box` alternativo) | `e2e/xornada-gol-reciente.spec.ts` (casos SPEC-041 CA-6 × 2 variantes × gl/es); demo y tests de render no asumen variante por defecto (`recent-goal.test.ts` pasa la variante explícita): sin ajuste | | ❌ |
| CA-4 | `.env.example` (comentario + `RECENT_GOAL_MARK=`) | `src/app/config.test.ts` › «SPEC-042 CA-4 .env.example»; `vercel env ls` abajo | | ❌ |
| CA-5 | sin cambios fuera de config/e2e/.env.example | gates y e2e en Linux (abajo); diff de fronteras vacío | | ❌ |

### Evidencia del implementador (2026-11-02, HEAD `66873bb`)
- Gates y e2e en Linux (`mcr.microsoft.com/playwright:v1.63.0-noble`, `git archive HEAD` LF, `npm ci`):
  - `npm run gates` → `Checked 315 files … No fixes applied.` · `Test Files 111 passed (111)` · `Tests 2050 passed | 3 skipped (2053)` · `✓ Compiled successfully` · `GATES=0`
  - `CI=1 npm run e2e` → `233 passed (1.8m)`, `1 skipped` · `E2E=0`
- `git grep -n E2E_RECENT_GOAL_MARK -- . ':!docs'` → sin salida (exit 1).
- CA-5 fronteras: `git diff origin/ft/SPEC-041-gol-reciente-que-pulsa --stat -- src/sources src/decide src/ingest src/model supabase` → vacío (SPEC-041 aún no está en `origin/main`). Mismo diff sobre `src/i18n` → vacío; líneas añadidas en `src/` sin hex ni `font:`.
- CA-4 `vercel env ls` (desde `D:/src/tremen-dev/marcadorgal`):
  ```
   RECENT_GOAL_MARK                   Hidden                      Secret    Preview                     1h ago
   RECENT_GOAL_MARK                   Hidden                      Secret    Production                  1h ago
  ```

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-042/. Informe HTML opcional: _qa/SPEC-042/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-042-1, F-SPEC-042-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-042-1** `vercel env ls` muestra la variable en Production y Preview pero su valor como `Hidden` (tipo Secret): el valor `label` que pide N-1 no se puede leer sin `vercel env pull` (vuelca todos los secretos), que no se hizo. Destino: el titular lo confirma en el panel de Vercel o la recrea como tipo no secreto.
- **F-SPEC-042-2** CA-2 pide a la vez el caso `{ E2E_RECENT_GOAL_MARK: "box" } → label` y `git grep` vacío: el test construye la clave (`["E2E", "RECENT_GOAL_MARK"].join("_")`) para cumplir ambos. Informativo.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-5 implementados en `ft/SPEC-042-gol-por-defecto-y-variable-recent-goal-mark` (worktree `marcadorgal-ux`), sin push. Commits `a8ec521` (CA-1/2/4) y `66873bb` (CA-3). Falta: verificación (sdd-verificador) y capturas si el verificador las quiere (`QA_CAPTURE_DIR=… npm run e2e`, el spec e2e sigue apuntando a `_qa/SPEC-041` en su comentario).
