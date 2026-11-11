---
id: ADR-038
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-11-11, por: sdd-arquitecto}
---
# ADR-038: Speed Insights para medir la carga real sin cookie

- Deciders: sdd-arquitecto propone (2026-11-11) a petición del titular («¿podemos tener analíticas del tiempo de carga en Vercel Analytics?»); **aparcado por el titular el 2026-11-12** (no se contrata Plus de momento; se mide con curl y la herramienta de SPEC-026). Sigue en borrador; P-1..P-3 abiertas.
- Specs relacionadas: SPEC-026 (medición de laboratorio, perfil 3G), SPEC-077 (Web Analytics), SPEC-085 (TTFB en fallo de caché); ADR-033 (Web Analytics sin cookie, enmienda de FOUNDATION).

## Contexto
Web Analytics (ADR-033) cuenta visitas; **no mide tiempos**. Lo que mide la carga con usuarios reales es otro producto de Vercel, **Speed Insights** (`@vercel/speed-insights`): Core Web Vitals (FCP, LCP, INP, CLS, TTFB) de cada carga, por ruta, dispositivo, país y tipo de red. Hoy la única medida es de laboratorio (SPEC-026, herramienta propia, campo nunca corrido).
Docs de Vercel consultadas el 2026-11-11 (`/docs/speed-insights/limits-and-pricing`, `/privacy-policy`):
- **Gratis** en todos los planes, pero solo da la puntuación agregada (RES), desgloses sin entradas «Poor», 24 h y 7 días, y **10.000 eventos en 30 días compartidos por el equipo**; al pasarlos, la recogida se **pausa ≥ 14 días** (la web sigue).
- **Speed Insights Plus** (Pro): 10 $/proyecto/mes + 0,65 $ por 10.000 eventos, sin eventos incluidos; da las cinco métricas, entradas «Poor», países, selector del elemento culpable y 30 días.
- Privacidad: sin cookie, sin IP, sin poder reconstruir la sesión; v2 sirve script e ingesta desde una ruta aleatoria del propio dominio, como Web Analytics v2. Acepta `beforeSend` y `sampleRate`.
*Hipótesis:* una carga produce hasta 5 eventos (uno por métrica). Con el tráfico de ADR-033 §7 (~30.000 vistas/mes) son ≤ 150.000 eventos: el plan gratis se pausaría en la primera jornada; Plus costaría ≤ 10 + 9,75 ≈ 20 $/mes, ≈ 12,5 $ con `sampleRate` 0,25.

## Decisión (propuesta)
1. **Speed Insights v2** junto a Web Analytics, en el mismo punto de montaje (`SiteAnalytics`), **solo en Production** (ADR-033 §4).
2. **El mismo filtro en el navegador** que ADR-033 §3 (fuera `navigator.webdriver`, rutas no públicas y query salvo `utm_*`), compartido como función pura.
3. **Plus con `sampleRate` 0,25** (P-1): el gratis no da LCP/TTFB por ruta, que es lo que se quiere mirar, y se pausaría. Muestra suficiente: a ~7.500 cargas/mes el p75 por ruta y dispositivo es estable.
4. **No cuenta como analítica de terceros** por la misma razón que ADR-033 (mismo proveedor, mismo dominio, sin cookie). Las páginas de privacidad y cookies lo nombran.
5. SPEC-026 sigue siendo la referencia del criterio 4 (perfil fijo y reproducible); Speed Insights es la vigilancia continua con usuarios reales.

## Consecuencias
### Positivas
- p75 real por ruta y dispositivo, y el elemento culpable del LCP/CLS, sin herramienta propia.
- Cada spec de rendimiento (SPEC-085 y siguientes) se juzga también con datos de campo.
### Negativas / follow-ups
- Coste fijo de 10 $/mes más eventos; spend management del equipo como tope.
- Un script más en el cliente (pequeño, carga diferida) que SPEC-026 debe ver sin empeorar.
- Spec de implementación pendiente (montaje, filtro, textos legales gl/es, test de que Preview no envía).

## Alternativas consideradas
- **Plan gratis**: solo RES y se pausa con nuestro volumen. Rechazada salvo P-1 = gratis con `sampleRate` ≤ 0,05 (*hipótesis*: ~7.500 eventos/mes).
- **`useReportWebVitals` de Next a un endpoint propio**: sin coste de proveedor, pero ruta de ingesta, tabla en la única Supabase (producción) y agregación a mano. Reserva.
- **Solo SPEC-026**: laboratorio, una red y un dispositivo; no ve a los usuarios reales.
