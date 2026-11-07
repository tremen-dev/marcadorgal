# Ledger de SPEC-051

Criterios de aceptación y evidencia de verificación de SPEC-051.

## CA-1 Manifiesto Web
Evidencia: `src/app/manifest.test.ts` (2 tests) en verde.
- Devuelve `name: "marcador.gal"`, `short_name: "marcador.gal"`, `display: "standalone"`, `start_url: "/"`.
- `background_color` y `theme_color` son `COLORS.bg.value` (`#111110`).
- Genera la ruta estática `/manifest.webmanifest`.

## CA-2 Iconos PWA
Evidencia: ejecución de `tools/icons.mjs`.
- Archivos generados en `public/`:
  - `icon-192.png`: 192 × 192 px, formato PNG.
  - `icon-512.png`: 512 × 512 px, formato PNG.
- `src/design/icon.test.ts` (6 tests) en verde: comprueba dimensiones exactas de `icon-192.png` y `icon-512.png`.

## CA-3 Metadatos y Viewport
Evidencia: `src/app/metadata.test.ts` en verde.
- `siteMetadata` define `manifest: "/manifest.webmanifest"` y `appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "marcador.gal" }`.
- `siteViewport` exporta `themeColor: COLORS.bg.value` (`#111110`).
- Incorporado a los layouts de gl (`src/app/(gl)/layout.tsx`) y es (`src/app/(es)/es/layout.tsx`).

## CA-4 Tests automatizados
Evidencia:
- `src/app/manifest.test.ts` (2 tests) en verde.
- `src/design/icon.test.ts` (6 tests) en verde.
- `src/app/metadata.test.ts` (4 tests) en verde.
- `src/design/no-hex.test.ts` (3 tests) en verde: ningún color hexadecimal fuera de `tokens.ts`.

## CA-5 Gates
Evidencia: `npm run gates` limpio:
- `npm run typecheck` (tsc --noEmit) → 0
- `npm run lint` (biome check .) → 0
- `npm run test` (vitest run: 125 suites, 2190 tests) → 0
- `npm run build` (next build Turbopack: compila `/manifest.webmanifest`) → 0
