---
id: SPEC-048
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-048 La rfef observa sin decidir el directo de Primera y Segunda División

## Resumen
- Fase: en-revision (implementación lista 2026-11-03; aprobada 2026-11-03, Alberto Fojo: H-1, H-2, H-3 y H-4 aprobadas en sesión con el orquestador)
- Rama: `ft/SPEC-048-rfef-sin-decision-en-primera-y-segunda` (spec: `docs/SPEC-048-rfef-sin-decision-en-primera-y-segunda`)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/model/source.ts` (`liveObservedOnly`, default `[]`, subconjunto de `competitions`); `src/sources/registry.ts` (rfef) | `src/model/source.test.ts` «SPEC-048 CA-1 liveObservedOnly» (3 casos); `src/sources/registry.test.ts` «rfef observes Primera and Segunda…», «api-football has no liveObservedOnly» | ✅ 3+2 tests en verde (vitest verbose); Docker gates de e4d4c83 | ✅ |
| CA-2 | `src/ingest/live-observed-only.ts` (`admittedByEngine`, `forEngine`) | `src/ingest/live-observed-only.test.ts` «SPEC-048 CA-2 live observed only» (13 casos) | ✅ 13 casos en verde; función sin reloj/red/base; `forEngine([],…)` lo deja todo | ✅ |
| CA-3 | `src/ingest/engine.ts` `decideLocked` (ventana de 15 min y `lastHeard` filtrados) | `src/ingest/live-observed-only.db.test.ts` «SPEC-048 CA-3 …» (Primera, control `primera-rfef-g1`, reversibilidad); `src/ingest/engine.test.ts` «does not count as heard a live the engine never receives» | ✅ db: Primera (i)-(iv), control g1 (live → RN-02 forced, 1 alerta), reversible con `[]` (live 0-0 → RN-02); unit lastHeard excluye el live rfef (traza = api-football a −40) | ✅ |
| CA-4 | `src/ingest/engine.ts` `decideRecovered`; `src/ingest/replay-jornada-db.ts` `replayJornadaFilas(…, sources = SOURCES)` | `src/ingest/live-observed-only.db.test.ts` «SPEC-048 CA-4 …» (recovery; replay-jornada con espía del motor y control revertido) | ✅ db: recuperación → 1 Decision `finished 2-1 RN-01` con `observation_ids=[final]`; replay sin `live` y sin corrección; con `[]` ve `live:0-0` (el test muerde) | ✅ |
| CA-5 | n-a (evidencia de producción, abajo) | SELECT de solo lectura en prod, 2026-11-03 (ver «Evidencia CA-5») | ✅ re-ejecutado `ca5.mjs` en prod (solo SELECT) 2026-11-03: salida idéntica a la tabla; 19 partidos, primer≠último 0 | ✅ |
| CA-6 | `git diff --stat 973c7a6..HEAD -- . ":!docs"`: solo `src/model/source*.ts`, `src/sources/registry*.ts`, `src/ingest/*` | `npm run gates` en Docker Linux sobre `git archive` de b029130 → GATES_RC=0 (biome 330 ficheros, 120 test files, build OK); suites db a mano (`vitest.db.config.mts`, Supabase local) → 22 ficheros, 238 tests | ✅ diff 973c7a6..e4d4c83 sin `src/decide`, `src/sources/rfef`, `supabase`, `tools`; `src/sources` solo importa de model; gates Docker e4d4c83 GATES_RC=0 (120 files, 2161 tests); db 22/238 en verde, 27/27 migraciones aplicadas en local (el `db push` de test:db no tendría nada) | ✅ |
| CA-7 | pendiente: despliegue y jornada (titular) | SELECT de solo lectura en prod, 2026-11-09 (ver «Evidencia CA-7») | ❌ (a) desplegado 702e209 el 2026-11-03 (deployment GitHub 7531140945, success), pero sustituido en prod el 2026-11-06T23:38:56Z por 10e8400 (PR #99, revierte `liveObservedOnly`) antes del primer kickoff; (b) 528 Decisions `live` de Primera/Segunda citan observación rfef (esperado 0); sin captura «sen sinal» de Primera | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN (CA-1 a CA-6) — 2026-11-03, sdd-verificador, sobre e4d4c83.** CA-7 queda abierta (despliegue y jornada 07-09); la spec sigue en `en-revision` hasta cerrarla.
- Gates: `npm run gates` en Docker `playwright:v1.63.0-noble` sobre `git archive` de e4d4c83 → GATES_RC=0 (120 test files, 2161 passed, 3 skipped; build OK).
- Suites db (Supabase local, `vitest.db.config.mts`): 22 ficheros, 238 tests en verde; `live-observed-only.db.test.ts` 5/5.
- Revisado en código: `lastHeard` elige la última fila admitida por `admittedByEngine` (el live excluido no cuenta como oído); `decideRecovered` no abre instantes de lives excluidos y `decideLocked` filtra al leer; `replayJornadaFilas` filtra con el registro por defecto y `tools/replay-jornada.mjs` la llama sin `sources` (F-SPEC-048-1 aceptada); con `liveObservedOnly` vacío el filtro es la identidad.
- **Corrección de F-SPEC-048-5 (errónea).** SELECT en prod 2026-11-03: `primera-division-2026-27-j11-deportivo-osasuna` tiene v1 `live 0-0 RN-01`, v2 `finished 0-0 RN-02 forced`, **v3 `finished 2-1 confirmado operator`** (decided_at 2026-11-02T23:58:30Z, una observación `operator`); `board` publica 2-1 confirmado. El 0-0 ya no está publicado; F-SPEC-048-5 queda sin objeto.
- **Reversión de salvaguarda (2026-11-07, decisión de Alberto Fojo):** Se levanta `liveObservedOnly` de `src/sources/registry.ts` conforme a ADR-027 §3 tras el despliegue verificado en producción de `marcadorgal-explorer` v2.0 multi-proveedor con MARCA, habilitando la decisión y publicación del directo en Primera y Segunda División.

**RED (CA-7) — 2026-11-09, sdd-verificador, sobre origin/main 6148242 y prod.** CA-1 a CA-6 siguen ✅ (veredicto del 2026-11-03).
- CA-7 (a): 702e209 se desplegó el 2026-11-03 (GitHub deployment 7531140945, success), pero la salvaguarda se retiró en prod el 2026-11-06T23:38:56Z (10e8400, deployment 7613335697), antes del primer kickoff del 07.
- CA-7 (b): 528 Decisions `live` de Primera/Segunda citan observación rfef (355 + 173); se esperaba 0. Sin captura de Primera en juego con «sen sinal».
- No es un defecto de implementación: hace falta una decisión del titular sobre CA-7 (F-SPEC-048-6).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-048/. Informe HTML opcional: _qa/SPEC-048/informe.html -->
| CA | Captura | Qué muestra |
|---|---|---|
| CA-7 | `_qa/SPEC-048/ca7-directos-gl-segunda-2026-11-09.png` | https://marcador.gal/directos (gl, 390 px, 2026-11-09 ~20:35Z, v0.3.0·6148242): Sabadell 0-0 Real Sociedad B «Descanso», marcador en directo publicado, no «sen sinal». No había ningún partido de Primera en juego: la captura pedida no se puede tomar, y con la salvaguarda revertida no mostraría «sen sinal». |

## Evidencia CA-5
`node ca5.mjs prod.env` (scratchpad; solo SELECT), 2026-11-03. Partidos de `primera-division`/`segunda-division` con observaciones rfef `finished`:

rfef: primera observación 2026-11-02T15:04:48.823Z total 269
| matchId | n finished | primer finished | último finished | marcadores distintos | Decision vigente |
|---|---|---|---|---|---|
| primera-division-2026-27-j11-villarreal-espanyol | 1 | 0-1 (2026-11-02T03:03:17.960Z) | 0-1 (2026-11-02T03:03:17.960Z) | 1 | finished 0-1 provisional RN-01 |
| primera-division-2026-27-j11-levante-atletico-madrid | 1 | 0-2 (2026-11-02T03:03:17.998Z) | 0-2 (2026-11-02T03:03:17.998Z) | 1 | finished 0-2 confirmado RN-12 |
| primera-division-2026-27-j11-rayo-vallecano-celta | 1 | 3-0 (2026-11-02T03:03:18.019Z) | 3-0 (2026-11-02T03:03:18.019Z) | 1 | finished 3-0 confirmado RN-12 |
| primera-division-2026-27-j11-real-betis-malaga | 1 | 2-1 (2026-11-02T03:03:18.040Z) | 2-1 (2026-11-02T03:03:18.040Z) | 1 | finished 2-1 provisional RN-01 |
| primera-division-2026-27-j11-barcelona-alaves | 1 | 6-1 (2026-11-02T03:03:18.060Z) | 6-1 (2026-11-02T03:03:18.060Z) | 1 | finished 6-1 provisional RN-01 |
| primera-division-2026-27-j11-getafe-sevilla | 1 | 3-1 (2026-11-02T03:03:18.081Z) | 3-1 (2026-11-02T03:03:18.081Z) | 1 | finished 3-1 provisional RN-01 |
| primera-division-2026-27-j11-racing-santander-real-madrid | 1 | 0-3 (2026-11-02T03:03:18.101Z) | 0-3 (2026-11-02T03:03:18.101Z) | 1 | finished 0-3 provisional RN-01 |
| primera-division-2026-27-j11-elche-valencia | 1 | 0-1 (2026-11-02T03:03:18.122Z) | 0-1 (2026-11-02T03:03:18.122Z) | 1 | finished 0-1 provisional RN-01 |
| primera-division-2026-27-j11-athletic-club-real-sociedad | 1 | 2-1 (2026-11-02T03:03:18.153Z) | 2-1 (2026-11-02T03:03:18.153Z) | 1 | finished 2-1 provisional RN-01 |
| segunda-division-2026-27-j12-real-sociedad-b-girona | 2 | 1-0 (2026-11-02T15:02:53.788Z) | 1-0 (2026-11-02T15:06:03.683Z) | 1 | finished 1-0 provisional RN-01 |
| segunda-division-2026-27-j12-eibar-almeria | 2 | 1-1 (2026-11-02T15:02:53.808Z) | 1-1 (2026-11-02T15:06:03.703Z) | 1 | finished 1-1 provisional RN-01 |
| segunda-division-2026-27-j12-celta-fortuna-cordoba | 2 | 2-2 (2026-11-02T15:02:53.829Z) | 2-2 (2026-11-02T15:06:03.723Z) | 1 | finished 2-2 provisional RN-01 |
| segunda-division-2026-27-j12-albacete-sabadell | 2 | 2-1 (2026-11-02T15:02:53.850Z) | 2-1 (2026-11-02T15:06:03.744Z) | 1 | finished 2-1 provisional RN-01 |
| segunda-division-2026-27-j12-eldense-granada | 2 | 0-2 (2026-11-02T15:02:53.870Z) | 0-2 (2026-11-02T15:06:03.764Z) | 1 | finished 0-2 provisional RN-01 |
| segunda-division-2026-27-j12-ceuta-sporting | 2 | 0-2 (2026-11-02T15:02:53.891Z) | 0-2 (2026-11-02T15:06:03.784Z) | 1 | finished 0-2 provisional RN-01 |
| segunda-division-2026-27-j12-burgos-castellon | 2 | 1-1 (2026-11-02T15:02:53.911Z) | 1-1 (2026-11-02T15:06:03.804Z) | 1 | finished 1-1 provisional RN-01 |
| segunda-division-2026-27-j12-oviedo-las-palmas | 1 | 2-3 (2026-11-02T19:53:40.305Z) | 2-3 (2026-11-02T19:53:40.305Z) | 1 | finished 2-3 provisional RN-01 |
| segunda-division-2026-27-j12-valladolid-leganes | 1 | 4-3 (2026-11-02T20:01:10.332Z) | 4-3 (2026-11-02T20:01:10.332Z) | 1 | finished 4-3 provisional RN-01 |
| segunda-division-2026-27-j12-mallorca-cadiz | 1 | 2-1 (2026-11-02T22:30:13.668Z) | 2-1 (2026-11-02T22:30:13.668Z) | 1 | finished 2-1 provisional RN-01 |
partidos: 19 · primer≠último: 0 · con >1 marcador distinto: 0

Ningún primer `finished` difiere del último: la spec no para. `primera-division-2026-27-j11-deportivo-osasuna` no tiene ningún `finished` rfef (por eso no sale).

## Evidencia CA-7
Verificación 2026-11-09 (sdd-verificador, rama `docs/SPEC-048-ca7-jornada` desde origin/main 6148242). Solo SELECT en prod (`ca7.mjs`, `freeze.mjs` en el scratchpad).

**(a) Despliegue.** `gh api repos/tremen-dev/marcadorgal/deployments?sha=702e209a2ff9a97895e9273b0f0f0dcbe87a0d7c` → deployment GitHub **7531140945**, Production, 2026-11-03T21:29:49Z, status `success` (https://marcadorgal-rhzytwqcl-albertofojo-5908s-projects.vercel.app; Vercel p2b4BJQYPRqrX9wTdQLMZB2dcEro según el encargo). Sha **702e209a2ff9a97895e9273b0f0f0dcbe87a0d7c** (merge PR #96). **Pero** el deployment 7613335697 (2026-11-06T23:38:56Z, success) puso en producción **10e8400** (merge PR #99, commit 885e4c0 «levantar salvaguarda liveObservedOnly»), que borra `liveObservedOnly` de la rfef. Durante toda la jornada 07-09 producción corrió sin el filtro (despliegues posteriores: 5a9e561 … 6148242, todos sobre el revert).

**(b) Jornada** (`matches.kickoff` en [2026-11-06T23:00Z, 2026-11-09T23:00Z), consulta a 2026-11-09T20:32Z):
| competición | partidos | con rfef live | obs. rfef live | Decisions live | live que citan rfef | Decisions forced_finish (histórico) |
|---|---|---|---|---|---|---|
| primera-division | 9 | 9 | 2194 | 355 | **355** | 8 |
| segunda-division | 11 | 7 | 1580 | 196 | **173** | 5 |
| primera-rfef-g1 (control) | 8 | 8 | 2172 | 84 | 84 | 8 |
| segunda-rfef-g1 (control) | 9 | 9 | 2455 | 88 | 87 | 9 |
| tercera-rfef-g1 (control) | 9 | 2 | 520 | 4 | 4 | 1 |

- Decisions `live` que citan rfef en Primera/Segunda: **528 (esperado 0)** → (b) falla. Observaciones rfef `live` > 0: sí (3774).
- Vigentes Primera/Segunda: 16 `finished confirmado` (RN-12 o RN-01), 4 `postponed` (Andorra–Mallorca, Castellón–Eibar, Granada–Tenerife, Las Palmas–Eldense), 1 `live 0-0 sen_sinal RN-05` (Sabadell–Real Sociedad B, kickoff 19:30Z del 09, en juego al consultar: **la jornada no había terminado**). Ningún vigente es `forced_finish`; los forzados son versiones intermedias ya superadas.
- Control Federación: decide el directo como antes (84/87/4 Decisions `live` con rfef).

**Dato para SPEC-046 (informativo, no cambia el veredicto).** Por partido de Primera/Segunda, último `live` rfef vs primer `finished` rfef: 14 coinciden; **2 congelados**: `primera-division-2026-27-j12-real-sociedad-rayo-vallecano` (246 lives, todos 0-0; acta 1-0) y `segunda-division-2026-27-j13-girona-almeria` (283 lives, todos 0-0; acta 0-1), ambos con kickoff 2026-11-08T15:15Z. Celta–Levante y Espanyol–Deportivo: un único marcador live 0-0 con acta 0-0 (no distinguible). En `explorer.match_events` esos dos partidos (acta:70694641, acta:70695042, `live_provider` rfef) tienen MATCH_STARTED, varios READING_DISCARDED y MATCH_FINISHED, **ningún SCORE_CHANGED**; los demás de Primera/Segunda con goles sí lo tienen. `explorer.raw_readings` 07-09: 1103 lecturas `paneles/live` y 436 `jornada/today_groups`. Las Decisions vigentes de ambos son `finished confirmado RN-12` con el marcador del acta.

## Salvedades / follow-ups
<!-- IDs F-SPEC-048-1, F-SPEC-048-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-048-1: el filtro de replay-jornada vive en `replayJornadaFilas` (por defecto el registro), no en `tools/replay-jornada.mjs`, para respetar CA-6. En Primera y Segunda, los «ticks live ≠ fuente» (SPEC-014 CA-6) de la rfef quedan en 0 por diseño. Destino: ninguno salvo que el titular lo quiera en la herramienta.
- F-SPEC-048-2: la consulta de `lastHeard` devuelve ahora una fila por (partido, fuente, live o no) en lugar de una por partido. El motor elige la última admitida. Hay más filas, pero acotadas. Destino: EPIC-MEJORA si se nota en el tick.
- F-SPEC-048-3: ADR-027 sigue en `borrador`; aceptarlo corresponde a sdd-arquitecto o al titular.
- F-SPEC-048-4: las suites db se corrieron a mano desde Windows (`npx vitest run --config vitest.db.config.mts` contra la Supabase local), no con `npm run test:db`. No hay migraciones en esta spec.
- F-SPEC-048-5: el Depor–Osasuna sigue publicado `finished` 0-0 (RN-02). Esta spec no lo corrige; queda para el operador o SPEC-046.

- F-SPEC-048-6: CA-7 no se puede cumplir tal como está escrita: el titular revirtió la salvaguarda (885e4c0, PR #99, desplegado 2026-11-06T23:38:56Z) antes de la jornada que debía medirla. La justificación anotada (explorer v2.0 con MARCA) no es el criterio de reversión de H-4 (export con la RFEF moviendo marcadores en ≥ 1 jornada), y la anotación se escribió en «Veredicto del verificador», que es solo del verificador. Destino: titular / sdd-arquitecto (enmendar CA-7, o dar la spec por superada y cerrarla con decisión registrada).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1 a CA-6 implementados y con tests en la rama `ft/SPEC-048-rfef-sin-decision-en-primera-y-segunda`, solo en local (sin push). CA-5 con evidencia de producción.
- Falta: la verificación y CA-7. CA-7 (a) es desplegar antes del primer kickoff del 2026-11-07 y anotar aquí el id de despliegue y el sha. CA-7 (b) es la consulta tras la jornada del 07 al 09 y la captura gl en `_qa/SPEC-048/`.
