---
id: SPEC-042
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-042 Gol por defecto y variable RECENT_GOAL_MARK

## Resumen
- Fase: hecho <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-042-gol-por-defecto-y-variable-recent-goal-mark`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/app/config.ts` (`RECENT_GOAL_MARK = "label"`, comentario) | `src/app/config.test.ts` › «SPEC-042 CA-1 RECENT_GOAL_MARK» | config.test CA-1 verde en Linux; `config.ts:16` `"label"` con comentario | ✅ |
| CA-2 | `src/app/config.ts` (`recentGoalMark` lee `env.RECENT_GOAL_MARK`, comparación exacta); inicio/semana/demo sin cambios | `src/app/config.test.ts` › «SPEC-042 CA-2 recentGoalMark(env)» (9 filas, incl. nombre viejo → `label`); `git grep -n E2E_RECENT_GOAL_MARK -- . ':!docs'` → vacío (exit 1) | tabla de 9 filas verde; `git grep` vacío (exit 1); inicio/semana/demo llaman `recentGoalMark(process.env)` | ✅ |
| CA-3 | `playwright.config.ts` (3100 `RECENT_GOAL_MARK: ""`, `boxPort` 3101 `RECENT_GOAL_MARK: "box"`); `e2e/xornada-gol-reciente.spec.ts` (`label` por defecto, `box` alternativo) | `e2e/xornada-gol-reciente.spec.ts` (casos SPEC-041 CA-6 × 2 variantes × gl/es); demo y tests de render no asumen variante por defecto (`recent-goal.test.ts` pasa la variante explícita): sin ajuste | e2e Linux verde; servidor por defecto → «GOL» ×2, `RECENT_GOAL_MARK=box` → 0 «GOL» (capturas) | ✅ |
| CA-4 | `.env.example` (comentario + `RECENT_GOAL_MARK=`) | `src/app/config.test.ts` › «SPEC-042 CA-4 .env.example»; `vercel env ls` abajo | test `.env.example` verde; `vercel env ls` del implementador lista Production y Preview (ver F-SPEC-042-1) | ✅ |
| CA-5 | sin cambios fuera de config/e2e/.env.example | gates y e2e en Linux (abajo); diff de fronteras vacío | gates/e2e Linux verdes; fronteras e i18n vacíos vs `origin/main`; sin hex ni `font:` | ✅ |

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
**GREEN — 2026-11-02, sdd-verificador, HEAD `e945035` (origin/main fusionado).**
- Linux `mcr.microsoft.com/playwright:v1.63.0-noble`, `git -c core.autocrlf=false archive HEAD` (LF) copiado dentro, `npm ci`:
  `npm run gates` → `Checked 315 files … No fixes applied.` · `Test Files 111 passed (111)` · `Tests 2050 passed | 3 skipped (2053)` · `✓ Compiled successfully` · `GATES=0`; `CI=1 npm run e2e` → `233 passed (1.8m)`, `1 skipped` · `E2E=0`.
- `git grep -n E2E_RECENT_GOAL_MARK -- . ':!docs'` → vacío. `git diff origin/main...HEAD --stat -- src/sources src/decide src/ingest src/model supabase src/i18n` → vacío. Líneas `+` en `src/` sin hex ni `font:`.
- Diff fuera de la lista de CA: solo docs (ADR-014 referencia cruzada, ADR-022 estado/relación, SPEC-020 N-6), sin código.
- UI real (build local, `next start` con `DATABASE_URL_PUBLIC=` y `RECENT_GOAL_MARK=` / `=box`), `reducedMotion: reduce`, claro y oscuro: `label` muestra «GOL» en las 2 cifras marcadas (Sporting, Bilbao Athletic), `box` 0 «GOL» y recuadro; `animation-name: none` con movimiento reducido; `scrollWidth` = viewport en 390 y 1440; con `forced-colors: active` la pastilla «GOL» sigue visible.
- CA-4: el texto del CA pide `vercel env ls` con la variable en Production y Preview, y está. El valor (N-1) no es legible (Secret/Hidden): queda como salvedad para el titular (F-SPEC-042-1), no bloquea: cualquier valor distinto de `box` exacto da `label`.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-042/. Informe HTML opcional: _qa/SPEC-042/informe.html -->
Carpeta `docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-042/verificador/` (movimiento reducido).
| CA | Captura |
|---|---|
| CA-1/CA-3 `label` por defecto | `label-{gl,es}-{390,1440}-{light,dark}.png` |
| CA-3 `box` alternativo | `box-{gl,es}-{390,1440}-{light,dark}.png` |
| CA-3 `label` en forced-colors | `label-gl-390-forced-colors.png` |

## Salvedades / follow-ups
<!-- IDs F-SPEC-042-1, F-SPEC-042-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-042-1** `vercel env ls` muestra la variable en Production y Preview pero su valor como `Hidden` (tipo Secret): el valor `label` que pide N-1 no se puede leer sin `vercel env pull` (vuelca todos los secretos), que no se hizo. Destino: el titular lo confirma en el panel de Vercel o la recrea como tipo no secreto.
- **F-SPEC-042-2** CA-2 pide a la vez el caso `{ E2E_RECENT_GOAL_MARK: "box" } → label` y `git grep` vacío: el test construye la clave (`["E2E", "RECENT_GOAL_MARK"].join("_")`) para cumplir ambos. Informativo.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-5 implementados en `ft/SPEC-042-gol-por-defecto-y-variable-recent-goal-mark` (worktree `marcadorgal-ux`), sin push. Commits `a8ec521` (CA-1/2/4) y `66873bb` (CA-3). Falta: verificación (sdd-verificador) y capturas si el verificador las quiere (`QA_CAPTURE_DIR=… npm run e2e`, el spec e2e sigue apuntando a `_qa/SPEC-041` en su comentario).
