---
id: SPEC-030
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-030 La portada sirve una instantánea ISR antigua

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-030-la-portada-sirve-una-instantanea-isr-antigua`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/app/(gl)/page.tsx`, `src/app/(es)/es/page.tsx` (`dynamic = "force-dynamic"`); cabecera sin cambios en `next.config.ts`. **Bloqueado en Vercel: ver F-SPEC-030-1** | `src/arch/home-cache.test.ts`; `e2e/home.spec.ts` «SPEC-030 CA-1 rendered per request: no ISR headers» | | 🚧 |
| CA-2 | idem | `e2e/home.spec.ts` «SPEC-030 CA-2 / and /es are not prerendered at build» | | 🚧 |
| CA-3 | | | | ❌ |
| CA-4 | | | | ❌ |
| CA-5 | | | | ❌ |
| CA-6 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-030/. Informe HTML opcional: _qa/SPEC-030/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-030-1, F-SPEC-030-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-030-1 (PARADA, al gate humano).** En el camino de despliegue, Next pisa la cabecera de la página dinámica. Evidencia, 2026-10-12:
  - `next build` (sin `DATABASE_URL_PUBLIC`): `ƒ /` y `ƒ /es`.
  - `next start`: `curl -sI /` y `curl -sI /es` → `Cache-Control: public, s-maxage=10, stale-while-revalidate=30`, sin `x-nextjs-prerender` ni `x-nextjs-cache`. Aquí el router de `next start` aplica `headers()` antes del render.
  - Modo mínimo de Next, que es como corre la función en Vercel: ahí `headers()` lo aplica la plataforma, no Next. Comando: `node _qa/SPEC-030/sonda-minimal-mode.cjs <repo>` → `/ 200 cache-control: private, no-cache, no-store, max-age=0, must-revalidate`, y lo mismo en `/es`.
  - Origen: `node_modules/next/dist/build/templates/app-page-runtime.js` (~l.1085), en `!isSSG`: si la respuesta no trae `Cache-Control`, fija `revalidate: 0`, que da `private, no-store`.
  - Documentación de Vercel (`/docs/caching/cache-control-headers`, «Functions have priority over config files»): el `Cache-Control` de la función gana al de `next.config.js`, y `private` impide la caché de la CDN.
  - Consecuencia en Vercel: BYPASS, un render por visita. Es fresco, pero la CDN no lo cachea.
  - Vías posibles, sin aplicar: (i) `CDN-Cache-Control` o `Vercel-CDN-Cache-Control` en `headers()`, que según la misma página tienen prioridad sobre el `Cache-Control` de la función; (ii) `proxy.ts`. Ninguna está confirmada sin un despliegue de preview. Decide el titular.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- 2026-10-10 (sdd-arquitecto): spec en `borrador`, sin implementar. Investigación en solo lectura en `_qa/SPEC-030/sondeo-2026-10-10.md` (scripts `sonda-get.mjs` y `sonda-playwright.mjs`, salidas crudas `2026-10-10-*.txt`). Pendiente: gate del titular (H-1, H-2).
- 2026-10-12 (sdd-implementador): spec en `en-progreso`, PARADA por F-SPEC-030-1. Hecho: CA-1 y CA-2 en local (páginas `force-dynamic`, tests en verde), y `npm run gates` → 0 (88 ficheros, 1504 tests). Falta: la resolución de F-SPEC-030-1, y CA-3, CA-4, CA-5 y CA-6, sin empezar porque se paró al confirmar la CDN, como pide la nota de la spec. Se sigue en la rama `ft/SPEC-030-…`.
