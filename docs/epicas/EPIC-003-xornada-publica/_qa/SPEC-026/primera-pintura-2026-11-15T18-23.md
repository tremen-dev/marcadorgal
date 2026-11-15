# SPEC-026 — Primera pintura en móvil con 3G · 2026-11-15T18:23:44.105Z

- Destino: https://marcador.gal · rutas /, /es alternas · n objetivo 20 por ruta · pausa 15 s · 2026-11-15T18:23:44.105Z → 2026-11-15T18:38:18.967Z
- Perfil (CA-1) «3G (WebPageTest)»: red 1600 kbit/s de bajada, 768 kbit/s de subida, RTT 300 ms (CDP Network.emulateNetworkConditions) · CPU ×4 (Emulation.setCPUThrottlingRate) · 390 × 844, DPR 3, isMobile · contexto nuevo por pasada (caché y almacenamiento vacíos) · Chromium 153.0.8010.12
- Umbral (CA-3): p75 del FCP < 2000 ms en cada ruta y el dato en el HTML en todas las pasadas (percentil por rango más cercano).

**Veredicto: NO CUMPLE** — /: p75 2052 ms ≥ 2000 ms; /es: p75 2380 ms ≥ 2000 ms

Tiempos en ms (mediana salvo FCP), bytes en kB (mediana; JS/CSS pedidos antes de DOMContentLoaded).

| Ruta | n | FCP mediana | FCP p75 | FCP máx. | fallos | x-vercel-cache | TTFB | transferencia | render | LCP | doc kB | JS kB | CSS kB | cumple |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | 20 | 1908 | 2052 | 2924 | 0 | MISS 20 | 598 | 83 | 1131 | 1908 | 17.1 | 154.7 | 10.2 | no |
| /es | 20 | 2076 | 2380 | 2792 | 0 | MISS 20 | 598 | 91 | 1341 | 2076 | 17.1 | 154.7 | 10.2 | no |

## Dónde se va el tiempo

TTFB = cabeceras del documento en la red emulada (CDP); transferencia = hasta el fin del documento (CDP `loadingFinished`) o el FCP si llega antes; render = FCP − fin del documento. TTFB + transferencia + render = FCP.

- /: render (TTFB 598 ms, transferencia 83 ms, render 1131 ms)
- /es: render (TTFB 598 ms, transferencia 91 ms, render 1341 ms)

JSON crudo de cada pasada: `primera-pintura-2026-11-15T18-23.json`
