---
id: SPEC-032
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-032 Calibración de la cadencia sostenible de la RFEF con una identidad estable

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-032-calibracion-rfef` (desde la rama de SPEC-031, PR #63 sin fusionar)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/calibration.ts` (`buildPlan`, `planRounds`, `formatPlan`, `calibrate` dry-run); `tools/calibrar-rfef.mjs`; script `rfef:calibrar` en `package.json` | `src/sources/rfef/calibration.test.ts` › CA-1 (3 casos; dry-run con fetch doble: 0 llamadas). Evidencia: `npm run rfef:calibrar -- --dry-run` → 6 escalones 180…30 s de 30 min, «Peticiones máximas: 176 (175 vueltas + 1 portada…)», «Duración máxima: 3 h», exit 0 | | ❌ |
| CA-2 | `calibration.ts` (`runSeries`, `send`); `src/sources/rfef/adapter.ts` exporta `PANEL_ENJUEGO_QUERY`, `PANEL_CONTENT_TYPE`, `USER_AGENT`, `portadaInit`, `panelInit`, `sessionCookie`, `charsetOf` y el adaptador los usa | `src/sources/rfef/calibration.test.ts` › CA-2 (7 casos: patrón vuelta 1/siguientes/última, constantes, NLogin y 3xx con renovación, segundo NLogin para, sesión recién abierta rechazada para, ≤ 3 por vuelta); `src/arch/rfef-identity.test.ts` (UA = registro, rfef sin registrar) | | ❌ |
| CA-3 | `calibration.ts` (`runSeries`: inicio = max(inicio previo + intervalo, fin previo)) | `src/sources/rfef/calibration.test.ts` › CA-3 (2 casos: 174 huecos = intervalo exacto, 10/15/20/30/40/60 POST por escalón, 3 h ≤ 4 h; petición de 200 s retrasa, nunca adelanta) | | ❌ |
| CA-4 | `calibration.ts` (`send`/`report`: `vacio`, `no-2xx`, `error-red`, `nlogin`; `rancia` por sha-256; `exitCode`) | `src/sources/rfef/calibration.test.ts` › CA-4 (4 casos con el fixture real `…-todos-vacio.raw`: 0 peticiones más, umbral en consola, exit ≠ 0; 503 y error de red sin reintento; rancia registrada sin parar) | | ❌ |
| CA-5 | `calibration.ts` (`preconditions`, `inWindow`, `REST_MS`); `tools/calibrar-rfef.mjs` (`lastLogged` de `_qa/calibracion/*.jsonl`, calendario de `data/calendario/2026-27`) | `src/sources/rfef/calibration.test.ts` › CA-5 (9 casos: sin `--ultima-peticion`, < 24 h, no ISO, JSONL < 24 h, 24 h exactas valen, ventana −10/+150 min, sin partido en ventana, `bloqueada-al-inicio` y reintento vetado). Humo de la cáscara con `fetch` bloqueado (preload): sin flag → exit 2 y 0 llamadas; `--ultima-peticion 2026-10-11T16:29:16Z` hoy → «menos de 24 h de reposo», exit 2, 0 llamadas | | ❌ |
| CA-6 | `calibration.ts` (`CalibrationLine`, una línea por petición, sin cabeceras de petición); `tools/calibrar-rfef.mjs` (JSONL en `_qa/calibracion/<fecha>.jsonl`, cuerpos `.raw.gz` en `--crudo/<fecha>/`, rechaza `--crudo` dentro del repo) | `src/sources/rfef/calibration.test.ts` › CA-6 (2 casos: campos, sha-256 = node:crypto, cuerpo íntegro al registro; la cookie no está en ninguna línea ni log). Humo de la cáscara con respuestas guionizadas (portada 302 con cookie, POST con el fixture real, vacío): 3 líneas JSONL, `002-todos-…raw.gz` (11.905 B) fuera del repo, `grep -c SMOKESECRET` → 0 en JSONL e informe, exit 1; ficheros de humo borrados para no activar la regla (ii) | | ❌ |
| CA-7 | `calibration.ts` (`analyze`, `rowOf`, `buildReport`); la cáscara escribe `<fecha>-informe.md` y `--informe <jsonl>` lo regenera | `src/sources/rfef/calibration.test.ts` › CA-7 (6 casos sobre JSONL fijos: fila ≤ 45 s (sin umbral hasta 30 s → 45 s), fila 60 s–3 min (vacío en la 6.ª de 45 s → 60/90 s, conteos 5/11/31/52), sin cadencia (vacío a 180 s), sostenible 180 s sin margen, `bloqueada-al-inicio` sin fila, parada por no-2xx sin umbral) | | ❌ |
| CA-8 | **Pendiente** (serie real; ver handoff) | — | | ❌ |
| CA-9 | Lógica pura en `calibration.ts` (solo importa `src/model` y `src/sources/rfef`; reloj/red/fs inyectados; formatea con `shiftInstant`); cáscara `tools/calibrar-rfef.mjs`; sin cambios en `registry.ts` ni `ADAPTERS`; sin dependencias nuevas | `src/sources/rfef/calibration.test.ts` › CA-9; `src/arch/rfef-boundary.test.ts` y `src/arch/sources-boundary.test.ts` (existentes) cubren el fichero nuevo. `npm run gates` → exit 0 (95 ficheros, 1649 tests, build OK; 1 aviso de lint preexistente en `src/arch/deploy.test.ts`) | | ❌ |
| CA-10 | `src/sources/rfef/adapter.ts` (`nloginInit`, `readPortada`, `readNlogin`, `RfefSessionError`; `fetch` hace portada → `NLogin` → POST; portada `200` vacía al crudo) ; doble estricto `src/sources/rfef/server-double.ts` (`rfefServer`, URLs escritas a mano, no importadas del adaptador) | `src/sources/rfef/adapter.test.ts` › CA-10: (i) 3 llamadas exactas y 1 request sin `requestErrors` (fixture real `paneles-masculino-fed3-…`), crudo sin cookie ni `NLogin`/`NSess`; (ii) portada → POST sin `NLogin` → `302` a `/pnfg/NLogin`; (iii) 6 portadas y 4 `NLogin` que lanzan sin llegar al paso siguiente; `JSESSIONID` nueva de `NLogin` sustituye; (iv) portada `200` vacía → 1 request, `empty body`. CA-7 › (ii)-(iv) adaptados al handshake. Rojo antes del código: 17 fallos (48 tests), (i) con `Error: rfef responded 302` (el defecto de campo). Mutación quitando el `NLogin` de `adapter.ts`: (i) y 5 más en rojo; restaurado → 48/48 | | |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-032/. Informe HTML opcional: _qa/SPEC-032/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-032-1, F-SPEC-032-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-032-1** (gate humano): si solo se sostiene 180 s no hay escalón más lento para el margen; el informe lo trata como «sin cadencia» (fila 3). La spec no cubre ese caso.
- **F-SPEC-032-2** (interpretación): un vacío en cualquier petición de la vuelta 1 (portada o POST `todos`) es `bloqueada-al-inicio`; la spec dice «la primera petición». Sin medida, el CA-8 sigue abierto.
- **F-SPEC-032-3** (spec de alta): el mapa `codgrupo` → competición sale de `src/sources/rfef/fixtures/alias-test.json`; no existe `data/alias/2026-27/rfef.json`.
- **F-SPEC-032-4** (spec de alta): `USER_AGENT` vive en `adapter.ts`, pero el adaptador sigue enviando `ctx.userAgent`; al registrar la rfef, su entrada debe declarar ese UA.
- **F-SPEC-032-5** (operación): si la serie se corta a mano, el informe se regenera con `npm run rfef:calibrar -- --informe <jsonl>`.
- **F-SPEC-032-6** (residual de SPEC-031, se cierra aquí por E-1): `adapter.ts` y la calibración abren sesión sin el GET a `NLogin` y en real el POST rebota (`_qa/calibracion/2026-10-12-handshake.md`, `2026-10-12.jsonl`). Los dobles aceptaban la cookie de la portada. Arreglo: ADR-020, CA-2 y CA-10 de SPEC-032. PR #63 no lo lleva.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hechos CA-1..CA-7 y CA-9 con fetch doble y reloj falso: **cero peticiones a marcadores.rfef.es** en esta implementación (IP bloqueada el 2026-10-11; última petición a mano 16:29:16Z).
- **Falta CA-8** (lo lanza el titular u orquestador, H-3): en una franja con partidos, tras ≥ 24 h de reposo (probablemente sáb 17 o dom 18 oct), con el Mac despierto unas 3 h y sin navegar la RFEF desde esa IP (H-4):

  ```
  caffeinate -i npm run rfef:calibrar -- --ultima-peticion 2026-10-11T16:29:16Z --crudo ~/rfef-calibracion-crudo
  ```

  Si alguien navegó la RFEF desde esta IP después, `--ultima-peticion` es esa hora. Antes de lanzarla: `npm run rfef:calibrar -- --dry-run`. Sin partido en ventana o sin 24 h, sale con exit 2 y 0 peticiones. Deja `_qa/calibracion/<fecha>.jsonl` y `<fecha>-informe.md`. Copiar aquí el comando, la `--ultima-peticion` y la C\* del informe. Si sale `bloqueada-al-inicio`, CA-8 sigue abierto y se repite otro día de partido.
- La spec sigue `en-progreso` hasta que exista CA-8.
