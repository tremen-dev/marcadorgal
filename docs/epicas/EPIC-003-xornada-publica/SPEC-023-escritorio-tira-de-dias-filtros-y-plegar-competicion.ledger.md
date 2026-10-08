---
id: SPEC-023
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-023 Escritorio, tira de días, filtros y plegar competición

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-023-escritorio-tira-de-dias-filtros-y-plegar-competicion`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/xornada/view.ts` (`xornadaDays`, `madridDate`, `XornadaRow.day`, `XornadaCompetition.round`) · it.2 B-2: `XornadaDay.monthKey`, `otherMonth` | `src/xornada/view.test.ts` «SPEC-023 CA-1 madridDate / xornadaDays / buildXornada day and round» · it.2: «B-2: the month, and whether it is not the month of today» | `npm run gates` 1151/1151; tabla con CEST→`2026-10-25` y CET→`2026-10-26`, `[]`, `today`, `live` de otra ronda (`view.test.ts`). En `/` local, el `live` de la ronda anterior añade su día (`sáb 12`) | ✅ |
| CA-2 | `src/components/xornada/XornadaControls.tsx` (`DayStrip`), `XornadaFilters.tsx`, `src/xornada/filter.ts` (`toggleDay`), `Xornada.module.css` (`.days`, `.day[aria-current]`), i18n `weekday.*`, `xornada.dayLabel`, `xornada.days` · it.2 B-2: `src/components/xornada/labels.ts` (`dayLabel`, mes si `otherMonth`), i18n `month.*`, `xornada.dayMonthLabel` | `e2e/xornada-controls.spec.ts` «CA-2 strip…», «CA-9 with JavaScript…»; `src/xornada/filter.test.ts` «toggleDay»; `src/i18n/i18n.test.ts` «SPEC-023 … weekdays» · it.2: `src/components/xornada/labels.test.ts` «B-2 … «sáb 12 set» / «sáb 12 sep»»; `i18n.test.ts` «B-2 months» | Playwright propio 360/390/1024/1440 gl·es: «ven 2 · SÁB 3 · dom 4 · lun 5» / «vie 2…», sin ‹ ›, ningún `aria-current` sin JS; el día elegido lleva fondo marca, peso 600 y `aria-current`; repetir el clic lo quita; `overflow-x:auto`, sin scroll de página. Salvedades F-2 y F-3 (el enlace de día mide 23 px de alto en móvil) | ⚠️ |
| CA-3 | `XornadaControls.tsx` (`FilterPills`), `src/xornada/filter.ts` (`rowMatches`, `countFilters`), `XornadaFilters.tsx`, `XornadaScreen.tsx` (`xornada-empty`), i18n `filter.*`, `xornada.empty` · it.2 F-4: `filter.ts` (`competitionCounts`), `XornadaFilters.tsx` (`[data-competition-count]`), `CompetitionSection.tsx` (píldora) | `src/xornada/filter.test.ts` «rowMatches», «countFilters»; `e2e/xornada-controls.spec.ts` «CA-3 filter labels…», «CA-9 … nada aquí»; `i18n.test.ts` «CA-3 filters», «CA-3 empty» · it.2: `filter.test.ts` «F-4 competitionCounts»; e2e «F-4 counts follow the day and the filter at 390/1440px» | Todos·En xogo·Rematados / Todos·En juego·Finalizados, sin «Directo»; los contadores siguen al día (lun: 1/0/0 en la demo, 7/0/0 en `/`), con `tabular-nums`; «nada aquí» visible con `#d=…&f=finished` vacío; secciones vacías con `hidden`. Salvedad F-3 (píldoras de 26 px) | ⚠️ |
| CA-4 | `src/xornada/filter.ts` (`parseFragment`, `fragmentOf`), `XornadaFilters.tsx` (`replaceState`, `hashchange`, enlaces gl·es con `data-locale-href`) | `src/xornada/filter.test.ts` «CA-4 parseFragment / fragmentOf»; `e2e/xornada-controls.spec.ts` «CA-9 loading #d=…&f=finished…; an invalid fragment is ignored», «CA-9 with JavaScript» (URL, gl·es, sin peticiones ni recarga) | `#f=live`, `#d=…` y `#d=…&f=finished` en la demo y en `/`: 0 peticiones y sin recarga (marcador en `window`); un `hashchange` manual se aplica; `#d=2030-01-01&f=directo` se ignora (e2e); gl·es lleva el fragmento y lo aplica al llegar (`/es#f=live` → En juego con `aria-current`) | ✅ |
| CA-5 | `src/components/xornada/CompetitionSection.tsx` (`<details open>`/`<summary>`, ▾/▸ `aria-hidden`), `Xornada.module.css` (`.details`, `.arrow*`, `.round`) | `e2e/xornada-controls.spec.ts` «CA-9 folding a competition», «CA-6 without JavaScript» (plegado sin JS) | `<details open>`/`<summary>` con nombre, «xornada N» solo desde 1024 px, píldora con etiqueta para lector de pantalla y ▾/▸ `aria-hidden`; pliega con clic y con Enter; sin JS también pliega (e2e CA-6); plegar no cambia la URL | ✅ |
| CA-6 | `XornadaFilters.tsx` (único componente cliente, `hidden` sobre el HTML servido), `Xornada.module.css` (`.row[hidden]…`) | `e2e/xornada-controls.spec.ts` «CA-6 without JavaScript…»; `e2e/xornada.spec.ts` «CA-5 noindex and the same rows without JavaScript» | Sin JS en la demo y en `/` (base local) a los 4 anchos: 22/50 filas, tira y filtros visibles, todo abierto; el clic en día o filtro solo cambia el hash (siguen las 50 filas); el lateral salta a la sección; un solo `"use client"` (`XornadaFilters.tsx`); `package.json` sin diff | ✅ |
| CA-7 | `src/design/tokens.ts` (`MEASURE.breakpointDesktop`), `tokens.css`, `CompetitionNav.tsx`, `Xornada.module.css` (`@media (min-width: 1024px)`), i18n `xornada.competitions`, `xornada.round`, `xornada.matchCount` · it.2 V-1/B-3/F-4: `CompetitionNav.tsx` («N en xogo» visible; total número + `srOnly`), `CountLabel.tsx`, `labels.ts`, `filter.ts` (`formatCount`), i18n `xornada.matchCountOne`, `Xornada.module.css` (`.navLive` nowrap, `[hidden]`) | `src/design/tokens.test.ts` «SPEC-023 CA-7 breakpointDesktop»; `css.test.ts`; `e2e/xornada-controls.spec.ts` «CA-7 desktop at 1440px», «CA-7 mobile at 390px» · it.2: e2e «V-1 the sidebar live count is labelled on screen…», «F-4 …»; `labels.test.ts` «count labels»; `filter.test.ts` «B-3 formatCount»; `i18n.test.ts` «matchCountOne» | 1440: cabecera 56, barra 44 (tira a la izquierda, filtros a la derecha), lateral 236, main 832 (788 a 1024); por debajo de 1024, móvil 52/40/42 sin lateral; sin ★, búsqueda, pestañas ni panel; el lateral pliega y `aria-expanded` se sincroniza en ambos sentidos; `breakpointDesktop` coincide con la media query (tokens.test). Salvedades: V-1 (en el lateral, en xogo y total solo se distinguen por color) y F-1 | ⚠️ |
| CA-8 | `Xornada.module.css` (sin elipsis, `overflow-wrap`), `src/xornada/demo.ts` (viernes 2 a lunes 5, `DEMO_NOW`) | `e2e/xornada-controls.spec.ts` «CA-8 nothing is truncated at 360/390/1024/1440px» (gl, es); `src/xornada/demo.test.ts` «SPEC-023 CA-8 demonstration days»; `src/design/{fonts,no-hex,parity}.test.ts`; `i18n.test.ts` (paridad) | Playwright propio en la demo y en `/`, gl·es, 360/390/1024/1440, con y sin JS: 0 elementos con `scrollWidth>clientWidth` o elipsis (fuera de `.srOnly`), sin scroll horizontal, 0 marcadores o contadores sin `tabular-nums`; grep sin hex ni `font:` en `src/`; la demo va de viernes a lunes, con live/finished/scheduled el sábado y el domingo | ✅ |
| CA-9 | `XornadaFilters.tsx` | `e2e/xornada-controls.spec.ts` «CA-9 …» a 390 y 1440 px, gl y es | e2e a 390/1440, gl·es, en verde; repetido a mano en la demo y en `/` (base local): solo `live`, día con `aria-current`, restaurar, combinar, «nada aquí» y plegar desde la cabecera y desde el lateral | ✅ |
| CA-10 | — | `npm run gates` exit 0 (65 ficheros, 1151 tests; build ok); `npm run e2e` 68 passed; `npm run e2e:db` 7 passed, 1 skipped (capturas QA sin `QA_CAPTURE_DIR`); `git diff origin/main --stat -- src/sources src/decide src/ingest src/board supabase` vacío | `npm run gates` exit 0 (65 ficheros, 1151 tests; en el build `/` y `/es` son ISR de 10 s); `npm run e2e` 68 passed; `npm run e2e:db` 7 passed, 1 skipped (dos veces); `git diff origin/docs/SPEC-023-escritorio --stat -- src/sources src/decide src/ingest src/board supabase package.json package-lock.json` vacío; `curl -I /` en local: `Cache-Control: public, s-maxage=10, stale-while-revalidate=30` | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN condicionado. 2026-10-08, sdd-verificador.** Gates, e2e y e2e:db en verde. He comprobado por mi cuenta, en la demo y en `/` con base local (gl·es; 360, 390, 1024 y 1440 px), el comportamiento con y sin JS, el fragmento, el plegado, el escritorio y que nada se trunca. La spec sigue en `en-revision`: quedan salvedades frente a ADR-005 que solo puede aceptar el titular.
- **V-1 (media, CA-7).** En el lateral, un «2» en ember (partidos en xogo) y un «11» en gris (partidos en total) solo se distinguen por el color: la etiqueta solo la lee el lector de pantalla. ADR-005 dice que ningún estado se comunica solo con color, y la spec pide «con etiqueta». El diseño lo dibuja así. A decidir: aceptarlo o exigir una etiqueta visible.
- **F-SPEC-023-3 (media, CA-2/3/7), más amplia de lo declarado.** Medidas: enlace de día de 23 px de alto en móvil y 24 px en escritorio, píldoras de 26 px, entradas del lateral de 30 px y cabecera de competición de 33 px en móvil. ADR-005 fija un objetivo táctil de 44 px sin excepción, y ni la spec ni H-1..H-6 lo amparan. WCAG 2.5.8 (AA, 24 px) se cumple gracias al espaciado; 2.5.5 (44 px) no. A decidir: añadir una excepción a ADR-005 o corregirlo.
- **F-SPEC-023-1 (baja).** El margen de 72 px en escritorio está amparado por ADR-005 exc. 1 y D-2, igual que en SPEC-019.
- **F-SPEC-023-2 (baja).** La tira escribe «lun 5» y el diseño «lun 01»; la spec no lo decide. Las abreviaturas en gallego son correctas.
- **F-SPEC-023-4 (baja).** La píldora de la cabecera y el lateral no siguen al día: con «lun 12» elegido, Primeira muestra «2» en xogo aunque no se vea ninguna fila en xogo. La spec no lo pide.
- **F-SPEC-023-6 (baja).** Con ISR (`revalidate` 10 s, `expire` 40 s), «hoy» puede cambiar hasta unos 40 s tarde, no 10 s. Sin impacto en v1.
- **V-2 (baja).** El día va sin mes: en `/` local la tira dice «sáb 12 · ven 9 · sáb 10 · dom 11 · lun 12», y el primero es un `live` de septiembre. Cumple la letra de CA-1 y CA-2, pero se presta a confusión.
- **V-3 (baja).** `xornada.matchCount` («{n} partidos») no tiene singular: una competición con un solo partido y ninguno en xogo diría «1 partidos» (solo lo oye el lector de pantalla).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-023/. Informe HTML opcional: _qa/SPEC-023/informe.html -->
Generadas por `QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-023 npm run e2e` (implementador; el verificador decide su valor).

| CA | Captura |
|---|---|
| CA-7, CA-8 | `xornada-{gl,es}-{360,390,1024,1440}.png` |
| CA-2, CA-9 | `dia-{gl,es}-{390,1440}.png` (sábado elegido) |
| CA-3, CA-9 | `en-xogo-{gl,es}-{390,1440}.png`, `nada-{gl,es}-{390,1440}.png` |
| CA-5, CA-7 | `plegada-{gl,es}-1440.png` (plegada desde el lateral) |
| Verificador CA-6/7/8 | `verif-{demo,home}-{gl,es}-{js,nojs}-{360,390,1024,1440}.png` (`home` = `/` y `/es` con base local) |
| Verificador CA-3/9 | `verif-{demo,home}-{gl,es}-{envivo,dia,combo}-{390,1440}.png` |
| Verificador CA-5/7 | `verif-{demo,home}-{gl,es}-plegada-1440.png`, `verif-{home-gl,demo-es}-plegada-lateral-1440.png`, `verif-{home-gl,demo-es}-nojs-enlace-1440.png` |
| It.2 V-1, F-4 | `xornada-{gl,es}-{1024,1440}.png` (lateral con «N en xogo»), `contadores-{gl,es}-1440.png` (`#d=2026-10-04&f=finished`: píldoras y lateral siguen al estado) |
| Verificador, foco | `verif-demo-gl-teclado-390.png` (contorno de 2 px al tabular) |

## Salvedades / follow-ups
<!-- IDs F-SPEC-023-1, F-SPEC-023-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-023-1 Margen de fila en escritorio a 72 px (diseño: 56 px), como SPEC-019 en móvil: «Suspendido»/«Finalizado» son palabras (ADR-005 exc. 1) y no caben sin truncar (D-2). Puntuaciones en columna de 46 px como el diseño. Destino: anotar en ADR-005 si el titular lo quiere explícito.
- F-SPEC-023-2 Día del mes sin cero («lun 5»; el diseño escribe «lun 01»), igual que `formatDay` (SPEC-019). Abreviaturas de día en i18n (`weekday.*`): gl `lun mar mér xov ven sáb dom`, es `lun mar mié jue vie sáb dom` (ICU daría «luns»). Destino: gate humano si se prefiere otra letra.
- F-SPEC-023-3 Los enlaces de día y las píldoras miden menos de 44 px de alto (la tira es de 40 px por diseño); el objetivo táctil de ADR-005 no se cumple en ellos. Destino: EPIC-MEJORA.
- F-SPEC-023-4 Los números del lateral y la píldora de la cabecera son de la xornada entera: no siguen al día ni al filtro (la spec no lo pide). Destino: spec de Realtime o EPIC-MEJORA.
- F-SPEC-023-5 La rama local `main` está atrasada (a4890b4); el diff de CA-10 se mide contra `origin/main` (4770929), vacío. Contra `main` local aparecen cambios ajenos a esta spec.
- F-SPEC-023-7 (it.2) A 1024 px, con «1 en xogo» visible en el lateral, «Segunda Federación · Grupo 1» parte en 3 líneas (antes 2); sin truncar (e2e CA-8 y V-1). Destino: gate humano si se quiere otra letra.
- F-SPEC-023-4 corregido en it.2 (decisión del titular); F-SPEC-023-3 aceptado como ADR-005 exc. 6; F-SPEC-023-2 aceptado.
- F-SPEC-023-6 En `/` el «hoy» de la tira se calcula al renderizar (ISR 10 s): a medianoche puede ir hasta 10 s tarde. Sin efecto en v1.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- It.2 (decisiones del titular 2026-10-08): V-1, B-3, B-2 y F-4 corregidos en 053e272 sobre `ft/SPEC-023-escritorio-tira-de-dias-filtros-y-plegar-competicion`; F-2 y F-3 sin tocar (aceptados). Spec en `en-revision`.
- Evidencia it.2: `DATABASE_URL_PUBLIC="" npm run gates` exit 0 (66 ficheros, 1165 tests); `npm run e2e` 74 passed; `npm run e2e:db` 7 passed, 1 skipped.
- Etiquetas en `src/components/xornada/labels.ts` (no en `src/xornada/`: su frontera prohíbe `@/i18n`). Plantillas `{n}` en `data-label-one/other` para que el cliente rellene sin diccionarios.
- La píldora y «N en xogo» del lateral solo se sirven si la xornada entera tiene `live` (filtrar solo baja el número); el total del lateral siempre, con `hidden` si hay `live`.
- Falta: verificación (sdd-verificador). B-2 no se ve en la demo (todo octubre): cubierto por unit tests.
