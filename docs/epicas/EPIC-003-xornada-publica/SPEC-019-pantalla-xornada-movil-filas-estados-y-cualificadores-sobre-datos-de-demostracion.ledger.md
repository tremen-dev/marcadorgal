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
| CA-1 | `src/model/public.ts` (export en `src/model/index.ts`) | `src/model/public.test.ts` «SPEC-019 CA-1 PublicMatch» | `public.test.ts` 13 casos en verde (5 estados, claves extra sourceId/rule/observationIds/scoredBy rechazadas, live sin marcador y scheduled con marcador rechazados); refines extra coherentes con «0 sin Decision» y ADR-013 §2 | ✅ |
| CA-2 | `src/xornada/view.ts`; `src/arch/xornada-boundary.ts` | `src/xornada/view.test.ts` (estado × cualificador, orden H-1/H-2, 45+3 vs 46, `minute: null`, empate); `src/arch/xornada-boundary.test.ts` | `view.test.ts` y `xornada-boundary.test.ts` en verde; orden tier 1..5 y H-2 visto en pantalla | ✅ |
| CA-3 | `src/components/xornada/{XornadaScreen,CompetitionSection,MatchRow}.tsx`, `Xornada.module.css` | `e2e/xornada.spec.ts` «CA-3 …» (etiqueta/minuto, cualificador, literales, «–», `tabular-nums`, píldora) | e2e verde; Playwright propio: colores calculados ember/ámbar/rojo según ADR-005 en las 20 filas, cada color con etiqueta; márgenes y píldora `tabular-nums`; sin hex ni `font:` en `src/` (grep vacío) | ✅ |
| CA-4 | `Xornada.module.css` (nombres con `overflow-wrap`, sin `ellipsis`); `src/xornada/demo.ts` | `e2e/xornada.spec.ts` «CA-4 nothing is truncated at 360px/390px» (gl y es) | Playwright propio gl/es a 360 y 390: sin scroll horizontal, 0 elementos con `ellipsis`, 0 desbordes en nombres ni en el margen | ✅ |
| CA-5 | `src/xornada/demo.ts` (`DEMO_MATCHES`, `isDemoAvailable`); `src/app/demo-xornada.tsx`; `src/app/(gl)/demo/xornada/page.tsx`; `src/app/(es)/es/demo/xornada/page.tsx` | `src/xornada/demo.test.ts`; `e2e/xornada.spec.ts` «CA-5 noindex and the same rows without JavaScript» | Build `VERCEL_ENV=production` + start: `/demo/xornada` 404, `/es/demo/xornada` 404, `/` 200. Build sin VERCEL_ENV + start con `VERCEL_ENV=production`: 200 (guarda solo en build, F-SPEC-019-5). `robots` `noindex, nofollow`; sin JS mismas filas (e2e) | ⚠️ |
| CA-6 | `src/i18n/gl.ts`, `src/i18n/es.ts` (`xornada.*`, `locales.*`); selector en `XornadaScreen.tsx`; `formatTime` en `MatchRow.tsx` | `src/i18n/i18n.test.ts` «SPEC-019 CA-6»; `e2e/xornada.spec.ts` «CA-6 …» (selector, castellano, nombres idénticos, 21:00 Madrid) | e2e verde; selector gl·es enlaza a la ruta par; es: «Finalizado», «Aplazado», «sin señal», nombres idénticos; 21:00 Madrid. Salvedad: h1/`<title>` «Jornada» en es (F-SPEC-019-4) y logo «marcador▮gal» literal en `XornadaScreen.tsx` | ⚠️ |
| CA-7 | — | `npm run gates` exit 0 (57 ficheros, 971 tests); `npm run e2e` 37 passed; `git diff main --stat -- src/sources src/decide src/ingest supabase` vacío; `no-hex.test.ts` y `fonts.test.ts` en verde | `npm run gates` exit 0 (57 ficheros, 971 tests); `npm run e2e` 37 passed; `git diff origin/main --stat -- src/sources src/decide src/ingest supabase package.json package-lock.json` vacío | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN** — 2026-10-06, sdd-verificador. CA-1..4 y CA-7 ✅; CA-5 y CA-6 ⚠️ justificadas:
- CA-5: la guarda se evalúa al compilar (ruta `○` estática). Cumple en Vercel, donde build y runtime ven el mismo `VERCEL_ENV` (ADR-014); no cumpliría si un build no productivo se sirviera con `VERCEL_ENV=production` (comprobado: 200).
- CA-6: `es.xornada.title` = «Jornada» (h1 oculto y `<title>`). Lo ampara `strings()` del diseño (D-8) y el precedente de traducir estados en es; choca con la cabecera de `dominio.md` («no se traducen… en UI»). Decide el titular. El logo «marcador▮gal» es literal de marca fuera de i18n (igual en ambas lenguas).
- Desviaciones de diseño F-SPEC-019-1/2: amparadas (margen 72 px por ADR-005 exc. 1; ★ fuera de v1 por la spec; salto de línea por D-2; cualificador como texto por ADR-005 exc. 2; píldora cuenta `status = live`, letra de CA-2).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-019/. Informe HTML opcional: _qa/SPEC-019/informe.html -->
| CA | Captura |
|---|---|
| CA-3, CA-4 (gl 360) | [xornada-gl-360.png](_qa/SPEC-019/xornada-gl-360.png) |
| CA-3, CA-4 (gl 390) | [xornada-gl-390.png](_qa/SPEC-019/xornada-gl-390.png) |
| CA-4, CA-6 (es 360) | [xornada-es-360.png](_qa/SPEC-019/xornada-es-360.png) |
| CA-4, CA-6 (es 390) | [xornada-es-390.png](_qa/SPEC-019/xornada-es-390.png) |
| Verif. CA-3, CA-4 gl 360/390 | [verif-gl-360.png](_qa/SPEC-019/verif-gl-360.png) · [verif-gl-390.png](_qa/SPEC-019/verif-gl-390.png) (+ `-viewport`) |
| Verif. CA-4, CA-6 es 360/390 | [verif-es-360.png](_qa/SPEC-019/verif-es-360.png) · [verif-es-390.png](_qa/SPEC-019/verif-es-390.png) (+ `-viewport`) |

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
