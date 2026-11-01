---
id: SPEC-040
tipo: spec
epica: EPIC-003
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-11-01, por: sdd-arquitecto}
---
# SPEC-040 — Fecha y hora por fila y escritorio multicolumna

## Problema
El titular, usando la pantalla (2026-11-01): (1) quiere quitar la cabecera de
día de cada competición (SPEC-033 CA-2) y que **cada fila** diga su fecha y hora;
(2) en escritorio la fila ocupa toda la columna de hasta 832 px (SPEC-023 CA-7)
y los marcadores quedan lejos de los equipos; pide varias columnas en PC para
ver todos los resultados aprovechando el ancho. En móvil, la fila sigue como está.

## Usuarios / roles afectados
- Público, móvil y escritorio, gl y es, con y sin JS. Rutas `/`, `/es`, `/xornada/[fecha]` (SPEC-027) y demos.

## Criterios de aceptación
Solo presentación: sin lecturas nuevas, sin migración, sin dependencias. **Sustituye SPEC-033 CA-2** y la parte de cabeceras de su CA-3 (N-1).
- **CA-1 Fecha de la fila (puro, H-1).** `XornadaRow` gana `date` (`weekdayKey`, `dayOfMonth`, `monthKey` de la fecha Madrid del `kickoff`) en `scheduled`, `finished`, `postponed` y `suspended`, y `null` en `live` (descanso incluido). `XornadaCompetition` pierde `dayGroups`; el orden de SPEC-033 CA-1 no cambia. Test de tabla: los cinco estados; `2026-10-24T22:30Z` → dom 25 out; `2026-10-25T23:30Z` → lun 26 out (cambio de hora).
- **CA-2 Fila con fecha (H-1, H-4).** Ni cabecera de día ni `<h3>` ni envoltorio por día: cada competición, un solo `<ul>` de filas. En el margen, sobre la línea de hoy (hora en `scheduled`, palabra de estado en los demás), la fecha con la plantilla de `xornada.dayHeader` («sáb 11 out» / «sáb 11 oct»; se puede renombrar a `xornada.rowDate`); el día de hoy en mayúsculas, como la tira. Letra mono 500 10 px, interlineado 1.2, `--fg-dim`; cabe en los 72 px del margen sin ensancharlo. La fila `live` no lleva fecha. El texto de la fecha es contenido (no `aria-hidden`).
- **CA-3 Día y filtros sin cabeceras.** `XornadaFilters` deja de tratar `[data-day-group]`/`[data-day-header]` (y `dayGroupView` sale de `src/xornada/filter.ts`). Elegir día o filtro sigue ocultando filas y competiciones vacías como en SPEC-023 CA-3/CA-9; un repintado de SPEC-024 conserva plegado y fragmento. Los e2e de SPEC-033 CA-3/CA-7 se reescriben sin cabeceras.
- **CA-4 Escritorio multicolumna (H-2, H-3).** Tokens nuevos en `MEASURE`: `breakpointWide` 1280, `breakpointWider` 1680, `rowColumnMax` 440. Desde `breakpointDesktop`, las filas de cada competición van en una rejilla: 2 columnas hasta 1279 px, 3 de 1280 a 1679, 4 desde 1680; orden de lectura por filas (izquierda → derecha, luego abajo), el del DOM. Ninguna columna pasa de 440 px: la zona principal no crece de 4 × 440 más huecos y va pegada al lateral. Entre columnas, hueco `--space-16`; cada fila conserva su hairline, su fondo `--bg-live` y su inserto. La cabecera de competición, la frescura, la leyenda de SPEC-034 y «nada aquí» ocupan el ancho de la rejilla. Lateral de 236 px, barra de tira y filtros y `<details>` como en SPEC-023/028. Una fila oculta (`hidden`) no deja hueco. Por debajo de 1024 px, el layout móvil de hoy (una columna, máx. 640 px).
- **CA-5 E2e de la rejilla.** Playwright en `/demo/xornada` y `/es/demo/xornada`, con JS, en una competición de ≥ 4 filas: valores distintos de `left` de las filas = 1 a 390 px, 2 a 1024, 3 a 1280 y 1440, 4 a 1920; a 1024/1280/1440/1920 cada fila mide entre 320 y 440 px y sus marcadores caen dentro de ella. Con «Rematados», las filas visibles ocupan las primeras celdas en orden; plegar la competición oculta su rejilla. Sin JS (1440): misma rejilla.
- **CA-6 Nada se trunca y letra de la casa.** A 360, 390, 1024, 1280, 1440 y 1920 px: fechas del margen, equipos y competiciones sin `scrollWidth > clientWidth` ni `text-overflow: ellipsis`; sin scroll horizontal; marcadores con `tabular-nums`. Cada fila no `live` contiene en su margen la fecha de su `kickoff`; ninguna `live` la lleva; ningún `day-header`. Textos de `src/i18n/` (paridad), colores por tokens, ningún `font:` ni hex (tests de `src/design/`; los media queries usan los tokens, como `breakpointDesktop`). Capturas a 390, 1024, 1440 y 1920 en `_qa/SPEC-040/`.
- **CA-7 Gates.** `npm run gates`, `e2e` y `e2e:db` en verde. `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/model src/app/api supabase` vacío.

## Entidades y reglas afectadas
Xornada, Estado de partido (`dominio.md`); D-2, D-8. ADR-005 (breakpoints a la
spec de pantalla; ember solo `live`). Sustituye SPEC-033 CA-2 y la parte de
cabeceras de CA-3 y H-1; enmienda SPEC-023 CA-7 («columna de hasta 832 px»).
SPEC-024 (repintado), SPEC-027, SPEC-028, SPEC-034 (leyenda).

## Fuera de alcance
Goleadores (épica futura tras el proveedor RFEF); gol reciente (SPEC-041);
cambiar la tira de días; panel de detalle, ★ y columnas por competición (H-2 B).

## Notas para el gate humano
- **H-1 Qué fecha lleva cada estado.** Recomendado: fecha en todos menos `live`, porque «en xogo» es ahora y el minuto con su ember ya lo dicen. En `finished`, `postponed` y `suspended`, fecha + palabra de estado, sin hora: de un partido jugado o no jugado importa el día, no la hora. Alternativa: «sáb 11 out · 18:00» también en esos tres (tercera línea en el margen).
- **H-2 Qué va en columnas.** **A (recomendada) — rejilla de filas dentro de cada competición:** conserva el orden por categoría (SPEC-019 H-1), el plegado y el lateral; filas alineadas por línea. **B — una competición por columna** (multicolumna): columnas de alto desigual (Terceira G1 tiene más filas) y el orden por categoría se lee en zigzag.
- **H-3 Cortes 2/3/4 y tope de 440 px.** Con 440 px, equipo y marcador quedan a menos de ~270 px. Efecto: entre ~1150 y 1279 px y en pantallas > 2076 px queda margen libre a la derecha. Alternativa: centrar la zona principal.
- **H-4 Hoy.** Recomendado: mayúsculas, como la tira y la cabecera de SPEC-033. Alternativa «hoxe»/«hoy»: es tiempo relativo en un HTML en caché (ISR) que cruza la medianoche.
- **N-1** Al aprobar, sdd-arquitecto anota en SPEC-033 y SPEC-023 (con fecha, sin cambiar su estado) la sustitución y la enmienda.
- **N-2** `docs/diseno/` no dibuja escritorio multicolumna: es desviación de la letra de D-8 pedida por el titular; ADR-005 deja la maqueta por tamaños a la spec de pantalla, sin ADR nuevo.
