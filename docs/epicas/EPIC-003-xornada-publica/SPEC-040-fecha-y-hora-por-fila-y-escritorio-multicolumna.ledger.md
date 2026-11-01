---
id: SPEC-040
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-040 Fecha y hora por fila y escritorio multicolumna

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-040-fecha-y-hora-por-fila-y-escritorio-multicolumna` (worktree `marcadorgal-ux`)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/xornada/view.ts` (`XornadaRow.date`/`part`, `RowDate`, `MatchPart`, `partOf`, `dateOf`; fuera `dayGroups`/`XornadaDayGroup`/`groupByDay`); `src/calendar/galicians.test.ts` (sin `dayGroups`) | `src/xornada/view.test.ts` «SPEC-040 CA-1 the two-line margin of a row» (5 estados, 30', 45', 45+3', 46', 90+2', descanso, sin minuto; `2026-10-24T22:30Z`→dom 25, `2026-10-25T23:30Z`→lun 26; sin `dayGroups`, orden SPEC-033) | | ❌ |
| CA-2 | `src/components/xornada/MatchRow.tsx` (`marginLines`, línea 2 `match-margin-sub`: fecha / «1ª P»·«2ª P» `aria-hidden` + `srOnly` / «DESCANSO» / vacía; prop `today`), `CompetitionSection.tsx` (un `<ul>`, sin `<h3>` ni grupos), `labels.ts` (`rowDateLabel`, era `dayHeaderLabel`), `Xornada.module.css` (`.marginLines`, `.marginMain` 15 px, `.marginSub` mono 500 10 px/1.2 `--fg-dim` 12 px; fuera `.dayGroup`/`.dayHeader`), `src/i18n/{gl,es}.ts` (`xornada.rowDate` renombra `dayHeader`; `firstPart`, `secondPart`, `firstPartLong`, `secondPartLong`) | `src/components/xornada/row-margin.test.ts` (gl/es: programado, hoy en mayúsculas, rematado/aprazado/suspendido, directo 30'/45+3'/46'/90+2', descanso, sin minuto; competición sin `<h3>`; i18n); `src/components/xornada/labels.test.ts` «SPEC-040 CA-2 rowDateLabel»; e2e `xornada-lectura.spec.ts` «CA-1/CA-5/CA-7, SPEC-040 CA-2 at …px» (360/390/1024/1440, con y sin JS); `xornada.spec.ts` «SPEC-021 CA-7 half-time row» | | ❌ |
| CA-3 | `src/xornada/filter.ts` (fuera `dayGroupView`), `src/components/xornada/XornadaFilters.tsx` (fuera `[data-day-group]`/`[data-day-header]`) | `src/xornada/filter.test.ts` «SPEC-040 CA-3 no day groups»; e2e `xornada-lectura.spec.ts` «SPEC-040 CA-3 at 390/1440px …» y «… without JS»; `xornada-live.spec.ts` «SPEC-040 CA-3/SPEC-033 CA-4: a repaint keeps day, fold, fragment and the galician mark» | | ❌ |
| CA-4 | Borrado `src/components/xornada/CompetitionNav.tsx`; `XornadaBody.tsx` (sin lateral, `div.columns` `data-testid="xornada-columns"`); `CompetitionSection.tsx` (contador en cabecera: `live-pill` con palabras en escritorio, `competition-total` «N partidos»); `XornadaFilters.tsx` (fuera lógica de lateral y `goTo`); `Xornada.module.css` (rejilla `repeat(auto-fill, var(--competition-column))`, `gap`/relleno `--space-16`, `justify-content: start`, `align-items: start`; fila con métrica móvil; fuera `.sidebar`, `.nav*`, `sticky`, 832 px); `src/design/tokens.ts` (`competitionColumn: 360`, fuera `sidebar`) + `tokens.css` regenerado; i18n sin `xornada.competitions` | `src/design/tokens.test.ts` «SPEC-040 CA-4 desktop columns» (token, fórmula 2/3/4/5 en 1143/1144/1519/1520/1895/1896, CSS de la rejilla, sin lateral); `src/design/css.test.ts`; `src/components/xornada/columns.test.ts` (gl/es: sin nav de competiciones, secciones en orden dentro de la rejilla, contador vivo/total); `src/i18n/i18n.test.ts`; e2e `xornada-controls.spec.ts` (CA-7 desktop, V-1 y F-4 sobre la cabecera) | | ❌ |
| CA-5 | — (e2e) | `e2e/xornada-columnas.spec.ts` «CA-5 at {390,1024,1280,1440,1536,1920,2200}px with JS» y «at 1536px without JS» (n columnas, sin lateral ni `nav` de competiciones, 360 px, orden DOM, misma `top` por fila, x = 16 + i·376); «CA-5 at {1024,1536,1920}px: counters follow …» (contador = filas visibles con En xogo, Rematados y día; celdas iniciales en orden; plegar no mueve `left`); «CA-5 /#xornada-<id> takes you to its column, unfiltered». Retirados: SPEC-023 CA-9 (lateral) en `xornada-controls.spec.ts`, SPEC-028 CA-1/CA-3 y CA-2 sin JS en `xornada-nav.spec.ts` | | ❌ |
| CA-6 | `MatchRow.tsx` (`data-testid="match-margin-lines"`), `Xornada.module.css` (`.margin { align-self: start }` para que las dos líneas queden al mismo `top`; `.marginMain` sin tracking, F-SPEC-040-6) | `e2e/xornada-columnas.spec.ts` «CA-6 at {360,390,1024,1280,1440,1536,1920,2200}px» (sin truncado ni elipsis en márgenes/equipos/competiciones/contadores, sin scroll horizontal, `tabular-nums`, fecha en toda fila no `live`, ninguna en `live`, sin `day-header`, alto y `top` de líneas iguales en programado/minuto/descanso/sin minuto ±1 px); `src/design/*.test.ts`, `src/i18n/i18n.test.ts` | | ❌ |
| CA-7 | — | Linux, como CI (imagen `mcr.microsoft.com/playwright:v1.63.0-noble`, node 24.20, `git -c core.autocrlf=false archive` de `aa1559e`, `npm ci`): `npm run gates` → tsc OK, biome 301 ficheros sin errores (1 aviso previo en `src/arch/deploy.test.ts`), **105 ficheros / 1873 tests**, build OK, `GATES_EXIT=0`; `npm run e2e` (CI=true) → **213 passed, 1 skipped**, `E2E_EXIT=0`. Windows: `npx playwright test` 212 passed, 1 skipped, 1 flaky (F-SPEC-040-3). `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/model src/app/api supabase` → vacío. `e2e:db` **no ejecutado** (F-SPEC-040-1) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-040/. Informe HTML opcional: _qa/SPEC-040/informe.html -->
| CA | Captura (`_qa/SPEC-040/`) |
|---|---|
| CA-2/CA-6 filas | `filas-{gl,es}-{390,1024,1536,1920}.png` |
| CA-4/CA-5 columnas | `columnas-{gl,es}-{390,1024,1536,1920}.png` |
| CA-5 En xogo, día, plegada | `columnas-en-xogo-*`, `columnas-dia-*`, `columnas-plegada-*` a 1024/1536/1920 |

Generadas con `QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-040 npx playwright test e2e/xornada-columnas.spec.ts` (40 passed).

## Salvedades / follow-ups
- **F-SPEC-040-1** `npm run e2e:db` no ejecutado: la Supabase local no estaba arriba (puertos 54321/54322 libres; solo `marcadorgal-postgres` en 5432) y el encargo prohíbe arrancarla. Ajustado sin correr `e2e/xornada.db.spec.ts` (descanso: «En xogo» + «DESCANSO»). Destino: verificador, con Supabase local.
- **F-SPEC-040-2** En Windows con `core.autocrlf=true` (checkout CRLF), `npm run lint` y varios tests de `src/design/` (separador `\`, CRLF) fallan también en `main`: entorno, no código. Por eso los gates se corrieron en Linux sobre un export LF de HEAD, como CI. Destino: EPIC-MEJORA (`.gitattributes` `* text=auto eol=lf`).
- **F-SPEC-040-3** `e2e/primera-pintura.spec.ts` (`filasAlFcp`) falló una vez en la suite completa en paralelo y pasó 2/2 aislado: sensible a carga, no a este cambio.
- **F-SPEC-040-4** Decisiones de letra: (a) línea 1 = hora/minuto/estado, línea 2 = fecha/parte, para que «principal arriba» sea igual en todos los estados; (b) el total de la cabecera se muestra en palabras («N partidos»), no como número desnudo del lateral; en móvil la cabecera queda como hoy (píldora con número; total oculto); (c) en la demo las cinco competiciones tienen directo, así que «En xogo» no cambia los contadores: el e2e lo comprueba contra las filas visibles y prueba el cambio con «Rematados» y con un día.
- **F-SPEC-040-6** `.marginMain` pierde `letter-spacing: 0.03em`: en Linux (Chromium) las diez letras de «Suspendido»/«Finalizado» medían 73,3 px > 72 px (Windows 69,3); ya pasaba antes en producción sin test que lo mirase. Con 0 caben en ambos. Commit `aa1559e`.
- **F-SPEC-040-5** `.margin` pasa a `align-self: start` (antes centrado) también en móvil: necesario para el ±1 px de CA-6 cuando un nombre parte en dos líneas o hay cualificador.

## Cómo retomar (handoff)
Todos los CA implementados con tests, en commits `586858f` (CA-1) … `aa1559e`. Spec en `en-revision`. Falta: verificación (sdd-verificador), incluido `npm run e2e:db` con Supabase local (F-SPEC-040-1). Gates de referencia: correr en Linux/CI o con checkout LF (F-SPEC-040-2).
