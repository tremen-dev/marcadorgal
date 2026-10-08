---
id: SPEC-023
tipo: spec
epica: EPIC-003
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-08, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-08, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-08, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-10-08, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-10-08, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-10-08, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-10-08, por: sdd-verificador}
---
# SPEC-023 — Escritorio, tira de días, filtros y plegar competición

## Problema
`/` y `/es` sirven la xornada actual (SPEC-020) con el layout móvil de SPEC-019
(máx. 640 px centrado) y sin los controles de `Movil.tpl.html` y
`Escritorio.tpl.html`: tira de días, filtros y plegar competición. En escritorio
se desperdicia la pantalla y en ningún tamaño se puede acotar una xornada de
cinco competiciones y de viernes a lunes (`dominio.md`, Xornada). ADR-005 deja
los breakpoints a esta spec.

## Usuarios / roles afectados
- Público en móvil y escritorio. La spec de Realtime hereda el marcado (N-2).

## Criterios de aceptación
Todo sobre los partidos que ya sirve SPEC-020 CA-5: **sin lecturas nuevas, sin migración** (H-1).
- **CA-1 Días de la xornada (puro).** `src/xornada/` exporta `xornadaDays(matches, now)`: fechas distintas (`Europe/Madrid`) de los `kickoff`, ascendentes, cada una con `date` (`YYYY-MM-DD`), clave i18n del día de la semana, día del mes y `today` (fecha de `now`). `buildXornada` añade a cada fila su `day` y a cada competición su `round` (la ronda más frecuente de sus filas; empate → menor). Test de tabla: `2026-10-24T22:30Z` → `2026-10-25` (CEST) y `2026-10-25T23:30Z` → `2026-10-26` (CET, tras el cambio de hora); `live` de otra ronda añade su día; lista vacía → `[]`; `today` solo en la fecha de `now`.
- **CA-2 Tira de días (H-2, H-3).** Bajo la cabecera, la tira (40 px móvil; en la barra de 44 px en escritorio) pinta un enlace por día de CA-1 con etiqueta i18n «ven 29» / «vie 29»; hoy en mayúsculas («SÁB 30», letra del diseño). Sin día elegido se ve la xornada entera y ningún día va seleccionado. Elegir un día deja solo las filas con ese `day`; elegir el seleccionado lo quita. Seleccionado: fondo `--marca`, peso 600 y `aria-current="true"`, nunca solo color. Con más días de los que caben, la tira desplaza dentro de sí misma; la página nunca tiene scroll horizontal. Sin flechas ‹ › (H-2).
- **CA-3 Filtros (H-4).** Tres píldoras: Todos · En xogo · Rematados (es: Todos · En juego · Finalizados; ADR-005 exc. 1: no «Directo»). En xogo = `status` `live` (descanso y `sen_sinal` incluidos); Rematados = `finished`; cada una con su número (dígitos tabulares) sobre las filas del día elegido o de toda la xornada. En xogo con ember y etiqueta (solo `live`, ADR-005). Combinan con el día. Una competición sin filas tras filtrar no se pinta; si no queda ninguna, el texto i18n `xornada.empty` («nada aquí» en gl y es, letra del diseño).
- **CA-4 Estado en la URL (H-5).** Día y filtro viven en el fragmento: `#d=2026-10-11&f=live|finished`. Abrir la URL con fragmento aplica el estado; cambiarlo actualiza el fragmento sin recargar ni pedir nada a la red; un valor inválido o un día que no está en la tira se ignora (xornada entera, Todos). gl·es conserva el fragmento.
- **CA-5 Plegar competición.** Cada competición es `<details open>` con la cabecera como `<summary>` (nombre, en escritorio «xornada N», píldora en xogo con su etiqueta accesible, ▾/▸ `aria-hidden`). Plegada, sus filas no se ven y la cabecera sí. Funciona sin JavaScript; no va en la URL ni se recuerda.
- **CA-6 Sin JavaScript.** Con `javaScriptEnabled: false` el HTML trae todas las filas de la xornada (como hoy), la tira y los filtros visibles y todas las competiciones abiertas; los enlaces de día y filtro no rompen nada. JS mínimo: un único componente cliente nuevo que lee el fragmento y oculta filas y secciones con `hidden` sobre el HTML servido; sin dependencias nuevas.
- **CA-7 Escritorio (H-6).** Desde 1024 px (token nuevo `breakpointDesktop`): cabecera de 56 px (logo, gl·es); una barra de 44 px con la tira a la izquierda y los filtros a la derecha; lateral de 236 px con una entrada por competición (nombre completo, número en xogo con etiqueta o total) que pliega/despliega su competición (sin JS, enlace a su sección); columna de filas de hasta 832 px con la rejilla de `Escritorio.tpl.html` sin ★ ni columna de insignia (las etiquetas de SPEC-019 CA-3 y SPEC-021 CA-7 siguen en texto). Por debajo de 1024 px, el layout móvil de SPEC-019 más tira y filtros. Sin pestañas Global/Clasificacións, búsqueda, ★, barra inferior ni panel de detalle.
- **CA-8 Nada se trunca (D-2) y letra de la casa.** Playwright en `/demo/xornada` y `/es/demo/xornada` a 360, 390, 1024 y 1440 px: ningún nombre de equipo, competición (cabecera y lateral) ni día con `scrollWidth > clientWidth` ni `text-overflow: ellipsis`; sin scroll horizontal de página; marcadores y números de píldora con `tabular-nums`. Textos solo de `src/i18n/` (paridad gl/es); colores por tokens; ningún `font:` (tests de `src/design/`). La demo abarca al menos tres días y tiene `live`, `finished` y `scheduled` en dos de ellos.
- **CA-9 Comportamiento con JS.** Playwright en la demo (gl y es, 390 y 1440): «En xogo» deja solo filas `data-status=live` y pone `#f=live`; elegir un día deja solo filas de ese día y lo marca con `aria-current`; volver a pulsarlo restaura todo; cargar `#d=…&f=finished` aplica ambos; un filtro sin resultados muestra «nada aquí»; pulsar una cabecera (y en escritorio su entrada del lateral) oculta sus filas y deja la cabecera.
- **CA-10 Gates.** `npm run gates` y `npm run e2e` en verde; `e2e:db` sigue verde. `git diff main --stat -- src/sources src/decide src/ingest src/board supabase` vacío.

## Entidades y reglas afectadas
Xornada, Estado de partido, Cualificador (`dominio.md`). D-2, D-8, D-9. ADR-005
(semántica de color, exc. 1 y 4; breakpoints), ADR-014 §4 y §6 y ADR-015 (sin
cambios: mismas lecturas). SPEC-019 (`buildXornada`, fila), SPEC-020 CA-5/CA-6
(selección y snapshot), SPEC-021 CA-7 (descanso).

## Fuera de alcance
Realtime, polling y frescura (spec propia); navegar a otras xornadas (H-2);
medición; búsqueda, ★, «Global», Clasificacións, barra inferior y panel de
detalle (ADR-005 exc. 4); recordar el plegado.

## Notas para el gate humano
- **H-1 Sin lecturas nuevas.** La tira sale de los partidos ya servidos: cero cambios en `web.xornada`, `web_reader`, `/api/board` y caché; sin migración, se despliega con el merge. Recomendado.
- **H-2 La tira son los días de la xornada servida, sin ‹ ›.** Las flechas del diseño llevarían a otra xornada: exige una ruta por fecha (`/xornada/AAAA-MM-DD`, ISR) y una regla de «xornada en una fecha» que `currentRound` no da bien (el día antes del viernes vuelve a la misma ronda). Cabe en los permisos de `web_reader` (ya lee toda la vista) sin migración, pero es otra spec. Recomendado: sin flechas en v1 (desviación de la letra de D-8 que el titular acepta aquí); efecto: el miércoles por la tarde desaparecen los resultados del fin de semana.
- **H-3 Sin día por defecto.** Recomendado: xornada entera hasta que se elija un día. Preseleccionar hoy haría que el HTML sin JS (todo) y el hidratado (hoy) difieran: salto de contenido en la primera pintura (criterio 4).
- **H-4 «Filtros por competición» = filtros de estado + plegar**, como en SPEC-019 y en el diseño (no hay filtro por competición en `docs/diseno/`). Recomendado.
- **H-5 Estado en el fragmento**, compartible y sin tocar la caché: con query o ruta, `/` dejaría de ser ISR o fragmentaría la CDN (ADR-014 §6). Sin JS el fragmento no filtra (CA-6). Recomendado.
- **H-6 Lateral de escritorio.** El diseño lo titula «As miñas ligas» (personalización que no hay); recomendado «Competicións» / «Competiciones». Alternativa: quitar el lateral (pediría anotarlo en ADR-005 por ADR nuevo).
- **N-1** El diseño trunca con elipsis en filas y lateral: manda D-2 (CA-8).
- **N-2** Para Realtime: el plegado vive en el DOM (`<details>`) y el filtro en el fragmento; repintar filas no debe reabrir secciones ni perder el filtro.
- **Decididas por el titular (Alberto Fojo, 2026-10-08):** H-1..H-6 según recomendación (H-2: sin flechas en v1, navegar entre xornadas queda para otra spec; H-6: lateral «Competicións» / «Competiciones»). Spec aprobada.
- **Decididas por el titular tras el GREEN condicionado (Alberto Fojo, 2026-10-08):** V-1 se corrige: en el lateral, «en xogo» y total no se distinguen solo por color (etiqueta o prefijo visible, gl/es). F-3 se acepta como excepción 6 de ADR-005 (controles densos ≥ 24 px, WCAG 2.5.8). B-3 se corrige: singular «1 partido». B-2 se corrige: la tira muestra el mes abreviado en los días cuyo mes no es el de hoy (Europe/Madrid). F-4 se corrige: los contadores del lateral y la píldora en xogo de cada cabecera siguen el día y el filtro elegidos. F-2 (día sin cero inicial) se acepta.
