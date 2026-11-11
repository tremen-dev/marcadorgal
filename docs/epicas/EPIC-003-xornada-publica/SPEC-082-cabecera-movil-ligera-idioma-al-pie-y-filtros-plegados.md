---
id: SPEC-082
tipo: spec
epica: EPIC-003
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-11, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-11, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-11, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-11, por: sdd-implementador}
---
# SPEC-082 — Cabecera móvil ligera: idioma al pie y filtros plegados

## Problema
En móvil, antes del primer partido se apilan logo + lema, `gl·es`, la fila del título («‹ Xornada · 6–16 nov ›»), los chips «Todos / En xogo / Rematados», «⚙ Ligas» y «Actualizado ás HH:MM». El titular quiere una cabecera menos cargada. Decisiones del titular (no se reabren): (1) `gl·es` sale de la cabecera y va al pie de SPEC-058 en todas las anchuras; (2) en móvil, chips y «Ligas» se pliegan tras un único botón de filtros; en escritorio siguen como hoy (SPEC-023); (3) el botón marca los filtros activos sin depender del color, con nombre accesible y `aria-expanded`; (4) la línea de frescura (SPEC-024 CA-8, RN-11) no cambia.

## Usuarios / roles afectados
Público de Xornada (`/`, `/es`, `/xornada/*`, `/es/xornada/*`, `/demo/xornada`, `/es/demo/xornada`) y de toda página con el pie (SPEC-058).

## Criterios de aceptación
Móvil = por debajo de `MEASURE.breakpointDesktop` (1024 px, SPEC-023 CA-7); escritorio = desde 1024. Sin token nuevo de breakpoint.
- **CA-1 (cabecera sin idioma)**: Dado las rutas de Xornada a 360, 390, 1024 y 1440 px, cuando se pinta, entonces dentro de `header` no hay `[data-testid="locale-switch"]` ni enlaces `hreflang`; la `.bar` móvil sigue en 52 px y la de escritorio en 56 px.
- **CA-2 (idioma en el pie)**: Dado cualquier página pública (Xornada, competición, clasificación, calendario, directos, legales) en gl y es a 360 y 1440, cuando se pinta el pie, entonces contiene un único `<nav data-testid="locale-switch">` con nombre i18n `xornada.locale`, enlaces `gl` y `es` con `hreflang`, `lang` y `aria-current="page"` en la lengua actual, y cada enlace apunta a la ruta equivalente de la otra lengua. La equivalencia es una función pura (`localePaths(pathname)`) con test de tabla: prefijo `/es` en Xornada, semanas, demo, competición, clasificación, calendario y directos; `privacidade ↔ privacidad` (`LEGAL_ROUTES`); ruta desconocida → portada de la otra lengua. En Xornada con JS, el enlace conserva el fragmento `#d=…&f=…` (SPEC-023 CA-4) aunque el pie esté fuera de `[data-xornada]`. En móvil, cada enlace ≥ 44 × 44 px.
- **CA-3 (botón de filtros, móvil)**: Dado Xornada a 360 y 390 con JS, cuando se pinta, entonces en la `.bar`, a la derecha (hueco que deja `gl·es`), hay un `<button type="button" data-testid="filters-toggle">` de ≥ 44 × 44 px con icono SVG de filtros (`currentColor`, `aria-hidden`), `aria-expanded="false"` y `aria-controls` apuntando al panel; chips y «Ligas» no se ven (`[data-testid="filters"]` oculto) y la línea de frescura queda bajo la fila del título. A 1024 y 1440 el botón no se pinta (`display: none`) y `[data-testid="filters"]` y «Ligas» se ven como hoy.
- **CA-4 (abrir y cerrar)**: Dado el botón plegado, cuando se pulsa, entonces `aria-expanded="true"` y aparecen, en flujo bajo la fila del título, los tres chips y «Ligas» (sin superponerse a filas). Cuando se elige un chip, el filtro se aplica (SPEC-023 CA-3/CA-4) y el panel se pliega con el foco en el botón. `Escape` con el foco en el panel lo pliega y devuelve el foco al botón. «Ligas» abre su diálogo (SPEC-057) sin plegar el panel. El estado plegado/abierto no va en la URL ni en `localStorage`: cada carga empieza plegado.
- **CA-5 (marca de filtro activo)**: Dado `n` = (filtro de estado ≠ Todos ? 1 : 0) + (alguna liga oculta en `marcadorgal:preferences:visible-leagues:v1` ? 1 : 0), cuando `n > 0`, entonces el botón muestra una insignia con el número `n` (dígitos tabulares, `aria-hidden`, posición absoluta sobre el icono: no desplaza nada) y su nombre accesible es `xornada.filtersActive` con `n` («Filtros: 1 activo» / «Filtros: 2 activos»; es igual); con `n = 0`, sin insignia y nombre `xornada.filters` («Filtros»). Se actualiza al cambiar chip, preset o interruptor, y al cargar `#f=live`. Función pura `activeFilterCount(state, hiddenLeagues)` con test de tabla. Playwright: el nombre accesible cambia (no solo el color).
- **CA-6 (sin JavaScript)**: Dado `javaScriptEnabled: false` a 360, cuando se pinta Xornada, entonces el botón no se ve y los chips y «Ligas» se ven como hoy (SPEC-023 CA-6); con JS, primera pintura ya plegada, sin parpadeo ni `layout-shift` en la cabecera (p. ej. `<noscript><style>`). Ningún botón muerto.
- **CA-7 (i18n, tokens, letra)**: Dado `gl.ts` y `es.ts`, cuando corre `i18n.test.ts`, entonces `xornada.filters` y `xornada.filtersActive` (singular y plural) existen en ambos; ningún literal en `.tsx`; colores solo de tokens (insignia `--marca` / `--marca-ink`, icono `--fg-dim`, foco visible); ningún `font:` bajo `src/` (tests de `src/design/`).
- **CA-8 (diseño, D-8)**: Dado `docs/diseno/`, cuando se revisa, entonces `Movil.tpl.html` y `Escritorio.tpl.html` ya no dibujan `gl·es` en la cabecera; `Movil.tpl.html` dibuja el botón de filtros plegado (con insignia «1») y el panel abierto; sus `.dc.html` se regeneran con `node build.mjs`, y `HERENCIA.md` tiene la entrada 2026-11-xx que dice que `gl·es` vive en el pie de SPEC-058 (no dibujado en `docs/diseno/`, ver H-1).
- **CA-9 (verificación y gates)**: Dado la rama `ft/SPEC-082-…`, cuando corren los e2e en `/demo/xornada` y `/es/demo/xornada` a 360, 390, 1024 y 1440 (con y sin JS), entonces pasan; las pruebas existentes que usan chips en móvil (SPEC-023 CA-9, SPEC-057, SPEC-028 CA-4) abren antes el panel; sin scroll horizontal ni truncados (SPEC-023 CA-8); capturas en `_qa/SPEC-082/` (360 plegado, 360 abierto con insignia, 1440); `npm run gates` en verde y versión `minor`.

## Entidades y reglas afectadas
D-2, D-8 (ADR-005: nunca solo color), RN-11 (sin cambios). **Enmienda**: SPEC-019 CA-6 (`gl·es` ya no está en la cabecera), SPEC-023 CA-3/CA-6/CA-7/CA-9 (en móvil, chips tras el botón; cabecera de escritorio sin `gl·es`), SPEC-057 CA-1/CA-3 (cabecera sin `gl·es`; «Ligas» dentro del panel en móvil), SPEC-058 CA-1 (el pie gana el selector), SPEC-061 CA-4 (orden de controles: `["filters"]` / `["day-strip","filters"]`), SPEC-081 CA-4/CA-5 (las medidas contra `gl·es` pasan a hacerse contra el botón en móvil; en escritorio desaparecen). **No cambian**: SPEC-024 CA-8, SPEC-028 CA-4/CA-6 (logo y título; el estado inicial empieza plegado), SPEC-072.

## Fuera de alcance
Tira de días (SPEC-061, sigue fuera del panel si se activa); cambiar el contenido del diálogo «Ligas»; recordar la lengua elegida; plegar nada en escritorio.

## Notas para el gate humano
- **Decisiones del arquitecto**: umbral 1024 px (el único breakpoint del código); el chip pliega el panel (un toque, un resultado: se ven las filas y la insignia lo confirma); «Ligas» no lo pliega (su diálogo es modal y al cerrarlo vuelves al panel); plegado sin persistencia (como plegar competición, SPEC-023 CA-5: la insignia ya avisa); insignia con número y no punto (dice cuántos sin depender del color); botón en la `.bar` (la fila de filtros desaparece entera al plegar); selector en el pie en todas las páginas (el pie es global; una función pura da la ruta equivalente).
- **H-1**: `docs/diseno/` no tiene pie. ¿Se dibuja un artboard de pie (con `gl·es`) o basta con la entrada de `HERENCIA.md`? La spec asume lo segundo.
- **H-2**: SPEC-057 sigue en `borrador` en el tablero aunque «⚙ Ligas» está en producción. Esta spec la enmienda igual; conviene regularizarla.
- **H-3**: ¿Texto «Filtros» visible junto al icono o solo icono? La spec asume solo icono (con nombre accesible).
