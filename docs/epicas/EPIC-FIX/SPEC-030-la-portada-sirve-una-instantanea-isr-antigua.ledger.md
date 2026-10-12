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
| CA-1 | `src/app/(gl)/page.tsx`, `src/app/(es)/es/page.tsx` (`dynamic = "force-dynamic"`); `next.config.ts` `headers()` de `/` y `/es`: `Cache-Control` igual + `Vercel-CDN-Cache-Control: s-maxage=10, stale-while-revalidate=30` (`HOME_CDN_CACHE_CONTROL`, `src/board/http.ts`; F-SPEC-030-1). **Pendiente MISS→HIT en la CDN del preview** | `src/arch/home-cache.test.ts` (force-dynamic, sin revalidate, ambas cabeceras); `e2e/home.spec.ts` «SPEC-030 CA-1 rendered per request: no ISR headers»; `_qa/SPEC-030/2026-10-12-minimal-mode.txt` | `next build` → `ƒ /`, `ƒ /es`. `next start` + `curl -sI` → `Cache-Control: public, s-maxage=10, stale-while-revalidate=30` y `Vercel-CDN-Cache-Control: s-maxage=10, stale-while-revalidate=30`, sin `x-nextjs-*` (`_qa/SPEC-030/2026-10-12-verif-next-start.txt`). Render por petición: `servedAt` 21:06:12Z y 21:06:15Z en dos GET. Modo mínimo: la función da `private, no-store` y `routes-manifest.json` lleva las dos cabeceras (`2026-10-12-verif-minimal-mode.txt`). Salvedad: MISS→HIT en la CDN de Vercel sin comprobar (F-SPEC-030-2) | ⚠️ |
| CA-2 | ídem | `e2e/home.spec.ts` «SPEC-030 CA-2 / and /es are not prerendered at build» | e2e «SPEC-030 CA-2» en verde; `prerender-manifest.json` `routes` = `/_global-error`, `/_not-found`, `/demo/xornada`, `/es/demo/xornada`; sin `.next/server/app/index.html` ni `es.html`; `npm run gates` compila sin `DATABASE_URL_PUBLIC` | ✅ |
| CA-3 | `src/live/transport.ts` (`STALE_SERVED_MS = 45_000`, petición al arrancar si `servedAt` es más antiguo y la pestaña está visible); `src/components/xornada/XornadaLive.tsx` le pasa `servedAt` | `src/live/transport.test.ts` «SPEC-030 CA-3 …»: 44 s y 45 s → 0 peticiones; 46 s y 5 h → 1, con `If-None-Match` y `no-store`; después, polling normal; `servedAt` futuro → 0; oculta → espera a que se vea. Demos: `e2e/xornada-live.spec.ts` «CA-10: the demos neither subscribe nor poll» (no montan `XornadaLive`) | Los tests unitarios aplican el umbral de 45 s. Navegador real (Chromium, `next start` con lector local, `verif-ca3-reloj.mjs`): pestaña con reloj al día → 0 peticiones a `/api/board`; con el reloj adelantado 60 s → 1 a los 133 ms, con `If-None-Match` (`2026-10-12-verif-ca3-reloj.txt`). Demos: e2e CA-10 en verde | ✅ |
| CA-4 | `tools/cache-portada.mjs` (`npm run cache:portada`, node:http(s), sin `Accept-Encoding`, JSONL en `_qa/SPEC-030/`); `src/medicion/cache-portada.ts` (puro) | `src/medicion/cache-portada.test.ts` sobre `src/medicion/fixtures/cache-portada-2026-10-10.jsonl` (sondeo: PRERENDER de 5 h → falla; MISS del minuto de `date` → bien). **Pendiente: corrida en producción tras el despliegue** | Los tests del parser pasan con el fixture del sondeo (5 respuestas: 3 fallan por PRERENDER). Corrida local `npm run cache:portada -- --url http://localhost:3300 --rondas 2 --espera 3` → `CUMPLE: 4/4`, exit 0 (`2026-10-12-verif-cache-portada-local.jsonl`). Salvedad: falta la corrida en producción tras el despliegue (F-SPEC-030-2) | ⚠️ |
| CA-5 | sin cambios en `/xornada/[fecha]`, `/api/board`, `expireTime` (40) ni ADR-014 §6 | `npm run e2e` → 139 passed; `npm run e2e:db` (Supabase local) → 47 passed, 1 skipped (capturas QA sin `QA_CAPTURE_DIR`); `src/live/transport.test.ts` SPEC-024 en verde; `src/arch/home-cache.test.ts` «CA-5: expireTime is unchanged»; `src/arch/week-cache.test.ts` | `npm run e2e` → 139 passed; `npm run e2e:db` → 47 passed, 1 skipped. `git diff 0003fad` no toca `/xornada/[fecha]`, `src/app/api`, `docs/adr`; `expireTime: 40` | ✅ |
| CA-6 | — | `npm run gates` → 0 (lint 266 ficheros; 89 ficheros de test, 1532 tests; build `ƒ /`, `ƒ /es`). `git diff 0003fad --stat -- src/sources src/decide src/ingest supabase package-lock.json` vacío; `package.json`: solo el script `cache:portada` | `npm run gates` → exit 0 (89 ficheros de test; la build lista `/` y `/es` como `ƒ`). `git diff 0003fad..HEAD --stat -- src/sources src/decide src/ingest supabase package-lock.json` sale vacío; `package.json` solo añade el script `cache:portada` | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN con salvedades, 2026-10-12 (sdd-verificador).** CA-2, CA-3, CA-5 y CA-6 ✅. CA-1 y CA-4 ⚠️: lo que se puede ver en local está bien, pero falta la comprobación en Vercel, que el titular dejó para el preview del PR (resolución tras F-SPEC-030-1) y que CA-4 pide tras el despliegue. **Condición de merge:** en el preview, `curl -sI` dos veces a `/` y `/es` debe dar `x-vercel-cache` MISS y luego HIT/STALE. Si sale BYPASS, se para y vuelve al gate (nota de la spec), y la spec vuelve a `en-progreso`. Tras el despliegue: `npm run cache:portada` contra producción, con su JSONL aquí y el resultado en este ledger.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-030/. Informe HTML opcional: _qa/SPEC-030/informe.html -->
No cambia la UI, así que no hay capturas. Las pruebas son de red.
| CA | Evidencia |
|---|---|
| CA-1 | `_qa/SPEC-030/2026-10-12-verif-next-start.txt`, `2026-10-12-verif-minimal-mode.txt` |
| CA-3 | `_qa/SPEC-030/2026-10-12-verif-ca3-reloj.txt` (script `verif-ca3-reloj.mjs`) |
| CA-4 | `_qa/SPEC-030/2026-10-12-verif-cache-portada-local.jsonl` (local; la de producción, pendiente) |

## Salvedades / follow-ups
<!-- IDs F-SPEC-030-1, F-SPEC-030-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-030-1 (resuelto por el titular, 2026-10-12: vía (i), `Vercel-CDN-Cache-Control` en `headers()`; spec, commit 7fbb3d7).** En el camino de despliegue, Next pisa la cabecera de la página dinámica. Evidencia, 2026-10-12:
  - `next build` (sin `DATABASE_URL_PUBLIC`): `ƒ /` y `ƒ /es`.
  - `next start`: `curl -sI /` y `curl -sI /es` → `Cache-Control: public, s-maxage=10, stale-while-revalidate=30`, sin `x-nextjs-prerender` ni `x-nextjs-cache`. Aquí el router de `next start` aplica `headers()` antes del render.
  - Modo mínimo de Next, que es como corre la función en Vercel: ahí `headers()` lo aplica la plataforma, no Next. Comando: `node _qa/SPEC-030/sonda-minimal-mode.cjs <repo>` → `/ 200 cache-control: private, no-cache, no-store, max-age=0, must-revalidate`, y lo mismo en `/es`.
  - Origen: `node_modules/next/dist/build/templates/app-page-runtime.js` (~l.1085), en `!isSSG`: si la respuesta no trae `Cache-Control`, fija `revalidate: 0`, que da `private, no-store`.
  - Documentación de Vercel (`/docs/caching/cache-control-headers`, «Functions have priority over config files»): el `Cache-Control` de la función gana al de `next.config.js`, y `private` impide la caché de la CDN.
  - Consecuencia en Vercel: BYPASS, un render por visita. Es fresco, pero la CDN no lo cachea.
  - Vías posibles, sin aplicar: (i) `CDN-Cache-Control` o `Vercel-CDN-Cache-Control` en `headers()`, que según la misma página tienen prioridad sobre el `Cache-Control` de la función; (ii) `proxy.ts`. Ninguna está confirmada sin un despliegue de preview. Decide el titular.
  - Aplicada la vía (i). Comando: `node docs/epicas/EPIC-FIX/_qa/SPEC-030/sonda-minimal-mode.cjs <repo>` → `_qa/SPEC-030/2026-10-12-minimal-mode.txt`. La función sigue dando `private, no-cache, no-store…`, y `.next/routes-manifest.json`, que es lo que aplica la plataforma, añade `Vercel-CDN-Cache-Control: s-maxage=10, stale-while-revalidate=30` en `/` y `/es`. Con `next start` la cabecera sale tal cual (e2e).
- **F-SPEC-030-2 (evidencia pendiente, para el verificador o el preview del PR).** Que la CDN de Vercel cachea `/` y `/es`, es decir, `x-vercel-cache` MISS y luego HIT/STALE en dos GET seguidos del preview, no está comprobado: no hay despliegue sin push. Tampoco se ha corrido CA-4 en producción (`npm run cache:portada`), que debe ir tras el despliegue con su JSONL en `_qa/SPEC-030/`.

- **F-SPEC-030-2: cerrada (2026-10-12, orquestador, evidencia de campo).** Preview del PR #64, con fetch same-origin desde un navegador autenticado: `/` y `/es` dan MISS con age=0 y luego HIT con age=2. Tras 65 s de inactividad, MISS con age=0 y `servedAt` de hace 2 s (comentario en el PR #64). En producción, después del merge: `node tools/cache-portada.mjs --url https://marcador.gal` → `CUMPLE: 10/10`; las 5 rondas × 2 rutas dan MISS con age=0 y frescura del minuto de `date`, ningún PRERENDER (`_qa/SPEC-030/2026-10-12-cache-portada-produccion.jsonl`).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- 2026-10-10 (sdd-arquitecto): spec en `borrador`, sin implementar. Investigación en solo lectura en `_qa/SPEC-030/sondeo-2026-10-10.md` (scripts `sonda-get.mjs` y `sonda-playwright.mjs`, salidas crudas `2026-10-10-*.txt`). Pendiente: gate del titular (H-1, H-2).
- 2026-10-12 (sdd-implementador): spec en `en-progreso`, PARADA por F-SPEC-030-1. Hecho: CA-1 y CA-2 en local (páginas `force-dynamic`, tests en verde), y `npm run gates` → 0 (88 ficheros, 1504 tests). Falta: la resolución de F-SPEC-030-1, y CA-3, CA-4, CA-5 y CA-6, sin empezar porque se paró al confirmar la CDN, como pide la nota de la spec. Se sigue en la rama `ft/SPEC-030-…`.
- 2026-10-12 (sdd-implementador): F-SPEC-030-1 resuelto por el titular. CA-1…CA-6 implementados con sus tests; spec a `en-revision`. Para el verificador: en el preview del PR, `curl -sI` dos veces seguidas a `/` y `/es` (MISS y luego HIT/STALE), y tras el despliegue `npm run cache:portada` contra producción (F-SPEC-030-2). Rama `ft/SPEC-030-la-portada-sirve-una-instantanea-isr-antigua`, sin push.
- 2026-10-12 (sdd-verificador): GREEN con salvedades y spec a `hecho`. Antes del merge: MISS y luego HIT en el preview (F-SPEC-030-2). Si sale BYPASS, la spec vuelve a `en-progreso` y al gate. Después del despliegue: `npm run cache:portada` en producción.
