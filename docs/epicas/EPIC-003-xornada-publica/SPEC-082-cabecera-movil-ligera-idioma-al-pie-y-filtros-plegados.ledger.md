---
id: SPEC-082
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-082 Cabecera móvil ligera: idioma al pie y filtros plegados

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-082-cabecera-movil-ligera` (la misma rama que SPEC-057; PR conjunto)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/components/xornada/XornadaHeader.tsx` (sin `<nav locale-switch>`; `{filters && <FiltersToggle>}`) | `src/components/xornada/filters-toggle.test.ts` «CA-1 the header without gl·es»; `e2e/cabecera-movil.spec.ts` «CA-1» (demo gl/es × 360/390/1024/1440: 0 `locale-switch`/`[hreflang]` en `header`, 52/56 px) | | ❌ |
| CA-2 | `src/lib/locale-paths.ts` (`localePaths`); `src/components/layout/LocaleSwitch.tsx` (`usePathname`), `Footer.tsx`, `Footer.module.css` (`.locale` ≥ `--touch-target`); `XornadaFilters.tsx` (fragmento en `a[data-locale-href]` de todo el documento) | `src/lib/locale-paths.test.ts` (tabla, 26 casos); `src/components/layout/LocaleSwitch.test.ts`; `e2e/cabecera-movil.spec.ts` «CA-2» (18 rutas: Xornada, demo, directos, legales y, en el build con Explorer de prueba, competición/clasificación/calendario; gl y es × 360/1440; enlace ≥ 44 × 44 en móvil) y «the link keeps the xornada's fragment»; `e2e/xornada-controls.spec.ts` CA-9 (gl·es conserva `#d=…&f=live`) | | ❌ |
| CA-3 | `src/components/xornada/FiltersToggle.tsx`, `filters-panel.ts` (store), `FiltersPanel.tsx` (`<nav id=xornada-filters data-open>`), `XornadaControls.tsx`, `XornadaBody.tsx` (`.titleRoom`), `Xornada.module.css` (`.filtersToggle`, `.controls .filters:not([data-open])`, escritorio `display: none`/`flex`) | `filters-toggle.test.ts` «CA-3 the folded filters button» y «the CSS»; `e2e/cabecera-movil.spec.ts` «CA-3» (360/390: botón ≥ 44 × 44 a la derecha de la `.bar`, svg `currentColor` `aria-hidden`, `aria-expanded=false`, `aria-controls`=id del panel, chips y «Ligas» ocultos, `main` justo bajo la fila del título; 1024/1440: botón `display: none`, filtros y «Ligas» visibles) | | ❌ |
| CA-4 | `FiltersPanel.tsx` (clic en `a[data-filter-link]` o `Escape` fuera de `[role=dialog]` → `foldFilters()`, foco al botón), `filters-panel.ts` (estado en memoria del módulo, sin URL ni `localStorage`) | `e2e/cabecera-movil.spec.ts` «CA-4» (gl/es × 360/390: abre en flujo bajo el título sin pisar filas; chip aplica `#f=live`, pliega y foco al botón; `Escape` pliega y foco; «Ligas» abre su diálogo sin plegar; recarga empieza plegado; nada en URL ni `localStorage`) | | ❌ |
| CA-5 | `src/xornada/filter.ts` (`activeFilterCount`); `FiltersToggle.tsx` (insignia `aria-hidden`, nombre `xornada.filters`/`filtersActive.one/other`; escucha `xornada:filter-state`, `hashchange` y `LEAGUES_PREFERENCE_EVENT`); `XornadaFilters.tsx` (emite `xornada:filter-state`); `.filtersBadge` | `src/xornada/filter.test.ts` «SPEC-082 CA-5 activeFilterCount» (tabla, 8 casos); `e2e/cabecera-movil.spec.ts` «CA-5» (n=0 sin insignia; `#f=live` → «Filtros: 1 activo»; preset Pro → «Filtros: 2 activos»; Todos → 1; preset Todas → 0; preferencia guardada cuenta al cargar; insignia absoluta, `tabular-nums`, no cambia la caja del botón) | | ❌ |
| CA-6 | `XornadaScreen.tsx` (`<noscript><style>`: oculta `.filtersToggle`, muestra `.controls .filters:not([data-open])`); CSS móvil pliega por defecto (primera pintura plegada) | `filters-toggle.test.ts` «CA-6 without JavaScript»; `e2e/cabecera-movil.spec.ts` «CA-6» (sin JS a 360: sin botón, chips y «Ligas» visibles, sin scroll; con JS y los `.js` abortados: ya plegado; suma de `layout-shift` < 0,01); `e2e/xornada-controls.spec.ts` CA-6 sin JS (sigue verde) | | ❌ |
| CA-7 | `src/i18n/gl.ts`, `es.ts` (`xornada.filters`, `xornada.filtersActive.{one,other}`); colores solo de tokens (`--marca`/`--marca-ink`, `--fg-dim`, `--bg-step`); foco: anillo global `:focus-visible`; longhands de fuente | `src/i18n/i18n.test.ts` «SPEC-082 CA-5/CA-7 the filters button» (paridad, singular/plural, sin literal «Filtros» en `.tsx`) + «CA-8 dictionaries»; `filters-toggle.test.ts` «the badge: --marca on --marca-ink…»; `src/design/` (`no-hex`, `css` sin `font:`) en `npm run test` | | ❌ |
| CA-8 | `docs/diseno/Movil.tpl.html`, `Escritorio.tpl.html`, `_logic.js` (`leagues`), `.dc.html` regenerados (`node build.mjs`), `HERENCIA.md` (entrada 2026-11-11 SPEC-082, H-1) | `src/design/artboards.test.ts` «SPEC-082 CA-8 the light mobile header» (sin gl·es en tpl/dc de Movil y Escritorio; botón, insignia «1» en `--marca`/`--marca-ink`, panel; entrada de HERENCIA) | | ❌ |
| CA-9 | e2e adaptadas: `xornada-controls`, `xornada-columnas`, `xornada-lectura`, `xornada-nav`, `xornada-provisional`, `ligas-preferencias`, `xornada-lema` (SPEC-081 mide contra el botón), y las db `xornada-weeks`, `xornada-weeks-sen-tira`; helper `e2e/filters-panel.ts` (`openFilters`); versión `0.10.0` (`npm version minor`) | `npm run gates` verde (typecheck, Biome 484 ficheros, Vitest 171 ficheros / 2871 tests, build); `npx playwright test` completa (ver Evidencia); capturas en `_qa/SPEC-082/` | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-082/. Informe HTML opcional: _qa/SPEC-082/informe.html -->
| CA | Captura (`_qa/SPEC-082/`) |
|---|---|
| CA-3 360 plegado | `ca3-_demo_xornada-360-plegado.png`, `ca3-_es_demo_xornada-360-plegado.png` |
| CA-4/CA-5 360 abierto con insignia «2» | `ca5-_demo_xornada-360-abierto-insignia.png`, `ca5-_es_demo_xornada-360-abierto-insignia.png` |
| CA-3 1440 | `ca3-_demo_xornada-1440.png`, `ca3-_es_demo_xornada-1440.png` |

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
