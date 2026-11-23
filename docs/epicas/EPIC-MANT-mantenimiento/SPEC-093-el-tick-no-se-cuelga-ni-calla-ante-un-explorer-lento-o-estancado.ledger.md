---
id: SPEC-093
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-093 El tick no se cuelga ni calla ante un explorer lento o estancado

## Resumen
- Fase: hecho (verificada en GREEN el 2026-11-23)
- Rama: `ft/SPEC-093-tick-robusto-explorer`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/tick.ts` (`withDeadline`, `fetchWithSignal`, `attemptTimeoutMs`), `src/ingest/constants.ts` (`SOURCE_ATTEMPT_TIMEOUT_MS`) | `src/ingest/tick.spec093.test.ts` › «SPEC-093 CA-1 the deadline of the attempt» (6 casos) | Tests OK. Recorrido con servidor HTTP local y `fetch` real (undici), plazo 1500 ms: sin respuesta → cerrado en 1538 ms, `ok=false`, `rfef: sin respuesta de la fuente en el plazo del intento (1500 ms)`, `engine`+`social` presentes; cabeceras y cuerpo sin fin → igual (1582 ms). Producción usa el valor por defecto (único uso de `attemptTimeoutMs`) | ✅ |
| CA-2 | `src/ingest/salud.ts` (`isOrphan`, fila `sin cerrar`, razón), `src/ingest/constants.ts` (`SALUD_ORPHAN_MINUTES`) | `src/ingest/salud.test.ts` › «SPEC-093 CA-2 tickSalud sees the orphan attempt» (4 casos) | Tests OK. `tickSalud` directo: abierto desde now−3 min → `sin cerrar`, `REVISAR` y razón «intento sin cerrar de rfef desde …»; abierto desde now−1 min → `abierto`, `OK` | ✅ |
| CA-3 | `src/model/source.ts` (`SourceReading`, `ParseResult.readings?`), `src/sources/rfef/explorer.ts` (`parseRequest`, `parse`) | `src/sources/rfef/explorer.test.ts` › «SPEC-093 CA-3 the readings of the source» (7 casos); ajustados con `said()` los 5 casos de SPEC-038 que comparaban el resultado entero | Tests OK; lectura de `parseRequest`: la lectura se empuja tras resolver y antes del `continue` de `SCHEDULED`; `observations` sin cambios | ✅ |
| CA-4 | `src/ingest/tick.ts` (`readingAge`, veredicto en `runAttempt`, `details.ultimaLectura`/`edadLecturaMin`) | `src/ingest/tick.spec093.test.ts` › «SPEC-093 CA-4 the stalled source» (7 casos, uno sobre `export-local-2026-11-01.json` con el adaptador real y `tickSalud`) | Tests OK. Recorrido con el adaptador real sirviendo `export-local-2026-11-01.json` por HTTP: now 18:20 → `ok=false`, `rfef: fuente estancada: última lectura hace 7 min`, 1 observación insertada, `details` con `ultimaLectura`/`edadLecturaMin=7`, `tickSalud` en rojo; now 18:14 → `ok=true`, `edadLecturaMin=1`, salud OK | ✅ |
| CA-5 | `src/lib/explorer-client.ts` (`requiredEnv`), `src/sources/rfef/calendar.ts` (`requiredEnv`, origen leído en `fetch`), `tools/calendario-sync.mjs` (solo `RFEF_EXPLORER_TOKEN`, y sale 1 sin `RFEF_EXPLORER_URL`), `playwright.config.ts` (mock con `RFEF_EXPLORER_URL`) | `src/lib/explorer-sin-respaldo.test.ts` › «SPEC-093 CA-5 no silent fallback to explorer» (10 casos) y «… no alias and no fixed url in the code» (3 casos); `src/calendar/cli.test.ts` › «exits 1 without RFEF_EXPLORER_URL (SPEC-093 CA-5)»; `src/lib/explorer-client.test.ts` con `vi.stubEnv` | Tests OK. `grep -rnE` de la URL fija y los tres alias en `src/`+`tools/` (sin tests) → sin líneas. Consumidores de `explorer-client` capturan el error (`competition-data`, `directos`, `explorer-xornada`, `allSettled` en enriquecimiento). e2e con el mock renombrado: 457 passed, 1 skipped | ✅ |
| CA-6 | `src/sources/registry.ts` (comentario de cabecera) | `src/sources/registry.test.ts` › «SPEC-093 CA-6 the comment of the registry» (2 casos); `rg -n "API-Football" src/sources/registry.ts` → sin líneas (exit 1) | `rg -n "API-Football" src/sources/registry.ts` → exit 1, sin líneas; comentario leído: única fuente, RN-04, `liveProvider`, SPEC-049 | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN** — 2026-11-23, sdd-verificador, sobre `431f4e6`.
- Worktree LF: `npm run typecheck` exit 0; `npm run lint` «Checked 508 files … No fixes applied»; `npm run test` 185 ficheros, 4838 passed, 3 skipped.
- Árbol principal: `npm run build` OK; `npx playwright test` (Chromium local, sin Docker ni Supabase) 457 passed, 1 skipped (4.3 min).
- Recorrido real de CA-1/CA-2/CA-4 con un explorer doble HTTP en 127.0.0.1 (cuelga, cuerpo sin fin, export con `lastSeenAt` viejos) contra `runTick` + BD de memoria + `tickSalud`; sin red externa ni producción.
- No corrido `test:db` (Docker): el cambio no toca SQL.
- ADR-028: `patch` (0.11.4) coherente con la spec («ADR-028: `patch`»).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-093/. Informe HTML opcional: _qa/SPEC-093/informe.html -->
n-a: la spec no cambia UI; sin capturas.

## Salvedades / follow-ups
<!-- IDs F-SPEC-093-1, F-SPEC-093-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-093-1 (titular, despliegue): Preview no tiene `RFEF_EXPLORER_URL` ni `RFEF_EXPLORER_TOKEN`; con CA-5 sus llamadas a explorer fallan con error explícito (nota 3 de la spec). `tools/calendario-sync.mjs` sale 1 sin `RFEF_EXPLORER_URL`; `calendario-semanal.yml` ya la pasa.
- F-SPEC-093-2 (EPIC-MEJORA): el export trae a veces varias filas del mismo partido (en `export-local-2026-11-01.json`, 49 lecturas para 28 partidos), así que `readings` puede repetir `matchId`. CA-4 usa la más reciente y no le afecta.
- F-SPEC-093-3 (EPIC-MEJORA): `tick:salud` solo lee los 10 últimos intentos; un huérfano más antiguo no se ve, aunque eso exige 10 intentos nuevos, o sea un tick vivo.
- Sin correr `npm run test:db` (Docker): el cambio no toca SQL; `details` gana dos claves jsonb (`ultimaLectura`, `edadLecturaMin`).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-6 implementados con test en `ft/SPEC-093-tick-robusto-explorer`, versión 0.11.4 (patch, ADR-028). En worktree LF: `npm run typecheck` OK, `npm run lint` (508 ficheros, sin cambios), `npm run test` 185 ficheros / 4838 tests verdes. Falta: verificación (sdd-verificador), `next build` en el árbol principal y, si se quiere, `test:db`/`e2e` (el mock de Playwright ya usa `RFEF_EXPLORER_URL`). Sin push ni PR.
