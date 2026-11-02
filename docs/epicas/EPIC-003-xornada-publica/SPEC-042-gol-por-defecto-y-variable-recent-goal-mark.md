---
id: SPEC-042
tipo: spec
epica: EPIC-003
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-02, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-02, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-02, por: sdd-implementador}
---
# SPEC-042 — Gol por defecto y variable RECENT_GOAL_MARK

## Problema
SPEC-041 (hecho) dejó dos variantes de la marca de gol reciente, `box` por
defecto y `label` (pastilla «GOL»), y una variable `E2E_RECENT_GOAL_MARK`
pensada solo para el segundo servidor de e2e que, de hecho, producción también
honra (F-SPEC-041-2, V-3). El recuadro `box` es casi imperceptible en oscuro y
desaparece en `forced-colors` (V-4). El titular (Alberto Fojo, 2026-11-02)
decide: por defecto `label`, y la variable pasa a llamarse `RECENT_GOAL_MARK` y
es configuración legítima de producción. Ya existe en Vercel (Production y
Preview) con valor `label`.

## Usuarios / roles afectados
- Público (gl/es, móvil y escritorio): ve la pastilla «GOL» en vez del recuadro.
- Titular/operador: cambia la variante con una variable de entorno y un redeploy, sin PR.

## Criterios de aceptación
Solo cambian `src/app/config.ts`, su test, `playwright.config.ts`, los e2e de
SPEC-041, `.env.example` y, si asumen `box`, la demo y los tests de pantalla.
- **CA-1 Por defecto `label`.** `RECENT_GOAL_MARK` de `src/app/config.ts` vale `"label"` (el comentario lo dice). `config.test.ts`: el valor está en `RECENT_GOAL_MARKS` y es `"label"`.
- **CA-2 Variable `RECENT_GOAL_MARK`.** `recentGoalMark(env)` lee `env.RECENT_GOAL_MARK`. Test de tabla: `"box"` → `box`; `"label"` → `label`; sin la clave, `""`, `"pulse"`, `"Box"` y `" box"` → `label` (comparación exacta, sin recortar ni pasar a minúsculas); `{ E2E_RECENT_GOAL_MARK: "box" }` → `label` (el nombre viejo ya no cuenta). `git grep -n E2E_RECENT_GOAL_MARK -- . ':!docs'` vacío. Las tres páginas que hoy llaman a `recentGoalMark(process.env)` (inicio, semana, demo) siguen haciéndolo: en producción la variante la da la variable.
- **CA-3 E2e con la variante por defecto y la alternativa.** `playwright.config.ts`: el primer servidor (3100) arranca con `RECENT_GOAL_MARK: ""` (variante por defecto, `label`) y el segundo con `RECENT_GOAL_MARK: "box"`; nombres de puerto y comentarios sin «label» como alternativa. `e2e/xornada-gol-reciente.spec.ts` recorre `label` en el servidor por defecto y `box` en el alternativo, con los mismos casos de SPEC-041 CA-6 (incluida «en `box`, la fila mide lo mismo con y sin marca») y todos en verde. La demo y los tests de render no asumen una variante por defecto: si alguno lo hace, se ajusta y lo anota el ledger.
- **CA-4 Documentación.** `.env.example` gana la línea `RECENT_GOAL_MARK=` (sin valor), precedida de un comentario: valores `box` | `label`, vacía o inválida → `label`, puesta en Vercel en Production y Preview. Test en `config.test.ts` (patrón de SPEC-020 CA-3): `.env.example` contiene `^RECENT_GOAL_MARK=$` y no contiene `E2E_RECENT_GOAL_MARK`. Ledger: salida de `vercel env ls` con `RECENT_GOAL_MARK` en Production y Preview.
- **CA-5 Gates y fronteras.** `npm run gates` y `npm run e2e` en verde. `git diff ft/SPEC-041-gol-reciente-que-pulsa --stat -- src/sources src/decide src/ingest src/model supabase` vacío (contra `origin/main` si SPEC-041 ya está mergeada). Sin hex ni `font:` nuevos; i18n sin cambios.

## Entidades y reglas afectadas
SPEC-041 CA-3/CA-4/CA-6 (variantes, configuración, e2e; F-SPEC-041-2 y V-3/V-4
de su ledger), SPEC-034 CA-5 (patrón de `config.ts`), SPEC-020 CA-3 (patrón de
`.env.example`), ADR-022 (sin cambios: no fija variante), ADR-005 (sin color de
estado), D-8.

## Fuera de alcance
Elegir la variante por competición o por usuario; cambiar `RECENT_GOAL_MINUTES`;
rediseñar `box` o `label` (revisión de diseño de F-SPEC-041-7, aparte); dos
builds de e2e.

## Notas para el gate humano
- **Decisión del titular (Alberto Fojo, 2026-11-02):** por defecto `label`; la variable se llama `RECENT_GOAL_MARK` y producción la lee a propósito (resuelve F-SPEC-041-2/V-3). Sin ADR: es configuración de presentación, global, que no constriñe datos ni fronteras.
- **N-1 Lectura en tiempo de render.** La variante se toma al renderizar en el servidor; en páginas con ISR un cambio de la variable se ve tras redeploy o revalidación, no al instante. Valor inválido en Vercel → `label` sin error: el ledger debe mostrar el valor real con `vercel env ls`.
- **N-2 Orden.** Va encima de SPEC-041 (PR #85). Si SPEC-041 se despliega sola, producción muestra `box` (su código lee el nombre viejo); con SPEC-042, `label`.
