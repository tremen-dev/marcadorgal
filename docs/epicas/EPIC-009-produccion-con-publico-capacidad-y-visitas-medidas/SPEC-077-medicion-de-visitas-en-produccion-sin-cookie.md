---
id: SPEC-077
tipo: spec
epica: EPIC-009
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-10, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-10, por: sdd-implementador}
---
# SPEC-077 — Medición de visitas en producción sin cookie

## Problema
Criterio 1 de EPIC-009: hoy no sabemos cuánta gente mira marcador.gal, y esa cifra desbloquea EPIC-008. ADR-033 elige Vercel Web Analytics (sin cookie, desde el propio dominio). Esta spec lo monta en producción, deja fuera nuestras propias sondas, actualiza los textos legales y demuestra con una consulta real que salen las cuatro dimensiones. El informe por jornada y el pico de simultáneos son la spec siguiente.

## Usuarios / roles afectados
- Público: ninguna cookie ni banner; la política de privacidad dice qué se mide.
- Titular: activa Web Analytics en el proyecto de Vercel y consulta las cifras.

## Criterios de aceptación
- **CA-1 Montaje.** `@vercel/analytics` v2 (versión exacta, única dependencia nueva) monta `<Analytics />` en `src/app/(gl)/layout.tsx` y `src/app/(es)/es/layout.tsx` a través de un único componente propio. Test de tabla: con `VERCEL_ENV=production` se renderiza; con `preview`, `development` o sin variable, no.
- **CA-2 Filtro antes de enviar.** `src/analytics/before-send.ts`, puro (recibe el evento y `{ webdriver }`), es el `beforeSend`. Test de tabla: `webdriver: true` → `null`; ruta bajo `/api`, `/demo` o `/es/demo` → `null`; `/xornada/2026-11-15?x=1&utm_source=x#a` → `/xornada/2026-11-15?utm_source=x` (fuera toda query salvo `utm_*`, fuera el hash); `/` y `/es` intactas.
- **CA-3 Sin cookie ni terceros.** e2e Playwright sobre `next build` con el componente forzado en modo producción y `navigator.webdriver` sobreescrito a `false`: al cargar `/`, `/es` y `/xornada/<fecha>`, `context.cookies()` está vacío, toda petición va al mismo origen que la página, y hay exactamente una petición al endpoint de vista por carga. Las claves que el script deje en `localStorage`/`sessionStorage` se listan en el ledger (esperado: ninguna).
- **CA-4 Las sondas no cuentan.** Con `navigator.webdriver` sin tocar (como corren `tools/sonda-pantalla.mjs` y `tools/primera-pintura.mjs`), la misma e2e registra **cero** peticiones al endpoint de vista en las tres rutas.
- **CA-5 Primera pintura.** El script se carga diferido (ningún `<script>` bloqueante nuevo en el HTML de `/`, comprobado en la e2e). Ledger: First Load JS de `/` antes y después (`next build`), con aumento ≤ 3 kB gzip. Tras desplegar, `npm run primera:pintura -- --n 20` (SPEC-026, mismo perfil) sigue `cumple` en `/` y `/es`; se copian p75 de ambas rutas junto a la última medida de SPEC-026.
- **CA-6 Textos legales.** `src/lib/legal/content.ts` gana en `privacidade` una sección «Medición de audiencia» (gl y es): qué se cuenta (páginas vistas agregadas por ruta, dispositivo, país y origen), quién (Vercel, encargado y alojamiento), sin cookie, sin IP guardada, identificador por petición descartado en 24 h, y que los navegadores automatizados no cuentan. `cookies` deja de decir «sen analítica de terceiros» si G-1 lo exige. Test: la sección existe en ambos idiomas con el mismo número de párrafos; `lastUpdated` cambia.
- **CA-7 Campo.** El titular activa Web Analytics en el proyecto (H-1). Tras el despliegue y al menos un día con partidos, el ledger guarda la respuesta cruda de `GET /v1/query/web-analytics/visits/aggregate` (`environment` producción, `by=day`) agrupada por `route`, `deviceType`, `country` y `referrerHostname`, una consulta cada una: las cuatro devuelven filas con `pageviews` y `visitors`, y `route` incluye `/`, `/es` y `/xornada/[fecha]` (o los nombres reales de ruta, anotados). Una carga a mano con Playwright esa misma tarde no aparece (cruce por hora y ruta, anotado).
- **CA-8 Gates.** `npm run gates` y `e2e` en verde; versión `minor` (ADR-028). `git diff main --stat -- src/sources src/decide src/ingest` vacío. Ningún test pide a la red ni a Vercel.

## Entidades y reglas afectadas
ADR-033. FOUNDATION (no-negociable «sin cookies, sin analítica de terceros», reinterpretado en G-1), D-2 (textos vía i18n/legal), D-8. SPEC-024 (polling, First Load JS), SPEC-025 y SPEC-026 (sondas), SPEC-030 (caché de `/` y `/es`, que no cambia).

## Fuera de alcance
Informe por jornada exportable y pico de simultáneos (criterios 2 y 4: spec siguiente, que fija la fuente del pico según G-2). Prueba de carga a 1.000 (criterio 3: spec posterior). Eventos personalizados, embudos, Speed Insights, Drains. Informe maquetado para patrocinadores (EPIC-008).

## Notas para el gate humano
- **G-1 «Sin analítica de terceros».** Vercel es un tercero en sentido estricto, aunque ya aloja la web y el script va por el propio dominio. *Recomendación:* aceptarlo por escrito como reinterpretación (un tercero que ya es encargado, sin cookie, sin dominio ajeno) y enmendar la línea de FOUNDATION en el mismo PR que apruebe ADR-033.
- **G-2 Fuente del pico (criterio 4).** Web Analytics no da simultáneos. *Recomendación:* Observability Plus en Vercel (precio por confirmar en el panel: *hipótesis* ~10 $/mes más uso) para leer `vercel.request.count` de `/api/board` por minuto (÷ 2 = pestañas visibles con polling). Alternativas: Log Drain propio (sin Plus, pero una tubería de ingesta) o conexiones pico de Supabase si Realtime se enciende. Se decide antes de la spec del informe.
- **G-3 WhatsApp como origen.** Llega sin referrer y cuenta como directo. *Recomendación:* no pagar Web Analytics Plus todavía; aceptar «directo» y reabrir si el patrocinador lo pide. Alternativa: Plus (10 $/mes) y `utm_source` en los enlaces que se compartan.
- **G-4 Texto legal.** El titular aprueba la redacción de CA-6 antes del merge (es su política de privacidad).
- **H-1 Activación.** Activar Web Analytics en el proyecto (Settings → Analytics) es manual y del titular; sin ello CA-7 no arranca. El token de la API de CA-7 vive en local, no en el repo.
- **N-1** Visitantes únicos son por día (hash de 24 h, ADR-033 §2). Una jornada de viernes a lunes no suma «personas»: la spec del informe lo dirá así.
- **Resolución del titular (2026-11-10, Alberto Fojo):** se aceptan las recomendaciones. G-1: Vercel no cuenta como «analítica de terceros» (alojamiento y encargado del tratamiento, sin cookie, sin dominio ajeno); FOUNDATION enmendado con cita a ADR-033, así que en CA-6 `cookies` se ajusta para no contradecirlo. G-2: abierta; se decide antes de la spec del informe y el pico y no bloquea esta spec. G-3: WhatsApp cuenta como «directo» por ahora. G-4: el titular aprueba el texto legal de CA-6 antes del merge. H-1: activar Web Analytics en Vercel es tarea manual del titular. Spec aprobada.
