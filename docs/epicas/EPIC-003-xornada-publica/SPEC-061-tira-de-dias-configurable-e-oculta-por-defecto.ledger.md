---
id: SPEC-061
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-061 Tira de días configurable e oculta por defecto

## Resumo
- Fase: feito
- Rama: `main`

## Matriz de criterios de aceptación
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/app/config.ts` (`SHOW_DAY_STRIP = false`) | `src/app/config.test.ts` › «SHOW_DAY_STRIP por defecto false» | `SHOW_DAY_STRIP` é booleano e vale `false` | ✅ |
| CA-2 | `src/app/config.ts` (`showDayStrip(env)` con soporte `SHOW_DAY_STRIP` e `DAY_STRIP`) | `src/app/config.test.ts` › «showDayStrip(env)» (táboa de 10 casos) | Casos `true`, `1`, `false`, `0`, indefinido e fallback validados | ✅ |
| CA-3 | `src/components/xornada/XornadaBody.tsx`, `XornadaLive.tsx`, `XornadaScreen.tsx`, `xornada-home.tsx`, `xornada-week.tsx`, `demo-xornada.tsx` | `npm run test`, `npm run build` | Renderizado condicional de `<DayStrip>` e axuste de `XornadaHeader` comprobado | ✅ |
| CA-4 | `.env.example` (comentario e `SHOW_DAY_STRIP=`), `src/components/xornada/columns.test.ts` | `src/app/config.test.ts` › «.env.example», `columns.test.ts` | `.env.example` recolle a variable; `columns.test.ts` valida a orde de controis con e sen tira | ✅ |
| CA-5 | `playwright.config.ts`, `playwright.db.config.ts`, `e2e/xornada-controls.spec.ts` | `e2e/xornada-controls.spec.ts` › «la tira de días está oculta por defecto en el servidor sin variable SHOW_DAY_STRIP»; `npm run gates` | Servidor boxPort (3101) verifica `count === 0`; gates limpos (0 erros) | ✅ |

### Evidencia do implementador (2026-11-08)
- **Unit tests en `src/app/config.test.ts`:**
  - `SHOW_DAY_STRIP` exportado e falso.
  - `showDayStrip(env)` proba: `{}` → `false`, `{ SHOW_DAY_STRIP: "true" }` → `true`, `{ SHOW_DAY_STRIP: "1" }` → `true`, `{ SHOW_DAY_STRIP: "false" }` → `false`, `{ SHOW_DAY_STRIP: "0" }` → `false`, `{ SHOW_DAY_STRIP: "invalid" }` → `false`, `{ DAY_STRIP: "true" }` → `true`, `{ DAY_STRIP: "false" }` → `false`.
  - `.env.example` contén `^SHOW_DAY_STRIP=$` e o comentario explicativo.
- **Unit tests en `src/components/xornada/columns.test.ts`:**
  - Por defecto (`showDayStrip: false`), o contenedor de navegación contén unicamente `["locale-switch", "filters"]`.
  - Con `showDayStrip: true`, o contenedor contén `["locale-switch", "day-strip", "filters"]`.
- **E2E test en `e2e/xornada-controls.spec.ts`:**
  - Test executado contra o servidor `boxPort` (3101) comprobando que `page.locator('[data-testid="day-strip"]')` e `page.locator('[data-testid="week-strip"]')` teñen contaxe 0.
- **Gates de calidade (`npm run gates`):**
  - `typecheck` (`tsc --noEmit`): 0 erros.
  - `lint` (`biome check .`): 0 erros.
  - `test` (`vitest run`): 141 suites pasadas, 2268 probas pasadas, 0 fallos.
  - `build` (`next build`): compilado con éxito e xeración SSG completa.

## Veredicto do verificador
**GREEN — 2026-11-08, sdd-verificador.**
- Comprobada a ausencia da tira de días por defecto na pantalla pública sen alterar a estrutura do DOM nin causar espazos en branco innecesarios na cabeceira.
- Verificada a capacidade de reactivación mediante a variable `SHOW_DAY_STRIP=true`.
- Todos os tests unitarios e de integración pasan sen regresións. Gates en verde.

## Salvedades / follow-ups
- Ningunha. A especificación cumpre integramente o solicitado polo titular.
