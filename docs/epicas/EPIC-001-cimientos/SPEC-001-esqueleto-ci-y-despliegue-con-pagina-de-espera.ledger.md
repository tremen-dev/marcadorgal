---
id: SPEC-001
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-001 Esqueleto, CI y despliegue con página de espera

## Resumen
- Fase: en-revision (implementación completa en local; CA-11 pendiente de PR, CA-13/14 pendientes de actos humanos)
- Rama: `ft/SPEC-001-esqueleto-ci-y-despliegue-con-pagina-de-espera`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `package.json` (scripts `typecheck`/`lint`/`test`/`build`/`gates`, `engines.node` 24.x, next 16.3.5, react 19.3.0), `tsconfig.json` (`strict: true`), `biome.json`, `next.config.ts`, `vitest.config.mts` | `npm run gates` → exit 0 en local (Node 26.4.0, ver F-2); `npx tsc --showConfig` muestra `"strict": true` | | ❌ |
| CA-2 | `src/i18n/gl.ts`, `src/i18n/es.ts`, `src/i18n/index.ts` | `src/i18n/i18n.test.ts` (3 casos: mismas claves, ninguna vacía, `t(locale)`); mutación: borrar `switchLocale` de `es.ts` → `1 failed` | | ❌ |
| CA-3 | `src/components/WaitingPage.tsx` (solo consume `t(locale)`), `src/i18n/*` | `e2e/waiting.spec.ts` › «CA-3 h1 and paragraph come literally from the i18n file» (× `/` y `/es`, importa `gl`/`es`) | | ❌ |
| CA-4 | `src/app/(gl)/{layout,page}.tsx`, `src/app/(es)/es/{layout,page}.tsx` (N-1), enlace en `WaitingPage.tsx` | `e2e/waiting.spec.ts` › «CA-4 responds 200 with the right <html lang>», «CA-4 language link leads to the other locale» (× 2 rutas), «CA-4 /gl is not a route» | | ❌ |
| CA-5 | `src/app/metadata.ts` (`robots: { index: false, follow: false }`, N-4) | `e2e/waiting.spec.ts` › «CA-5 has the noindex meta» (× 2 rutas) | | ❌ |
| CA-6 | `src/app/globals.css` (`@font-face` × 6, `:root`), `src/components/WaitingPage.module.css` (`.logo` 800 + `font-synthesis: none`, `.mark`), `public/fonts/Geist-ExtraBold.woff2` (release 1.8.0, OFL) | `e2e/waiting.spec.ts` › «CA-6 brand and tokens are applied» (× 2 rutas); añade comprobación de `FontFace` Geist 800 `loaded` (ver F-3); mutación: sin la cara 800 → `2 failed` | | ❌ |
| CA-7 | `src/app/globals.css` bloque `:root` (`--bg`, `--fg`, `--fg-muted`, `--marca`, `--line`, `--sans`, `--mono`; N-3) | `grep -rnE '#[0-9a-fA-F]{3,8}\b' src --include='*.tsx' --include='*.ts' --include='*.module.css'` → vacío (exit 1); diff contra `_tokens.css`: mismos nombres y valores, hex en minúsculas (F-1) | | ❌ |
| CA-8 | `src/app/globals.css` (`@font-face` con `url(/fonts/…)`), `public/fonts/*.woff2`; sin `<link>` externo ni cookies | `e2e/waiting.spec.ts` › «CA-8 no third-party requests, no cookies, fonts served 200» (× 2 rutas; lee los `url(/fonts/*.woff2)` de `globals.css` y pide cada uno) | | ❌ |
| CA-9 | `WaitingPage.module.css` (`.switch` `min-height: 44px`, `.main` sin anchos fijos), `globals.css` (`:focus-visible` outline 2px) | `e2e/waiting.spec.ts` › «CA-9 at 360×640…» y «CA-9 at 1440×900…» (× 2 rutas; scrollWidth, altura del enlace, foco por Tab) | | ❌ |
| CA-10 | `playwright.config.ts` (proyecto único `chromium`; `webServer: npm run build && npm run start -- --port 3100`, `reuseExistingServer: false`), script `e2e` en `package.json` | `npm run e2e` → `17 passed` en local | | ❌ |
| CA-11 | `.github/workflows/ci.yml` (on `pull_request` + `push` a `main`; jobs `gates` y `e2e` con `setup-node` `node-version-file: .nvmrc` + `cache: npm`) | Pendiente de PR (la abre el orquestador tras verificación): `gh pr checks` | | ❌ |
| CA-12 | `.env.example` (6 claves sin valor), `.gitignore` (`.env`, `.env.*`, `!.env.example`) | `git check-ignore -q .env` → 0; `git check-ignore -q .env.example` → 1; bucle `grep -rqF` por cada valor de `.env` sobre el árbol (sin node_modules/.next/.git) → 0 coincidencias | | ❌ |
| CA-13 | — (precondición humana H-1..H-3 no ejecutada) | Pendiente: `curl` a `https://marcador.gal` y `/es` tras H-1..H-3 y merge a `main` | | ❌ |
| CA-14 | — (precondición humana H-1 no ejecutada) | Pendiente: `gh pr view --comments` + `curl` a la URL de preview | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-001/. Informe HTML opcional: _qa/SPEC-001/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-001-1, F-SPEC-001-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-001-1** Biome formatea los hex de `globals.css` a minúsculas (`#f5f1ea`) mientras `_tokens.css` los tiene en mayúsculas; mismo valor. Destino: spec de tokens (test de paridad insensible a mayúsculas).
- **F-SPEC-001-2** Gates y e2e ejecutados en local con Node 26.4.0 (no hay `nvm`; `.nvmrc` y `engines` siguen en 24). La ejecución con Node 24 la aporta CI. Destino: verificación de CA-11.
- **F-SPEC-001-3** `document.fonts.check('800 1em Geist')` devuelve `true` aunque falte la cara 800 (cae a la 600), así que el e2e añade una comprobación estricta de `FontFace` 800 cargada. Destino: sdd-arquitecto, redacción de CA similares en futuras specs (SPEC-001 no se edita).
- **F-SPEC-001-4** `next-env.d.ts` y `*.tsbuildinfo` van en `.gitignore`: Next 16 los regenera y `next-env.d.ts` importa `.next/types`, inexistente en un clon limpio. `tsc --noEmit` pasa sin ellos (los tipos globales entran por `import type { NextConfig } from "next"`). Informativo.
- **F-SPEC-001-5** `next build` reescribe `tsconfig.json` (`jsx: react-jsx`, `include` con `.next/dev/types`); se ha commiteado tal cual lo deja Next. Informativo.
- **F-SPEC-001-6** `public/fonts/LICENSE.txt` es el heredado (OFL 1.1, © 2023 Vercel); `Geist-ExtraBold.woff2` viene del release 1.8.0 cuyo `OFL.txt` dice © 2024 The Geist Project Authors, misma licencia. Destino: EPIC-MEJORA (actualizar el fichero de licencia al del release).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho en local: CA-1..CA-10 y CA-12 con código, tests y comandos en verde (`npm ci && npm run gates`; `npx playwright install chromium && npm run e2e`).
- CA-11: `ci.yml` está en la rama; falta abrir la PR (orquestador) y comprobar `gh pr checks` con `gates` y `e2e` en verde.
- CA-13 y CA-14: bloqueados por actos humanos H-1..H-3 (Vercel, DNS). No son fallos de implementación.
- Commits en la rama: `f7861c4` esqueleto, `ad10ed0` i18n, `8d8aa34` página de espera, `3fe5689` e2e, `298b3f9` ci, `7c7c30b` `.env.example`, más el de este ledger.
- Para reproducir: Node 24 (`.nvmrc`), `npm ci`, `npm run gates`, `npx playwright install chromium`, `npm run e2e`. El e2e levanta `next start` en el puerto 3100.
