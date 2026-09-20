---
id: SPEC-003
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-003 Tokens de diseño como código e i18n

## Resumen
- Fase: en-revision (implementación completa, pendiente de sdd-verificador)
- Rama: `ft/SPEC-003-tokens-de-diseno-como-codigo-e-i18n`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/design/tokens.ts` (`COLORS` `as const`, 17 entradas `{ value, css }`; heredadas con `--marca`, `--directo`, `--alerta`…; nuevas `--bg-subtle`, `--bg-live`, `--line-row`) | `src/design/tokens.test.ts` › «CA-1 colors» (5 casos: 17 claves en orden, las tres nuevas presentes en los artboards, nombres heredados, sin repetidos, sin `fgProv`/`--fg-prov`) | | ❌ |
| CA-2 | `src/design/tokens.ts` (`StateSemantic`, `StateColorToken`, `STATE_COLOR`) | `tokens.test.ts` › «CA-2 state colour semantics» (2 casos, uno con `// @ts-expect-error` `'brand'`); mutación `StateColorToken` + `"brand"` → `tsc` TS2578 en `tokens.test.ts:81`, restaurado | | ❌ |
| CA-3 | `src/design/tokens.ts` (`FAMILIES`, `TypeRole`, `TYPE`) | `tokens.test.ts` › «CA-3 typography» (2 casos `toEqual`) | | ❌ |
| CA-4 | `src/design/tokens.ts` (`SPACE`, `RADIUS`, `MEASURE`, `GRID`, `LIVE_DOT`, `LIVE_EDGE`, `TOUCH_TARGET_PX`, `FOCUS_RING_PX`, `INPUT_FONT_PX`, `HAIRLINE_PX`) | `tokens.test.ts` › «CA-4 scales and measures» (6 casos `toEqual`) | | ❌ |
| CA-5 | `src/design/css.ts` (`renderTokensCss`, importa `./tokens.ts`), `tools/tokens-css.mjs` (type-stripping nativo, sin `tsx`), `package.json` script `tokens:css`, `src/design/tokens.css` (generado, 57 variables), `src/app/globals.css` (`@import "../design/tokens.css"` en línea 1, sin `:root`, `html { color-scheme: dark }`), `tsconfig.json` `allowImportingTsExtensions`, `biome.json` excluye `tokens.css` | `src/design/css.test.ts` (5 casos: idéntico a `tokens.css`, cabecera + un solo `:root`, 37 variables nombradas, `globals.css` empieza por el `@import` y no tiene `:root`); `npm run tokens:css && git status --porcelain` → vacío (Node 26.4.0, sin flags) | | ❌ |
| CA-6 | — (cubierto por `tokens.ts` y `tokens.css`) | `src/design/parity.test.ts` (34 casos: `it.each` por variable de `_tokens.css` salvo `--fg-prov` × {`tokens.ts`, `tokens.css`}, más `--fg-prov` ausente); mutación `brand` → `#56DB8E` → `3 failed` (`--marca` en tokens.ts, «identical», «declares the variables»), restaurado y regenerado | | ❌ |
| CA-7 | `src/design/tokens.ts` (`FACES`, 6 caras), `src/app/globals.css` (seis `@font-face` intactos, sin `@import` externo, `html { font-variant-numeric: tabular-nums }`) | `src/design/fonts.test.ts` (9 casos: `FACES` exacto, `it.each` fichero en `public/fonts` + exactamente un `@font-face`, ninguno fuera de `FACES`, sin `@import url(`, `tabular-nums` en `html`) | | ❌ |
| CA-8 | `src/i18n/gl.ts` (`gl` `as const satisfies { status: Record<MatchStatus,…>, qualifier: Record<Qualifier,…> }`, `Dictionary = Shape<typeof gl>`), `src/i18n/es.ts` (`es: Dictionary`) | `src/i18n/i18n.test.ts` › «CA-8 dictionaries» (6 casos: caminos aplanados iguales, sin vacíos, `{param}` iguales, claves = `MatchStatus.options`/`Qualifier.options`, textos actuales intactos, literales de cualificador/frescura/es.status) | | ❌ |
| CA-9 | `src/i18n/gl.ts` (`status`) | `i18n.test.ts` › «CA-9 domain literals» (lee `dominio.md`, fila «Estado de partido», cinco paréntesis en orden); mutación `En xogo` → `Directo` → `2 failed` (CA-9 y `t('gl','status.live')`), restaurado | | ❌ |
| CA-10 | `src/i18n/index.ts` (`LOCALES`, `Locale`, `TranslationKey`, `t(locale, key, params?)` con `params` inferidos de la cadena de `gl`), `src/i18n/format.ts` (`formatTime`, `formatDay`, entrada `Instant`, `Europe/Madrid`, `hourCycle: h23`, punto final quitado, día sin cero), `vitest.config.mts` (alias `@` → `src`), `src/app/metadata.ts` (`t(locale, "common.title")`) | `i18n.test.ts` › «CA-10 typed t()» (4 casos, dos `// @ts-expect-error`); `src/i18n/format.test.ts` (8 casos: 4 horas incl. invierno y medianoche, 4 días gl/es); mutación `TranslationKey = string` → `tsc` 1×TS2578, restaurado | | ❌ |
| CA-11 | `src/components/WaitingPage.tsx` (`t(locale, 'waiting.heading' | 'waiting.body' | 'common.switchLocale')`), `src/components/WaitingPage.module.css` (`.switch min-height: var(--touch-target)`, `.heading` 800, `--space-*`, `--hairline`, `--tracking-display`), `e2e/waiting.spec.ts` (solo los tres caminos de clave) | `src/design/no-hex.test.ts` › «CA-11» (2 casos: cada `var(--…)` del módulo existe en `tokens.css`; `.switch`/`.heading`); `npm run e2e` → ver handoff; `git diff main -- e2e/` → tres caminos, aserciones intactas (Biome parte dos en varias líneas) | | ❌ |
| CA-12 | `src/design/no-hex.test.ts` (regex `(?<![\w-])#[0-9a-fA-F]{3,8}\b`, `globSync('src/**/*.{ts,tsx,css}')`, permitidos `tokens.ts`/`tokens.css`) | `no-hex.test.ts` › «CA-12» (2 casos); `grep -rnE '#[0-9a-fA-F]{3,8}\b' src --include=… | grep -v 'src/design/tokens\.'` → vacío; mutación `.mut { color: #fff }` en `WaitingPage.module.css` → `1 failed`, restaurado | | ❌ |
| CA-13 | `package.json` (solo script `tokens:css`; `dependencies`/`devDependencies` intactas) | `npm run gates` → ver handoff; `npm run tokens:css && git status --porcelain` → vacío; `git diff main -- package.json` → solo `+ "tokens:css": "node tools/tokens-css.mjs"` | | ❌ |
## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-003/. Informe HTML opcional: _qa/SPEC-003/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-003-1, F-SPEC-003-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-003-1** `node tools/tokens-css.mjs` emite el aviso `MODULE_TYPELESS_PACKAGE_JSON` (Node reparsea `css.ts` como ESM porque `package.json` no declara `"type"`). Funciona sin flags en Node 26.4.0 local (y en 24 según N-8). No se ha añadido `"type": "module"` para no cambiar la semántica de otros ficheros. Destino: EPIC-MEJORA (o `"type": "module"` cuando otra spec lo necesite). Informativo.
- **F-SPEC-003-2** CA-12 (grep sobre todo `src/`) obliga a que ni los tests contengan hex: `tokens.test.ts` comprueba los tres colores nuevos contra los artboards (`docs/diseno/*.dc.html`), `css.test.ts` deriva sus líneas de `COLORS` y `parity.test.ts` solo exige forma `#RRGGBB` para `--fg-prov`. Los valores concretos quedan protegidos por la paridad con `_tokens.css`. Informativo.
- **F-SPEC-003-3** `WaitingPage.module.css` mantiene `gap: 40px` (40 no está en `SPACE`, N-3; cambiarlo sí sería visible), los `clamp(...)` del logo/heading/body y `.switch font: 500 15px/1` (no `--font-team`, leading 1.2). Solo se han tokenizado los valores 1:1 sin cambio visible. Destino: spec de la pantalla Xornada / rediseño de la página de espera.
- **F-SPEC-003-4** Biome reformatearía `src/design/tokens.css` (hex en minúsculas, comillas dobles, `44px / 1`), lo que rompería el test «identical» de CA-5: `biome.json` lo excluye como fichero generado. Informativo.
- **F-SPEC-003-5** `tsconfig.json` añade `allowImportingTsExtensions: true` (exigido por `import … from "./tokens.ts"` de N-8; compatible con `noEmit`). `next build` resuelve el import con extensión sin cambios. Informativo.
- **F-SPEC-003-6** `vitest.config.mts` añade `resolve.alias` `@` → `src` para que los tests importen `@/model` (N-7); hasta ahora ningún test usaba el alias. Informativo.
- **F-SPEC-003-7** `src/app/metadata.ts` no está en CA-11 pero consumía `t(locale).title`; migrado a `t(locale, "common.title")` por el cambio de firma de CA-10. Informativo.
- **F-SPEC-003-8** Gates y e2e ejecutados en local con Node 26.4.0 (no hay Node 24; `.nvmrc` sigue en 24). Push de la rama por instrucción explícita del orquestador (sin PR), igual que F-SPEC-002-6. Informativo.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho en local (2026-09-21, Node 26.4.0): CA-1..CA-13 con código y tests; rama `ft/SPEC-003-tokens-de-diseno-como-codigo-e-i18n` publicada, sin PR.
- Reproducir: `npm ci && env -u DATABASE_URL npm run gates` → exit 0 (typecheck ok, Biome «Checked 42 files», Vitest `10 files / 129 passed`, `next build` ok); `npm run tokens:css && git status --porcelain` → vacío; `npm run e2e` → `17 passed` (Chromium); `git diff main -- package.json` → solo el script `tokens:css`.
- Mutaciones de la spec verificadas y revertidas: CA-2 (`'brand'` en `StateColorToken` → TS2578), CA-6 (`brand` `#56DB8E` → 3 failed), CA-9 (`Directo` → 2 failed), CA-10 (`TranslationKey = string` → TS2578), CA-12 (`color: #fff` → 1 failed).
- Pendiente del verificador: estilo computado con Playwright (CA-7 `tabular-nums`, CA-11 heading 800 y colores), CI en Node 24.
