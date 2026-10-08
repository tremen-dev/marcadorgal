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
| CA-1 | `src/xornada/view.ts` (`xornadaDays`, `madridDate`, `XornadaRow.day`, `XornadaCompetition.round`) | `src/xornada/view.test.ts` «SPEC-023 CA-1 madridDate / xornadaDays / buildXornada day and round» | | ❌ |
| CA-2 | `src/components/xornada/XornadaControls.tsx` (`DayStrip`), `XornadaFilters.tsx`, `src/xornada/filter.ts` (`toggleDay`), `Xornada.module.css` (`.days`, `.day[aria-current]`), i18n `weekday.*`, `xornada.dayLabel`, `xornada.days` | `e2e/xornada-controls.spec.ts` «CA-2 strip…», «CA-9 with JavaScript…»; `src/xornada/filter.test.ts` «toggleDay»; `src/i18n/i18n.test.ts` «SPEC-023 … weekdays» | | ❌ |
| CA-3 | `XornadaControls.tsx` (`FilterPills`), `src/xornada/filter.ts` (`rowMatches`, `countFilters`), `XornadaFilters.tsx`, `XornadaScreen.tsx` (`xornada-empty`), i18n `filter.*`, `xornada.empty` | `src/xornada/filter.test.ts` «rowMatches», «countFilters»; `e2e/xornada-controls.spec.ts` «CA-3 filter labels…», «CA-9 … nada aquí»; `i18n.test.ts` «CA-3 filters», «CA-3 empty» | | ❌ |
| CA-4 | `src/xornada/filter.ts` (`parseFragment`, `fragmentOf`), `XornadaFilters.tsx` (`replaceState`, `hashchange`, enlaces gl·es con `data-locale-href`) | `src/xornada/filter.test.ts` «CA-4 parseFragment / fragmentOf»; `e2e/xornada-controls.spec.ts` «CA-9 loading #d=…&f=finished…; an invalid fragment is ignored», «CA-9 with JavaScript» (URL, gl·es, sin peticiones ni recarga) | | ❌ |
| CA-5 | `src/components/xornada/CompetitionSection.tsx` (`<details open>`/`<summary>`, ▾/▸ `aria-hidden`), `Xornada.module.css` (`.details`, `.arrow*`, `.round`) | `e2e/xornada-controls.spec.ts` «CA-9 folding a competition», «CA-6 without JavaScript» (plegado sin JS) | | ❌ |
| CA-6 | `XornadaFilters.tsx` (único componente cliente, `hidden` sobre el HTML servido), `Xornada.module.css` (`.row[hidden]…`) | `e2e/xornada-controls.spec.ts` «CA-6 without JavaScript…»; `e2e/xornada.spec.ts` «CA-5 noindex and the same rows without JavaScript» | | ❌ |
| CA-7 | `src/design/tokens.ts` (`MEASURE.breakpointDesktop`), `tokens.css`, `CompetitionNav.tsx`, `Xornada.module.css` (`@media (min-width: 1024px)`), i18n `xornada.competitions`, `xornada.round`, `xornada.matchCount` | `src/design/tokens.test.ts` «SPEC-023 CA-7 breakpointDesktop»; `css.test.ts`; `e2e/xornada-controls.spec.ts` «CA-7 desktop at 1440px», «CA-7 mobile at 390px» | | ❌ |
| CA-8 | `Xornada.module.css` (sin elipsis, `overflow-wrap`), `src/xornada/demo.ts` (viernes 2 a lunes 5, `DEMO_NOW`) | `e2e/xornada-controls.spec.ts` «CA-8 nothing is truncated at 360/390/1024/1440px» (gl, es); `src/xornada/demo.test.ts` «SPEC-023 CA-8 demonstration days»; `src/design/{fonts,no-hex,parity}.test.ts`; `i18n.test.ts` (paridad) | | ❌ |
| CA-9 | `XornadaFilters.tsx` | `e2e/xornada-controls.spec.ts` «CA-9 …» a 390 y 1440 px, gl y es | | ❌ |
| CA-10 | — | `npm run gates` exit 0 (65 ficheros, 1151 tests; build ok); `npm run e2e` 68 passed; `npm run e2e:db` 7 passed, 1 skipped (capturas QA sin `QA_CAPTURE_DIR`); `git diff origin/main --stat -- src/sources src/decide src/ingest src/board supabase` vacío | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-023/. Informe HTML opcional: _qa/SPEC-023/informe.html -->
Generadas por `QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-023 npm run e2e` (implementador; el verificador decide su valor).

| CA | Captura |
|---|---|
| CA-7, CA-8 | `xornada-{gl,es}-{360,390,1024,1440}.png` |
| CA-2, CA-9 | `dia-{gl,es}-{390,1440}.png` (sábado elegido) |
| CA-3, CA-9 | `en-xogo-{gl,es}-{390,1440}.png`, `nada-{gl,es}-{390,1440}.png` |
| CA-5, CA-7 | `plegada-{gl,es}-1440.png` (plegada desde el lateral) |

## Salvedades / follow-ups
<!-- IDs F-SPEC-023-1, F-SPEC-023-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-023-1 Margen de fila en escritorio a 72 px (diseño: 56 px), como SPEC-019 en móvil: «Suspendido»/«Finalizado» son palabras (ADR-005 exc. 1) y no caben sin truncar (D-2). Puntuaciones en columna de 46 px como el diseño. Destino: anotar en ADR-005 si el titular lo quiere explícito.
- F-SPEC-023-2 Día del mes sin cero («lun 5»; el diseño escribe «lun 01»), igual que `formatDay` (SPEC-019). Abreviaturas de día en i18n (`weekday.*`): gl `lun mar mér xov ven sáb dom`, es `lun mar mié jue vie sáb dom` (ICU daría «luns»). Destino: gate humano si se prefiere otra letra.
- F-SPEC-023-3 Los enlaces de día y las píldoras miden menos de 44 px de alto (la tira es de 40 px por diseño); el objetivo táctil de ADR-005 no se cumple en ellos. Destino: EPIC-MEJORA.
- F-SPEC-023-4 Los números del lateral y la píldora de la cabecera son de la xornada entera: no siguen al día ni al filtro (la spec no lo pide). Destino: spec de Realtime o EPIC-MEJORA.
- F-SPEC-023-5 La rama local `main` está atrasada (a4890b4); el diff de CA-10 se mide contra `origin/main` (4770929), vacío. Contra `main` local aparecen cambios ajenos a esta spec.
- F-SPEC-023-6 En `/` el «hoy» de la tira se calcula al renderizar (ISR 10 s): a medianoche puede ir hasta 10 s tarde. Sin efecto en v1.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1..CA-10 implementados con test; spec en `en-revision`. Commits 58a1e5f, 1d5dc17, 0c1cc92 (+ docs) en `ft/SPEC-023-escritorio-tira-de-dias-filtros-y-plegar-competicion`.
- Lógica pura en `src/xornada/view.ts` (días) y `src/xornada/filter.ts` (fragmento); DOM en el único cliente `src/components/xornada/XornadaFilters.tsx`.
- Falta: verificación (sdd-verificador). `npm run e2e:db` exige `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` exportada.
