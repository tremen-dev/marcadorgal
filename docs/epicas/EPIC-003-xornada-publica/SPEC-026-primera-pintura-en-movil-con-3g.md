---
id: SPEC-026
tipo: spec
epica: EPIC-003
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-09, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-09, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-09, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-10-09, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-10-09, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-10-09, por: sdd-implementador}
---
# SPEC-026 — Primera pintura en móvil con 3G

## Problema
Criterio 4 de EPIC-003 y métrica norte de `vision.md`: primera pintura en
móvil con 3G < 2 s, con el dato ya en el HTML (snapshot servido, SPEC-020),
medida en la jornada del criterio 1. Nadie la ha medido y «3G» no está
definido: sin perfil fijo, el número no es reproducible.

## Usuarios / roles afectados
- Titular: corre la medición en la jornada (H-2) y decide si no se cumple (H-3).
- sdd-verificador: verificación de campo. Público: ninguno (sin cookies ni datos de quien mira).

## Criterios de aceptación
- **CA-1 Perfil «3G» fijado aquí (H-1).** Constante única en `tools/primera-pintura.mjs`: red 1,6 Mbit/s de bajada, 768 kbit/s de subida, 300 ms de RTT (perfil «3G» de WebPageTest) por CDP `Network.emulateNetworkConditions`; CPU ×4 (`Emulation.setCPUThrottlingRate`); viewport 390 × 844, DPR 3, `isMobile`; contexto nuevo por pasada (caché y almacenamiento vacíos). Chromium de `@playwright/test`, sin dependencias nuevas.
- **CA-2 Qué se mide.** Por pasada: TTFB y `first-contentful-paint` (Navigation y Paint Timing), LCP, bytes del documento y del JS/CSS inicial, `x-vercel-cache` y `Age` del documento. Y el dato en el HTML: el cuerpo de la respuesta (sin ejecutar JS) contiene al menos un `[data-match-id]` con marcador o hora, y el FCP llega con filas ya en el DOM (comprobado en el primer `paint`). Una pasada sin filas en el HTML cuenta como fallo, no se descarta.
- **CA-3 Muestra y umbral (H-1).** `npm run primera:pintura -- --n 20` sobre `https://marcador.gal/` y `https://marcador.gal/es`, pasadas alternas y separadas ≥ 15 s (para incluir fallos de caché del CDN). Cumple si el **p75 del FCP < 2 s en cada ruta** y todas las pasadas traen el dato en el HTML; se imprimen mediana, p75, máximo y n. La aritmética vive en `src/medicion/pintura.ts`, pura, con test de tabla (umbral exacto 2000 ms, una ruta sí y otra no, pasada sin dato).
- **CA-4 Informe y campo.** Salida a `_qa/SPEC-026/primera-pintura-<fecha>.md` (una página, con el perfil de CA-1 copiado) y JSON crudo de cada pasada al lado. En la jornada medida (N-1), en un bloque con partidos en juego, se corre una vez; el ledger recoge p75, mediana, máximo, n por ruta, aciertos de caché y veredicto. Si no cumple, el informe dice dónde se va el tiempo (TTFB, transferencia o render) y el ledger abre un residual; el arreglo es otra spec (H-3).
- **CA-5 Gates.** `npm run gates` en verde; ningún test pide a la red (la cáscara se prueba con un servidor local de fixture o no se prueba; la aritmética sí). Sin dependencias nuevas; `src/sources`, `src/decide` y `src/ingest` intactos.

## Entidades y reglas afectadas
Board, Frescura (`dominio.md`); snapshot servido de SPEC-020; D-8, D-9. ADR-014 §6 (caché),
ADR-002 §5. SPEC-020 (snapshot), SPEC-024 CA-11 (First Load JS).

## Fuera de alcance
Optimizar la página (spec aparte si no se cumple). Latencia gol → pantalla
(SPEC-025). Medir con usuarios reales o analítica (no hay, y no habrá terceros).

## Notas para el gate humano
- **H-1 Perfil y umbral.** Recomendado: «3G» de WebPageTest + CPU ×4 y p75 por ruta (convención de Core Web Vitals). Más duro: «Slow 3G» de DevTools (400 kbit/s, 2 s de RTT), que casi ninguna web cumple a 2 s. Más blando: mediana.
- **H-2 Dónde corre.** Recomendado: el Mac del titular en Galicia (borde de Vercel cercano, como el público real; ~15 min). Alternativa: GitHub Actions (gratis, repo público), pero sale desde EE. UU. y mide otro borde y otro RTT real bajo la emulación.
- **H-3 Si no se cumple:** residual y spec de optimización priorizada por el tramo dominante; el criterio 4 queda abierto hasta cumplir o hasta que el titular cambie el objetivo por escrito. Recomendado.
- **N-1 Fecha.** El criterio pide la jornada del criterio 1 (la publicada). Recomendado: correrla además en la de SPEC-025 (2026-10-16/19) para llegar con datos.
- **N-2 Partida de SPEC-025** para que cada una quepa en una página: comparten `src/medicion/` y nada más.
- **Decididas por el titular (Alberto Fojo, 2026-10-09):** H-1 = perfil «3G» de WebPageTest, CPU ×4, percentil 75 por ruta; H-2 = medido desde el Mac del titular; H-3 según recomendación. Spec aprobada.
