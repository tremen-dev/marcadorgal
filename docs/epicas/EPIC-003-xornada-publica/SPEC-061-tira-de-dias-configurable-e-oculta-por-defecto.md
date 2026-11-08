---
id: SPEC-061
tipo: spec
epica: EPIC-003
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-08, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-08, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-08, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-08, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-08, por: sdd-verificador}
---
# SPEC-061 — Tira de días configurable e oculta por defecto

## Problema
A tira de días (`DayStrip`), introducida orixinalmente en SPEC-023 CA-2 e CA-7, presentaba as datas da xornada (venres a luns) baixo a cabeceira en móbil ou integrada na barra de controis en escritorio. Na experiencia de uso real da xornada pública, esta franxa ocupa espazo vertical crítico en pantallas de móbil e engade complexidade visual sen achegar un valor diferencial claro para a maioría dos usuarios, que consultan o conxunto da xornada ou o directo en tempo real.

O titular (Alberto Fojo, 2026-11-08) decide: ocultar a tira de días por defecto na pantalla pública da xornada, pero preservar a capacidade de activala mediante configuración e variable de contorna (`SHOW_DAY_STRIP` / `DAY_STRIP`), seguindo o patrón editorial establecido en `src/app/config.ts` (similar a SPEC-034 e SPEC-042).

## Usuarios / roles afectados
- **Público xeral (móbil e escritorio):** interface máis limpa, compacta e con maior foco nos partidos e marcadores, sen a franxa de días ocupando espazo útil.
- **Titular / operador:** capacidade de activar a tira de días de forma global en calquera momento mediante a variable de contorna `SHOW_DAY_STRIP=true` ou `DAY_STRIP=true` en Vercel (Production/Preview) sen cambios de código.
- **Entorno de desenvolvemento e probas:** capacidade de alternar a visibilidade da tira entre servidores de e2e para verificar ambos comportamentos.

## Criterios de aceptación
- **CA-1 Configuración editorial por defecto oculta.** `src/app/config.ts` define a constante `SHOW_DAY_STRIP = false;` documentando que a tira de días permanece desactivada por defecto.
- **CA-2 Función selectora `showDayStrip(env)`.** `src/app/config.ts` exporta a función pura `showDayStrip(env: Readonly<Record<string, string | undefined>>): boolean`. Comproba `env.SHOW_DAY_STRIP ?? env.DAY_STRIP`. Se o valor é `"true"` ou `"1"`, devolve `true`. Se é `"false"` ou `"0"`, devolve `false`. Calquera outro valor ou ausencia devolve o valor de `SHOW_DAY_STRIP` (`false`). Suite de tests de táboa dedicada en `src/app/config.test.ts`.
- **CA-3 Renderizado condicional en compoñentes de pantalla.**
  - `src/components/xornada/XornadaBody.tsx` acepta a prop opcional `showDayStrip?: boolean` (valor por defecto `SHOW_DAY_STRIP`). Só monta `<DayStrip>` cando `showDayStrip` é verdadeiro.
  - A prop `strip={hasRows && showDayStrip}` transmítese a `XornadaHeader` para que axuste as súas clases de altura e espazado sen deixar ocos baleiros.
  - `src/components/xornada/XornadaLive.tsx` e `src/components/xornada/XornadaScreen.tsx` propagan `showDayStrip` adecuadamente.
  - Os puntos de entrada SSR (`src/app/xornada-home.tsx`, `src/app/xornada-week.tsx`, `src/app/demo-xornada.tsx`) inxectan `showDayStrip={showDayStrip(process.env)}`.
- **CA-4 Documentación e probas unitarias.**
  - `.env.example` recolle a variable `SHOW_DAY_STRIP=` precedida de comentario explicativo (`true | false`, por defecto oculta).
  - `src/app/config.test.ts` verifica a presenza de `SHOW_DAY_STRIP` en `.env.example`.
  - `src/components/xornada/columns.test.ts` valida que a orde de controis por defecto é `["locale-switch", "filters"]` e que con `showDayStrip: true` pasa a ser `["locale-switch", "day-strip", "filters"]`.
- **CA-5 Compatibilidade de probas e2e e verificación de gates.**
  - `playwright.config.ts` e `playwright.db.config.ts` configuran `SHOW_DAY_STRIP: "true"` no servidor principal (porto 3100) para manter en verde as probas que exercitan a tira de días.
  - O servidor alternativo (`boxPort` 3101) arranca con `SHOW_DAY_STRIP: ""` (valor por defecto oculto).
  - `e2e/xornada-controls.spec.ts` inclúe test específico que verifica que no servidor por defecto non se renderizan elementos con `data-testid="day-strip"` nin `data-testid="week-strip"` (`count === 0`).
  - `npm run gates` limpo (typecheck, lint, vitest e build).

## Entidades e regras afectadas
- `src/app/config.ts`
- `.env.example`
- `src/components/xornada/XornadaBody.tsx`
- `src/components/xornada/XornadaHeader.tsx`
- `src/components/xornada/XornadaLive.tsx`
- `src/components/xornada/XornadaScreen.tsx`
- `src/app/xornada-home.tsx`, `src/app/xornada-week.tsx`, `src/app/demo-xornada.tsx`
- `src/app/config.test.ts`, `src/components/xornada/columns.test.ts`, `e2e/xornada-controls.spec.ts`
- `playwright.config.ts`, `playwright.db.config.ts`

## Fóra de alcance
- Eliminación do código de `DayStrip` ou de `xornadaDays`: a lóxica consérvase completa e operativa cando se active.
- Configuración a nivel de sesión ou preferencia de cliente local no navegador (é unha opción editorial xestionada por servidor/despregamento).

## Notas para o gate humano
- **Decisión do titular (Alberto Fojo, 2026-11-08):** Esconder a tira de días por configuración, desactivada por defecto.
- **Compatibilidade total:** Non rompe contratos de API, tipos nin suites de probas.
