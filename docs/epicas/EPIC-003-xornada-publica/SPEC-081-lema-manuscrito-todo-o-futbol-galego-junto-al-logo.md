---
id: SPEC-081
tipo: spec
epica: EPIC-003
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-10, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-10, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-11, por: sdd-verificador}
---
# SPEC-081 — Lema manuscrito «todo o fútbol galego» junto al logo

## Problema
El titular quiere que, junto al wordmark «marcador▮gal», se lea el lema «todo o fútbol galego» en manuscrita (Caveat), discreto, sin quitar protagonismo al logo. Decisiones del titular (no se reabren): Caveat 400 autoalojada, `--fg` al 72 %, escritorio 19 px a la derecha alineado por línea base con ~10 px de separación, móvil 16 px debajo, siempre en galego (también en `/es`) pero vía i18n. La familia nueva la registra **ADR-035** (enmienda ADR-005/ADR-001 y edita `docs/diseno/`).

## Usuarios / roles afectados
Público de la pantalla Xornada (`/`, `/es`, `/xornada/*`, `/es/xornada/*`, `/demo/xornada`, `/es/demo/xornada`). La única cabecera con logo es `XornadaHeader` (`.bar` › `a.logo`); el resto de páginas (competición, calendario, clasificación, directos, legales) no muestran logo en cabecera.

## Criterios de aceptación
- **CA-1 (fuente)**: Dado el repo, cuando corre `fonts.test.ts`, entonces `FACES` incluye `{family: "Caveat", weight: 400}` con su `.woff2` en `public/fonts/` (≤ 50 KB, contiene el glifo «ú» U+00FA), un único `@font-face` con `font-display: swap`, la licencia OFL de Caveat en `public/fonts/`, `FAMILIES.hand` en paridad con `--hand` de `docs/diseno/_tokens.css`, y ningún fichero bajo `src/` referencia `fonts.googleapis.com` ni `fonts.gstatic.com`.
- **CA-2 (i18n)**: Dado `gl.ts` y `es.ts`, cuando corre `i18n.test.ts`, entonces la clave del lema existe en ambos con el valor idéntico «todo o fútbol galego», y el componente lo lee con `t()` (ningún literal del lema en `.tsx`).
- **CA-3 (escritorio)**: Dado `/` y `/es` a 1024 y 1440 px, cuando se pinta la cabecera, entonces el lema mide 19 px, familia Caveat, peso 400, color `--fg` con opacidad efectiva 0.72, está a la derecha del wordmark con su línea base a ±1 px de la del wordmark y separación horizontal de 10 ± 2 px, y su `font-size` es menor que el del wordmark (21 px).
- **CA-4 (escritorio, sin empujar)**: Dado anchos 1024, 1100, 1280 y 1440 en gl y es, con y sin flechas, cuando se mide la cabecera, entonces los rectángulos de enlace del logo, lema, fila del título y `gl·es` no se solapan, el título ocupa una sola línea sin recorte (`scrollWidth ≤ clientWidth`) y `gl·es` queda dentro del viewport. Y dado un título forzado de 200 caracteres (mutación del DOM en el test), entonces el lema deja de pintarse entero (`display: none` o fuera del árbol de accesibilidad, nunca cortado a medias) antes que el título se trunque. Mecanismo solo CSS (funciona sin JavaScript).
- **CA-5 (móvil, encaje)**: Dado `/` y `/es` a 360 y 768 px, con y sin tira de días, cuando se pinta la cabecera, entonces el lema mide 16 px y está debajo del wordmark, alineado a su borde izquierdo; `--bar-mobile-header` sigue en 52 px (`MEASURE.barMobileHeader` sin cambio) y la `.bar` mide 52 px; las cajas del logo y del lema caben en la cabecera con ≥ 2 px de margen arriba y abajo, no se solapan entre sí ni con `gl·es`; y la posición `top` de `.title`, de la tira y de los filtros es idéntica (±0.5 px) a la de `main` sin el lema.
- **CA-6 (accesibilidad)**: Dado la cabecera, cuando se inspecciona el árbol de accesibilidad, entonces el lema está **fuera** del enlace del logo (hermano, no hijo), el enlace conserva su nombre `xornada.home` sin cambios, el lema es texto plano (no encabezado ni enlace) con `lang="gl"` también en `/es`, y su contraste efectivo sobre `--bg` es ≥ 4.5:1 (calculado en test unitario desde `COLORS.fg`, `COLORS.bg` y 0.72).
- **CA-7 (sin CLS)**: Dado `/` a 360 y 1440 con la respuesta del `.woff2` de Caveat retrasada 2 s (`page.route`), cuando se comparan los rectángulos del logo, el lema, la fila del título y `gl·es` antes y después de cargar la fuente, entonces son idénticos (±0.5 px) y no hay entradas `layout-shift` cuyo origen esté en la cabecera. No se añade `<link rel="preload">` de Caveat.
- **CA-8 (diseño, D-8)**: Dado `docs/diseno/`, cuando se revisa, entonces `_tokens.css` declara `--hand`, `Movil.tpl.html` y `Escritorio.tpl.html` dibujan el lema en la cabecera con las medidas de CA-3/CA-5 (y sus `.dc.html` regenerados con `node build.mjs`), `HERENCIA.md` tiene la entrada 2026-11-xx y ningún CSS bajo `src/` usa el shorthand `font:` (`fonts.test.ts`).
- **CA-9 (verificación visual y gates)**: Dado la rama `ft/SPEC-081-…`, cuando se ejecutan e2e en `/`, `/es`, `/demo/xornada` y `/es/demo/xornada` a 360 y 1440 (y 1024 para CA-4), entonces pasan y hay capturas en `_qa/SPEC-081/`; `npm run gates` en verde y versión `minor`.

## Entidades y reglas afectadas
ADR-035 (familia `--hand`, uso único, color, carga), ADR-005 (D-8; contraste, solo modo oscuro), ADR-029 §3 (wordmark, que no cambia), ADR-001 (stack), SPEC-026 (primera pintura < 2 s en 3G), SPEC-028 CA-4/CA-6 y SPEC-072 (logo, título y flechas), SPEC-065 CA-3 (wordmark). Reglas de la casa: tokens sin hex, longhands de fuente.

## Fuera de alcance
- El wordmark del pie (`Footer.tsx`, `.brandName`): no es cabecera (ver H-1).
- `og.png`, icono y assets de redes (SPEC-064): sin lema.
- Añadir logo a cabeceras que hoy no lo tienen (competición, legales, directos).

## Notas para el gate humano
- **Requiere aprobar ADR-035** (tercera familia; edita `docs/diseno/`). Sin él, CA-1 y CA-8 chocan con ADR-005.
- **H-1**: ¿el pie (Footer) lleva también el lema? La spec dice no (no es cabecera).
- Decisiones del arquitecto a mirar: altura móvil se queda en 52 px (cabe: 18 + ~2 + 16 = 36 px); el wordmark sube unos 9 px en móvil al apilarse; lema fuera del enlace por WCAG 2.5.3 (el nombre accesible del enlace no contiene el lema), así que el lector lo anuncia como texto aparte tras el enlace; `swap` sin `preload` con caja reservada (en 3G se ve un instante en Geist antes de Caveat, sin desplazar nada); opacidad 0.72 en vez de token (≈ 8.9:1).
