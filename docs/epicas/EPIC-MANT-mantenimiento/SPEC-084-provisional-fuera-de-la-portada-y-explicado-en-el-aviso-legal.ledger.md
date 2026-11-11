---
id: SPEC-084
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-084 Provisional fuera de la portada y explicado en el aviso legal

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-083-mantenimiento-ligas-y-artefactos` (PR #137; ver H-2)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/app/config.ts` (`PROVISIONAL_DISPLAY = "hidden"`) | `src/app/config.test.ts` «SPEC-084 CA-1 PROVISIONAL_DISPLAY»; `e2e/xornada-provisional.spec.ts` «SPEC-084 CA-1 the default mode is hidden» | | ❌ |
| CA-2 | `src/app/config.ts` (el modo `hidden` ya existía, SPEC-034 CA-4) | `e2e/xornada-provisional.spec.ts` «SPEC-084 CA-2 hidden at {390,1440}px with JS (default / ?provisional=hidden / ?provisional=Mark)» y «… without JS», gl y es; `e2e/xornada.spec.ts` «CA-3 every row says…» (provisional sin palabra en `hidden`) | | ❌ |
| CA-3 | `src/app/config.ts` `provisionalDisplay(param)`; `src/app/demo-xornada.tsx`; `src/app/(gl)/demo/xornada/page.tsx`; `src/app/(es)/es/demo/xornada/page.tsx` | `src/app/config.test.ts` «SPEC-084 CA-3 provisionalDisplay(param)» (tabla valor → modo); `e2e/xornada-provisional.spec.ts` «SPEC-034 CA-3 mark …» (aserciones previas, por `?provisional=mark`) y «SPEC-084 CA-3 label … with/without JS»; unitarios de `provisional.test.ts`/`qualifier.test.ts` sin cambios (ya pasaban el modo explícito) | | ❌ |
| CA-4 | `src/lib/legal/content.ts` (párrafo en apartado 4 gl/es; `lastUpdated` 11 nov 2026) | `src/lib/legal/content.test.ts` «provisional results in the aviso legal (SPEC-084 CA-4)» | | ❌ |
| CA-5 | — (sin cambios en fronteras; versión 0.10.1 sin tocar) | `npm run gates` exit 0 (172 ficheros, 2905 tests); `npx playwright test` exit 0: 457 passed, 1 skipped; `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/app/api supabase` vacío | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-084/. Informe HTML opcional: _qa/SPEC-084/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-084-1, F-SPEC-084-2… con destino (spec futura o EPIC-MEJORA). -->
- **Cambio pedido por el titular en el gate (fuera del alcance escrito de la spec):** corregida la errata «reconciled multiffuente» del apartado 4 del aviso legal gl → «reconciliación multifonte», coherente con el es «reconciliación multifuente». Test: `src/lib/legal/content.test.ts` «section 4 in gl is in Galician, like its es twin». Commit 0288d0f.
- Desviación menor: `e2e/xornada.spec.ts` (SPEC-019 CA-3, «every row says … its qualifier») asumía la palabra visible en filas provisionales; ahora afirma su ausencia cuando el defecto es `hidden` (sen_sinal sigue exigiendo su etiqueta).
- Desviación (test de otra spec): `e2e/cabecera-movil.spec.ts` «SPEC-082 CA-6 … no layout shift in the header» sumaba todo el CLS de la página. Con `hidden` pasó a 0,0101 (> 0,01) en 8 de 10 repeticiones; con `mark`, 10/10 en verde. Causa medida con PerformanceObserver: el cambio de fuente web desplaza ~4 px las filas de la lista (no la cabecera); con las `.woff2` bloqueadas, CLS 0. `hidden` solo deja otras filas dentro de los 900 px. Cambio: una primera visita para tener las fuentes en caché antes de medir (sigue midiendo pliegue de primera pintura e hidratación). `--repeat-each=5`: 325 passed.
- F-SPEC-084-2: CLS real de ~0,01 por cambio de fuente en la primera visita a la xornada a 360 px (previo a SPEC-084; métricas de fallback de las fuentes). Destino: EPIC-MEJORA.
- F-SPEC-084-1: el enlace «Todos» del filtro (navegación real a la ruta) no conserva `?provisional=`; solo afecta a la demo con parámetro, no a producción. Sin destino salvo que el titular lo pida.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-5 implementados en `ft/SPEC-083-mantenimiento-ligas-y-artefactos` (PR #137, H-2): commits 9e610d5 (modo `hidden` + parámetro de demo + e2e), 0288d0f (aviso legal + errata) y el de cierre (test CLS de SPEC-082 + ledger). Sin subida de versión (0.10.1 de SPEC-083). Falta: verificación (sdd-verificador). Capturas: `QA_CAPTURE_DIR=_qa/SPEC-084 npx playwright test e2e/xornada-provisional.spec.ts` genera `oculto-*`, `provisional-*`.
