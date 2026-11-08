---
id: SPEC-064
tipo: spec
epica: EPIC-003
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-08, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-08, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-08, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-08, por: sdd-implementador}
---
# SPEC-064 — Assets de redes sociales y og.png con la identidad celeste

## Problema
Con ADR-028 la marca es celeste, el ▮ un bloque dibujado y el icono una barra sola, pero `public/og.png`, `public/twitter-avatar.png` y `public/twitter-header.png` siguen con el verde, el glifo ▮ y la semente B. `og.png` lleva además una píldora «EN XOGO» con punto verde: marca usada como estado (contra ADR-005/028) y, en una imagen estática, una afirmación de directo que casi siempre es falsa. El titular pide (2026-11-08) el juego completo de piezas para redes, reproducible desde código. Depende de SPEC-063 (`COLORS`, `iconSvg` con `variant`, `Wordmark`).

## Usuarios / roles afectados
- Quien recibe un enlace por WhatsApp/X/Telegram; seguidores en redes; el titular, que sube las piezas a mano.

## Criterios de aceptación
- **CA-1 Catálogo único.** `src/design/social.ts` exporta `SOCIAL_ASSETS`: por pieza `path`, `width`, `height`, `variant` (`dark` = fondo `bg` + barra `brand`; `brand` = fondo `brand` + barra `bg`), `crop` (`circle` | `rect`), zona segura. Contenido:

  | Pieza | Fichero(s) | px | Variante | Recorte |
  |---|---|---|---|---|
  | Open Graph | `public/og.png` | 1200×630 | dark | rect |
  | X avatar | `assets/redes/x-avatar-{oscuro,celeste}.png` | 400×400 | ambas | circle |
  | X cabecera | `assets/redes/x-header.png` | 1500×500 | dark | rect |
  | Instagram perfil | `assets/redes/ig-perfil-{oscuro,celeste}.png` | 1080×1080 | ambas | circle |
  | Instagram post 1:1 / 4:5 | `assets/redes/ig-post-1080x1080.png`, `ig-post-1080x1350.png` | — | dark | rect |
  | Instagram story/reel | `assets/redes/ig-story.png` | 1080×1920 | dark | rect |
  | Instagram destacadas | `assets/redes/ig-destacada-{oscuro,celeste}.png` | 1080×1920 | ambas | circle |
  | WhatsApp perfil | `assets/redes/whatsapp-perfil-{oscuro,celeste}.png` | 640×640 | ambas | circle |
  | Bluesky avatar | `assets/redes/bluesky-avatar-{oscuro,celeste}.png` | 1000×1000 | ambas | circle |
  | Bluesky banner | `assets/redes/bluesky-banner.png` | 3000×1000 | dark | rect |

  `oscuro` = variante `dark`, `celeste` = variante `brand`; ninguna se declara principal (la elige el titular con la hoja de CA-6). Todas son obligatorias.
- **CA-2 Generación reproducible.** `node tools/redes.mjs` (`npm run redes`) pinta todo `SOCIAL_ASSETS` salvo `og.png` con el Chromium de Playwright, Geist de `public/fonts/`, el icono de `iconSvg` y el wordmark con el bloque dibujado de SPEC-063 (sin el carácter ▮); colores solo de `COLORS`. `tools/og-image.mjs` usa los mismos helpers. `tools/twitter-assets.mjs` y `public/twitter-avatar.png`/`twitter-header.png` se borran (la cuenta aún no existe; nadie las enlaza). Ejecutar dos veces deja `git status` limpio en `assets/redes/` y `public/`.
- **CA-3 Texto.** Las piezas de `assets/redes/` solo llevan el wordmark y, en cabeceras/story/post, el dominio `marcador.gal` (nombres propios, no se traducen). `og.png` conserva titular y subtítulo en gl (SPEC-050 CA-3) y las píldoras de competición.
- **CA-4 og.png sin falso directo.** Desaparece la píldora «EN XOGO» y su punto; icono de barra sola y wordmark con bloque. Test: 1200×630, < 300 KB (SPEC-050), ningún píxel a ΔE < 10 de `#56DB8F` ni de ember `#FF6B00`.
- **CA-5 Medidas, colores y zona segura (tests de `src/design/`).** Por cada pieza presente en disco: PNG válido con `width`×`height` exactos; la esquina (2,2) es el fondo de su variante; entre los píxeles que no son fondo, el color mayoritario es `brand` (dark) o `bg` (brand); ninguna pieza contiene `#56DB8F`/`#35C177` (ΔE < 10). `crop: circle`: todo píxel que no es fondo cae dentro del círculo centrado de radio 0.40·lado. `crop: rect`: todo píxel que no es fondo cae dentro de su zona segura (X cabecera: x 360–1140, y 90–410, libre del avatar abajo a la izquierda; Bluesky banner: x 720–2280, y 180–820; story: y 250–1670). Destacadas (1080×1920, `circle`): círculo de radio 0.40·1080 centrado. Falta una pieza del catálogo = test rojo.
- **CA-6 Evidencia y gates.** Una hoja `_qa/SPEC-064/contacto.png` con todas las piezas, las dos variantes de cada avatar lado a lado y la máscara circular superpuesta donde aplica: con ella elige el titular. `npm run gates` en verde; `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/app supabase` vacío salvo tests.

## Entidades y reglas afectadas
ADR-028, ADR-005 (marca nunca es estado), SPEC-050 CA-3 (og.png: cambia el arte, no los metadatos), SPEC-063 (dependencia), D-2 (texto de interfaz: aquí no hay más que nombres propios y el og en gl).

## Fuera de alcance
Subir las piezas a las redes (lo hace el titular). og por idioma (`/es` sigue sirviendo la gl). Facebook (no hay página) y Threads (usa la foto de Instagram). Marca de agua de la captura compartida (ADR-005 exc. 5: va con la spec de la pantalla). Plantillas con contenido dinámico (resultados).

## Notas para el gate humano
- **H-1 Dónde viven.** `public/` solo lo que el sitio sirve (`og.png`); lo que se sube a mano va a `assets/redes/`, fuera del despliegue y sin URL que mantener.
- **H-2 Píldora del og.** Se quita: en ember mentiría casi siempre en una imagen fija.
- **Respuestas del titular (2026-11-08):** todas las piezas entran y son obligatorias; avatares, perfiles y destacadas en las dos variantes sin principal, la elección se hace con la hoja de `_qa/`; `public/twitter-*.png` se borran sin reserva.
