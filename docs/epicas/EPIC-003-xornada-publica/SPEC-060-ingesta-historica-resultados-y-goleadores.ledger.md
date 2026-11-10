# Ledger de SPEC-060 — Ingesta histórica de resultados y goleadores desde la jornada inicial hasta la actual

Criterios de aceptación y evidencia de verificación de SPEC-060.

| Criterio | Módulos afectados | Pruebas | Verif. | Estado |
| :--- | :--- | :--- | :--- | :--- |
| CA-1 Modelo y persistencia relacional de eventos de gol | `supabase/migrations/20261108120000_spec060_match_goals.sql`, `src/board/row.ts` | `src/db/web.db.test.ts`, `src/board/row.test.ts` | ❌ V-1 | ❌ |
| CA-2 Herramienta de ingesta histórica | `tools/historico-sync.mjs`, `src/ingest/historico.ts`, `src/ingest/historico-db.ts` | `src/ingest/historico.test.ts`, `src/ingest/historico.db.test.ts` | ❌ V-2, V-3, V-4 | ❌ |
| CA-3 Integración en la lectura pública histórica | `src/board/week-read.ts`, `src/board/row.ts`, `src/app/xornada-week.tsx` | `src/board/week-read.test.ts`, `src/board/row.test.ts` | ⚠️ V-6 | ⚠️ |
| CA-4 Idempotencia y trazabilidad | `tools/historico-sync.mjs`, `src/ingest/historico-db.ts` | `src/ingest/historico.test.ts`, `src/ingest/historico.db.test.ts` | ❌ V-5 | ❌ |
| CA-5 Calidad, pruebas y gates | Suite completa | `typecheck`, `lint`, vitest, test:db, `next build` | ❌ V-1 | ❌ |

La columna «Estado» de la versión anterior marcaba los cinco CA como «✅ Verificado»
antes de pasar por el verificador; queda sustituida por esta.

## Evidencia del implementador

- **CA-1:** migración `20261108120000_spec060_match_goals.sql` (tabla, índice `(match_id, minute asc)`, RLS activado) y `goals` como 24.ª columna de `web.xornada`.
- **CA-2:** `src/ingest/historico.ts`, `src/ingest/historico-db.ts`, `tools/historico-sync.mjs`; `npm run historico:sync` con `--desde`, `--hasta`, `--dry-run`.
- **CA-3:** `src/board/row.ts` mapea `goals`; `week-read.ts` los conserva.
- **CA-4:** re-ejecución en `historico.db.test.ts` sin decisiones ni goles duplicados.
- **CA-5:** el implementador declaró `npm run gates` en verde.

## Veredicto del verificador — RED (2026-11-09)

Entorno: worktree LF de `origin/main` (6148242), Supabase local (`127.0.0.1:54322`), Node 22.19, Windows.

| Comando | Salida clave |
| :--- | :--- |
| `npm run typecheck` · `npm run lint` | limpio · `Checked 401 files … No fixes applied` |
| `npm run test` | `1 failed / 2295 passed`: `src/db/test-db.test.ts` (spawnSync en Windows, ajeno a SPEC-060) |
| `npm run build` | build completo |
| `npx vitest run --config vitest.db.config.mts` en `b8850c5` (padre de a24bed7) | `6 failed / 232 passed` (línea base) |
| ídem en `a24bed7` (SPEC-060) | `8 failed / 234 passed`: las 6 de la base **+ 2 de `src/db/schema.db.test.ts`** |
| ídem en `origin/main` | `26 failed / 216 passed` (12 más de `engine.db.test.ts` aparecen después de a24bed7, no por SPEC-060) |
| `historico.db.test.ts` y bloque SPEC-060 de `web.db.test.ts` | 5/5 ✓ |
| `npm run historico:sync -- --desde 2026-11-01 --hasta 2026-11-02 --dry-run` sin token (BD local) | dos `Error 401`, `Datas procesadas: 2`, `Partidos consolidados: 0`, **exit 0** |
| sonda `historicoSync` con fetcher simulado (BD local, rollback) | P1–P4, ver V-2, V-3, V-4 |

### Hallazgos

- **V-1 (CA-1, CA-5) Regresión en test:db.** La nueva tabla rompe `src/db/schema.db.test.ts:74` («has the ten tables…», recibe `match_goals`) y `:289` («enables RLS on every table…», `match_goals: 0` no previsto). El ledger declaraba la suite en verde.
- **V-2 (CA-2, D-6, ADR-025 §6) Pisa un `finished` cerrado.** P1: decisión v1 `finished 1-1` (api-football) + Explorer `FINISHED 2-1` → el script inserta v2 `finished 2-1 confirmado RN-01`, 0 alertas. ADR-025 §6 dice que para un partido cerrado se guarda la observación y, si el marcador no coincide, se abre **una** alerta `conflict`, y nunca se escribe una Decision. `src/ingest/historico.ts:153` y `src/ingest/historico-db.ts:175-183` escriben la Decision a mano, con una `rule` (`RN-01`) que el motor no ha aplicado. P4: dos ejecuciones con marcadores distintos producen v1 2-1 y v2 2-2, así que cada vez se sigue lo último que diga Explorer.
- **V-3 (CA-2, «crudo antes que parseo», D-9) Observación sin crudo y con un instante falso.** `src/ingest/historico-db.ts:171`: `raw_ref = 'historico-sync'` es un valor fijo que no apunta a ningún crudo guardado, y no hay `ingest_attempt`. `observed_at = kickoff` deja un `finished` observado en el minuto 0 (P1: `observed_at 19:00`, el inicio), y eso contamina `replay:jornada` e `informe:latencia`.
- **V-4 (CA-2) Explorer caído no se ve.** `src/ingest/historico-db.ts:125-130`: con el `catch` se avisa por consola, se sigue y se sale con 0. Con todas las fechas en 401, el resumen dice «Datas procesadas: 2 / consolidados 0», igual que si no hubiera nada que hacer.
- **V-5 (CA-4) El dry-run no desglosa por jornada.** CA-4 pide partidos y goles «por jornada y competición». `HistoricoSyncReport.detailsByCompetition` y `tools/historico-sync.mjs:75-82` solo agrupan por competición.
- **V-6 (CA-3) Sin verificar en navegador.** `src/board/reader.ts:51` hace `select *` y `row.ts` mapea `goals`, con tests unitarios. El acordeón en una semana pasada no se ha visto con Playwright.
- **Riesgo, no bloquea.** `src/ingest/historico-db.ts:191`: el `delete from match_goals` corre para todo partido emparejado aunque Explorer no lo dé por `FINISHED` o devuelva `goals: []`. P2: Explorer devuelve el partido como `LIVE_PROVISIONAL` con `goals: []` y el gol que había guardado se borra.
- **Conforme.** RLS sin políticas: `web_reader` recibe `42501` al leer `match_goals` y lee los goles por `web.xornada`, que se ejecuta con los permisos de su propietario (ADR-015). Es más estricto que la letra de CA-1. Placeholders de SPEC-059: P3 descarta «Goleador Local», «Goleador Visitante» y los nombres en blanco. La idempotencia de `match_goals` (borrar e insertar por partido dentro de la transacción del día) también está bien.

## Enmienda 2026-11-09 (ADR-033) — matriz CA-1..CA-7

La tabla de arriba es la de la versión anterior (CA-1..CA-5) con el RED. Esta es la de la spec enmendada; Verif. y Estado son del verificador.

| Criterio | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
| :--- | :--- | :--- | :--- | :--- |
| CA-1 `match_goals` | migración `20261108120000_spec060_match_goals.sql` (sin cambios) | `src/db/schema.db.test.ts` «has the eleven tables…» y «enables RLS on every table…» (V-1) | ✅ E-3 | ✅ |
| CA-2 Corrección por el motor | `src/ingest/historico.ts` (`parseHistoricoArgs`, `planDaySync`), `src/ingest/historico-db.ts` (`historicoSync`, `applyDate`), `src/lib/explorer-client.ts` (`getDayMatchesRaw`), `tools/historico-sync.mjs` | `historico.db.test.ts` «finished 1-1 + Explorer FINISHED 2-1 → v2…; again, 0 rows», «a match with no Decision…»; `historico.test.ts` parseHistoricoArgs, planDaySync, «no INSERT into decisions from the tool»; `explorer-client.test.ts` getDayMatchesRaw | ⚠️ E-3..E-7, S-1 | ⚠️ |
| CA-3 Goleadores | `historico.ts` (`completeGoals`, `replaceGoals`), `historico-db.ts` (`applyDate`) | `historico.db.test.ts` «LIVE_PROVISIONAL with goals: [] and FINISHED 1-0 without goals keep the stored goals»; `historico.test.ts` completeGoals y planDaySync | ✅ E-3, E-4, E-6 | ✅ |
| CA-4 Dry-run revisable | `historico.ts` (`formatHistoricoReport`), `historico-db.ts` (`dryDate`) | `historico.test.ts` «prints one line per match with a change…»; `historico.db.test.ts` «0 rows in every table, nothing in the raw store…» | ✅ E-3, E-8 | ✅ |
| CA-5 Fallos visibles | `historico.ts` (`parseExplorerDay`, `isAuthFailure`, `historicoFailed`), `historico-db.ts` (`realDate`, `AuthAbort`), `tools/historico-sync.mjs` (exit) | `historico.db.test.ts` «a 401 aborts in the act…», «an empty date fails…», «an invalid answer…»; `historico.test.ts` historicoFailed | ✅ E-3, E-9 | ✅ |
| CA-6 Lectura pública | sin cambios de código: `web.xornada.goals` → `src/board/row.ts` → `MatchRow` | `e2e/xornada-goleadores-historico.db.spec.ts` | ✅ E-10 | ✅ |
| CA-7 Gates | toda la rama | `npm run gates`, suite db (ver abajo) | ⚠️ E-1, E-2, S-2 | ⚠️ |

### Evidencia del implementador (enmienda)

Entorno: worktree `D:/src/tremen-dev/wt-060` (LF), rama `ft/SPEC-060-back-fill-historico-explorer`, Supabase local (`127.0.0.1:54322`), Node 22.19, Windows. Nunca contra producción.

| Comando | Salida clave |
| :--- | :--- |
| `npx vitest run src/ingest/historico.test.ts src/lib/explorer-client.test.ts` | `historico.test.ts` 19 passed · `explorer-client.test.ts` 7 passed |
| `DATABASE_URL=…54322 npx vitest run --config vitest.db.config.mts src/ingest/historico.db.test.ts` | `Tests 7 passed (7)` |
| suite db completa en `e54ff0d` (base: main + docs) tras `supabase db reset --local` + competiciones | `Tests 25 failed \| 217 passed (242)` |
| suite db completa en la rama, mismo estado de BD | `Tests 23 failed \| 225 passed (248)`; `comm` de los FAIL: **0 solo en la rama**, 2 solo en la base (los dos de `schema.db.test.ts`, V-1) |
| `npx playwright test --config playwright.db.config.ts e2e/xornada-goleadores-historico.db.spec.ts` | `ok 1 … SPEC-060 CA-6 a past week shows the scorers and minutes of match_goals in the accordion (2.2s)` · `1 passed`; el `globalTeardown` falla en Windows (`spawnSync supabase` sin shell, ajeno) y se hizo el reset a mano |
| `EXPLORER_BASE_URL=http://127.0.0.1:9 npm run historico:sync -- --desde 2026-11-01 --hasta 2026-11-02 --dry-run` (BD local) | `Fechas fallidas (2): 2026-11-01 · fetch failed …` · **exit 1** · 0 intentos `operator` en BD |
| `npm run historico:sync -- --hasta 2026-11-09` (hoy) | `--hasta tiene que ser anterior a hoy (2026-11-09, Europe/Madrid)` · exit 1 |
| `npm run gates` | typecheck limpio · lint `Checked 402 files … No fixes applied` · test `1 failed \| 2305 passed \| 3 skipped`: solo `src/db/test-db.test.ts` «wins over a .env file in the cwd too» (spawnSync en Windows, el mismo ajeno del RED) → gates se corta antes del build |
| `npm run build` (aparte) | `✓ Compiled successfully` · `✓ Generating static pages (9/9)` · exit 0 |
| `npm version patch --no-git-tag-version` (ADR-028) | `v0.3.1` (`package.json` y `package-lock.json`) |

Fallos ajenos de la suite db (23, presentes igual en la base): `engine.db.test.ts` (14: CA-11 ×3, SPEC-013 CA-4, SPEC-014, SPEC-018 CA-5, SPEC-021 CA-5 ×2, SPEC-035 CA-1/CA-2/CA-3, SPEC-044 CA-4 ×3), `live-observed-only.db.test.ts` (3), `replay-jornada.db.test.ts` (3), `reconciliacion.db.test.ts` (1), `reconciliacion-sin-directo.db.test.ts` (1), `recuperacion-rfef.db.test.ts` (1, «applied: …»). Con la BD sucia (1834 partidos de un e2e:db anterior) la base daba 30.

### Salvedades / follow-ups

- **F-SPEC-060-1** «Una segunda ejecución igual escribe 0 filas» (CA-2): interpretado como 0 filas en `observations`, `decisions`, `match_goals` y `alerts`. Cada fecha consultada abre su `ingest_attempt` (ADR-033 §4) y guarda su crudo, también en la segunda ejecución; el test lo afirma (`ingest_attempts + 1`).
- **F-SPEC-060-2** La línea de cambio de CA-4 añade « (incompletos)» tras `goles <n> → <n>` cuando los goles de Explorer no suman el marcador, para que no parezca que se van a escribir.
- **F-SPEC-060-3** `informe:*`/`salud` aún no tratan las filas `operator` (follow-up de ADR-033, fuera de alcance).
- **F-SPEC-060-4** `e2e/db-teardown.ts` y `tools/test-db.mjs` fallan en Windows por `spawnSync` sin shell (ajeno; ya conocido).
- La herramienta comprueba que el motor publica una Decision por cada observación del operador; si no, deshace la fecha (fallo visible).

### Cómo retomar (handoff)

Código: `src/ingest/historico.ts` (puro), `src/ingest/historico-db.ts` (BD), `tools/historico-sync.mjs` (shell). Verificar con la suite db contra Supabase local (comando de arriba) y el spec e2e:db. La ejecución real contra producción la lanza el titular, solo tras revisar `npm run historico:sync -- --dry-run`.

## Veredicto del verificador (enmienda) — GREEN con salvedades (2026-11-09)

Entorno: worktree `D:/src/tremen-dev/wt-060` en `4b2803c` (LF, `npm ci`), Supabase local (`127.0.0.1:54322`, `db reset --local` + competiciones antes y después), Node 22.19, Windows. Nada contra producción; sin `.env.local` en el worktree.

| # | Comando | Salida clave |
| :--- | :--- | :--- |
| E-1 | `npm run typecheck` · `npm run lint` · `npx vitest run` · `npm run build` | limpio · `Checked 402 files … No fixes applied` · `1 failed \| 2305 passed \| 3 skipped`: solo `src/db/test-db.test.ts` «wins over a .env file in the cwd too» (spawnSync en Windows; fichero no tocado por la rama) · build completo |
| E-2 | `npx vitest run --config vitest.db.config.mts` (BD recién reseteada) | `Tests 23 failed \| 225 passed (248)`; los 23 son exactamente la lista de fallos ajenos de arriba. Ninguno en `schema.db.test.ts` ni `historico.db.test.ts`. Ningún fichero fallido está en `git diff origin/main...HEAD` ni importa `historico*`; el cambio en `explorer-client.ts` es solo aditivo (`getDayMatchesRaw`) |
| E-3 | ídem: `historico.db.test.ts` (7), `schema.db.test.ts`, `historico.test.ts` (19), `explorer-client.test.ts` (7) | todos ✓; tests no vacíos (asserts sobre filas, versión, regla, `raw_ref` legible, intento, alertas) |
| E-4 | sonda propia `historicoSync` (rollback) en `tercera-rfef-g1`: v1 `finished 1-1` RN-01 sobre observación `rfef` + Explorer `FINISHED 2-1` con placeholder «Goleador Local»; y partido sin Decision con `FINISHED 0-0` | v2 `finished 2-1 confirmado operator`, `decided_at` = `observed_at` = instante de lectura (≠ kickoff); v1 `finished 0-0 operator`; `raw_ref` = la única clave del store; **0 alertas** pese al `rfef 1-1`; goles 2 válidos ≠ 3 → «(incompletos)», 0 filas en `match_goals` |
| E-5 | sonda: segunda ejecución idéntica | `Sin cambios.`; observaciones, decisiones, goles y alertas iguales; `ingest_attempts` +1 y un crudo más (S-1) |
| E-6 | sonda: `replay:jornada` (`replayJornadaFilas` + `replayJornada`) | ventana que incluye la lectura (hasta 2026-11-10): reproduce `finished 2-1` y `0-0`, sin corrección. Ventana solo del día del partido: propone `RN-02 finished 1-1` (ver R-1) |
| E-7 | CLI real `npm run historico:sync -- --desde 2026-07-01 --hasta 2026-07-01` contra Explorer simulado en loopback y Storage local | exit 0; BD `obs 1→2, dec 1→2, goals 0→3, alerts 0, attempts 0→1, storage.objects 0→1`; intento `ok, observations 1, raw_ref` = el de la observación y presente en `storage.objects`; repetido: `Sin cambios.`, solo `attempts` y `storage.objects` +1 |
| E-8 | CLI `--dry-run` con un cambio pendiente; CLI `--dry-run` sin argumentos | `2026-07-01 · tercera-rfef-g1 · J1 · Celta P–Osasuna P · finished 1-1 → 2-1 · goles 3 → 3`, listas, «Por jornada: tercera-rfef-g1 J1…», «Por competición…»; contadores y `storage.objects` idénticos antes/después · sin argumentos: `2026-08-14 → 2026-11-08` (ayer, Europe/Madrid) |
| E-9 | CLI con Explorer que responde 401 (`--desde 2026-06-30 --hasta 2026-07-02`); CLI `--hasta 2026-11-09` | `Fechas fallidas (1): 2026-07-01 · [explorer] respuesta 401` + `Ejecución abortada…`, **exit 1**, 0 filas salvo el intento `ok=false` con crudo · `--hasta tiene que ser anterior a hoy (2026-11-09, Europe/Madrid)`, exit 1 |
| E-10 | `npx playwright test` (config `playwright.db.config.ts` sin teardown, `screenshot: on`) `e2e/xornada-goleadores-historico.db.spec.ts` | `1 passed`; captura `_qa/SPEC-060/CA-6-acordeon-semana-pasada.png`: semana 30 out–2 nov, Athletic 2–1 Real Sociedad «Rematado», acordeón con «Aspas E2E 23'», «Swedberg E2E 85'» |
| E-11 | `package.json` | `0.3.0` (origin/main) → `0.3.1`, `package-lock.json` coherente (patch, ADR-028) |

### Salvedades aceptadas

- **S-1 (CA-2, F-SPEC-060-1).** Coherente con la spec y el ADR: CA-2 (a) y ADR-033 §4 exigen intento + crudo en *cada* fecha consultada; el «no escribe nada» de (c) y ADR-033 §3 es por partido (observación, Decision). Las tablas de verdad (`observations`, `decisions`, `match_goals`, `alerts`) quedan a 0 filas (E-5, E-7). No es RED.
- **S-2 (CA-7).** `npm run gates` no termina en verde en Windows por `src/db/test-db.test.ts` (ajeno, preexistente, fichero no tocado); typecheck, lint, resto de tests y build en verde por separado. Condición: CI (Linux) en verde en el PR.

### Riesgos para la ejecución real (no bloquean)

- **R-1** `replay:jornada --aplicar` con la ventana del día del partido no ve la observación del operador (`observed_at` = hoy) y propone devolver el marcador antiguo con `RN-02`. No usar `--aplicar` sobre jornadas corregidas sin una ventana que llegue hasta la corrección.
- **R-2** El emparejado (`isMatchEqual`, `planDaySync` con `find`) es por subcadena de slug y no es exclusivo: dos partidos locales pueden emparejar el mismo de Explorer, y sin `canonicalCompetitionId` puede cruzar competiciones. El control es la revisión línea a línea del dry-run.
- **R-3** Un partido `postponed`/`suspended` que Explorer dé `FINISHED` se cierra `operator · confirmado`; un `FINISHED 0-0` borra los goles guardados (suma = 0). Buscar `postponed →`, `suspended →` y `goles n → 0` en el dry-run.
- **R-4** Cada re-ejecución añade un intento y un crudo por fecha (S-1); `informe:*`/`salud` aún no separan `operator` (F-SPEC-060-3).

## Rebase sobre `main` (2026-11-10) — SPEC-070, SPEC-071 y SPEC-068

La rama partía de `6148242`; `main` había reescrito el emparejamiento de `historico:sync` (SPEC-070: identidad por alias rfef; SPEC-071: ventana ±3, un GET por día) y el marcado de goles de `MatchRow` (SPEC-068). Fusión a mano: la escritura de esta spec (operador → motor, crudo, intento, fallos) con el emparejamiento de `main`.

- **Plan.** `planDaySync(fecha, locales, filas | filas por día, alias)` → un `MatchPlan` por partido: `unpaired` (con motivo `no_identity`/`no_competition_rows`), `ambiguous` (candidatas), `not-finished` y `finished` (con `rowDate`). `isMatchEqual` (subcadena de slug, primera que encaja) deja de usarse aquí: **cierra R-2**.
- **Crudo.** Una captura por fecha con las siete peticiones de su ventana; cada día se pide una vez por ejecución (caché por ejecución).
- **CA-5 afinado.** La fecha falla si su propio día viene vacío y ninguno de sus partidos se emparejó en la ventana (Explorer no dijo nada); un día vacío cuyos partidos se jugaron en un día vecino no falla. Un 401/403 corta la ventana en el acto.
- **Informe.** Añade ambiguos y emparejados (línea de SPEC-070 CA-7, `fecha → fecha de la fila`) y el nº en otro día.
- **ADR.** El ADR-031 de esta rama pasa a **ADR-033** (`main` ya tenía ADR-031 calendario y ADR-032 alertas). Sin cambio de decisión.
- **E2e CA-6** reescrito para SPEC-068: `team-goals` por equipo, `data-expanded` en la fila, `goal-player`/`goal-minute`/`goal-kind`.
- **Social.** El motor de la recuperación no encola en `social_posts` (ADR-030 §1); el test db lo afirma.

| # | Comando | Salida clave |
| :--- | :--- | :--- |
| R-E1 | `npm run typecheck` · `npm run lint` · `npm run build` | limpio · `Checked 445 files … No fixes applied` · build completo |
| R-E2 | `npx vitest run` | `2 failed \| 2636 passed`: `src/db/test-db.test.ts` (Windows, F-SPEC-060-4) y `src/sources/rfef/explorer.test.ts` SPEC-069 CA-2, que falla igual en `origin/main` desde `cdaad54` (el bot del calendario movió Las Palmas–Eldense y el test lee `data/calendario`) |
| R-E3 | `historico.test.ts` + `explorer-emparejamiento.test.ts` | `46 passed`, con los tests de SPEC-070 CA-7 y SPEC-071 CA-1..CA-4 portados y CA-5 (día vacío, 401 en la ventana) nuevos |
| R-E4 | `npm run test:db` con la BD local reseteada (`db reset --local` + competiciones), `origin/main` y la rama | `main`: 23 fallos; rama: 24 = los mismos 23 + `informe.db.test` «dos partidos en board…», flaky en ambos (aislado: `main` 2/3 rojo, rama 1/3). `historico.db.test.ts` 7/7 y `schema.db.test.ts` verdes. **Sin fallos nuevos** (CA-7) |
| R-E5 | `playwright test --config playwright.db.config.ts e2e/xornada-goleadores-historico.db.spec.ts` | `1 passed`; el teardown falla en Windows (F-SPEC-060-4) y se hizo a mano |
| R-E6 | `package.json` | `0.5.7` → `0.5.8` (patch, ADR-028) |

Pendiente antes de la ejecución real: **dry-run contra prod** con el emparejamiento nuevo (los números de E-8 son de antes del rebase) y revisión de R-1 y R-3.

