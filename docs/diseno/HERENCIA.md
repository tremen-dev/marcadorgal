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
