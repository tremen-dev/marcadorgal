---
id: SPEC-068
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-068 Goleadores colgados de su equipo en la fila de partido

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-068-goleadores-colgados-de-su-equipo` (worktree `D:\src\tremen-dev\wt-068`, desde `origin/main` 6148242)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/components/goals/TeamGoals.tsx` (bloque `team-goals` por lado, `id=goals-{matchId}-{side}`, nulo sin goles); `src/components/xornada/MatchRow.tsx` (bloques dentro de `.sides` tras cada marcador; sin `match-goals` ni emoji) | Vitest `src/components/xornada/goals.test.ts` › «SPEC-068 CA-1» (3 casos: orden en `.sides`, sin bloque para equipo sin goles, sin ⚽/`match-goals`/nombre repetido); Playwright `e2e/xornada-goleadores.spec.ts` › «CA-1» (gl/es × 360/1440: bloque local entre nombres, visitante bajo el suyo, `border-top-width: 0px` en todo el bloque) | | |
| CA-2 | `TeamGoals.tsx` (`sortGoals` estable por minuto; `goal-minute` «{minute}'» antes de `goal-player`); `src/components/goals/TeamGoals.module.css` (`.minute` mono 4ch derecha tabular `--fg-muted`; `.player` sans `--fg-muted`, `line-height: 16px` ambos, baseline) | Vitest `goals.test.ts` › «SPEC-068 CA-2» (2 casos: minuto delante y nombre tal cual; orden por minuto con empate en orden de llegada); Playwright `xornada-goleadores.spec.ts` › «CA-2» (mono/tabular/`--fg-muted`/derecha, mismo ancho y borde derecho de los `goal-minute`, nombre largo parte a 360 px con minuto en la primera línea ±1 px, sin desbordar) | | |
| CA-3 | `src/i18n/gl.ts`, `src/i18n/es.ts` (`xornada.goalPenalty`, `xornada.goalOwnGoal`); `TeamGoals.tsx` (`goal-kind` tras el nombre); `TeamGoals.module.css` (`.kind` `--fg-muted`, `font-style: normal`) | Vitest `goals.test.ts` › «SPEC-068 CA-3» (gl y es, texto de las claves, orden tras `goal-player`, nombre intacto); Playwright `xornada-goleadores.spec.ts` › «CA-3» (color computado `--fg-muted`, `font-style: normal`) | | |
| CA-4 | `TeamGoals.tsx` (prop `recent {until, now}`; solo la última línea tras ordenar lleva `data-recent="true"` y `recent-scorer-badge` con `animationIterationCount = pulseIterations`); `MatchRow.tsx` (pasa `recent[side]` con el reloj `clock` de `watchRecentGoal`); `TeamGoals.module.css` (`.line[data-recent="true"] .player` en `--fg`; `.badge` con `recent-scorer-pulse`, `prefers-reduced-motion` → `animation-name: none`) | Vitest `goals.test.ts` › «SPEC-068 CA-4» (2 casos: solo la última por minuto aunque llegue desordenada, pastilla tras el nombre, iteraciones; nada sin reciente o vencido); Playwright `xornada-goleadores.spec.ts` › «CA-4» (nombre en `--fg`, pastilla GOL animada, iteraciones ≈ segundos restantes, deja de marcarse al vencer `until` con `page.clock` y sin peticiones; «reduced motion» sin animación) | | |
| CA-5 | `MatchRow.tsx` (`aria-controls` con los ids presentes en orden DOM; `handleToggle` sin la exclusión del cajón: cualquier clic conmuta; `role/tabIndex/aria-expanded/aria-label` y Enter/Espacio como SPEC-056); `TeamGoals.module.css` (`.folded` `grid-template-rows: 0fr` → `.expanded` `1fr` con transición; `.clip`) | Vitest `goals.test.ts` › «SPEC-068 CA-5» (servido `data-expanded="false"`, `aria-controls` lista y cada id único; solo visitante → solo su id) y «SPEC-056 kept» (fila sin goles sin atributos); Playwright `xornada-goleadores.spec.ts` › «CA-5» (alto 0 y `grid-template-rows: 0px` servidos, `transition-property` con `grid-template-rows`, cada id resuelve a 1 elemento, clic/Enter/Espacio conmutan ambos bloques a la vez, clic sobre un `goal-line` pliega, fila sin goles no gana nada) | | |
| CA-6 | `src/components/xornada/Xornada.module.css` (`.sides` sin `row-gap`; `.awaySide` `margin-top: 3px` en nombre y marcador visitantes); `MatchRow.tsx` (clase `awaySide`); `TeamGoals.module.css` (padding dentro de `.clip`, bloque plegado mide 0) | Playwright `xornada-goleadores.spec.ts` › «CA-6 label/box × 360/1440» (alto de la fila y `offsetTop` de los dos nombres y los dos marcadores idénticos con los bloques en `display: none`, puertos 3100 y 3101); e2e existentes sin tocar: `npm run e2e` completo (ver evidencia) | | |
| CA-7 | `src/components/directos/DirectosView.tsx` (`TeamGoals` bajo cada `teamLine`, sin `expanded`); `src/components/directos/DirectosView.module.css` (fuera `goalsBox`, `goalItem`, `goalPenalty`) | Vitest `src/components/directos/DirectosView.test.ts` › «SPEC-068 CA-7» (3 casos: bloques bajo su `teamLine` sin `data-expanded` ni `role=button`; HTML de cada `goal-line` idéntico al de `MatchRow` en gl y es; sin ⚽, `match-goals` ni clases antiguas) | | |
| CA-8 | `src/xornada/demo.ts` (`demoMatch(..., goals)`; Betis 2–1 Depor con penalti, p.p. y nombre de 45 caracteres; Celta 1–0 Madrid; Oviedo 0–1 Sporting (reciente visitante); Bilbao Athletic 1–0 Ourense (reciente local, un solo equipo); el resto sin `goals`) | Vitest `src/xornada/demo.test.ts` › «SPEC-068 CA-8» (6 casos: coherencia goles↔marcador por lado, finished con ambos lados + penalti + p.p., un solo lado, nombre ≥ 40 caracteres, goleador de la fila live reciente, filas sin goles con marcador) | | |
| CA-9 | `Xornada.module.css` y `DirectosView.module.css` sin las clases antiguas; sin hex ni `font:` en los CSS nuevos (tokens vía variables) | Vitest `goals.test.ts` › «SPEC-068 CA-9» (ninguna clase antigua en los tres CSS); `src/design/fonts.test.ts` y reglas existentes de hex/`font:`; `npm run gates` y `npm run e2e` (ver evidencia) | | |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-068/. Informe HTML opcional: _qa/SPEC-068/informe.html -->

## Evidencia del implementador (2026-11-09, Windows 11, Node 22.19, sin Docker)
- `npm run gates`: typecheck OK; `biome check .` «Checked 404 files. No fixes applied.»; `vitest run` → `Test Files 1 failed | 141 passed (142)`, `Tests 1 failed | 2313 passed | 3 skipped (2317)`. El único fallo es `src/db/test-db.test.ts › SPEC-022 CA-1 › wins over a .env file in the cwd too` (`expected 1 to be +0`): el test monta `PATH` con `:` (POSIX) y en Windows no encuentra los shims. **Preexistente**: reproducido en `origin/main` (6148242) sin mis cambios con `git checkout --detach origin/main && npx vitest run src/db/test-db.test.ts` → `Tests 1 failed | 10 passed (11)`, el mismo caso. Como `gates` encadena con `&&`, `npm run build` se lanzó aparte: `✓ Compiled successfully`, `✓ Generating static pages (9/9)`, exit 0.
- `npx playwright test e2e/xornada-goleadores.spec.ts`: 25 passed (gl/es × 360/1440 × CA-1..CA-5, CA-6 label/box × 360/1440, reduced motion).
- `npm run e2e` completo (1.ª vez, con la lista de goles en `<ul>`): `277 passed, 22 failed, 1 skipped (6.6m)`. 17 fallos eran `xornada-lectura.spec.ts` (`expect(seen[id].lists).toBe(1)` → `Received: 4`: el e2e de SPEC-033 cuenta un solo `<ul>` por competición), corregido en f55fbaa (`ul`/`li` → `div`). Los otros 5 (3 `xornada-provisional` «without JS», 1 `xornada-gol-reciente` «without JS», 1 `xornada-goleadores` CA-4 es/360) pasan aislados: `npx playwright test e2e/xornada-provisional.spec.ts e2e/xornada-gol-reciente.spec.ts -g "without JS"` → `8 passed (56.7s)`; carga de la máquina en el run completo.
- `npm run e2e` completo (2.ª vez, tras f55fbaa): **interrumpido por Claude Code por falta de memoria del sistema** a mitad del run; no se relanzó por indicación del entorno. Comprobación acotada del fix: `npx playwright test e2e/xornada-lectura.spec.ts e2e/xornada-goleadores.spec.ts --workers=2` → `53 passed (1.6m)`. **Pendiente un `npm run e2e` completo en verde** (verificador o CI).

## Salvedades / follow-ups
<!-- IDs F-SPEC-068-1, F-SPEC-068-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-068-1** (EPIC-MANT): `src/db/test-db.test.ts` «wins over a .env file in the cwd too» falla en Windows por el separador de `PATH` (`:`); verde en CI (Linux). Hace que `npm run gates` no llegue a `build` en Windows sin Docker. Fuera del alcance de esta spec.
- **F-SPEC-068-2** (nota, no defecto): `data-recent` se emite siempre en cada `goal-line` (`"true"`/`"false"`), también en `/directos` (siempre `"false"`), para que el HTML de `goal-line` sea idéntico en las dos vistas (CA-7). La spec no fijaba si el atributo ausente valía como «no reciente».
- **F-SPEC-068-3** (nota): el minuto y el nombre van en `line-height: 16px` y `align-items: baseline` (no en la métrica 1.4 de la maqueta) para que el borde superior de ambos coincida (CA-2, ±1 px) con fuentes distintas.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- **Hecho:** CA-1..CA-9 implementados con test en la rama `ft/SPEC-068-goleadores-colgados-de-su-equipo` (worktree `D:\src\tremen-dev\wt-068`), versión 0.4.0. Commits: b9011c0 (en-progreso), 2b82dcf (CA-1), 8780838 (CA-2), 9639aee (CA-3), c5a8549 (CA-4), 0c8d7d1 (limpieza imports), 97c6b6d (CA-7), e67bb4c (CA-8), 94e7ded (CA-5/6/9 + e2e), 73a6e85 (0.4.0), f55fbaa (lista en div).
- **Falta (verificador):** `npm run e2e` completo en verde en una máquina con memoria (o CI); en Windows, `npm run gates` se corta en F-SPEC-068-1, así que `build` va aparte. Capturas de `_qa/SPEC-068/` sin hacer (no las pide la spec al implementador).
- **Dónde mirar:** `src/components/goals/TeamGoals.tsx` + `.module.css` (componente compartido), `MatchRow.tsx` (`controls`, `goals(side)`, `awaySide`), `Xornada.module.css` (`.sides` sin `row-gap`), `DirectosView.tsx`, `demo.ts` (goles), `e2e/xornada-goleadores.spec.ts`.
- Sin push ni PR: los hace el orquestador tras la verificación.
