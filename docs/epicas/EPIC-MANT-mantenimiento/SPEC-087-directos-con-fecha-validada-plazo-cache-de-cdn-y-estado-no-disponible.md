---
id: SPEC-087
tipo: spec
epica: EPIC-MANT
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-16, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-16, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-16, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-16, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-16, por: sdd-verificador}
---
# SPEC-087 — Directos con fecha validada, plazo, caché de CDN y estado no disponible

## Problema
`/directos` y `/es/directos` (SPEC-055) leen explorer en cada visita: `src/app/(gl)/directos/page.tsx` y su gemelo en `(es)` llaman a `getDayMatches(date)` sin `timeoutMs`, son `force-dynamic` y `next.config.ts` no les da cabecera de CDN, así que cada visita es una petición a explorer. `?date=` se reenvía sin validar. El `catch` vacío deja la lista vacía sin log: una caída se pinta «Non hai partidos rexistrados para esta data», el mismo texto que un día sin partidos (contra D-9). Investigación `docs/investigaciones/2026-11-16-explorer-en-marcadorgal.md`, hallazgo 3 (commit `efc1ff4`).

## Usuarios / roles afectados
Público de `/directos` y `/es/directos`; explorer (carga por visita).

## Criterios de aceptación
Tests unitarios sin red: explorer inyectado y reloj fijo (`now` como parámetro, nunca `new Date()` dentro de la lógica).
- **CA-1 (fecha)**: Una función pura `(raw, now) → fecha | null` da: sin `date` → hoy en Europe/Madrid; `YYYY-MM-DD` de calendario real y a ±7 días de hoy (Madrid) → esa fecha; `null` para `2026-02-30`, `2026-1-5`, `20261116`, `2026-11-16T00:00`, valor repetido (`string[]`) y fechas a 8 o más días. Borde: con `now = 2026-11-15T23:30:00Z`, hoy es `2026-11-16`.
- **CA-2 (fecha inválida)**: Dado `?date=` que da `null`, cuando se pide la página, entonces responde con redirección temporal a la misma ruta sin query (`/directos` o `/es/directos`) y explorer no se llama.
- **CA-3 (plazo)**: La lectura del día pasa `{ timeoutMs: EXPLORER_ENRICHMENT_TIMEOUT_MS }` a `getDayMatches`. Dado un explorer que nunca responde, con temporizadores falsos, la carga termina como «no disponible» al vencer el plazo.
- **CA-4 (fallo visible)**: Dado un explorer que rechaza (plazo, HTTP 5xx, JSON inválido), entonces hay un `console.error` con la fecha y el mensaje, y `DirectosView` pinta un estado `data-testid="directos-unavailable"` con el texto i18n nuevo `directos.unavailable` (gl «Os directos non están dispoñibles agora mesmo.», es «Los directos no están disponibles en este momento.»), distinto de `competitions.noMatches`; el estado es texto, no solo color. Test en gl y es con `renderToStaticMarkup`; las dos claves existen en `gl.ts` y `es.ts`.
- **CA-5 (vacío real)**: Dado un 200 con `matches: []`, entonces se pinta `competitions.noMatches` como hoy y no hay `console.error`.
- **CA-6 (CDN)**: `next.config.ts` da a `/directos` y `/es/directos` las mismas dos cabeceras que a `/` (`Cache-Control: BOARD_CACHE_CONTROL` y `Vercel-CDN-Cache-Control: HOME_CDN_CACHE_CONTROL`, ADR-014 §6, SPEC-030), comprobado como en `src/arch/home-cache.test.ts`.
- **CA-7 (campo, clave con query)**: En el despliegue de la PR, dos `curl -sI` seguidos a `/directos?date=<hoy>` dan el segundo `x-vercel-cache: HIT` (o `STALE`); `/directos?date=<ayer>` da `MISS` en su primera petición y su cuerpo muestra la fecha de ayer. Comando y salida en el ledger.

## Entidades y reglas afectadas
D-9 (FOUNDATION). ADR-014 §6 (directivas de caché). SPEC-030 (`Vercel-CDN-Cache-Control` en páginas dinámicas), SPEC-085 (plazo `EXPLORER_ENRICHMENT_TIMEOUT_MS`), SPEC-055 (origen de `/directos`), D-8 (`docs/diseno/`, tokens; sin hex sueltos).

## Fuera de alcance
- Que `/directos` aplique Decision, ventana de directo o `missing_score` (hallazgo 10, por diseño): sigue pintando el export.
- Navegación entre días en la interfaz; caché de datos por instancia; reconciliar goleadores (hallazgo 9); variables de entorno (hallazgo 11); heurística de «galego» (hallazgo 13).
- Normalizar otras queries (`?x=1` también es otra clave de CDN): si se abusa, se resuelve en el firewall.
- La xornada femenina (SPEC-086).

## Notas para el gate humano
1. **Rango ±7 días** y **redirigir** en vez de 404 o «hoy en silencio»: la redirección no llama a explorer y no crea una entrada de caché con datos por cada `date` basura. Nada en la web enlaza hoy a `?date=`.
2. **Plazo de 2 s** (el de la portada). La página entera depende de explorer: si en frío se queda corta, el CDN (10 s + 30 s stale) sirve la respuesta anterior. Subirlo es una línea.
3. **El estado «no disponible» también se cachea** 10 s (+30 s stale): protege a explorer durante una caída; a cambio, la recuperación tarda hasta 10 s en verse.
