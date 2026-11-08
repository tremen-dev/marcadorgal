---
id: SPEC-065
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-065 Identidad celeste: tokens, wordmark con bloque dibujado e icono de barra sola

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-065-identidad-celeste-y-redes`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/design/tokens.ts` (brand/brandDeep/brandInk, `victory`), `src/design/tokens.css` (regenerado), `docs/diseno/_tokens.css` | `src/design/identity.test.ts` «SPEC-065 CA-1 tokens» (valores, contrastes ≥ 4.5, bg/victoria 8.53, regla `background: var(--marca)` sin `color: var(--fg)`); `parity.test.ts`; `tokens.test.ts` (18 claves) | identity.test.ts CA-1 verde (Win `vitest run src/design/` 183/183; Docker gates). `tokens.css`/`_tokens.css` leídos: tres hex + `--victoria:#4CC38A` | ✅ |
| CA-2 | `src/components/competition/StandingsTable.module.css` (única `var(--victoria)`) | `identity.test.ts` «CA-2» (git grep vacío, `var(--victoria)` solo en StandingsTable, ni Wordmark/icon/social/tools usan victory); `manifest.test.ts`/`metadata.test.ts` sin cambio | `git grep -i -E "56DB8F\|35C177\|04160C" -- src tools public` → exit 1 (vacío); `var(--victoria)` solo en StandingsTable (+ definición en tokens) | ✅ |
| CA-3 | `src/components/brand/Wordmark.tsx` + `.module.css` (`.block`), `XornadaHeader.tsx`, `Footer.tsx`; fuera `.mark` de cabecera y `.brandMark`; glifo fuera de `tools/og-image.mjs`/`twitter-assets.mjs` (bloque CSS, sin regenerar PNG) | `identity.test.ts` «CA-3»; `e2e/identidade-celeste.spec.ts` «CA-3» (`/`, `/es`, `/demo/xornada`, `/es/demo/xornada` × 360/1440) | e2e Docker «SPEC-065 CA-3» 8/8 verdes (`/`,`/es`,`/demo/xornada`,`/es/demo/xornada` × 360/1440: ratios 0.30/0.72/0.095, `rgb(0, 153, 204)`, nombre accesible, 800 y tracking); `git grep ▮ -- src tools` vacío; capturas `_qa/SPEC-065/verif/ca3-*` | ✅ |
| CA-4 | `src/design/icon.ts` (`variant`), `public/{favicon.ico,icon-32,apple-touch-icon,icon-192,icon-512}.png` (`node tools/icons.mjs`) | `src/design/icon.test.ts` «SPEC-065 CA-4»; capturas `_qa/SPEC-065/ca4-iconas-{antes,despois}.png` | icon.test.ts verde; mutación: `apple-touch-icon.png` de 9a4c9f7 → `× the centre is --marca…` (discrimina); `ca4-iconas-despois.png` revisada (barra sola 16/32/180/512) | ✅ |
| CA-5 | `docs/diseno/Marca.dc.html`, `*.tpl.html` + `.dc.html` (`node build.mjs`), `Componentes.dc.html`, `Main.dc.html`, `HERENCIA.md` | `identity.test.ts` «CA-5» | identity.test.ts CA-5 verde; `git grep` de los hex viejos (incl. `86, 219, 143`) en `docs/diseno/`: solo `Marca.dc.html` dentro de `data-historia` (9) y el monolito; HERENCIA.md con entrada 2026-11-08 | ✅ |
| CA-6 | (tokens) | `e2e/identidade-celeste.spec.ts` «CA-6»; `e2e/xornada-live.spec.ts` (Celta en `rgb(0, 153, 204)`); capturas `_qa/SPEC-065/ca6-{antes,despois}_*` | e2e Docker «CA-6» 8/8 verdes; `xornada-live.spec.ts` Celta `rgb(0, 153, 204)` verde. «Competición activa» probada en `CompetitionNav` (`/directos`), único relleno de marca de competición (`.categoryActive`); `/demo/xornada` no lo pinta (F-SPEC-065-2) | ⚠️ |
| CA-7 | `StandingsTable.module.css` `.formW`; `e2e/fixtures/explorer-mock.mjs` + `explorer-standings.json`; `playwright.config.ts` (puertos 3102/3103) | `e2e/identidade-celeste.spec.ts` «CA-7» (`/clasificacion/primera-rfef-g1`, gl/es × 360/1440) | e2e Docker «CA-7» 4/4 verdes (V/W `rgb(76, 195, 138)` + `rgb(17, 17, 16)`, D/L sin cambio); captura `_qa/SPEC-065/verif/ca7-1440.png` revisada | ✅ |
| CA-8 | — | ver «Evidencia de gates» | gates y e2e verdes (ver «Evidencia del verificador»); diff `origin/main...HEAD` en rutas vedadas vacío. `e2e:db` NO re-ejecutado por restricción del titular: rojo preexistente `xornada-nav.db.spec.ts:103` (×2) también en 5918431 (F-SPEC-065-5) | ⚠️ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN** (sdd-verificador, 2026-11-09, HEAD 26dae05). CA-1..CA-5 y CA-7 ✅; CA-6 y CA-8 ⚠️ con salvedad aceptada:
- CA-6 (F-SPEC-065-2): la «competición activa» con relleno de marca solo existe en `CompetitionNav.categoryActive`; probarla en `/directos` cumple la intención (relleno celeste + tinta) y `/demo/xornada` cubre día, gallego/perdedor y directo.
- CA-8 (F-SPEC-065-5): `e2e:db` no re-ejecutado por restricción de recursos del titular; sus 2 fallos son preexistentes en la base 5918431 según la evidencia del implementador, en un caso (`heads.nth(1).click()`) que no toca la marca.
- F-SPEC-065-1/3/4 aceptadas (F-1 la cierra SPEC-064). Observación no bloqueante: ADR-005 aún no lleva la nota «cláusula del verde enmendada por ADR-029» que pide ADR-029 §6 (tarea de sdd-arquitecto/documentalista).

## Evidencia del verificador (2026-11-09)
- Docker `mcr.microsoft.com/playwright:v1.63.0-noble`, un contenedor `--rm`, `git archive` de 26dae05, `npm ci` → `npm run gates`: `Checked 399 files … No fixes applied` · `Test Files 141 passed (141) · Tests 2244 passed | 3 skipped` · `✓ Compiled successfully` · `gates exit 0`.
- Mismo contenedor, `CI=1 npm run e2e -- --reporter=list`: `275 passed (5.5m)` · `e2e exit 0` (20 casos de `identidade-celeste.spec.ts`).
- Windows: `npx vitest run src/design/` → `Test Files 10 passed · Tests 183 passed`.
- `docker ps` al terminar: sin el contenedor del verificador (solo Supabase del host y uno ajeno, `interesting_liskov`, arrancado por otra sesión).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-065/. Informe HTML opcional: _qa/SPEC-065/informe.html -->
| CA | Captura (implementador) |
|---|---|
| CA-3 | `_qa/SPEC-065/ca3-{_,_es,_demo_xornada,_es_demo_xornada}-{360,1440}.png` |
| CA-4 | `_qa/SPEC-065/ca4-iconas-antes.png`, `ca4-iconas-despois.png` (16/32/180/512); iconos viejos en `_qa/SPEC-065/antes/` |
| CA-6 | `_qa/SPEC-065/ca6-{antes,despois}_{demo_xornada,es_demo_xornada}-{360,1440}.png` (antes = build de 5918431); `ca6-_{,es_}directos-*` |
| CA-7 | `_qa/SPEC-065/ca7{,_es}-{360,1440}.png` |
| CA-3/6/7 (verificador, Linux) | `_qa/SPEC-065/verif/ca3-*`, `ca6-*`, `ca7*` (20 PNG del e2e en Docker) |

## Evidencia de gates (implementador, 2026-11-08)
- `npm run gates` en Docker `mcr.microsoft.com/playwright:v1.63.0-noble` sobre `git archive` de HEAD (commit «git grep --no-index»): `Checked 396 files … No fixes applied` · `Test Files 140 passed (140) · Tests 2183 passed | 3 skipped` · `✓ Compiled successfully` · `gates exit 0`.
- Windows (worktree LF): `src/db/test-db.test.ts › wins over a .env file in the cwd too` falla (`expected 1 to be +0`) también sin estos cambios (`git stash`): el test arma `PATH` con `:`; solo Windows. En Linux pasa.
- `npm run e2e` (CI=1, Docker, commit 8306bb5): `274 passed (2.8m) · 1 skipped · exit 0`. `e2e/identidade-celeste.spec.ts` (20 casos) también verde en Windows.
- `npm run e2e:db` (Docker, red del host, Supabase local del host): `46 passed · 2 failed · 1 skipped`. Fallan `xornada-nav.db.spec.ts:103 CA-4 with JS … the logo resets` (gl y es) en `heads.nth(1).click()` (timeout, antes de tocar el logo). En la base 5918431 el mismo fichero da `14 passed · 2 failed` con los mismos dos casos y la misma línea: preexistente, no de esta spec.
- CA-8: `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/app/api supabase` → vacío. `manifest.ts`/`metadata.ts` y sus tests sin diff.

## Salvedades / follow-ups
<!-- IDs F-SPEC-065-1, F-SPEC-065-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-065-1** (→ SPEC-064). Para cumplir «ninguna fuente bajo `tools/` contiene ▮» (CA-3) se cambió el glifo por un bloque CSS en `tools/og-image.mjs` y `tools/twitter-assets.mjs`, **sin regenerar** `og.png` ni `twitter-*.png` (siguen con el verde y la semente B hasta SPEC-064). Sus SVG inline de semente B siguen ahí, sin hex (usan `COLORS`).
- **F-SPEC-065-2** (interpretación, para el verificador). «Competición activa» de CA-6 no existe en `/demo/xornada`; se probó en la pestaña activa de `CompetitionNav` (`tab-all`) en `/directos` y `/es/directos`. En la demo se prueban día seleccionado, gallego/perdedor y directo en ember.
- **F-SPEC-065-3**. CA-7 usa un Explorer de mentira (`e2e/fixtures/explorer-mock.mjs`, puerto 3103) y una tercera instancia `next start` (3102) en `playwright.config.ts`: +1 arranque en `npm run e2e`.
- **F-SPEC-065-4**. Además de los tres hex, en `*.tpl.html` y `Componentes.dc.html` se cambió la tinta `rgba(86,219,143,.12)` → `rgba(0,153,204,.12)` (es la marca en rgba); el test de CA-5 también la vigila.
- **F-SPEC-065-5** (→ EPIC-MEJORA/SPEC-047). `xornada-nav.db.spec.ts:103` (2 casos) rojo ya en main; `test-db.test.ts` rojo solo en Windows.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-8 implementados en la rama; spec en `en-revision`. Falta la verificación (sdd-verificador). Tests de unidad nuevos en `src/design/identity.test.ts`; e2e en `e2e/identidade-celeste.spec.ts` (`QA_CAPTURE_DIR=_qa/SPEC-065` para capturas). Regenerar: `node tools/tokens-css.mjs`, `node tools/icons.mjs`, `cd docs/diseno && node build.mjs`. SPEC-064 puede empezar sobre esta rama (`iconSvg({variant})`, `Wordmark`).
