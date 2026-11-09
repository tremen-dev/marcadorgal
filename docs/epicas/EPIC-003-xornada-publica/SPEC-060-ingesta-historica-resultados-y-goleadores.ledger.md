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
