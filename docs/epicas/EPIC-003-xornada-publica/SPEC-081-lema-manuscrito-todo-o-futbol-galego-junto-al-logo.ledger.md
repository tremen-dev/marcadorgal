---
id: SPEC-081
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-081 Lema manuscrito todo o fútbol galego junto al logo

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-081-lema-manuscrito`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `public/fonts/Caveat-Regular.woff2` (gstatic v23, subconjunto latino, estática, 48 836 B), `public/fonts/Caveat-OFL.txt` (googlefonts/caveat), `src/design/tokens.ts` (`FAMILIES.hand`, 7.ª entrada de `FACES`), `src/app/globals.css` (`@font-face` swap), `src/design/tokens.css` (regenerado), `docs/diseno/_tokens.css` (`--hand`, `@import` Caveat) | `src/design/fonts.test.ts` «SPEC-081 CA-1» (≤ 50 KB; cmap del woff2 leído con Brotli: «ú» y el resto del lema, control negativo U+4E2D; OFL; paridad `--hand`; nada de `fonts.googleapis/gstatic` en `src/`), «FACES lists the seven…», «every @font-face swaps»; `tokens.test.ts`, `css.test.ts`, `parity.test.ts` | | 🚧 |
| CA-2 | `src/i18n/gl.ts`, `src/i18n/es.ts` (`xornada.lema`), `src/components/xornada/XornadaHeader.tsx` (`t(locale, "xornada.lema")`) | `src/i18n/i18n.test.ts` «SPEC-081 CA-2 the motto» (valor idéntico gl/es; ningún `.tsx` con el literal) | | 🚧 |
| CA-3 | `XornadaHeader.tsx` (`.brand` › `a.logo` + `.lemaBox` › `span.lema`), `src/components/xornada/Xornada.module.css` (escritorio: `.brand` grid `auto minmax(0, 124px)`, `align-items: baseline`, `column-gap: 10px`; `.lema` 19 px) | `e2e/xornada-lema.spec.ts` «SPEC-081 CA-3» (`/`, `/es`, `/demo/xornada`, `/es/demo/xornada` × 1024/1440: 19 px, Caveat cargada, 400, `--fg`, 0.72, logo 21 px, separación 8–12, línea base ±1) | | 🚧 |
| CA-4 | `Xornada.module.css` (`.brand` `flex: 0 1000 auto`; `.lemaBox` `container-type: inline-size`; `@container (width < 124px) { .lema { display: none } }`) | `e2e/xornada-lema.spec.ts` «SPEC-081 CA-4» (gl/es × 1024/1100/1280/1440 × sin/con flechas (inyectadas con la clase `weekArrow` del módulo): sin solapes, título en 1 línea y `scrollWidth ≤ clientWidth`, `gl·es` en el viewport; título de 200 caracteres a 1024/1440 → `display: none` y fuera del árbol; sin JavaScript, igual) | | 🚧 |
| CA-5 | `Xornada.module.css` (móvil: `.brand` en columna, gap 2 px; `.lemaBox` 124 px; `.lema` 16 px) | `e2e/xornada-lema.spec.ts` «SPEC-081 CA-5» (`/`, `/es` sin tira; demo gl/es con tira (3100) y sin tira (3101) × 360/768: 16 px, debajo y alineado ±0.5, barra 52, `--bar-mobile-header` 52px, `MEASURE.barMobileHeader` 52, márgenes ≥ 2, sin solapes, tops de título/tira/filtros/`main` iguales ±0.5 con el lema oculto) | | 🚧 |
| CA-6 | `XornadaHeader.tsx` (lema hermano del enlace, `span` con `lang="gl"`) | `e2e/xornada-lema.spec.ts` «SPEC-081 CA-6» (4 rutas: nombre `xornada.home`, fuera de `a` y de encabezados, sin rol); `src/design/lema.test.ts` (regla `.lema` con `--fg` y 0.72; contraste 8.96:1 ≥ 4.5; `var(--hand)` con un solo uso en `src/`) | | 🚧 |
| CA-7 | `Xornada.module.css` (caja reservada de 124 px, `overflow-x: clip`), `globals.css` (swap, sin preload) | `e2e/xornada-lema.spec.ts` «SPEC-081 CA-7» (`/` × 360/1440, woff2 retrasado 2 s con `page.route`: `fonts.check` falso antes; rects de logo/lema/fila del título/`gl·es` iguales ±0.5 tras cargar; 0 `layout-shift` con origen en `header` después de asentarse Geist; HTML sin `preload` de Caveat) | | 🚧 |
| CA-8 | `docs/diseno/Movil.tpl.html`, `Escritorio.tpl.html`, sus `.dc.html` (`node build.mjs`; `Global.dc.html` sin cambio), `HERENCIA.md` (entrada 2026-11-11), `_tokens.css` | `src/design/artboards.test.ts` «SPEC-081 CA-8» (lema en ambos artboards con sus medidas, `--hand` + `@import`, HERENCIA); «the templates rebuild the artboards»; `fonts.test.ts` «no CSS under src/ uses the font shorthand» | | 🚧 |
| CA-9 | `package.json`/`package-lock.json` 0.8.2 → 0.9.0 (`npm version minor --no-git-tag-version`); 32 capturas en `_qa/SPEC-081/` | ver «Evidencia del implementador» | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia del implementador (2026-11-11, Windows, sin Docker)
- `npm run gates` → `Checked 473 files … No fixes applied` · `Test Files 168 passed (168)` · `Tests 2807 passed | 3 skipped` · `✓ Compiled successfully` · exit 0.
- `npx playwright test e2e/xornada-lema.spec.ts` (build + start, puertos 3100/3101) → `45 passed`.
- `npx playwright test` (suite completa sin db) → `347 passed, 5 failed, 1 skipped`: 4 en `xornada-nav.spec.ts:103` («28 px tras el logo»; ahora el lema está en medio) → test ajustado a «28 px tras el lema»; 1 en `xornada-goleadores.spec.ts:152` (temporización bajo carga).
- `npx playwright test e2e/xornada-lema.spec.ts e2e/xornada-nav.spec.ts e2e/xornada-goleadores.spec.ts` → `89 passed`, 1 fallo en `xornada-goleadores.spec.ts:152` (360, gl); `npx playwright test e2e/xornada-goleadores.spec.ts` solo → `25 passed`.
- Medida (dev, 1440): logo `x 20, w 132.47`; lema `x 162.47, w 124` (texto en Caveat 121.9 px); líneas base 34.5/34.5. A 360: logo `y 7.5 h 18`, lema `y 27.5 h 16`, barra 52. El lema en Geist 19 px mide 176 px (de ahí el `overflow-x: clip`).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-081/. Informe HTML opcional: _qa/SPEC-081/informe.html -->
| CA | Capturas (`QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-081 npx playwright test e2e/xornada-lema.spec.ts`) |
|---|---|
| CA-3 | `ca3-{_,_es,_demo_xornada,_es_demo_xornada}-{1024,1440}.png` |
| CA-4 | `ca4-{gl,es}-{1024,1100,1280,1440}-flechas.png`, `ca4-titulo-200-{1024,1440}.png` |
| CA-5 | `ca5-*-{360,768}-{tira,sen-tira}.png` |
| CA-7 | `ca7-despois-{360,1440}.png` (Playwright espera a las fuentes antes de capturar, así que no hay foto del «antes»: la prueba son los rects) |

## Salvedades / follow-ups
<!-- IDs F-SPEC-081-1, F-SPEC-081-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-081-1** (sdd-arquitecto): ADR-035 §6 pide la nota «familias ampliadas por ADR-035» en ADR-005 y ADR-001. Falta, y no le toca al implementador.
- **F-SPEC-081-2** (aviso): CA-4 «con flechas» se prueba inyectando ‹ › en el DOM con la clase real `weekArrow`; las flechas de verdad solo aparecen con lector y sin tira (`e2e:db`, no ejecutado: Docker es el último recurso).
- **F-SPEC-081-3** (aviso): CA-5 «con tira» solo se puede probar en las demos, porque sin lector `/` y `/es` no tienen filas ni tira.
- **F-SPEC-081-4** (aviso): durante el swap, el lema en Geist (≈ 176 px) se recorta a la caja de 124 px (`overflow-x: clip`) para no pisar el título; con Caveat ya cargada (122 px) cabe entero.
- **F-SPEC-081-5** (aviso): `e2e/xornada-nav.spec.ts` (SPEC-028 CA-6) medía «28 px tras el logo»; ahora mide desde el lema, que SPEC-081 coloca entre ambos.
- **F-SPEC-081-6** (aviso): `xornada-goleadores.spec.ts:152` (CA-4 de goleadores, reloj falso y margen de 15 s) falla bajo carga paralela y pasa ejecutado solo; no toca la cabecera.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-9 implementados con test en `ft/SPEC-081-lema-manuscrito` (sin push), versión 0.9.0, spec en `en-revision`. Falta: verificación (sdd-verificador), F-SPEC-081-1 (notas en ADR-005/ADR-001) y, si se quiere, `e2e:db` para las flechas reales. El ancho de 124 px se repite en `.lemaBox`, en la pista de `.brand` y en la `@container`: si cambia el tamaño del lema, hay que cambiar los tres.
