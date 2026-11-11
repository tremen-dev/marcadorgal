---
id: SPEC-050
tipo: ledger
epica: EPIC-003
---
# Ledger de SPEC-050

Criterios de aceptación y evidencia de verificación de SPEC-050.

## CA-1 Diccionarios i18n
Evidencia: `src/i18n/i18n.test.ts` en verde con 21 tests. Comprueba paridad entre `gl` y `es`, existencia de `common.claim` y `common.description`, ausencia de valores vacíos y correspondencia de marcadores.
- `gl.common.claim`: «Todo o fútbol galego nunha pantalla»
- `gl.common.description`: «Resultados galegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF e 3ª RFEF»
- `es.common.claim`: «Todo el fútbol gallego en una pantalla»
- `es.common.description`: «Resultados gallegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF y 3ª RFEF»

## CA-2 Metadatos Next.js
Evidencia: `src/app/metadata.test.ts` en verde con 4 tests.
- `siteMetadata` define `metadataBase: new URL("https://marcador.gal")`, `title`, `description`, `icons` y `robots`.
- `homeMetadata` define `title`, `description`, `openGraph` y `twitter` con tarjeta `summary_large_image`, imagen `/og.png` de 1200 × 630 px y URLs localizadas (`/` para gl, `/es` para es).

## CA-3 Imagen og.png
Evidencia: ejecución de `tools/og-image.mjs` (disponible como script `npm run og:image`).
- Archivo generado: `public/og.png`
- Dimensiones: 1200 × 630 px
- Peso: 41.839 bytes (~41 KB), muy inferior al tope de WhatsApp (300 KB).
- Renderizado con Playwright Chromium a partir de los tokens de color (`COLORS.bg`, `COLORS.brand`, etc.) y las fuentes autoalojadas `Geist` (800) y `Geist Mono` (500).

## CA-4 Tests automatizados
Evidencia:
- `src/app/metadata.test.ts` (4 tests) en verde.
- `src/design/og.test.ts` (3 tests) en verde: comprueba existencia, cabecera PNG, dimensiones exactas 1200 × 630 y peso < 300 KB.
- `src/design/no-hex.test.ts` (3 tests) en verde: ningún color hexadecimal fuera de `tokens.ts`.

## CA-5 Gates
Evidencia: `npm run gates` limpio (código de salida 0):
- `npm run typecheck` (tsc --noEmit) → 0
- `npm run lint` (biome check .) → 0
- `npm run test` (vitest run: 124 suites, 2187 tests) → 0
- `npm run build` (next build Turbopack) → 0
