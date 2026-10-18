---
id: SPEC-034
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-034 Provisional configurable en la pantalla

## Resumen
- Fase: hecho <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-034-provisional-configurable`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/xornada/qualifier.ts` (`ProvisionalDisplay`, `qualifierDisplay`, `provisionalLegendShown`); `src/xornada/view.ts` (`XornadaRow.qualifierDisplay`, 3.er arg de `buildXornada`) | `src/xornada/qualifier.test.ts` «SPEC-034 CA-1» (3 modos × 11 pares estado·cualificador) | `vitest` verde (qualifier.test.ts: 3 modos × estado·cualificador); `qualifierDisplay` solo varía `provisional`: `confirmado`→none, `sen_sinal`→label en los 3 modos (también en provisional.test.ts «CA-1 sen sinal…»). `src/xornada/qualifier.ts` sin reloj/red/i18n | ✅ |
| CA-2 | `src/components/xornada/MatchRow.tsx` (`kind: "label"`) | `src/components/xornada/provisional.test.ts` «CA-2 label» (gl, es) | provisional.test.ts «CA-2 label» gl/es: `span.qualifier.amber[data-testid=match-qualifier]` con `qualifier.provisional`, sin `*` | ✅ |
| CA-3 | `MatchRow.tsx` (`kind: "mark"`: `*` ámbar `aria-hidden` + `srOnly`); `XornadaBody.tsx` (`data-provisional-legend`, servida con `hidden` si no hay `provisional`); `XornadaFilters.tsx` (`apply`: sigue a las filas visibles); `Xornada.module.css` (`.mark`, `.legend`); `src/i18n/gl.ts`, `es.ts` (`qualifier.provisionalLegend`) | `provisional.test.ts` «CA-3 mark…», «the legend»; `qualifier.test.ts` «SPEC-034 CA-3»; `e2e/xornada-provisional.spec.ts` «CA-3 … with JS / without JS» | Playwright propio (`_qa/SPEC-034/verif.mjs`, gl/es × 390/1440 × JS/sin JS): 4/4 filas `provisional` (live, finished, suspended, postponed) con `*` `aria-hidden=true` y 0 etiquetas visibles; árbol a11y de la fila «46' En xogo provisional Sevilla 2 Getafe 1» (sin `*`); 1 leyenda al pie, texto literal gl/es, Geist Mono 600 11px, tracking 1.65px (0.15em), `text-transform: none`, color rgb(167,165,160) = `--fg-muted`; sin desbordes ni scroll horizontal. Con JS: Rematados → visible; + ven 2 (0 provisional visibles) → oculta; sáb 3 → vuelve. e2e `xornada-provisional.spec.ts` 8/8 (incl. plegado). Salvedad F-SPEC-034-2 (line-height 1.5 en lugar de 1) aceptada | ⚠️ |
| CA-4 | `MatchRow.tsx` (`kind: "none"`); sin leyenda fuera de `mark` (`XornadaBody.tsx`) | `provisional.test.ts` «CA-4 hidden», «CA-2/CA-4 %s: no legend» | provisional.test.ts «CA-4 hidden» gl/es: `data-qualifier="provisional"` presente, ni texto ni `*` ni `match-qualifier`; «CA-2/CA-4 hidden: no legend». No verificable en navegador sin cambiar código (la constante es `mark`); cubierto por render SSR | ✅ |
| CA-5 | `src/app/config.ts` (`PROVISIONAL_DISPLAY = "mark"`); pasada por `src/app/demo-xornada.tsx`, `xornada-home.tsx`, `xornada-week.tsx` a `XornadaScreen` y a `XornadaLive` (`provisionalDisplay`, obligatoria) | `src/app/config.test.ts`; `e2e/xornada-provisional.spec.ts` «CA-5» | `src/app/config.ts` única definición (`grep PROVISIONAL_DISPLAY src` → config.ts + 3 páginas); pasada a `XornadaScreen` y `XornadaLive` (prop obligatoria, typecheck); config.test.ts: ∈ modos y = `mark` | ✅ |
| CA-6 | (CA-2..CA-4) | `provisional.test.ts` (render de `MatchRow` y leyenda, 3 modos, gl/es); `e2e/xornada-provisional.spec.ts` (8 casos: gl/es × 390/1440 × JS/sin JS); `src/i18n/i18n.test.ts` (paridad, clave nueva) | provisional.test.ts (3 modos, gl/es) verde; e2e 190 passed; capturas `_qa/SPEC-034/provisional-*.png` y `verif-*.png`; i18n.test.ts paridad con `provisionalLegend`; diff sin hex ni `font:` (`grep -rnE '^\s*font:' src --include='*.css'` → vacío); `.mark`/`.legend` con `var(--amber)`, `var(--fg-muted)`, `var(--mono)`, `var(--tracking-eyebrow)`, `var(--space-16)` | ✅ |
| CA-7 | — | `npm run gates` → exit 0 (99 ficheros, 1711 tests; lint 1 warning previo en `src/arch/deploy.test.ts`); `npx playwright test` → 187 passed; `npm run e2e:db` → 47 passed, 1 skipped (`QA_CAPTURE_DIR`); `git diff cfc1193 --stat -- src/sources src/decide src/ingest src/board src/app/api supabase` → vacío | `npm run gates` EXIT=0 (101 ficheros, 1742 tests; lint 1 warning previo); `npx playwright test` 190 passed; `npm run e2e:db` 47 passed, 1 skipped; `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/app/api supabase` → vacío (origin/main = dba87e8, PR #65 fusionado) | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN** — 2026-10-12, sdd-verificador. CA-1, CA-2, CA-4..CA-7 ✅; CA-3 ⚠️ por F-SPEC-034-2, aceptada. `sen_sinal` conserva su etiqueta en los 3 modos y en las 8 combinaciones del navegador. Ningún estado va solo por color: el glifo `*` tiene leyenda y el lector de pantalla lee «provisional». La leyenda sigue a las filas visibles con JS y se sirve visible sin JS. Fronteras vacías contra origin/main.
- F-SPEC-034-1: cerrada. origin/main ya incluye #65 y el diff de CA-7 sale vacío.
- F-SPEC-034-2: aceptada como salvedad de CA-3. La familia, el peso, el tamaño, el tracking y la ausencia de mayúsculas son los de `TYPE.eyebrow`; solo cambia el interlineado, porque con 1 una frase de dos líneas a 390 px se montaría. Va a revisión de diseño (D-8).
- F-SPEC-034-3: aceptada. No afecta a ningún CA, porque lo que se pinta lo decide `qualifierDisplay` (verificado en el render). Queda como limpieza opcional.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-034/. Informe HTML opcional: _qa/SPEC-034/informe.html -->
| CA | Captura |
|---|---|
| CA-3, CA-6 | `_qa/SPEC-034/verif-{gl,es}-{390,1440}-{js,nojs}.png`; `_qa/SPEC-034/provisional-{gl,es}-{390,1440}.png`, `provisional-nojs-*.png` |
| CA-3 (leyenda oculta) | `_qa/SPEC-034/verif-oculta-{gl,es}-{390,1440}-js.png`; `_qa/SPEC-034/provisional-oculta-*.png` |

## Salvedades / follow-ups
<!-- IDs F-SPEC-034-1, F-SPEC-034-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-034-1 (CA-7): `git diff origin/main --stat -- …` no sale vacío: muestra `src/board/http.ts`, que es de SPEC-030 (8936569, en `origin/main` y no en esta rama, que parte de cfc1193). Contra cfc1193 sale vacío. Desaparece al rebasar sobre `origin/main`. Destino: el merge.
- F-SPEC-034-2 (CA-3): la leyenda usa la letra de `TYPE.eyebrow` (mono 600 11px, `--tracking-eyebrow`, sin mayúsculas) con `line-height: 1.5` en lugar del 1 del token, porque a 390 px la frase ocupa dos líneas. Destino: revisión de diseño (D-8).
- F-SPEC-034-3: `XornadaRow.qualifierKey` se mantiene (los tests de SPEC-019/021 lo usan) y sigue diciendo el cualificador sin modo; lo que se pinta lo decide `qualifierDisplay`. Destino: limpieza, si se quiere.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Están hechos CA-1..CA-7 y la spec está en `en-revision`. Lo siguiente es la verificación. El modo se cambia en `src/app/config.ts`. Las capturas salen con `QA_CAPTURE_DIR=_qa/SPEC-034 npx playwright test e2e/xornada-provisional.spec.ts` (`provisional-*.png`).
