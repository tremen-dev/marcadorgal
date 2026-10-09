---
id: SPEC-026
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-026 Primera pintura en móvil con 3G

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-026-primera-pintura-en-movil-con-3g`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `tools/primera-pintura.mjs` (`PERFIL_3G`, `aplicaPerfil`, `opcionesContexto`) | `src/medicion/primera-pintura-perfil.test.ts` (constante; CDP en B/s y ms; contexto 390×844, DPR 3, isMobile); `e2e/primera-pintura.spec.ts` (TTFB ≥ 300 ms contra localhost) | | ❌ |
| CA-2 | `src/medicion/pintura.ts` (`filasEnHtml`, `pasada`); captura en `tools/primera-pintura.mjs` (`unaPasada`, `sondaEnPagina`) | `src/medicion/pintura.test.ts` «CA-2 filasEnHtml» (5) y «CA-2 pasada» (9); `e2e/primera-pintura.spec.ts` (demo con filas al FCP; `/` sin lector = fallo «sin dato en el HTML», contado) | | ❌ |
| CA-3 | `src/medicion/pintura.ts` (`UMBRAL_FCP_MS`, `resumenRuta`, `veredicto`); script `primera:pintura` en `package.json` | `src/medicion/pintura.test.ts` «CA-3 resumenRuta» (1999/2000/2001 ms, pasada sin dato, sin pintura, caché, tramo) y «CA-3 veredicto» (cumple; una ruta sí y otra no; pasada sin dato; muestra no válida) | | ❌ |
| CA-4 | `src/medicion/pintura.ts` (`informePintura`, `describirPerfil`); `.md` + `.json` en `tools/primera-pintura.mjs` | `src/medicion/pintura.test.ts` «CA-4 informePintura» (4); `e2e/primera-pintura.spec.ts` (ficheros y contenido). Campo: pendiente del titular (procedimiento abajo) | | ❌ |
| CA-5 | sin dependencias nuevas; `git diff --stat origin/main` no toca `src/sources`, `src/decide`, `src/ingest` | `npm run gates` exit 0 (76 ficheros, 1315 tests, build OK); `npm run e2e` 91 passed; los tests no piden a la red (e2e contra `next start` local) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-026/. Informe HTML opcional: _qa/SPEC-026/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-026-1, F-SPEC-026-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-026-1 (para verificador/gate):** el TTFB no sale de Navigation Timing como dice CA-2 sino de CDP (`responseReceived − requestWillBeSent` del documento). Medido contra `next start` con 300 ms de RTT emulado: `responseStart` = 8 ms, CDP = 321 ms; Navigation Timing no ve la latencia emulada. FCP y LCP sí son Paint/LCP Timing. Sin dato de CDP cae a `responseStart`.
- **F-SPEC-026-2:** «JS/CSS inicial» = recursos `.js`/`.css` pedidos antes de `domContentLoadedEventEnd`; bytes = `transferSize` (comprimido; `encodedBodySize` si es 0).
- **F-SPEC-026-3:** «FCP con filas» se comprueba con un MutationObserver (init script): instante de la primera `[data-match-id]` ≤ `startTime` del FCP. Condición suficiente, no lectura del frame.
- **F-SPEC-026-4:** veredicto «MUESTRA NO VÁLIDA» si pausa < 15 s, n < 20 en alguna ruta o falta `/` o `/es`. La URL no se valida: el informe la imprime.
- **F-SPEC-026-5:** cosmético: Node avisa `MODULE_TYPELESS_PACKAGE_JSON` al importar `pintura.ts`, como otras herramientas.
- **F-SPEC-026-6 (merge con SPEC-025):** en `src/medicion/` solo `pintura.ts`, `pintura.test.ts`, `primera-pintura-perfil.test.ts`; `primera:pintura` va tras `e2e:db` en `package.json`, lejos de `informe:latencia`. `percentil` se importa de `src/ingest/informe.ts` (sin tocarlo).
- **N-1:** repetir en la jornada del criterio 1 cuando se publique.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Hecho: CA-1..CA-5 en código y tests. Prueba local (`next start`, rutas demo, n 1, pausa 0): FCP ≈ 700–750 ms, TTFB ≈ 312 ms, doc 7,9 kB, JS 81 kB, CSS 1,6 kB, «MUESTRA NO VÁLIDA» (esperado). Falta la medición de campo de CA-4 (titular, H-2).

**Procedimiento del titular — jornada 2026-10-16/19:**
1. Cuándo: en un bloque con partidos **en juego** (filas «en xogo» en https://marcador.gal), p. ej. sábado 18 o domingo 19 por la tarde. ~15 min (40 pasadas, ≥ 15 s entre ellas).
2. Dónde: el Mac del titular, en su red habitual (sin VPN), con la rama ya en `main`: `git switch main && git pull && npm ci` (si falta navegador: `npx playwright install chromium`).
3. Comando, desde la raíz: `caffeinate -i npm run primera:pintura -- --n 20` (por defecto `--url https://marcador.gal --rutas /,/es --pausa 15`; no cambiarlos o la muestra sale no válida).
4. Resultado: `docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-026/primera-pintura-<AAAA-MM-DDTHH-MM>.md` (perfil, tabla por ruta, tramos, veredicto) y `.json` al lado (cada pasada en crudo). Commit de ambos; el verificador copia aquí p75, mediana, máximo, n, aciertos de caché y veredicto. Si NO CUMPLE: «Dónde se va el tiempo» nombra el tramo → residual aquí y spec de optimización (H-3).
