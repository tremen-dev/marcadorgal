---
id: SPEC-028
tipo: spec
epica: EPIC-003
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-10, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-10, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-10-10, por: sdd-implementador}
---
# SPEC-028 — Mejoras de navegación: lateral, logo y título de la xornada

## Problema
El titular, usando la pantalla (2026-10-10): (1) en escritorio, pulsar una
entrada del lateral «Competicións» pliega o despliega su competición, pero casi
todas quedan más abajo, fuera de la vista: el clic no lleva a ningún sitio
(SPEC-023 CA-7 dice que el lateral pliega; esta spec lo **enmienda**); (2) el
logo no es un enlace: no hay forma de volver a «como al abrir la app»; (3) no
se ve qué xornada se está mirando: el `<h1>` «Xornada» es solo para lectores de
pantalla y, desde las flechas de SPEC-027, se puede estar en otra semana sin
saberlo.

## Usuarios / roles afectados
- Público, en móvil y escritorio, gl y es, con y sin JS. El lateral solo existe
  en escritorio (SPEC-023 CA-7): en móvil no hay equivalente que cambiar.

## Criterios de aceptación
Sin lecturas nuevas, sin migración, sin dependencias.
- **CA-1 El lateral lleva, no pliega (H-1, H-2).** Con JS, en escritorio, pulsar una entrada del lateral: abre su `<details>` si estaba plegada (nunca pliega), desplaza la página hasta su sección y mueve el foco a su `<summary>`. La URL no cambia (pathname, query y fragmento `#d=…&f=…` idénticos; `history.length` igual) y día y filtro siguen aplicados. La entrada deja de llevar `aria-expanded`, `aria-controls` y ▾/▸: es un enlace a su sección. Plegar queda solo en la cabecera (SPEC-023 CA-5 sigue en pie). Tras el salto, la `<summary>` de destino está entera dentro del viewport y ningún elemento la tapa (`elementFromPoint` en su centro cae dentro de ella), también si en el futuro hay algo `sticky` arriba: la sección lleva `scroll-margin-top` por token. Con `prefers-reduced-motion: reduce` el desplazamiento es instantáneo; sin esa preferencia puede ser suave.
- **CA-2 Sin JS y fragmento.** Con `javaScriptEnabled: false` la entrada es un `<a href="#xornada-<id>">` y lleva a la sección con el mismo criterio de visibilidad de CA-1 (no promete abrir una sección plegada a mano). Un fragmento `#xornada-<id>` al cargar con JS no es estado de filtro: `parseFragment` lo ignora (xornada entera, Todos) y la página no falla. Test unitario de `parseFragment` con ese caso.
- **CA-3 Lateral siempre a mano (H-3, H-4).** Desde 1024 px el lateral es `position: sticky` arriba y, si es más alto que el viewport, desplaza dentro de sí mismo; tras saltar a la última competición sigue visible. Con JS, la entrada de una competición oculta por día o filtro (SPEC-023 CA-3) se oculta con `hidden` junto a su sección y vuelve al cambiar el estado.
- **CA-4 El logo vuelve al estado inicial (H-5).** El logo es un `<a href>` a `/` (en gl) o `/es` (en es) desde toda pantalla de la xornada (portada, `/xornada/[fecha]`, demos), con nombre accesible i18n `xornada.home` (gl «marcador.gal, xornada actual»; es «marcador.gal, jornada actual»), el mismo aspecto que hoy, sin subrayado y con foco visible. **Estado inicial** = tras activarlo: `location.pathname` es `/` (`/es`), `location.hash` es `""`, `scrollY` es 0, todos los `<details>` abiertos, ningún día con `aria-current`, «Todos» con `aria-current` y visibles todas las filas servidas. Playwright, con y sin JS, desde: `/#d=<día>&f=finished` con dos competiciones plegadas y la página desplazada; y (en `e2e:db`) una semana pasada `/xornada/<semana>` → `/`.
- **CA-5 Rango de la xornada (puro, H-7).** `src/xornada/` exporta `xornadaRange(days, locale)`: con el primer y último `date` de `xornadaDays` (los mismos de la tira) y los meses de `month.*`: mismo mes → «10–12 out»; meses distintos → «30 set – 2 out» (es «30 sep – 2 oct»); un solo día → «11 out»; lista vacía → `null`. Día sin cero inicial, guion `–` (U+2013), sin año ni día de la semana, fechas `Europe/Madrid` (ya en `days`). Test de tabla gl y es con esos casos y un rango que cruza el cambio de hora (2026-10-25).
- **CA-6 Título visible (opción A de H-6).** El `<h1>` único de la página pasa a visible con texto i18n `xornada.heading` = «Xornada · {range}» (es «Jornada · {range}»), o solo `xornada.title` si `xornadaRange` es `null` (sin datos o `unavailable`). Escritorio: en la cabecera de 56 px, tras el logo y a 28 px, en el hueco de la pestaña «Xornada» de `Escritorio.tpl.html` (sans 600 13 px, subrayado interior de 2 px `--marca`). Móvil: fila de 42 px (`barMobileSegment`, la del segmento Xornada|Global de `Movil.tpl.html`) entre la tira y los filtros, mismo texto y letra. El rango es el de la semana servida, no cambia al elegir día o filtro, y coincide con el primer y último día de la tira; en `/xornada/[fecha]` dice las fechas de esa semana. Con JS, si el cliente de SPEC-024 repinta y cambian los días, el título los sigue.
- **CA-7 Diseño y matriz e2e.** Playwright en `/demo/xornada` y `/es/demo/xornada` (y la página de semana de `e2e:db`), a 360, 390, 1024 y 1440 px, con y sin JS: CA-1/CA-3 a 1024 y 1440; CA-4 y CA-6 en los cuatro anchos; título y logo sin `scrollWidth > clientWidth` ni `text-overflow: ellipsis`; sin scroll horizontal de página (D-2); textos solo de `src/i18n/` (paridad gl/es); colores por tokens; ningún `font:` (tests de `src/design/`); ningún estado solo por color (el título es texto; el subrayado es decoración).
- **CA-8 Gates.** `npm run gates`, `e2e`, `e2e:db` y `test:db` en verde; e2e de SPEC-023 CA-9 actualizado a la nueva letra (el lateral ya no pliega). `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/app/api supabase` vacío.

## Entidades y reglas afectadas
Xornada (`dominio.md`; la semana es clave de navegación, SPEC-027 H-1). D-2,
D-8. ADR-005 (exc. 4: sin Global ni Clasificacións; exc. 6: objetivos ≥ 24 px).
**Enmienda SPEC-023 CA-7** («que pliega/despliega su competición» → «que lleva
a su competición») y **CA-9** (la entrada del lateral ya no oculta filas).
SPEC-023 CA-4/H-5 (fragmento), SPEC-024 (cliente), SPEC-027 CA-2/CA-6 (semanas,
flechas).

## Fuera de alcance
Un índice de competiciones en móvil; recordar el plegado; resaltar en el
lateral la sección visible (scroll-spy); número de xornada común (no existe,
SPEC-027 H-1); cambiar la tira o las flechas.

## Notas para el gate humano
- **H-1 Lateral = navegación; plegar solo en la cabecera.** Recomendado. Alternativa: que el lateral siga plegando y además desplace al abrir: el mismo clic haría dos cosas según el estado.
- **H-2 El salto con JS no toca la URL** (ni ancla en el fragmento ni entrada de historial): mezclar `#xornada-x` con `#d=…&f=…` rompería SPEC-023 H-5. Recomendado. Coste: el salto no se comparte por enlace.
- **H-3 Entrada del lateral oculta con su sección** cuando día o filtro la vacían. Recomendado. Alternativa: dejarla con «0» y que el clic no haga nada (enlace muerto).
- **H-4 Lateral `sticky`** en escritorio. Recomendado: sin él, tras saltar abajo el lateral queda arriba, fuera de la vista, y vuelve el problema. Solo CSS. Si se rechaza, se quita de CA-3.
- **H-5 Logo = navegación completa a `/`**, sin interceptar con JS: una petición cacheada (ISR, ADR-014 §6), mismo resultado con y sin JS, y reinicia el cliente en directo. Recomendado. Alternativa: reiniciar en cliente sin recargar (más código, riesgo de estado residual).
- **H-6 Dónde va el título.** **A (recomendada) — en el sitio de la pestaña «Xornada» del diseño:** escritorio, en la cabecera junto al logo, subrayado verde como pestaña activa; móvil, una fila propia bajo la tira (la del segmento Xornada|Global). Usa huecos que el diseño ya tiene; en móvil cuesta 42 px de alto. **B — encabezado al principio de la lista:** «Xornada · 10–12 out» como titular grande encima de la primera competición, en la columna de filas; no ocupa barras fijas pero se va al hacer scroll y no está en el diseño. **C — solo cuando no es la actual:** en `/` nada nuevo; en otra semana, una franja «Estás vendo a xornada do 3–5 out · Ir á actual»; mínimo, pero en la portada no gana visibilidad. CA-6 está escrito para A; con B o C se reescribe antes de aprobar.
- **H-7 Texto: «Xornada · primer–último día con partidos»**, igual en todas las semanas. Recomendado. Alternativas: la ventana martes–lunes («6–12 out», incluye días sin partidos y confunde); añadir «esta semana» / «pasada» (más texto; el logo ya devuelve a la actual). Efecto: un `live` de otra ronda en la portada alarga el rango, igual que la tira (SPEC-023 CA-1).
- **N-1** Hoy nada es `sticky` arriba; el `scroll-margin-top` de CA-1 deja holgura y protege el salto si algún día lo hay.
- **N-2** Hasta hidratar, pulsar el lateral hace el salto nativo (CA-2) y pone `#xornada-<id>`; es inofensivo.
- **Decididas por el titular (Alberto Fojo, 2026-10-10):** H-1..H-5 y H-7 según recomendación; H-4 = sí, lateral sticky en escritorio; **H-6 = opción A** (título como pestaña activa: barra superior en escritorio, franja de 42 px entre la tira y los filtros en móvil). Spec aprobada.
- **F-SPEC-028-1 aceptado por el titular (Alberto Fojo, 2026-10-10):** la parte pura del rango (`xornadaSpan`) vive en `src/xornada/range.ts` y `xornadaRange` (textos i18n) en `src/components/xornada/labels.ts`, por la frontera de SPEC-019 CA-2.
