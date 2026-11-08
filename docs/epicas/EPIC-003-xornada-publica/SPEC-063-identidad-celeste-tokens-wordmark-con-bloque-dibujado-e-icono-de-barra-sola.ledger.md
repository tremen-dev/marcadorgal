---
id: SPEC-063
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-063 Identidad celeste: tokens, wordmark con bloque dibujado e icono de barra sola

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-063-identidad-celeste-tokens-wordmark-con-bloque-dibujado-e-icono-de-barra-sola`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/design/tokens.ts` (brand/brandDeep/brandInk, `victory`), `src/design/tokens.css` (regenerado), `docs/diseno/_tokens.css` | `src/design/identity.test.ts` «SPEC-063 CA-1 tokens» (valores, contrastes ≥ 4.5, bg/victoria 8.53, regla `background: var(--marca)` sin `color: var(--fg)`); `parity.test.ts`; `tokens.test.ts` (18 claves) | | ❌ |
| CA-2 | `src/components/competition/StandingsTable.module.css` (única `var(--victoria)`) | `identity.test.ts` «CA-2» (git grep vacío, `var(--victoria)` solo en StandingsTable, ni Wordmark/icon/social/tools usan victory); `manifest.test.ts`/`metadata.test.ts` sin cambio | | ❌ |
| CA-3 | `src/components/brand/Wordmark.tsx` + `.module.css` (`.block`), `XornadaHeader.tsx`, `Footer.tsx`; fuera `.mark` de cabecera y `.brandMark`; glifo fuera de `tools/og-image.mjs`/`twitter-assets.mjs` (bloque CSS, sin regenerar PNG) | `identity.test.ts` «CA-3»; `e2e/identidade-celeste.spec.ts` «CA-3» (`/`, `/es`, `/demo/xornada`, `/es/demo/xornada` × 360/1440) | | ❌ |
| CA-4 | `src/design/icon.ts` (`variant`), `public/{favicon.ico,icon-32,apple-touch-icon,icon-192,icon-512}.png` (`node tools/icons.mjs`) | `src/design/icon.test.ts` «SPEC-063 CA-4»; capturas `_qa/SPEC-063/ca4-iconas-{antes,despois}.png` | | ❌ |
| CA-5 | `docs/diseno/Marca.dc.html`, `*.tpl.html` + `.dc.html` (`node build.mjs`), `Componentes.dc.html`, `Main.dc.html`, `HERENCIA.md` | `identity.test.ts` «CA-5» | | ❌ |
| CA-6 | (tokens) | `e2e/identidade-celeste.spec.ts` «CA-6»; `e2e/xornada-live.spec.ts` (Celta en `rgb(0, 153, 204)`); capturas `_qa/SPEC-063/ca6-{antes,despois}_*` | | ❌ |
| CA-7 | `StandingsTable.module.css` `.formW`; `e2e/fixtures/explorer-mock.mjs` + `explorer-standings.json`; `playwright.config.ts` (puertos 3102/3103) | `e2e/identidade-celeste.spec.ts` «CA-7» (`/clasificacion/primera-rfef-g1`, gl/es × 360/1440) | | ❌ |
| CA-8 | — | ver «Evidencia de gates» | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-063/. Informe HTML opcional: _qa/SPEC-063/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-063-1, F-SPEC-063-2… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
