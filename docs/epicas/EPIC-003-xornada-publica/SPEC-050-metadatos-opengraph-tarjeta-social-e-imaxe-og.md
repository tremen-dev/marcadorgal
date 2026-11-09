---
id: SPEC-050
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
# SPEC-050 — Metadatos Open Graph, tarjeta social e imagen og.png

## Problema
El titular (Alberto Fojo, 2026-11-07) comparte `marcador.gal` por WhatsApp
para iniciar la validación orgánica del proyecto. La previsualización actual
en WhatsApp y redes muestra únicamente el icono cuadrado pequeño de 32/180 px
(`apple-touch-icon.png`), el título «Xornada · marcador.gal» y el dominio, sin
descripción explicativa ni tarjeta horizontal enriquecida.

En el código (`src/app/metadata.ts` y `src/app/xornada-home.tsx`):
1. No se define `metadataBase`, lo que impide a Next.js resolver rutas
   absolutas canónicas para imágenes sociales.
2. No se definen `description`, `openGraph` ni `twitter`.
3. No existe la imagen de previsualización `public/og.png` (estándar 1200 × 630 px)
   acorde al sistema de diseño de `docs/diseno/Marca.dc.html`.

El titular decide (2026-11-07):
- Texto de la descripción: «Resultados galegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF e 3ª RFEF» (gl) y su correspondencia en es, sin mención a publicidad.
- Título para la tarjeta OG: «marcador.gal · Todo o fútbol galego nunha pantalla» (gl) y «marcador.gal · Todo el fútbol gallego en una pantalla» (es).

## Usuarios / roles afectados
- Seareiros y usuarios que reciben enlaces compartidos por WhatsApp, Telegram, X (Twitter), etc.
- Titular y colaboradores en la difusión del proyecto.

## Criterios de aceptación
- **CA-1 Diccionarios i18n (`src/i18n/`).** `common.claim` y `common.description` en `gl.ts` y `es.ts`. En `gl`: `claim` = «Todo o fútbol galego nunha pantalla», `description` = «Resultados galegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF e 3ª RFEF». En `es`: `claim` = «Todo el fútbol gallego en una pantalla», `description` = «Resultados gallegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF y 3ª RFEF». Test de paridad y placeholders en `i18n.test.ts`.
- **CA-2 Metadatos del sitio y de la portada (`src/app/`).** `siteMetadata(locale)` define `metadataBase: new URL("https://marcador.gal")`. `homeMetadata(locale)` define `description`, `openGraph` (`title`, `description`, `url`, `siteName`, `locale`, `type: "website"`, `images` con `/og.png`, 1200 × 630 px, `alt`) y `twitter` (`card: "summary_large_image"`, `title`, `description`, `images: ["/og.png"]`).
- **CA-3 Imagen `public/og.png` y herramienta (`tools/og-image.mjs`).** Una imagen PNG estática en `public/og.png` de 1200 × 630 px generada con Chromium y Playwright. Sigue estrictamente los tokens de `src/design/tokens.ts`: fondo `--bg` (`#111110`), logotipo tipográfico `marcador` + bloque verde `▮` (`--marca`) + `gal`, claim `--fg` («Todo o fútbol galego nunha pantalla»), subtítulo descriptivo `--fg-muted` y pastillas de las 5 competiciones cubiertas. Tamaño de archivo < 300 KB. Script reproducible mediante `node tools/og-image.mjs` y comando `npm run og:image`.
- **CA-4 Tests automatizados (`src/app/metadata.test.ts` y `src/design/og.test.ts`).**
  - Los metadatos de inicio contienen `metadataBase`, `description`, `openGraph` y `twitter` con tarjeta `summary_large_image`.
  - `public/og.png` existe, es un PNG válido, tiene dimensiones 1200 × 630 px y pesa menos de 300 KB.
- **CA-5 Gates y no-hex.** `npm run gates` en verde. Ningún hex fuera de `tokens.ts`/`tokens.css`.

## Entidades y reglas afectadas
D-1, D-2, D-8. `src/i18n/`, `src/app/metadata.ts`, `src/app/xornada-home.tsx`.

## Fuera de alcance
Generación dinámica per-match de imágenes OG (Edge OG); páginas de partido individual (fuera de v1).
