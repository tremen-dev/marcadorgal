---
id: SPEC-003
tipo: spec
epica: EPIC-001
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-09-21, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-21, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-09-21, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-09-21, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-09-21, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-09-21, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-09-21, por: sdd-verificador}
---
# SPEC-003 — Tokens de diseño como código e i18n

## Problema
SPEC-001 dejó siete tokens transcritos a mano en `globals.css` («lo sustituye
la spec de tokens») y un i18n de cuatro cadenas planas. Sin una fuente de verdad
tipada, EPIC-003 escribiría colores y medidas sueltos en cada componente; sin
diccionarios estructurados, los literales de estado y cualificador (dominio.md)
acabarían en `.tsx`. Esta spec fija `src/design/tokens.ts` como única
definición del sistema (D-8, ADR-005), genera el CSS desde él con paridad
probada contra `docs/diseno/_tokens.css`, y da a `src/i18n/` su estructura
definitiva: claves tipadas con parámetros y formato de fecha/hora. Criterio de
éxito 2 de EPIC-001 y D-2.

## Usuarios / roles afectados
- sdd-implementador de EPIC-003/004: consume `tokens.ts`, `tokens.css` y `t()`; no escribe hex ni texto visible.
- Público: ningún cambio visible; la página de espera se ve y se lee igual.
- Humano: aprueba N-1..N-8. Sin actos fuera del repo.

## Criterios de aceptación
- **CA-1 Colores.** `src/design/tokens.ts` exporta `COLORS` (`as const`) con 17 entradas: las 14 de `_tokens.css` sin `--fg-prov` (ADR-005 §3) más tres que el sistema usa sin token: `bgSubtle #131211` (superficie fija: cabecera pegajosa, barra inferior), `bgLive #1E1A16` (tinte de la fila en xogo), `lineRow #1D1A16` (separador entre filas). Claves en inglés: `bg, bgElevated, bgStep, line, lineStrong, fg, fgMuted, fgDim, brand, brandDeep, brandInk, ember, amber, red` + las tres. Cada entrada declara su variable CSS: las heredadas con el nombre de `_tokens.css` (`--marca`, `--directo`, `--alerta`…, N-1), las nuevas `--bg-subtle`, `--bg-live`, `--line-row`. Test: 17 claves, ningún valor ni variable repetidos, ninguna clave `fgProv` ni variable `--fg-prov`.
- **CA-2 Semántica de color.** `tokens.ts` exporta `type StateSemantic = 'live' | 'awaiting' | 'alert'`, `type StateColorToken = 'ember' | 'amber' | 'red'` y `STATE_COLOR: Readonly<Record<StateSemantic, StateColorToken>>` = `{ live: 'ember', awaiting: 'amber', alert: 'red' }` (ADR-005: `awaiting` = aprazado, suspendido, provisional; `alert` = sen sinal, conflicto). Test: `toEqual` con ese objeto; una línea con `// @ts-expect-error` asigna `'brand'` a `StateColorToken` y `npm run typecheck` pasa (si el tipo se abre, falla con TS2578). La resolución estado × cualificador → semántica queda para la spec de Xornada.
- **CA-3 Tipografía.** `FAMILIES = { sans, mono }` con los valores de `--sans`/`--mono`. `TYPE: Record<'display'|'score'|'team'|'status'|'eyebrow', TypeRole>`, `TypeRole = { px, weight, family, leading, tracking?, uppercase? }`, exactamente: `display` 44/800 sans /1 tracking `-0.045em`; `score` 20/600 mono /1; `team` 15/500 sans /1.2 tracking `-0.01em`; `status` 13/600 mono /1; `eyebrow` 11/600 mono /1 tracking `0.15em` `uppercase`. Test: `toEqual` con esa tabla (Main.dc.html «44 / 800 · 20 / 600 · 15 / 500 · 13 / 600 · 11 / 600»; `font:` de Componentes.dc.html).
- **CA-4 Escalas y medidas.** `SPACE = [4, 8, 12, 16, 24, 32, 48]`; `RADIUS = { sm: 8, md: 10, lg: 14, pill: 999 }`; `MEASURE = { barDesktopTop: 56, barDesktopFilter: 44, barMobileHeader: 52, barMobileDays: 40, barMobileSegment: 42, barMobileBottom: 60, rowWide: 52, rowCompact: 30, sidebar: 236, panel: 372 }`; `GRID = { rowWide: '56px minmax(0, 1fr) 52px 32px', rowCompact: '32px minmax(0, 1fr) 46px minmax(0, 1fr) 14px' }`; `LIVE_DOT = { sizePx: 6, glow: '0 0 8px' }`; `LIVE_EDGE = 'inset 2px 0 0'`; `TOUCH_TARGET_PX = 44`; `FOCUS_RING_PX = 2`; `INPUT_FONT_PX = 16`; `HAIRLINE_PX = 1`. Test: `toEqual` por constante (N-3).
- **CA-5 CSS generado.** `src/design/css.ts` exporta `renderTokensCss(): string` (pura): cabecera `/* GENERATED from tokens.ts by tools/tokens-css.mjs — do not edit */` y un único bloque `:root` con una variable por color (nombres de CA-1), `--sans`, `--mono`, por rol `--font-<rol>` (shorthand `weight px/leading family`) y `--tracking-<rol>` si lo tiene, `--space-<valor>`, `--radius-<sm|md|lg|pill>`, y una por medida en kebab-case con unidad (`--bar-desktop-top: 56px`, `--row-wide`, `--grid-row-wide`, `--live-dot-size`, `--live-dot-glow`, `--live-edge`, `--touch-target`, `--focus-ring`, `--input-font`, `--hairline`). `npm run tokens:css` (`node tools/tokens-css.mjs`, que carga `css.ts` con el type-stripping nativo de Node 24, sin `tsx`; N-8) escribe `src/design/tokens.css`. `src/app/globals.css` empieza por `@import "../design/tokens.css";` y pierde su bloque `:root` con hex (los siete provisionales de SPEC-001); `color-scheme: dark` y los estilos base se quedan. Test: `renderTokensCss()` es idéntico a `readFileSync('src/design/tokens.css')` (falla si se edita el CSS a mano o se cambia `tokens.ts` sin regenerar). Verif.: `npm test`; e2e CA-6 de SPEC-001 sigue en verde (mismos colores computados).
- **CA-6 Paridad con el sistema.** `src/design/parity.test.ts` parsea el `:root` de `docs/diseno/_tokens.css`: para cada `--nombre: valor` salvo `--fg-prov` existe una entrada en `tokens.ts` con esa variable y el mismo valor (hex insensible a mayúsculas, F-SPEC-001-1; familias tras normalizar comillas y espacios) y la misma variable con el mismo valor en `tokens.css`. `--fg-prov` no aparece ni en `tokens.ts` ni en `tokens.css`. Mutación: `brand` a `#56DB8E` → falla.
- **CA-7 Fuentes y dígitos.** `tokens.ts` exporta `FACES` con las seis caras de `public/fonts/` (Geist 400/500/600/800, Geist Mono 500/600, con su fichero). `globals.css` conserva las seis `@font-face`, sin `@import` externo. Test: cada cara de `FACES` tiene su fichero en `public/fonts/` y exactamente un `@font-face` en `globals.css` con esa familia, peso y `url(/fonts/<fichero>)`; no hay `@font-face` fuera de `FACES`. `globals.css` declara `html { font-variant-numeric: tabular-nums; }` (ADR-005). Verif.: `npm test` + estilo computado con Playwright (verificador).
- **CA-8 Diccionarios.** `src/i18n/gl.ts` exporta `gl` (`as const`) con claves anidadas: `common { title, switchLocale }`, `waiting { heading, body }`, `status: Record<MatchStatus, string>` = Programado · En xogo · Rematado · Aprazado · Suspendido, `qualifier: Record<Qualifier, string>` = confirmado · provisional · sen sinal, `freshness { lastData: 'último dato hai {n} min' }`. `es.ts` exporta `es: Dictionary` (misma forma, derivada de `typeof gl`) con Programado · En juego · Finalizado · Aplazado · Suspendido, confirmado · provisional · sin señal, `'último dato hace {n} min'`; `title`, `heading`, `body` y `switchLocale` idénticos a los textos actuales. Test (`src/i18n/i18n.test.ts`): los caminos de clave aplanados con `.` de `gl` y `es` son iguales; ningún valor vacío; los `{param}` de cada cadena coinciden entre idiomas; `Object.keys(gl.status)` = `MatchStatus.options` y `Object.keys(gl.qualifier)` = `Qualifier.options` (`@/model`, N-7).
- **CA-9 Literales de dominio.** Test: lee `docs/fundacion/dominio.md`, localiza la fila «Estado de partido», extrae los cinco literales entre paréntesis en su orden y exige `toEqual(Object.values(gl.status))`. Mutación: `En xogo` → `Directo` en `gl.ts` → falla.
- **CA-10 `t` tipada y fechas.** `src/i18n/index.ts` exporta `Locale`, `LOCALES = ['gl', 'es']`, `TranslationKey` (caminos con punto: `'status.live'`, `'freshness.lastData'`…) y `t(locale, key, params?)`, que sustituye `{n}`; el tipo de `params` se infiere de la cadena de `gl` (`{ n: string | number }` para `freshness.lastData`, ninguno para el resto). Test: `t('gl', 'status.live') === 'En xogo'`; `t('es', 'freshness.lastData', { n: 3 }) === 'último dato hace 3 min'`; dos líneas `// @ts-expect-error` (clave inexistente; `freshness.lastData` sin `n`) y `npm run typecheck` pasa. `src/i18n/format.ts` exporta `formatTime(instant, locale)` → `HH:MM` 24 h en `Europe/Madrid` y `formatDay(instant, locale)` → día de la semana abreviado por `Intl` en minúsculas sin punto final + día del mes sin cero (patrón «sáb 26» de los artboards, N-4); entrada `Instant` (ISO UTC), nunca `Date` en la firma. Test con instantes fijos: `2026-09-26T16:00:00Z` → `18:00`, gl `sáb 26`, es `sáb 26`; `2026-09-25T18:30:00Z` → `20:30`, gl `ven 25`, es `vie 25`; `2026-09-28T19:00:00Z` → gl `luns 28`, es `lun 28`; `2026-12-05T17:00:00Z` → `18:00` (horario de invierno).
- **CA-11 Página de espera migrada.** `WaitingPage.tsx` consume `t(locale, 'waiting.heading')`, `'waiting.body'` y `'common.switchLocale'`; `WaitingPage.module.css` solo usa `var(--…)` de `tokens.css` (`.switch` con `min-height: var(--touch-target)`; `.heading` pasa a peso 800, N-6). Textos idénticos. `npm run e2e` pasa; el único diff admitido en `e2e/waiting.spec.ts` es el camino de las tres claves (`dict.waiting.heading`, `dict.waiting.body`, `dict.common.switchLocale`), sin tocar aserciones (N-5). Verif.: `git diff main -- e2e/` + `npm run e2e`.
- **CA-12 Sin hex fuera de los tokens.** `src/design/no-hex.test.ts` recorre `src/**/*.{ts,tsx,css}` y falla si un fichero distinto de `src/design/tokens.ts` y `src/design/tokens.css` contiene `(?<![\w-])#[0-9a-fA-F]{3,8}\b`. Equivalente: `grep -rnE '#[0-9a-fA-F]{3,8}\b' src --include='*.ts' --include='*.tsx' --include='*.css' | grep -v 'src/design/tokens\.'` → vacío. Mutación: `color: #fff` en `WaitingPage.module.css` → falla. Extiende CA-7 de SPEC-001 a todo `src/`.
- **CA-13 Gates.** Dado un clon limpio, `npm ci && npm run gates` sale 0 sin `DATABASE_URL`; `npm run tokens:css` seguido de `git status --porcelain` no muestra cambios (idempotente); `dependencies` de `package.json` no cambia (N-8). Verif.: comando + `git diff main -- package.json`.

## Entidades y reglas afectadas
Estado de partido, Cualificador, Frescura (dominio.md). RN-11 (plantilla de
frescura). D-2 (todo texto vía i18n), D-8 y ADR-005 entero (tokens, semántica
ember/ámbar/rojo, excepciones 1–3, dígitos tabulares, Geist autoalojada, 44 px,
foco, 16 px), D-9 (i18n solo formatea instantes; no mezcla relojes), D-10.
ADR-001 (Vitest, Biome, sin Tailwind). CLAUDE.md (instantes ISO UTC, código en
inglés). `MatchStatus` y `Qualifier` de `src/model/vocab.ts` (SPEC-002 CA-2)
como claves de los diccionarios.

## Fuera de alcance
Componentes nuevos (MatchRow, DayStrip, cabeceras), pantalla Xornada, la
resolución estado × cualificador → color, modo claro, breakpoints, calendario y
cargador (spec d), Storybook o catálogo visual, cara Geist 700 o variable,
detección de idioma o middleware, pluralización y claves más allá de las
listadas, `Intl.RelativeTimeFormat`, retirar `noindex`, tokens de la vista
Global y del panel de escritorio más allá de nombrar sus medidas (ADR-005 §4).

## Notas para el gate humano
- **N-1 Nombres.** Claves TS en inglés (CLAUDE.md); variables CSS heredadas con los nombres de `_tokens.css` (`--marca`, `--directo`, `--alerta`) para que la paridad sea 1:1 y los artboards se lean tal cual; las tres nuevas en inglés. `--directo` no es literal visible: ADR-005 §1 retira «Directo» como etiqueta, no como nombre de variable.
- **N-2 Recuento.** `_tokens.css` declara 15 colores; sin `--fg-prov` quedan 14 (el encargo decía 13), más 3 = 17. Confirmado por Alberto Fojo (2026-09-21).
- **N-3 Declarado, no practicado.** Escalas y radios son los de la prosa de Main.dc.html; los artboards se saltan su propia escala (radios 6/7/12, gaps 3/5/6…) y esas infracciones no se heredan. `sidebar` y `panel` se nombran aunque el panel esté fuera de v1 (ADR-005 §4): son medidas del sistema y nombrarlas evita que reaparezcan sueltas.
- **N-4 Días abreviados.** Los del ICU (`luns` en galego, `lun` en castellano), no los inventados de los artboards (`lun 01`); día sin cero. Si se quiere `lun` también en galego, es una tabla propia, no `Intl`.
- **N-5 e2e.** La reestructuración de claves obliga a tocar tres caminos en `e2e/waiting.spec.ts`; las aserciones no cambian. Desvía del encargo literal («sin cambiar su e2e») a cambio de una estructura sin claves planas residuales.
- **N-6 `.heading` a 800** cierra F-SPEC-001-8 sin cargar una cara más; Chromium ya resolvía a 800.
- **N-7 `src/i18n` importa de `src/model`** (claves = enums). No invierte ninguna frontera: `src/sources` no toca i18n.
- **N-8 Generador.** Resuelto por Alberto Fojo (2026-09-21): el generador se ejecuta con el type-stripping nativo de Node 24, sin devDependency `tsx` ni ninguna otra. `tools/tokens-css.mjs` importa `../src/design/css.ts` con extensión `.ts` explícita (y `css.ts` importa `./tokens.ts` igual); `tokens.ts` y `css.ts` solo usan sintaxis TS borrable (sin `enum`, sin parameter properties).

Mirar con lupa: N-1, N-4 y N-5.
