# SPEC-026 — Primera pintura en móvil con 3G · 2026-11-15T18:56:43.035Z

- Destino: https://marcador.gal · rutas /, /es alternas · n objetivo 20 por ruta · pausa 15 s · 2026-11-15T18:56:43.035Z → 2026-11-15T19:10:42.659Z
- Perfil (CA-1) «3G (WebPageTest)»: red 1600 kbit/s de bajada, 768 kbit/s de subida, RTT 300 ms (CDP Network.emulateNetworkConditions) · CPU ×4 (Emulation.setCPUThrottlingRate) · 390 × 844, DPR 3, isMobile · contexto nuevo por pasada (caché y almacenamiento vacíos) · Chromium 153.0.8010.12
- Umbral (CA-3): p75 del FCP < 2000 ms en cada ruta y el dato en el HTML en todas las pasadas (percentil por rango más cercano).

**Veredicto: CUMPLE**

Tiempos en ms (mediana salvo FCP), bytes en kB (mediana; JS/CSS pedidos antes de DOMContentLoaded).

| Ruta | n | FCP mediana | FCP p75 | FCP máx. | fallos | x-vercel-cache | TTFB | transferencia | render | LCP | doc kB | JS kB | CSS kB | cumple |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | 20 | 1604 | 1732 | 3204 | 0 | MISS 20 | 614 | 81 | 881 | 1604 | 17.0 | 154.7 | 10.2 | sí |
| /es | 20 | 1444 | 1640 | 3056 | 0 | MISS 20 | 556 | 90 | 782 | 1444 | 17.2 | 154.7 | 10.2 | sí |

JSON crudo de cada pasada: `primera-pintura-2026-11-15T18-56.json`
