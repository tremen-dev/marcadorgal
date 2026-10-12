---
id: SPEC-033
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-033 Mejoras de lectura: cabecera por día, equipos gallegos y favicon

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-033-mejoras-de-lectura`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/xornada/view.ts` (`compareMatches`, `dayGroups`, `XornadaDayGroup`) | `src/xornada/view.test.ts` «SPEC-033 CA-1 buildXornada day groups» (dos días, un día, `live` de otra ronda, cambio de hora), «rows by kickoff whatever their state (SPEC-033 CA-1)», «a half-time row stays in live, in its hour»; `e2e/xornada-lectura.spec.ts` «CA-1/CA-2/CA-5/CA-7 …» (orden por competición) | | ❌ |
| CA-2 | `src/components/xornada/CompetitionSection.tsx` (`<h3 data-day-header>` por grupo), `labels.ts` (`dayHeaderLabel`), `src/i18n/{gl,es}.ts` (`xornada.dayHeader`), `Xornada.module.css` (`.dayHeader`, `.dayGroup`) | `src/components/xornada/labels.test.ts` «SPEC-033 CA-2 dayHeaderLabel»; `e2e/xornada-lectura.spec.ts` «CA-1/CA-2/CA-5/CA-7 at {360,390,1024,1440}px {with,without} JS» (texto, `H3`, rol heading nivel 3, color/tamaño/peso/alto, sin fondo) | | ❌ |
| CA-3 | `src/xornada/filter.ts` (`dayGroupView`), `src/components/xornada/XornadaFilters.tsx` (`apply`: grupos y cabeceras) | `src/xornada/filter.test.ts` «SPEC-033 CA-3 dayGroupView»; `e2e/xornada-lectura.spec.ts` «CA-3 at {390,1440}px …», «CA-3 without JS …»; `e2e/xornada-live.spec.ts` «SPEC-033 CA-3/CA-4: a repaint keeps headers, day and the galician mark» | | ❌ |
| CA-4 | `data/galegos/2026-27.json` (31 ids), `src/model/galicians.ts` (`GalicianTeamsFile`), `src/calendar/galicians.ts` (`galicianNames`, `GALICIAN_SEASONS`), `src/xornada/view.ts` (`buildXornada(matches, galicians)`, `homeGalician`/`awayGalician`), `src/app/{xornada-home,xornada-week,demo-xornada}.tsx`, `XornadaLive.tsx`/`XornadaScreen.tsx` (prop `galicians`) | `src/calendar/galicians.test.ts` «SPEC-033 CA-4 …» (esquema, ids en calendario, nombres únicos, registro, 31 = 2/1/5/5/18); `src/xornada/view.test.ts` «SPEC-033 CA-4 buildXornada galician sides»; `src/arch/xornada-boundary.test.ts` (sin cambios, verde); `e2e/xornada-live.spec.ts` «SPEC-033 CA-3/CA-4 …» (cliente) | | ❌ |
| CA-5 | `src/components/xornada/team-name.ts` (`teamNameTone`), `MatchRow.tsx` (`data-galician`, clases), `Xornada.module.css` (`.galician`, `.galicianDeep`) | `src/components/xornada/team-name.test.ts` «SPEC-033 CA-5 teamNameTone» (11 casos); `e2e/xornada-lectura.spec.ts` (peso 600, `--marca`/`--marca-deep` por `getComputedStyle`, ningún no gallego en verde) | | ❌ |
| CA-6 | `src/design/icon.ts` (semilla B, `COLORS`), `tools/icons.mjs`, `public/{favicon.ico,icon-32.png,apple-touch-icon.png}`, `src/app/metadata.ts` (`icons`) | `src/design/icon.test.ts` «SPEC-033 CA-6 the icon» (geometría, medidas, ICO 16+32, píxeles `--bg`/`--marca`/`--fg`); `e2e/xornada-lectura.spec.ts` «SPEC-033 CA-6 …» en `/`, `/es`, `/xornada/<sáb>`, `/es/xornada/<sáb>`, demos; capturas `_qa/SPEC-033/icono-{16,32,180}.png` | | ❌ |
| CA-7 | `src/xornada/demo.ts` (Betis 2–1 Deportivo; Sevilla–Getafe en 46' provisional; `DEMO_SEASON`) | `src/calendar/galicians.test.ts` «SPEC-033 CA-7 Equipo galego in the demonstration»; `e2e/xornada-lectura.spec.ts` matriz 2 rutas × 4 anchos × JS/sin JS; `src/design/{no-hex,css,parity}.test.ts`, `src/i18n/i18n.test.ts` verdes; capturas `_qa/SPEC-033/lectura-*.png` | | ❌ |
| CA-8 | — | `npm run gates` → exit 0 (1652 tests, build OK); `npm run e2e` → 177 passed, 1 skipped (captura sin `QA_CAPTURE_DIR`); `npm run e2e:db` → 47 passed, 1 skipped; `npm run test:db` → 195 passed; `git diff 2fd05be --stat -- src/sources src/decide src/ingest src/board src/app/api supabase` → vacío | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-033/. Informe HTML opcional: _qa/SPEC-033/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-033-1, F-SPEC-033-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-033-1** (lectura de CA-2, a confirmar en verificación): de `TYPE.eyebrow` se toman familia, peso, tamaño, interlineado y tracking, no `uppercase`; solo la cabecera de hoy va en mayúsculas («SÁB 3 OUT»), como en la tira. Si se quiere todo en mayúsculas, es una línea de CSS.
- **F-SPEC-033-2**: `apple-touch-icon.png` es el cuadrado lleno en `--bg` sin la losa redondeada ni el filete (iOS redondea; una esquina transparente sale negra). `favicon.ico` e `icon-32.png` llevan la losa de la retícula de 48.
- **F-SPEC-033-3**: los iconos se regeneran a mano con `node tools/icons.mjs` (Chromium de Playwright); no está en gates. `icon.test.ts` compara píxeles con `COLORS`, así que un cambio de token lo pone en rojo hasta regenerar.
- **F-SPEC-033-4**: una temporada nueva exige su línea en `GALICIAN_SEASONS` (`src/calendar/galicians.ts`, JSON empaquetado, sin lectura de disco en la petición); el test falla si hay un `data/galegos/*.json` sin registrar. Las páginas de semana usan la temporada de `now`.
- **F-SPEC-033-5** (entorno): el primer `npm run test:db` falló en `reconciliacion-sin-directo.db.test.ts` (`matches_pkey` duplicada) por datos que quedaban en el Supabase local; tras el reset del teardown de `e2e:db`, 195/195. Sin relación con el diff.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1..CA-8 implementados con tests, en `ft/SPEC-033-mejoras-de-lectura` (sin push). Spec en `en-revision`.
- Siguiente: sdd-verificador. Capturas: `QA_CAPTURE_DIR=$PWD/docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-033 npx playwright test e2e/xornada-lectura.spec.ts`.
- SPEC-034 tocará el cualificador de la misma fila: este diff no lo toca (`MatchRow.tsx` solo cambia las clases de los nombres).
