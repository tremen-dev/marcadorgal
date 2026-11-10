---
id: ADR-033
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-033: Medición de visitas con Vercel Web Analytics sin cookie

- Deciders: sdd-arquitecto propone (2026-11-10) sobre la preferencia del titular («Vercel Web Analytics creo que es suficiente», 2026-11-10); Alberto Fojo (titular) aprueba el 2026-11-10.
- Resolución del titular (2026-11-10, Alberto Fojo): G-1 aceptado, Vercel no cuenta como «analítica de terceros» (ya es el alojamiento y el encargado del tratamiento, sin cookie y sin dominio ajeno); FOUNDATION enmendado con la misma fecha. G-2 sigue abierta y se decide antes de la spec del informe y el pico (§6 queda como propuesta). G-3: WhatsApp cuenta como «directo» por ahora, sin Web Analytics Plus. G-4 y H-1, como en SPEC-077.
- Specs relacionadas: SPEC-077 (medición, criterio 1 de EPIC-009); spec del informe por jornada y pico (criterios 2 y 4, sin escribir); SPEC-025 y SPEC-026 (sondas propias que no deben contar).

## Contexto
EPIC-009 pide visitantes únicos y páginas vistas por jornada, por ruta, dispositivo, país y origen, sin cookie, sin banner y sin peticiones a dominios de terceros (regla compartida con EPIC-008). FOUNDATION dice «sin cookies, sin analítica de terceros, sin datos de quien mira». La web corre en Vercel Pro y hoy no mide nada. Datos de la documentación de Vercel consultada el 2026-11-10 (`/docs/analytics/privacy-policy`, `/limits-and-pricing`, `/package`, `/web-analytics-api`, `/drains/reference/analytics`, `/cli/metrics`, `/query`).

## Decisión
1. **Vercel Web Analytics** (`@vercel/analytics` v2, componente `<Analytics />`) mide las páginas vistas. Script y envío salen de una ruta del propio dominio (`/<ruta-aleatoria>/script.js`, `/view`): **ninguna petición a otro dominio**. Vercel ya es el alojamiento y encargado del tratamiento; no entra un proveedor nuevo.
2. **Sin cookie ni identificador persistente.** Vercel identifica al visitante con un hash de la petición que descarta a las 24 h y no guarda la IP. Visitantes únicos son, por tanto, **únicos por día**: no se suman entre días como si fueran personas distintas.
3. **Lo que se envía se filtra en el navegador** con `beforeSend` (función pura del repo): fuera los navegadores automatizados (`navigator.webdriver`, que cubre las sondas Playwright de SPEC-025 y SPEC-026), las rutas que no son públicas y toda la query salvo `utm_*`. Además Vercel descarta bots por `User-Agent` (*hipótesis no verificada* en volumen: se contrasta en la primera jornada).
4. **Solo en Production.** Preview y local no envían.
5. **Las cifras se leen por la API de Web Analytics** (`/v1/query/web-analytics/visits/aggregate`, dimensiones `route`, `deviceType`, `country`, `referrerHostname`, `by=day`) o por `vercel metrics`, sin Observability Plus. Ventana garantizada en Pro: **12 meses**. El informe guarda la respuesta cruda antes de agregarla (crudo antes que parseo). Eso cubre el criterio 2 sin Drains.
6. **El pico de simultáneos no sale de Web Analytics**, que cuenta cargas, no presencia (una pestaña abierta 2 h es una vista). La fuente propuesta: con polling, cada pestaña visible pide `/api/board` cada 30 s (SPEC-024; se pausa oculta), así que **simultáneos ≈ peticiones a `/api/board` por minuto ÷ 2**. Leerlo exige `vercel.request.count` con Observability Plus (G-2). Con Realtime encendido, la cifra sería las conexiones pico del panel de Supabase. Se fija en la spec del informe.
7. **Coste.** Pro no incluye eventos: 0,03 $ por 1.000 páginas vistas, contra el crédito mensual de Pro. A 1.000 visitantes × 3 vistas × 10 jornadas/mes ≈ 30.000 eventos ≈ 0,90 $/mes.

## Consecuencias
### Positivas
- Una dependencia, cero cuentas y cero dominios nuevos; los datos quedan en el proveedor que ya ve todas las peticiones.
- Desglose por ruta, dispositivo, país y referrer listo; export reproducible por API durante 12 meses.
### Negativas / follow-ups
- **FOUNDATION se reinterpreta:** Vercel es un tercero en sentido estricto. El titular lo confirma por escrito en el gate (G-1); los textos de privacidad y cookies lo cuentan.
- WhatsApp suele llegar sin referrer y cuenta como directo. Separarlo exige `utm_source` en los enlaces compartidos y Web Analytics Plus (10 $/mes), sin el cual las UTM no son dimensión (G-3).
- Un bloqueador de anuncios puede filtrar el script: la cifra es un suelo, no un censo. La ruta aleatoria de v2 lo mitiga.
- El pico depende de G-2; sin él, el criterio 4 se queda sin fuente.

## Alternativas consideradas
- **Cloudflare Web Analytics**: sin cookie y gratis, pero el script y el envío van a `cloudflareinsights.com` salvo que el dominio pase por Cloudflare, que EPIC-009 deja fuera. Incumple la regla de terceros.
- **Recuento propio en el servidor**: `/` y `/es` salen de la CDN (`s-maxage=10`, SPEC-030) y no invocan función; contar exige un beacon propio a una ruta no cacheada, una tabla en la única Supabase (producción), detección de bots y un hash diario hecho a mano. Más código y más riesgo RGPD para el mismo dato. Queda como reserva si Vercel no cumple.
- **Web Analytics Drain a un endpoint propio**: trae `deviceId` y cada evento, pero cuesta 0,50 $/GB, una ruta de ingesta y una tabla. La API ya da los agregados; no hace falta.
- **Log Drain de la CDN para contar `/api/board`**: daría el pico sin Observability Plus, pero es una tubería de ingesta entera para un número. Reserva de G-2.
