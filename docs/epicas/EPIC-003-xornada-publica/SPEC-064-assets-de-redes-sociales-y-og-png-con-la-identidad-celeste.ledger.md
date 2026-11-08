---
id: SPEC-064
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-064 Assets de redes sociales y og.png con la identidad celeste

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-065-identidad-celeste-y-redes`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/design/social.ts` (`SOCIAL_ASSETS`, `OG_ASSET`, `SafeZone`) | `src/design/social.test.ts` «SPEC-064 CA-1 the catalogue» (tabla exacta, círculo 0.40·ancho, zonas de X/Bluesky/story) | | ❌ |
| CA-2 | `src/design/social.ts` (`socialHtml`, `ogHtml`), `tools/redes.mjs` (`npm run redes`), `tools/og-image.mjs`, `tools/social-render.mjs` (Geist de `public/fonts/` + Chromium de Playwright); borrados `tools/twitter-assets.mjs`, `public/twitter-{avatar,header}.png` | `social.test.ts` «CA-2» (hex solo de COLORS sin victory, sin glifo, sin `font:`, tamaño de página, `iconSvg({variant})`, bloque `span.block`, faces, script `redes`, helpers compartidos, twitter-* ausentes); reproducibilidad: ver evidencia | | ❌ |
| CA-3 | `socialHtml` (wordmark + `marcador.gal` en banner/poster; círculos sin texto), `ogHtml` (titular, subtítulo, 5 píldoras) | `social.test.ts` «CA-3» | | ❌ |
| CA-4 | `ogHtml` sin píldora ni punto, icono de barra sola + wordmark con bloque; `public/og.png` regenerado (38 453 B) | `social.test.ts` «CA-4» (sin «xogo»/badge/dot, 1200×630 < 300 KB, ΔE ≥ 10 de verde viejo y de ember); `og.test.ts` (SPEC-050) | | ❌ |
| CA-5 | `assets/redes/*.png` (15) + `public/og.png`; `src/design/raster.ts` (decodePng, ΔE CIE76; `icon.test.ts` lo reutiliza) | `social.test.ts` «CA-5» (un caso por pieza: existe, px exactos, (2,2) = fondo, color mayoritario, sin verdes, todo píxel ≠ fondo dentro de la zona segura) | | ❌ |
| CA-6 | `_qa/SPEC-064/contacto.png` (`node tools/redes.mjs --contacto`) | ver «Evidencia de gates» | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-064/. Informe HTML opcional: _qa/SPEC-064/informe.html -->
| CA | Captura (implementador) |
|---|---|
| CA-1..CA-6 | `_qa/SPEC-064/contacto.png`: todas las piezas a 300 px de alto; avatares, perfiles y destacadas oscuro/celeste lado a lado; círculo continuo = recorte de la plataforma (fuera atenuado), trazo ámbar = zona segura (círculo 0.40·lado o rect de CA-5) |
| CA-4 | `public/og.png` |

## Evidencia de gates (implementador, 2026-11-08)
- Reproducible (Windows, Chromium de Playwright 1.63 de node_modules): `md5sum public/og.png assets/redes/*.png` antes y después de `node tools/og-image.mjs && node tools/redes.mjs` → `diff` vacío (`IDENTICAL`); `git status --short` limpio en `public/` y `assets/redes/`.
- Los tests discriminan: con el `og.png` anterior (verde, EN XOGO) → `× no pixel within ΔE 10 of the old green or of ember` y `× public/og.png`; sin `assets/redes/x-header.png` → `× assets/redes/x-header.png`.
- `npm run gates` en Docker `mcr.microsoft.com/playwright:v1.63.0-noble` (un solo contenedor, `--rm`) sobre `git archive` de 80c1bf4: `Checked 399 files … No fixes applied` · `Test Files 141 passed (141) · Tests 2244 passed | 3 skipped` · `✓ Compiled successfully` · `gates exit 0`. `docker ps` después: solo los contenedores de Supabase del host.
- `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/app supabase` → vacío.
- Sin e2e: la spec no añade ni cambia specs e2e ni rutas.

## Salvedades / follow-ups
<!-- IDs F-SPEC-064-1, F-SPEC-064-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-064-1** (interpretación, para el verificador). «Color mayoritario» = el RGB exacto más frecuente entre los píxeles distintos del fondo exacto. Para que gane `brand` en las piezas con texto, banner y poster llevan la barra del icono en grande junto al wordmark, y `og.png` una barra grande a la derecha (ocupa el sitio que dejaba la píldora). **Aceptado por el titular (2026-11-08):** se mantiene la barra celeste grande en `og.png`, posts y story.
- **F-SPEC-064-2** (interpretación). Zonas seguras que la spec no fija: og x 24–1176, y 24–606 (dentro del marco); post 1:1 108–972; post 4:5 x 135–945, y 135–1215 (rejilla 3:4); story x 90–990 además de y 250–1670.
- **F-SPEC-064-3**. ΔE = CIE76 (distancia euclídea en CIELAB D65).
- **F-SPEC-064-4**. El decodificador PNG de `icon.test.ts` pasó a `src/design/raster.ts`, compartido; mismos casos.
- **F-SPEC-064-5**. Los PNG se generaron en Windows; en Linux Chromium puede dar otros bytes (antialias/hinting). Los tests miden geometría y color, no bytes.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-6 implementados en la rama (80c1bf4); spec en `en-revision`. Falta la verificación (sdd-verificador) y que el titular elija oscuro/celeste con `_qa/SPEC-064/contacto.png`. Regenerar: `node tools/og-image.mjs`, `npm run redes` (`npm run redes -- --contacto` para la hoja). Tests: `npx vitest run src/design/social.test.ts`.
