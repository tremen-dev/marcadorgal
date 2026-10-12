---
id: SPEC-034
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-034 Provisional configurable en la pantalla

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-034-provisional-configurable`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/xornada/qualifier.ts` (`ProvisionalDisplay`, `qualifierDisplay`, `provisionalLegendShown`); `src/xornada/view.ts` (`XornadaRow.qualifierDisplay`, 3.er arg de `buildXornada`) | `src/xornada/qualifier.test.ts` «SPEC-034 CA-1» (3 modos × 11 pares estado·cualificador) | | ❌ |
| CA-2 | `src/components/xornada/MatchRow.tsx` (`kind: "label"`) | `src/components/xornada/provisional.test.ts` «CA-2 label» (gl, es) | | ❌ |
| CA-3 | `MatchRow.tsx` (`kind: "mark"`: `*` ámbar `aria-hidden` + `srOnly`); `XornadaBody.tsx` (`data-provisional-legend`, servida con `hidden` si no hay `provisional`); `XornadaFilters.tsx` (`apply`: sigue a las filas visibles); `Xornada.module.css` (`.mark`, `.legend`); `src/i18n/gl.ts`, `es.ts` (`qualifier.provisionalLegend`) | `provisional.test.ts` «CA-3 mark…», «the legend»; `qualifier.test.ts` «SPEC-034 CA-3»; `e2e/xornada-provisional.spec.ts` «CA-3 … with JS / without JS» | | ❌ |
| CA-4 | `MatchRow.tsx` (`kind: "none"`); sin leyenda fuera de `mark` (`XornadaBody.tsx`) | `provisional.test.ts` «CA-4 hidden», «CA-2/CA-4 %s: no legend» | | ❌ |
| CA-5 | `src/app/config.ts` (`PROVISIONAL_DISPLAY = "mark"`); pasada por `src/app/demo-xornada.tsx`, `xornada-home.tsx`, `xornada-week.tsx` a `XornadaScreen` y a `XornadaLive` (`provisionalDisplay`, obligatoria) | `src/app/config.test.ts`; `e2e/xornada-provisional.spec.ts` «CA-5» | | ❌ |
| CA-6 | (CA-2..CA-4) | `provisional.test.ts` (render de `MatchRow` y leyenda, 3 modos, gl/es); `e2e/xornada-provisional.spec.ts` (8 casos: gl/es × 390/1440 × JS/sin JS); `src/i18n/i18n.test.ts` (paridad, clave nueva) | | ❌ |
| CA-7 | — | `npm run gates` → exit 0 (99 ficheros, 1711 tests; lint 1 warning previo en `src/arch/deploy.test.ts`); `npx playwright test` → 187 passed; `npm run e2e:db` → 47 passed, 1 skipped (`QA_CAPTURE_DIR`); `git diff cfc1193 --stat -- src/sources src/decide src/ingest src/board src/app/api supabase` → vacío | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-034/. Informe HTML opcional: _qa/SPEC-034/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-034-1, F-SPEC-034-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-034-1 (CA-7): `git diff origin/main --stat -- …` no sale vacío: muestra `src/board/http.ts`, que es de SPEC-030 (8936569, en `origin/main` y no en esta rama, que parte de cfc1193). Contra cfc1193 sale vacío. Desaparece al rebasar sobre `origin/main`. Destino: el merge.
- F-SPEC-034-2 (CA-3): la leyenda usa la letra de `TYPE.eyebrow` (mono 600 11px, `--tracking-eyebrow`, sin mayúsculas) con `line-height: 1.5` en lugar del 1 del token, porque a 390 px la frase ocupa dos líneas. Destino: revisión de diseño (D-8).
- F-SPEC-034-3: `XornadaRow.qualifierKey` se mantiene (los tests de SPEC-019/021 lo usan) y sigue diciendo el cualificador sin modo; lo que se pinta lo decide `qualifierDisplay`. Destino: limpieza, si se quiere.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Están hechos CA-1..CA-7 y la spec está en `en-revision`. Lo siguiente es la verificación. El modo se cambia en `src/app/config.ts`. Las capturas salen con `QA_CAPTURE_DIR=_qa/SPEC-034 npx playwright test e2e/xornada-provisional.spec.ts` (`provisional-*.png`).
