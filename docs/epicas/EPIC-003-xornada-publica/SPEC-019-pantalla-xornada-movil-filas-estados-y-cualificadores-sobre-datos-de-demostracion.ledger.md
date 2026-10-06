---
id: SPEC-019
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-019 Pantalla Xornada móvil: filas, estados y cualificadores sobre datos de demostración

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-019-pantalla-xornada-movil-filas-estados-y-cualificadores-sobre-datos-de-demostracion`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/model/public.ts` (export en `src/model/index.ts`) | `src/model/public.test.ts` «SPEC-019 CA-1 PublicMatch» | | ❌ |
| CA-2 | `src/xornada/view.ts`; `src/arch/xornada-boundary.ts` | `src/xornada/view.test.ts` (estado × cualificador, orden H-1/H-2, 45+3 vs 46, `minute: null`, empate); `src/arch/xornada-boundary.test.ts` | | ❌ |
| CA-3 | `src/components/xornada/{XornadaScreen,CompetitionSection,MatchRow}.tsx`, `Xornada.module.css` | `e2e/xornada.spec.ts` «CA-3 …» (etiqueta/minuto, cualificador, literales, «–», `tabular-nums`, píldora) | | ❌ |
| CA-4 | `Xornada.module.css` (nombres con `overflow-wrap`, sin `ellipsis`); `src/xornada/demo.ts` | `e2e/xornada.spec.ts` «CA-4 nothing is truncated at 360px/390px» (gl y es) | | ❌ |
| CA-5 | `src/xornada/demo.ts` (`DEMO_MATCHES`, `isDemoAvailable`); `src/app/demo-xornada.tsx`; `src/app/(gl)/demo/xornada/page.tsx`; `src/app/(es)/es/demo/xornada/page.tsx` | `src/xornada/demo.test.ts`; `e2e/xornada.spec.ts` «CA-5 noindex and the same rows without JavaScript» | | ❌ |
| CA-6 | `src/i18n/gl.ts`, `src/i18n/es.ts` (`xornada.*`, `locales.*`); selector en `XornadaScreen.tsx`; `formatTime` en `MatchRow.tsx` | `src/i18n/i18n.test.ts` «SPEC-019 CA-6»; `e2e/xornada.spec.ts` «CA-6 …» (selector, castellano, nombres idénticos, 21:00 Madrid) | | ❌ |
| CA-7 | — | `npm run gates` exit 0 (57 ficheros, 971 tests); `npm run e2e` 37 passed; `git diff main --stat -- src/sources src/decide src/ingest supabase` vacío; `no-hex.test.ts` y `fonts.test.ts` en verde | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-019/. Informe HTML opcional: _qa/SPEC-019/informe.html -->
| CA | Captura |
|---|---|
| CA-3, CA-4 (gl 360) | [xornada-gl-360.png](_qa/SPEC-019/xornada-gl-360.png) |
| CA-3, CA-4 (gl 390) | [xornada-gl-390.png](_qa/SPEC-019/xornada-gl-390.png) |
| CA-4, CA-6 (es 360) | [xornada-es-360.png](_qa/SPEC-019/xornada-es-360.png) |
| CA-4, CA-6 (es 390) | [xornada-es-390.png](_qa/SPEC-019/xornada-es-390.png) |

Guarda de producción: `VERCEL_ENV=production next build && next start` → `/demo/xornada` 404, `/es/demo/xornada` 404, `/` 200.

## Salvedades / follow-ups
<!-- IDs F-SPEC-019-1, F-SPEC-019-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-019-1 (desviación de diseño, para el titular): margen de la fila de 50 a 72 px y sin columna ★ (fuera de v1): los estados son palabras (ADR-005 exc. 1). Nombres y competición hacen salto de línea en vez de `ellipsis` (D-2). Equipo y marcador comparten línea de rejilla para no desalinearse al partir. Destino: spec de escritorio/filtros si se quiere afinar.
- F-SPEC-019-2 (decisión de implementación): `live` + `sen_sinal` se pinta como el diseño (`S`): borde, minuto y marcador en rojo, sin punto ember; cuenta en la píldora porque su estado es `live` (CA-2 literal). El diseño no lo contaba.
- F-SPEC-019-3: refine extra en `PublicMatch`: `version === 0` ⇔ `decidedAt === null`, y `sen_sinal` solo en `live`/`scheduled` (como `Decision`). SPEC-020 debe producir filas coherentes con ello.
- F-SPEC-019-4: título `h1` oculto «Xornada»/«Jornada» (es traduce, como `strings()` del diseño). Si «Xornada» debe ir sin traducir en `/es` (dominio.md), cambiar `es.xornada.title`.
- F-SPEC-019-5: la ruta demo es estática: la guarda se evalúa en build (Vercel expone `VERCEL_ENV` al build). Si algún día se construye una vez y se promociona a producción, haría falta hacerla dinámica.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-7 implementados en la rama `ft/SPEC-019-…` (sin push). Spec en `en-revision`. Falta: verificación (sdd-verificador) y gate humano de las desviaciones F-SPEC-019-1/2/4. Reproducir: `npm run gates && npm run e2e`.
