---
id: SPEC-082
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-082 Cabecera móvil ligera: idioma al pie y filtros plegados

## Resumen
- Fase: hecho <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-082-cabecera-movil-ligera` (la misma rama que SPEC-057; PR conjunto)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/components/xornada/XornadaHeader.tsx` (sin `<nav locale-switch>`; `{filters && <FiltersToggle>}`) | `src/components/xornada/filters-toggle.test.ts` «CA-1 the header without gl·es»; `e2e/cabecera-movil.spec.ts` «CA-1» (demo gl/es × 360/390/1024/1440: 0 `locale-switch`/`[hreflang]` en `header`, 52/56 px) | Verif. 2026-11-11: e2e «CA-1» 8/8 verde; recorrido propio (build local, `/`, `/es`, demo gl/es × 360/390/1024/1440, con y sin JS): 0 `locale-switch`/`[hreflang]` en `header`, alto 52 px (<1024) y 56 px (≥1024) en los 32 casos; con BD local sembrada `/` y `/es` igual (`verif-db_*-360-frescura.png`) | ✅ |
| CA-2 | `src/lib/locale-paths.ts` (`localePaths`); `src/components/layout/LocaleSwitch.tsx` (`usePathname`), `Footer.tsx`, `Footer.module.css` (`.locale` ≥ `--touch-target`); `XornadaFilters.tsx` (fragmento en `a[data-locale-href]` de todo el documento) | `src/lib/locale-paths.test.ts` (tabla, 26 casos); `src/components/layout/LocaleSwitch.test.ts`; `e2e/cabecera-movil.spec.ts` «CA-2» (18 rutas: Xornada, demo, directos, legales y, en el build con Explorer de prueba, competición/clasificación/calendario; gl y es × 360/1440; enlace ≥ 44 × 44 en móvil) y «the link keeps the xornada's fragment»; `e2e/xornada-controls.spec.ts` CA-9 (gl·es conserva `#d=…&f=live`) | Verif.: `locale-paths.test.ts` (26 casos) leído y verde; e2e «CA-2» 36/36 + fragmento verde; recorrido propio: 1 solo `locale-switch`, dentro de `app-footer`, `aria-current=page` en la lengua actual, enlaces 44 × 44 a 360/390; tras `#f=live` el enlace del pie es `/es/demo/xornada#f=live` | ✅ |
| CA-3 | `src/components/xornada/FiltersToggle.tsx`, `filters-panel.ts` (store), `FiltersPanel.tsx` (`<nav id=xornada-filters data-open>`), `XornadaControls.tsx`, `XornadaBody.tsx` (`.titleRoom`), `Xornada.module.css` (`.filtersToggle`, `.controls .filters:not([data-open])`, escritorio `display: none`/`flex`) | `filters-toggle.test.ts` «CA-3 the folded filters button» y «the CSS»; `e2e/cabecera-movil.spec.ts` «CA-3» (360/390: botón ≥ 44 × 44 a la derecha de la `.bar`, svg `currentColor` `aria-hidden`, `aria-expanded=false`, `aria-controls`=id del panel, chips y «Ligas» ocultos, `main` justo bajo la fila del título; 1024/1440: botón `display: none`, filtros y «Ligas» visibles) | Verif.: e2e «CA-3» 8/8 verde; propio a 360/390: botón 44 × 44 en x=312/342 (borde derecho a 4 px), `aria-expanded=false`, `aria-controls=xornada-filters` = id del panel, panel y «Ligas» ocultos; con datos (BD local) «Actualizado ás HH:MM» en y=94 = borde inferior de la fila del título; a 1024/1440 botón oculto, panel y «Ligas» visibles (`verif-js-*`) | ✅ |
| CA-4 | `FiltersPanel.tsx` (clic en `a[data-filter-link]` o `Escape` fuera de `[role=dialog]` → `foldFilters()`, foco al botón), `filters-panel.ts` (estado en memoria del módulo, sin URL ni `localStorage`) | `e2e/cabecera-movil.spec.ts` «CA-4» (gl/es × 360/390: abre en flujo bajo el título sin pisar filas; chip aplica `#f=live`, pliega y foco al botón; `Escape` pliega y foco; «Ligas» abre su diálogo sin plegar; recarga empieza plegado; nada en URL ni `localStorage`) | Verif.: e2e «CA-4» 4/4 verde; propio a 360: abre en flujo (panel 94–166, primera competición en 166, sin solape); chip «En xogo» → `#f=live`, `aria-expanded=false`, foco en el botón; teclado Enter→Tab (foco `filter-all`)→Escape pliega y devuelve foco; Escape dentro del diálogo «Ligas» cierra el diálogo sin plegar el panel; `localStorage` sin clave de panel (`verif-js-360-abierto.png`) | ✅ |
| CA-5 | `src/xornada/filter.ts` (`activeFilterCount`); `FiltersToggle.tsx` (insignia `aria-hidden`, nombre `xornada.filters`/`filtersActive.one/other`; escucha `xornada:filter-state`, `hashchange` y `LEAGUES_PREFERENCE_EVENT`); `XornadaFilters.tsx` (emite `xornada:filter-state`); `.filtersBadge` | `src/xornada/filter.test.ts` «SPEC-082 CA-5 activeFilterCount» (tabla, 8 casos); `e2e/cabecera-movil.spec.ts` «CA-5» (n=0 sin insignia; `#f=live` → «Filtros: 1 activo»; preset Pro → «Filtros: 2 activos»; Todos → 1; preset Todas → 0; preferencia guardada cuenta al cargar; insignia absoluta, `tabular-nums`, no cambia la caja del botón) | Verif.: `filter.test.ts` (8 casos) verde; e2e «CA-5» 2/2 verde; propio: un solo interruptor de liga (no preset) → nombre «Filtros: 1 activo» e insignia «1»; + chip «En xogo» → «Filtros: 2 activos» (`verif-js-360-interruptor-insignia.png`) | ✅ |
| CA-6 | `XornadaScreen.tsx` (`<noscript><style>`: oculta `.filtersToggle`, muestra `.controls .filters:not([data-open])`); CSS móvil pliega por defecto (primera pintura plegada) | `filters-toggle.test.ts` «CA-6 without JavaScript»; `e2e/cabecera-movil.spec.ts` «CA-6» (sin JS a 360: sin botón, chips y «Ligas» visibles, sin scroll; con JS y los `.js` abortados: ya plegado; suma de `layout-shift` < 0,01); `e2e/xornada-controls.spec.ts` CA-6 sin JS (sigue verde) | Verif.: e2e «CA-6» 6/6 verde (sin JS, JS abortado ya plegado, `layout-shift` < 0,01); propio sin JS a 360/390 (demo y `/` con datos): botón oculto, chips y «Ligas» visibles, sin scroll horizontal (`verif-nojs-*`) | ✅ |
| CA-7 | `src/i18n/gl.ts`, `es.ts` (`xornada.filters`, `xornada.filtersActive.{one,other}`); colores solo de tokens (`--marca`/`--marca-ink`, `--fg-dim`, `--bg-step`); foco: anillo global `:focus-visible`; longhands de fuente | `src/i18n/i18n.test.ts` «SPEC-082 CA-5/CA-7 the filters button» (paridad, singular/plural, sin literal «Filtros» en `.tsx`) + «CA-8 dictionaries»; `filters-toggle.test.ts` «the badge: --marca on --marca-ink…»; `src/design/` (`no-hex`, `css` sin `font:`) en `npm run test` | Verif.: `i18n.test.ts`, `filters-toggle.test.ts` y `src/design/` verdes en `npm run gates`; revisado `Xornada.module.css`/`Footer.module.css`: solo `var(--…)`, longhands; foco del botón `solid 2px rgb(0,153,204)` (anillo global en `--marca`, `verif-js-360-foco-boton.png`) | ✅ |
| CA-8 | `docs/diseno/Movil.tpl.html`, `Escritorio.tpl.html`, `_logic.js` (`leagues`), `.dc.html` regenerados (`node build.mjs`), `HERENCIA.md` (entrada 2026-11-11 SPEC-082, H-1) | `src/design/artboards.test.ts` «SPEC-082 CA-8 the light mobile header» (sin gl·es en tpl/dc de Movil y Escritorio; botón, insignia «1» en `--marca`/`--marca-ink`, panel; entrada de HERENCIA) | Verif.: `artboards.test.ts` verde; diff revisado: `Movil.tpl.html`/`Escritorio.tpl.html` sin gl·es, Movil con botón, insignia «1» y panel abierto; `.dc.html` regenerados; entrada 2026-11-11 en `HERENCIA.md` (H-1) | ✅ |
| CA-9 | e2e adaptadas: `xornada-controls`, `xornada-columnas`, `xornada-lectura`, `xornada-nav`, `xornada-provisional`, `ligas-preferencias`, `xornada-lema` (SPEC-081 mide contra el botón), y las db `xornada-weeks`, `xornada-weeks-sen-tira`; helper `e2e/filters-panel.ts` (`openFilters`); versión `0.10.0` (`npm version minor`) | `npm run gates` verde (typecheck, Biome 484 ficheros, Vitest 171 ficheros / 2871 tests, build); `npx playwright test` completa (ver Evidencia); capturas en `_qa/SPEC-082/` | Verif.: `npm run gates` exit 0 (Biome 484 ficheros sin cambios; Vitest 171 ficheros, 2871 passed / 3 skipped; build OK); `npx playwright test` completa: 431 passed, 1 skipped, exit 0; `e2e:db` (`xornada-weeks.db`, `xornada-weeks-sen-tira.db`) contra la Supabase local ya levantada: 27 passed; versión `0.10.0` (minor) | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-11-11 (sdd-verificador).** CA-1..CA-9 ✅. Gates, suite Playwright completa y las dos `e2e:db` modificadas en verde; flujo real propio con Playwright local sobre el build (`next start`, sin BD y con la BD local sembrada) a 360, 390, 1024 y 1440 px, con y sin JavaScript, gl y es. SPEC-057 (hecho) sigue cumpliendo: `ligas-preferencias.spec.ts` (14 casos) verde dentro de la suite completa, con «Ligas» dentro del panel en móvil (enmienda de SPEC-057 CA-1/CA-3 recogida en esta spec).

Comandos (Windows, rama `ft/SPEC-082-cabecera-movil-ligera`):
- `npm run gates` → `GATES_EXIT=0`; `Checked 484 files … No fixes applied`; `Test Files 171 passed (171)`, `Tests 2871 passed | 3 skipped (2874)`.
- `npx playwright test` → `431 passed (5.1m)`, `1 skipped`, exit 0.
- `npx playwright test --config playwright.db.config.ts e2e/xornada-weeks.db.spec.ts e2e/xornada-weeks-sen-tira.db.spec.ts` → `27 passed (1.1m)`. Necesaria: son las únicas que pintan `/` y `/xornada/*` con filas reales y cubren CA-9 (abren el panel antes de usar chips en móvil). Se usó la Supabase local que ya estaba en marcha (no se arrancó Docker). El `globalTeardown` (`supabase db reset --local`) falló una vez por un servidor de verificación aún conectado; se repitió a mano con éxito y se reinsertaron las 5 competiciones (lo mismo que hace `e2e/db-teardown.ts`). Ajeno a la spec.
- Recorrido propio: script Playwright (`chromium`) contra `next start` (puerto 3200 sin BD; 3201 con la BD local sembrada): 32 combinaciones ruta × anchura × JS más interacciones (abrir, chip, teclado, Escape, interruptor, diálogo, redimensionado 360↔1440).

Observaciones (no bloquean): la marca no cuenta las ligas ocultas si el almacenamiento está bloqueado (coherente con la definición de `n` del CA-5, que lee la clave de `localStorage`); antes de hidratar, el botón se ve pero no responde (inherente a la primera pintura plegada que pide CA-6).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-082/. Informe HTML opcional: _qa/SPEC-082/informe.html -->
| CA | Captura (`_qa/SPEC-082/`) |
|---|---|
| CA-3 360 plegado | `ca3-_demo_xornada-360-plegado.png`, `ca3-_es_demo_xornada-360-plegado.png` |
| CA-4/CA-5 360 abierto con insignia «2» | `ca5-_demo_xornada-360-abierto-insignia.png`, `ca5-_es_demo_xornada-360-abierto-insignia.png` |
| CA-3 1440 | `ca3-_demo_xornada-1440.png`, `ca3-_es_demo_xornada-1440.png` |
| CA-1/CA-3/CA-6 recorrido propio, 4 anchuras × JS sí/no | `verif-js-{360,390,1024,1440}_demo_xornada.png`, `verif-js-…_es_demo_xornada.png`, `verif-nojs-…` |
| CA-3 frescura bajo el título con datos reales (BD local) | `verif-db_gl-360-frescura.png`, `verif-db_es-360-frescura.png` |
| CA-4 panel abierto en flujo | `verif-js-360-abierto.png` |
| CA-5 insignia por un interruptor de liga | `verif-js-360-interruptor-insignia.png` |
| CA-7 foco visible del botón | `verif-js-360-foco-boton.png` |

Comandos (2026-11-11, rama `ft/SPEC-082-cabecera-movil-ligera`, Windows, sin Docker):
- `npm run gates` → exit 0 (Vitest: `Test Files 171 passed`, `Tests 2871 passed | 3 skipped`; Biome `Checked 484 files … No fixes applied`; `next build` OK).
- `npx playwright test e2e/cabecera-movil.spec.ts` → `65 passed`.
- `npx playwright test` (suite completa) → `431 passed`, `1 skipped` (5.1m), exit 0 (tras la subida a 0.10.0).

## Salvedades / follow-ups
<!-- IDs F-SPEC-082-1, F-SPEC-082-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-082-1** — `docs/diseno/Global.tpl.html` sigue dibujando `gl·es` en su cabecera (CA-8 solo nombra Movil y Escritorio; esa vista no está en producción). Destino: EPIC-MEJORA o la spec que lleve la vista Global.
- **F-SPEC-082-2** — Las suites `e2e:db` adaptadas (`xornada-weeks.db`, `xornada-weeks-sen-tira.db`: abren el panel antes de medir/pulsar en móvil) no se han corrido en local (requieren Supabase en Docker; el titular prefiere evitar Docker). Destino: verificador o la próxima corrida de `e2e:db`.
- **F-SPEC-082-3** — Los enlaces `gl`/`es` del pie miden ≥ 44 × 44 px en todas las anchuras (la spec solo lo exige en móvil); en escritorio se ven como una pastilla de 44 px de alto. Destino: diseño, si se quiere más compacto en escritorio.
- **F-SPEC-082-4** — `paths` deja de ser prop de `XornadaHeader` (el pie calcula la ruta con `localePaths`); `XornadaScreen`/`XornadaBody` la conservan solo para el `href` de «Todos». Sin cambio funcional.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-9 implementados con test; spec en `en-revision`. Commits: `63b2007` (funciones puras + i18n), `c853f0c` (pie y botón de filtros + e2e), `7b3fba1` (docs/diseno), `25d12e4` (versión 0.10.0, una sola para el PR conjunto con SPEC-057). Falta: verificación (sdd-verificador), y correr `e2e:db` (F-SPEC-082-2). Piezas: el estado abierto/plegado vive en `src/components/xornada/filters-panel.ts` (store de módulo compartido por `FiltersToggle` en la `.bar` y `FiltersPanel` bajo el título); el pie usa `LocaleSwitch` (cliente, `usePathname`).
