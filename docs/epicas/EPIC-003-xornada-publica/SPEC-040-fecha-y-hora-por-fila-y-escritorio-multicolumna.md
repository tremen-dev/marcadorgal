---
id: SPEC-040
tipo: spec
epica: EPIC-003
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-01, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-01, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-01, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-01, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-01, por: sdd-verificador}
---
# SPEC-040 — Fecha y hora por fila y escritorio multicolumna

## Problema
El titular, usando la pantalla (2026-11-01): (1) quiere quitar la cabecera de
día de cada competición (SPEC-033 CA-2) y que **cada fila** diga su fecha y hora;
(2) en escritorio la fila ocupa toda la columna de hasta 832 px (SPEC-023 CA-7)
y los marcadores quedan lejos de los equipos; pide varias columnas en PC, como
marcadorgalego.gal, para ver todos los resultados. En móvil sigue como está.

## Usuarios / roles afectados
- Público, móvil y escritorio, gl y es, con y sin JS. Rutas `/`, `/es`, `/xornada/[fecha]` (SPEC-027) y demos.

## Criterios de aceptación
Solo presentación: sin lecturas nuevas, sin migración, sin dependencias. **Sustituye SPEC-033 CA-2** y la parte de cabeceras de su CA-3 (N-1).
- **CA-1 Margen de dos líneas (puro, H-1).** `XornadaRow` gana `date` (`weekdayKey`, `dayOfMonth`, `monthKey` de la fecha Madrid del `kickoff`), `null` en `live`, y `part`: en `live`, `"halfTime"` en descanso, `"first"` con minuto ≤ 45 (también 45+n), `"second"` con minuto ≥ 46 y `null` sin minuto; `null` fuera de `live`. `XornadaCompetition` pierde `dayGroups`; el orden de SPEC-033 CA-1 no cambia. Test de tabla: los cinco estados, 45+3, 46, 90+2, descanso, `live` sin minuto; `2026-10-24T22:30Z` → dom 25 out; `2026-10-25T23:30Z` → lun 26 out.
- **CA-2 Fila (H-1, H-4).** Sin cabecera de día, `<h3>` ni envoltorio por día: un `<ul>` por competición. El margen tiene siempre dos líneas de alto fijo, y el cualificador queda debajo como hoy. `scheduled`: fecha («sáb 11 out» / «sáb 11 oct», plantilla de `xornada.dayHeader`, renombrable a `xornada.rowDate`) y hora. `finished`, `postponed` y `suspended`: fecha y palabra de estado, sin hora. `live`: punto + minuto y debajo «1ª P» / «2ª P» (claves i18n nuevas, visibles `aria-hidden`, con «primeira parte» / «primera parte» en `srOnly`). En descanso: «En xogo» sin punto y «DESCANSO». Sin minuto: «En xogo» con punto y la segunda línea vacía con su alto reservado. Fecha y parte en mono 500 10 px, interlineado 1.2, `--fg-dim`; hoy en mayúsculas. Todo cabe en los 72 px del margen.
- **CA-3 Día y filtros sin cabeceras.** `XornadaFilters` deja de tratar `[data-day-group]`/`[data-day-header]` y `dayGroupView` sale de `src/xornada/filter.ts`. Día y filtro siguen ocultando filas y competiciones vacías (SPEC-023 CA-3/CA-9); un repintado (SPEC-024) conserva plegado y fragmento. Los e2e de SPEC-033 CA-3/CA-7 se reescriben.
- **CA-4 Escritorio: una competición por columna, sin lateral (H-2, H-3, H-5).** Desde `breakpointDesktop` **se retira el lateral** «Competicións» (`CompetitionNav`, `MEASURE.sidebar`, su CSS `sticky` y su lógica en `XornadaFilters`). Token nuevo `MEASURE.competitionColumn` = 360. La zona principal ocupa el ancho de la página con relleno lateral `--space-16` y es una rejilla de columnas de 360 px con hueco `--space-16`, alineada a la izquierda. Con *n* columnas hacen falta 360·*n* + 16·(*n* − 1) + 32 px de ancho útil: 2 hasta 1143 px, 3 de 1144 a 1519, 4 de 1520 a 1895 y 5 desde 1896. Cada competición es una columna entera, cabecera y filas, con la métrica de fila móvil (SPEC-019), el ancho ya probado a 360 px (D-2). Van en orden de `tier`; si hay más competiciones que columnas, siguen en otra fila de columnas debajo. Cada columna tiene su alto natural (`align-items: start`). Tira, filtros, frescura, leyenda de SPEC-034 y «nada aquí» ocupan todo el ancho. Una competición vacía por día o filtro no se pinta y las siguientes ocupan su hueco. Lo que hacía el lateral pasa a la cabecera de columna: lleva el contador de la entrada del lateral («N en xogo» con su etiqueta o, sin `live`, el total «N partidos», sin depender del color, V-1 de SPEC-023), que sigue al día y al filtro (F-4 de SPEC-023), y pliega como hoy (SPEC-023 CA-5). Las secciones conservan `id="xornada-<id>"` y su `scroll-margin-top`; `parseFragment` sigue ignorando `#xornada-<id>` (SPEC-028 CA-2). Por debajo de 1024 px, el layout móvil de hoy, sin cambios.
- **CA-5 E2e de columnas.** Playwright en `/demo/xornada` y `/es/demo/xornada`, con JS (y sin JS a 1536 px), con las cinco competiciones. Valores distintos de `left` de las competiciones: 1 a 390 px, 2 a 1024, 3 a 1280 y 1440, 4 a 1536 y 5 a 1920 y 2200; ningún elemento `nav` de competiciones ni entrada de lateral en el DOM. Desde 1024, cada competición mide 360 px. Ordenadas por (`top`, `left`), salen en el orden del DOM; en una fila de columnas comparten `top`. Cada cabecera muestra su contador y lo cambia con «En xogo» y con un día. Con «En xogo», las que quedan ocupan las primeras celdas en orden. Plegar una deja su cabecera y no cambia el `left` de las demás. `/#xornada-<id>` lleva a su columna sin filtrar. Los e2e de SPEC-023 CA-9 y SPEC-028 CA-1/CA-3 sobre el lateral se retiran.
- **CA-6 Nada se trunca y letra de la casa.** A 360, 390, 1024, 1280, 1440, 1536, 1920 y 2200 px: márgenes, equipos y competiciones sin `scrollWidth > clientWidth` ni elipsis; sin scroll horizontal; marcadores con `tabular-nums`. El margen de una fila `live` (con minuto, en descanso y sin minuto) y el de una `scheduled` miden lo mismo, y sus dos líneas tienen el mismo `top` relativo a la fila (±1 px). Toda fila no `live` lleva la fecha de su `kickoff`, ninguna `live` la lleva y no hay `day-header`. Textos de `src/i18n/` (paridad), tokens en los media queries, ningún `font:` ni hex (tests de `src/design/`). Capturas a 390, 1024, 1536 y 1920 en `_qa/SPEC-040/`.
- **CA-7 Gates.** `npm run gates`, `e2e` y `e2e:db` en verde. `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/model src/app/api supabase` vacío.

## Entidades y reglas afectadas
Xornada, Estado de partido, descanso (`dominio.md`); D-2, D-8. ADR-005
(breakpoints a la spec de pantalla; retirada del lateral anotada en ADR-022 §A).
Sustituye SPEC-033 CA-2, cabeceras de CA-3 y H-1; enmienda SPEC-023 CA-7 (832 px
y lateral), CA-8/CA-9 (lateral) y SPEC-028 CA-1 y, por arrastre, CA-3 (lateral).
SPEC-021, SPEC-024, SPEC-027, SPEC-034.

## Fuera de alcance
Goleadores (épica futura tras el proveedor RFEF); gol reciente (SPEC-041);
cambiar la tira de días; panel de detalle y ★.

## Notas para el gate humano
- **Resolución del titular (Alberto Fojo, 2026-11-01):** H-1: en directo no se muestra la fecha, pero la fila guarda el equilibrio de dos líneas (minuto y parte, o «DESCANSO»). En finalizado, aplazado y suspendido, fecha + estado, sin hora. H-2: una competición por columna, más estrecha que 440 px; el arquitecto propone 360 (CA-4). H-3: rejilla alineada a la izquierda (era «pegada al lateral»). H-4: hoy en mayúsculas. **H-5 (2026-11-01): se quita el lateral en escritorio**: cada cabecera de columna ya lleva su contador y el lateral robaba casi una columna; sin él, a 1920 px caben las cinco.
- **N-1** Sustitución y enmiendas anotadas con fecha en SPEC-033, SPEC-023 y SPEC-028, sin cambiar su estado.
- **N-2 Por qué 360 px.** Es el móvil más estrecho que D-2 ya prueba sin truncar («Terceira Federación · Grupo 1», «Bilbao Athletic»). Una columna más estrecha partiría más nombres. A 1536 px (1920 al 125 %) caben 4; las cinco, desde 1896 (1920 con barra de desplazamiento clásica deja 1903).
- **N-3** «1ª P» / «2ª P» salen del minuto de `board`: son tan fiables como el minuto. Las ligas de D-3 no tienen prórroga.
- **N-4** `docs/diseno/` no dibuja escritorio multicolumna: desviación de D-8 pedida por el titular; ADR-005 deja la maqueta por tamaños a la spec, sin ADR nuevo.
