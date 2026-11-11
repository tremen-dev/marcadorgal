---
id: SPEC-085
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-085 TTFB de la xornada en fallo de cache

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-085-ttfb-de-la-xornada-en-fallo-de-cache`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `vercel.json` (`"regions": ["dub1"]`, sin `functions` ni `preferredRegion` en `src/` que lo pisen; el cron del tick vive en el mismo `vercel.json` y hereda la región) | `src/arch/deploy.test.ts` › «SPEC-085 CA-1 vercel.json pins the functions to dub1» (2 casos) + «SPEC-008 CA-5 declares nothing else» ajustado a `["crons","regions"]`. Rojo previo: 2 fallos; verde: 37/37. Campo pendiente: `X-Vercel-Id` de un `MISS` de `/` con `::dub1::` tras el deploy | | ❌ |
| CA-2 | | | | ❌ |
| CA-3 | | | | ❌ |
| CA-4 | | | | ❌ |
| CA-5 | | | | ❌ |
| CA-6 | | | | ❌ |
| CA-7 | PR 1 (solo CA-1): `package.json`/`package-lock.json` 0.10.3 → 0.10.4 (`npm version patch --no-git-tag-version`); `src/sources`, `src/decide`, `src/ingest` sin tocar | `npm run gates` por partes en el árbol principal (Windows, 2026-11-13): typecheck 0 errores; lint «Checked 487 files… No fixes applied»; test 173 ficheros, 2925 pass / 3 skip; build OK. e2e `xornada*.spec.ts` no corrido (sin cambio de código de render en este PR) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-085/. Informe HTML opcional: _qa/SPEC-085/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-085-1, F-SPEC-085-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-085-1 (campo, CA-1): tras el deploy a producción, `curl -sI https://marcador.gal/` hasta un `X-Vercel-Cache: MISS` y anotar aquí su `X-Vercel-Id` con `::dub1::`. Destino: esta spec.
- F-SPEC-085-2 (H-3): CA-2..CA-6 van en un segundo PR tras medir el efecto de la región; CA-7 se repite en ese PR (e2e `xornada*.spec.ts` incluido). Destino: esta spec.
- F-SPEC-085-3 (gates): corridos en el árbol principal de Windows con `core.autocrlf=false` y un `biome.json` modificado ajeno a este trabajo (solo añade `!media` a los ignorados; no entra en el commit). CI (Linux) es la referencia.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho (PR 1, rama `ft/SPEC-085-ttfb-de-la-xornada-en-fallo-de-cache`, sin push): CA-1 en `vercel.json` + test; versión 0.10.4.
- Falta: verificar PR 1, push/PR, deploy y F-SPEC-085-1 (cabecera dub1). Medir TTFB en `MISS` tras el deploy para decidir el alcance del PR 2 (H-1).
- PR 2: CA-2 (función compartida de lectura del tablero con dependencias inyectadas, femeninas en paralelo), CA-3 (`timeoutMs` en Explorer), CA-4 (caché del calendario femenino, TTL 1 h), CA-5 (una petición por día), CA-6 (campo), CA-7 (gates + e2e + patch).
