# Herencia del sistema de diseño

Esta carpeta es una copia íntegra, sin editar, de `docs/diseno/` del repo
previo `tremen-dev/marcador.gal` (estado a 2026-09-12). Es la referencia
vinculante (D-8, ADR-005).

- Fuente editable: `*.tpl.html` + `_logic.js`; `build.mjs` genera los `*.dc.html`.
- `_tokens.css`: paleta y familias. `canvas.json`: los seis artboards.
- `sistema-de-deseno-marcador-gal.html`: export monolítico completo.

Lo que **no** se hereda está enumerado en `docs/adr/ADR-005-sistema-de-diseno-heredado.md`.

## Cambios posteriores

- **2026-11-03 (SPEC-045 CA-2, H-2, H-3).** Cambian `Escritorio.tpl.html`,
  `Movil.tpl.html` y `_logic.js`, y con `node build.mjs` los tres `.dc.html`
  (`Global.dc.html` solo por los nombres). Escritorio pierde el lateral
  «Competicións» (236 px), el panel de detalle (372 px) y la ★: la zona
  principal es la rejilla de SPEC-040 CA-4 (columnas de 360 px, hueco y
  relleno de 16 px, `align-items: start`; a 1440 caben 3) con cabecera por
  columna y el margen de dos líneas de SPEC-040 CA-2, que también gana
  Movil. La cabecera dibuja la regla de SPEC-045 CA-3 (el nombre solo se
  parte antes de « · »); por eso `_logic.js` usa los nombres canónicos
  «Terceira Federación · Grupo 1» y «Primeira Federación · Grupo 1».
- `sistema-de-deseno-marcador-gal.html` **no** se regenera: sigue siendo la
  foto del 2026-09-12.
- Los artboards no se pueden renderizar desde el repo: falta `support.js`.
- **2026-11-08 (SPEC-065 CA-5, ADR-029 §4).** La marca pasa al celeste de
  Galicia: `_tokens.css` cambia `--marca`, `--marca-deep` y `--marca-ink` y
  gana `--victoria` (resultado, no marca). Las tres plantillas `*.tpl.html`
  cambian los tres hex y la tinta `rgba(…,.12)` de marca, y con
  `node build.mjs` sus `.dc.html`; `Componentes.dc.html` y `Main.dc.html`, lo
  mismo a mano. En esos artboards el ▮ sigue siendo glifo (SPEC-065 H-2): la
  referencia del bloque dibujado es `Marca.dc.html`, que presenta el logotipo
  con el bloque, el icono de una barra (oscuro y celeste, a 72/32/16 px) y
  guarda las semillas A/B/C en un bloque `data-historia` con su color original.
- **2026-11-10 (SPEC-072 CA-8, H-1 = A).** Cambian `Movil.tpl.html` y
  `Escritorio.tpl.html`, y con `node build.mjs` sus `.dc.html` (y
  `Global.dc.html`, sin cambios de contido). Las ‹ › de semana (SPEC-027
  CA-6) pasan a flanquear el título: en móvil, a ambos lados del texto en la
  fila de 42 px (el glifo de ‹ sobre el margen de 14 px; caja de 26 px y
  alto de la fila), sin altura extra; en escritorio, en la barra superior,
  cajas de 24 px y alto de la barra. Mismo glifo y color que antes (sans 400
  14/15 px, `--fg-dim`). La tira de días sigue dibujada como opcional
  (SPEC-061, `SHOW_DAY_STRIP`) y sin flechas: si se sirve, las ‹ › vuelven a
  sus extremos y no al título; nunca están en los dos sitios.
- **2026-11-11 (SPEC-081 CA-8, ADR-035).** Tercera familia, solo para el
  lema: `_tokens.css` gana `--hand` (Caveat y, detrás, la pila de `--sans`) y
  Caveat 400 en su `@import` de referencia. Cambian `Movil.tpl.html` y
  `Escritorio.tpl.html`, y con `node build.mjs` sus `.dc.html` (y
  `Global.dc.html`, sin cambios de contenido): la cabecera dibuja «todo o
  fútbol galego» en Caveat 400, `--fg` al 72 %; en móvil, 16 px debajo del
  wordmark y alineado a su izquierda (18 + 2 + 16 px en la barra de 52); en
  escritorio, 19 px a su derecha, en su línea base y a 10 px. Siempre en
  galego, también en `/es`.
- **2026-11-11 (SPEC-057 CA-6).** Tokens por liga solo en código, sin
  artboard: `LEAGUE_COLORS` en `src/design/tokens.ts` (`--liga-<id>` en
  `tokens.css`, ocho ligas) para el punto de identificación de cada liga en el
  panel «⚙ Ligas»; nunca indican estado y van siempre junto al nombre.
- **2026-11-11 (SPEC-057 CA-6/CA-3, F-SPEC-057-7/8).** Elevación solo en
  código, sin artboard: `ELEVATION` en `src/design/tokens.ts` (`--velo`, el
  velo negro al 75 % tras un diálogo modal, y `--sombra-dialogo`, la sombra de
  su tarjeta). Los interruptores del panel «⚙ Ligas» marcan el foco de teclado
  con un anillo de `--focus-ring` en `--marca`, separado `--focus-ring` del
  control.
