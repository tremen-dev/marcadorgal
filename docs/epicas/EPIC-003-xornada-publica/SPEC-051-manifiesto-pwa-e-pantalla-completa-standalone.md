---
id: SPEC-051
tipo: spec
epica: EPIC-003
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-07, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-07, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-07, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-07, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-07, por: sdd-verificador}
---
# SPEC-051 — Manifiesto PWA, pantalla completa standalone y theme-color

## Problema
En SPEC-033 quedó fuera de alcance el soporte de PWA («manifiesto web/PWA y
theme-color»). Al agregar `marcador.gal` a la pantalla de inicio de un móvil,
el navegador no ofrece el banner nativo de instalación ni abre la web en
modo «standalone» (pantalla completa sin barra de navegación del navegador).

El titular (Alberto Fojo, 2026-11-07) decide implementar la PWA para
permitir la instalación directa desde el móvil y su uso como aplicación
independiente.

## Usuarios / roles afectados
- Seareiros y usuarios que instalan la aplicación en móviles Android e iOS.

## Criterios de aceptación
- **CA-1 Manifiesto Web (`src/app/manifest.ts`).** Generador de manifiesto de
  Next.js que sirve `/manifest.webmanifest` con:
  - `name`: «marcador.gal»
  - `short_name`: «marcador»
  - `description`: el claim/descripción canónica
  - `start_url`: «/»
  - `display`: «standalone»
  - `background_color` y `theme_color`: `COLORS.bg.value` (`#111110`)
  - `icons`: incluye iconos PNG de 192 px, 512 px y 180 px
- **CA-2 Iconos PWA de 192 y 512 px (`public/`).** `tools/icons.mjs` y
  `src/design/icon.ts` incorporan `icon-192.png` e `icon-512.png` rasterizados
  con Playwright Chromium a partir de la semilla B con fondo `--bg`.
- **CA-3 Metadatos y Viewport de Next.js.** `siteMetadata` declara
  `manifest: "/manifest.webmanifest"` y `appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "marcador.gal" }`.
  Los layouts raíz (`src/app/(gl)/layout.tsx` y `src/app/(es)/es/layout.tsx`)
  exportan `viewport` con `themeColor: COLORS.bg.value`.
- **CA-4 Tests automatizados (`src/app/manifest.test.ts` e `icon.test.ts`).**
  - Comprueba los campos requeridos del manifiesto.
  - Comprueba la existencia y dimensiones exactas de los iconos de 192 y 512 px.
  - Comprueba la presencia de `appleWebApp` y `manifest` en `siteMetadata`.
- **CA-5 Gates y no-hex.** `npm run gates` en verde. Ningún color hexadecimal
  fuera de `tokens.ts`.

## Entidades y reglas afectadas
D-1, D-8. `src/design/icon.ts`, `src/app/metadata.ts`, `src/app/manifest.ts`.
