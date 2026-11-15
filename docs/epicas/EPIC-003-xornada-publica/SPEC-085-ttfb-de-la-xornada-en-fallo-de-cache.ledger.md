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
| CA-1 | `vercel.json` (`"regions": ["dub1"]`, sin `functions` ni `preferredRegion` en `src/` que lo pisen; el cron del tick vive en el mismo `vercel.json` y hereda la región) | `src/arch/deploy.test.ts` › «SPEC-085 CA-1 vercel.json pins the functions to dub1» (2 casos) + «SPEC-008 CA-5 declares nothing else» ajustado a `["crons","regions"]`. Rojo previo: 2 fallos; verde: 37/37. Campo pendiente: `X-Vercel-Id` de un `MISS` de `/` con `::dub1::` tras el deploy | Verificador 2026-11-12, worktree limpio en `aeac84a`: `vitest run src/arch/deploy.test.ts` 37/37; `vercel.json` = `crons` + `regions:["dub1"]`; sin `functions` ni `preferredRegion` en `src/`. Relajación de SPEC-008 CA-5 legítima: sigue siendo igualdad exacta de claves (`["crons","regions"]`), cualquier otra clave falla. Campo `::dub1::` pendiente (F-SPEC-085-1). **Campo 2026-11-15 (verificador):** `curl -sD - https://marcador.gal/` → `X-Vercel-Cache: MISS`, `Age: 0`, `X-Vercel-Id: cdg1::dub1::nwgzd-1794759749904-b75ee4b97014` (Date 16:22:30 GMT). F-SPEC-085-1 cerrado | ✅ |
| CA-2 | | | PR 2 (H-3), no evaluado | ❌ |
| CA-3 | | | PR 2 (H-3), no evaluado | ❌ |
| CA-4 | | | PR 2 (H-3), no evaluado | ❌ |
| CA-5 | | | PR 2 (H-3), no evaluado | ❌ |
| CA-6 | | | PR 2 (H-3), no evaluado | ❌ |
| CA-7 | PR 1 (solo CA-1): `package.json`/`package-lock.json` 0.10.3 → 0.10.4 (`npm version patch --no-git-tag-version`); `src/sources`, `src/decide`, `src/ingest` sin tocar | `npm run gates` por partes en el árbol principal (Windows, 2026-11-13): typecheck 0 errores; lint «Checked 487 files… No fixes applied»; test 173 ficheros, 2925 pass / 3 skip; build OK. e2e `xornada*.spec.ts` no corrido (sin cambio de código de render en este PR) | Verificador 2026-11-12: worktree limpio `aeac84a` → typecheck 0, lint «Checked 487 files… No fixes applied», vitest 173 ficheros 2925 pass / 3 skip; build OK en árbol principal en `aeac84a` (en worktree Turbopack rechaza la junction de node_modules; el `biome.json` ajeno no afecta al build). `node tools/version-gate.mjs --base origin/main` → «ok — 0.10.3 → 0.10.4, package-lock.json coherente» (origin/main en 0.10.3 tras `370e5c4`; el 0.10.4 de `1084315` fue revertido en main, sin colisión ni retroceso). `git show --stat`: nada en `src/sources`, `src/decide`, `src/ingest`. e2e pendiente con PR 2 | ⚠️ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN (PR 1, alcance H-3) — 2026-11-12, `aeac84a`.** CA-1 ⚠️ (test verde; campo `X-Vercel-Id` `::dub1::` pendiente, F-SPEC-085-1). CA-7 ⚠️ (gates verdes, patch 0.10.3→0.10.4 validado por version-gate, núcleo intacto; e2e en PR 2). CA-2..CA-6 fuera de este PR. La spec no pasa a `hecho`: sigue en `en-revision` hasta el PR 2.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-085/. Informe HTML opcional: _qa/SPEC-085/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-085-1, F-SPEC-085-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-085-1 (campo, CA-1): tras el deploy a producción, `curl -sI https://marcador.gal/` hasta un `X-Vercel-Cache: MISS` y anotar aquí su `X-Vercel-Id` con `::dub1::`. Destino: esta spec. **Cerrado.** Evidencia del titular, 2026-11-12, curl desde Galicia: `X-Vercel-Id` = `cdg1::dub1::…` en `MISS`; TTFB mediano `/` ≈ 0,74 s, `/es` ≈ 0,67 s, `/api/board` ≈ 1,7 s. Confirmado por el verificador el 2026-11-15: `MISS` de `/` con `X-Vercel-Id: cdg1::dub1::nwgzd-1794759749904-b75ee4b97014`.
- F-SPEC-085-2 (H-3): CA-2..CA-6 van en un segundo PR tras medir el efecto de la región; CA-7 se repite en ese PR (e2e `xornada*.spec.ts` incluido). Destino: esta spec.
- F-SPEC-085-4 (entrada para PR 2, de SPEC-026 CA-4, 2026-11-15): `npm run primera:pintura -- --n 20` en producción con dub1 y partidos `live` → **CUMPLE** (p75 FCP `/` 1816 ms, `/es` 1796 ms; TTFB CDP mediano bajo perfil 3G 778/796 ms; render 830/751 ms). Las **40 pasadas fueron `MISS`** (F-SPEC-026-9): la herramienta repide cada ruta cada ~42 s, más que la ventana `s-maxage=10, stale-while-revalidate=30` (40 s) de `HOME_CDN_CACHE_CONTROL`; con poco tráfico por PoP la entrada caduca y el lector real también cae en `MISS` (sondeo: `HIT` a 3–5 s, `STALE` a 25 s, `MISS` a 42 s). Para H-1: el `MISS` es el camino común con el tráfico de hoy, y con solo CA-1 el criterio 4 de EPIC-003 ya se cumple con 184/204 ms de margen; la mediana de 0,74/0,67 s de F-SPEC-085-1 ya está bajo los 800 ms de CA-6 para `/` y `/es` (no es la medición de CA-6: sin pausa ≥ 45 s ni 10 `MISS` por ruta); `/api/board` (≈ 1,7 s, fuera de CA-6) sigue lento. Ampliar la ventana de caché no es de esta spec (ADR-014 §6, D-9; decisión del titular).
- F-SPEC-085-3 (gates): corridos en el árbol principal de Windows con `core.autocrlf=false` y un `biome.json` modificado ajeno a este trabajo (solo añade `!media` a los ignorados; no entra en el commit). CI (Linux) es la referencia.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho (PR 1, rama `ft/SPEC-085-ttfb-de-la-xornada-en-fallo-de-cache`, sin push): CA-1 en `vercel.json` + test; versión 0.10.4.
- Falta: verificar PR 1, push/PR, deploy y F-SPEC-085-1 (cabecera dub1). Medir TTFB en `MISS` tras el deploy para decidir el alcance del PR 2 (H-1).
- PR 2: CA-2 (función compartida de lectura del tablero con dependencias inyectadas, femeninas en paralelo), CA-3 (`timeoutMs` en Explorer), CA-4 (caché del calendario femenino, TTL 1 h), CA-5 (una petición por día), CA-6 (campo), CA-7 (gates + e2e + patch).
