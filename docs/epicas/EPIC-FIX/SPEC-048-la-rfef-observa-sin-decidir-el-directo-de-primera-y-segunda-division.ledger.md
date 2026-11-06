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
| CA-7 | pendiente: despliegue y jornada (titular) |  | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN (CA-1 a CA-6) — 2026-11-03, sdd-verificador, sobre e4d4c83.** CA-7 queda abierta (despliegue y jornada 07-09); la spec sigue en `en-revision` hasta cerrarla.
- Gates: `npm run gates` en Docker `playwright:v1.63.0-noble` sobre `git archive` de e4d4c83 → GATES_RC=0 (120 test files, 2161 passed, 3 skipped; build OK).
- Suites db (Supabase local, `vitest.db.config.mts`): 22 ficheros, 238 tests en verde; `live-observed-only.db.test.ts` 5/5.
- Revisado en código: `lastHeard` elige la última fila admitida por `admittedByEngine` (el live excluido no cuenta como oído); `decideRecovered` no abre instantes de lives excluidos y `decideLocked` filtra al leer; `replayJornadaFilas` filtra con el registro por defecto y `tools/replay-jornada.mjs` la llama sin `sources` (F-SPEC-048-1 aceptada); con `liveObservedOnly` vacío el filtro es la identidad.
- **Corrección de F-SPEC-048-5 (errónea).** SELECT en prod 2026-11-03: `primera-division-2026-27-j11-deportivo-osasuna` tiene v1 `live 0-0 RN-01`, v2 `finished 0-0 RN-02 forced`, **v3 `finished 2-1 confirmado operator`** (decided_at 2026-11-02T23:58:30Z, una observación `operator`); `board` publica 2-1 confirmado. El 0-0 ya no está publicado; F-SPEC-048-5 queda sin objeto.
- **Reversión de salvaguarda (2026-11-07, decisión de Alberto Fojo):** Se levanta `liveObservedOnly` de `src/sources/registry.ts` conforme a ADR-027 §3 tras el despliegue verificado en producción de `marcadorgal-explorer` v2.0 multi-proveedor con MARCA, habilitando la decisión y publicación del directo en Primera y Segunda División.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-048/. Informe HTML opcional: _qa/SPEC-048/informe.html -->

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

## Salvedades / follow-ups
<!-- IDs F-SPEC-048-1, F-SPEC-048-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-048-1: el filtro de replay-jornada vive en `replayJornadaFilas` (por defecto el registro), no en `tools/replay-jornada.mjs`, para respetar CA-6. En Primera y Segunda, los «ticks live ≠ fuente» (SPEC-014 CA-6) de la rfef quedan en 0 por diseño. Destino: ninguno salvo que el titular lo quiera en la herramienta.
- F-SPEC-048-2: la consulta de `lastHeard` devuelve ahora una fila por (partido, fuente, live o no) en lugar de una por partido. El motor elige la última admitida. Hay más filas, pero acotadas. Destino: EPIC-MEJORA si se nota en el tick.
- F-SPEC-048-3: ADR-027 sigue en `borrador`; aceptarlo corresponde a sdd-arquitecto o al titular.
- F-SPEC-048-4: las suites db se corrieron a mano desde Windows (`npx vitest run --config vitest.db.config.mts` contra la Supabase local), no con `npm run test:db`. No hay migraciones en esta spec.
- F-SPEC-048-5: el Depor–Osasuna sigue publicado `finished` 0-0 (RN-02). Esta spec no lo corrige; queda para el operador o SPEC-046.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1 a CA-6 implementados y con tests en la rama `ft/SPEC-048-rfef-sin-decision-en-primera-y-segunda`, solo en local (sin push). CA-5 con evidencia de producción.
- Falta: la verificación y CA-7. CA-7 (a) es desplegar antes del primer kickoff del 2026-11-07 y anotar aquí el id de despliegue y el sha. CA-7 (b) es la consulta tras la jornada del 07 al 09 y la captura gl en `_qa/SPEC-048/`.
