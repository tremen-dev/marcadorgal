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

## Enmienda 2026-11-09 (ADR-031) — matriz CA-1..CA-7

La tabla de arriba es la de la versión anterior (CA-1..CA-5) con el RED. Esta es la de la spec enmendada; Verif. y Estado son del verificador.

| Criterio | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
| :--- | :--- | :--- | :--- | :--- |
| CA-1 `match_goals` | migración `20261108120000_spec060_match_goals.sql` (sin cambios) | `src/db/schema.db.test.ts` «has the eleven tables…» y «enables RLS on every table…» (V-1) | | |
| CA-2 Corrección por el motor | `src/ingest/historico.ts` (`parseHistoricoArgs`, `planDaySync`), `src/ingest/historico-db.ts` (`historicoSync`, `applyDate`), `src/lib/explorer-client.ts` (`getDayMatchesRaw`), `tools/historico-sync.mjs` | `historico.db.test.ts` «finished 1-1 + Explorer FINISHED 2-1 → v2…; again, 0 rows», «a match with no Decision…»; `historico.test.ts` parseHistoricoArgs, planDaySync, «no INSERT into decisions from the tool»; `explorer-client.test.ts` getDayMatchesRaw | | |
| CA-3 Goleadores | `historico.ts` (`completeGoals`, `replaceGoals`), `historico-db.ts` (`applyDate`) | `historico.db.test.ts` «LIVE_PROVISIONAL with goals: [] and FINISHED 1-0 without goals keep the stored goals»; `historico.test.ts` completeGoals y planDaySync | | |
| CA-4 Dry-run revisable | `historico.ts` (`formatHistoricoReport`), `historico-db.ts` (`dryDate`) | `historico.test.ts` «prints one line per match with a change…»; `historico.db.test.ts` «0 rows in every table, nothing in the raw store…» | | |
| CA-5 Fallos visibles | `historico.ts` (`parseExplorerDay`, `isAuthFailure`, `historicoFailed`), `historico-db.ts` (`realDate`, `AuthAbort`), `tools/historico-sync.mjs` (exit) | `historico.db.test.ts` «a 401 aborts in the act…», «an empty date fails…», «an invalid answer…»; `historico.test.ts` historicoFailed | | |
| CA-6 Lectura pública | sin cambios de código: `web.xornada.goals` → `src/board/row.ts` → `MatchRow` | `e2e/xornada-goleadores-historico.db.spec.ts` | | |
| CA-7 Gates | toda la rama | `npm run gates`, suite db (ver abajo) | | |

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

- **F-SPEC-060-1** «Una segunda ejecución igual escribe 0 filas» (CA-2): interpretado como 0 filas en `observations`, `decisions`, `match_goals` y `alerts`. Cada fecha consultada abre su `ingest_attempt` (ADR-031 §4) y guarda su crudo, también en la segunda ejecución; el test lo afirma (`ingest_attempts + 1`).
- **F-SPEC-060-2** La línea de cambio de CA-4 añade « (incompletos)» tras `goles <n> → <n>` cuando los goles de Explorer no suman el marcador, para que no parezca que se van a escribir.
- **F-SPEC-060-3** `informe:*`/`salud` aún no tratan las filas `operator` (follow-up de ADR-031, fuera de alcance).
- **F-SPEC-060-4** `e2e/db-teardown.ts` y `tools/test-db.mjs` fallan en Windows por `spawnSync` sin shell (ajeno; ya conocido).
- La herramienta comprueba que el motor publica una Decision por cada observación del operador; si no, deshace la fecha (fallo visible).

### Cómo retomar (handoff)

Código: `src/ingest/historico.ts` (puro), `src/ingest/historico-db.ts` (BD), `tools/historico-sync.mjs` (shell). Verificar con la suite db contra Supabase local (comando de arriba) y el spec e2e:db. La ejecución real contra producción la lanza el titular, solo tras revisar `npm run historico:sync -- --dry-run`.
