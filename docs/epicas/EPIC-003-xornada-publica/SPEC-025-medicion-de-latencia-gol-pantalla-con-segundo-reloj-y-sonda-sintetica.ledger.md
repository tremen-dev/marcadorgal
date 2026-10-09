---
id: SPEC-025
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-025 Medición de latencia gol → pantalla con segundo reloj y sonda sintética

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-025-medicion-de-latencia-gol-pantalla-con-segundo-reloj-y-sonda-sintetica`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `supabase/migrations/20261009180000_spec025_second_clock.sql` (`add column` sin default, luego `set default clock_timestamp()`; código desplegado no las nombra) | `src/medicion/second-clock.db.test.ts` (filas previas `null` tras aplicar la migración en rollback; intento por `createIngestDb.openAttempt` y Decision por `insertDecision` sellados, `recorded_at ≥ opened_at`; columnas nulables con default; ni en `web.xornada`/`board` ni en `to_jsonb` de board_delta); `src/medicion/latencia-db.db.test.ts` «storage.objects.created_at is Postgres's clock» | | ❌ |
| CA-2 | `src/sources/api-football/events.ts` (`goalEvents`, `goalReferences`; solo importa `src/model`) | `src/sources/api-football/events.test.ts` (live-2026-09-26.json: Cultural 17'/31' con intervalo, Granada sin `periods` → motivo; tabla 1', 45', 45+3, 46', 57', 90+4, sin `second`, sin `periods`, prórroga, Missed Penalty fuera y orden; 247 capturas de Girona-Albacete); `src/medicion/informe-latencia.test.ts` «referenciasDe»; `latencia.test.ts` «rawRefsDeReferencia» | | ❌ |
| CA-3 | `src/xornada/view.ts` (`version`), `src/components/xornada/MatchRow.tsx` (`data-version`), `tools/sonda-pantalla.mjs`, `src/medicion/sonda.ts`, `.github/workflows/sonda-pantalla.yml` | `src/xornada/view.test.ts` «SPEC-025 CA-3»; `e2e/xornada-live.spec.ts` «SPEC-025 CA-3» (2 → 6 al llegar la Decision); `src/medicion/sonda.test.ts` (fixture `src/medicion/fixtures/sonda-2026-10-17.jsonl`); `src/medicion/sonda-workflow.test.ts` (schedule + dispatch `horas`, cron solo 16-19/10, ≤ 5,5 h, `timeout-minutes` ≤ 360, sin `secrets.`, artefacto `if: always()`) | | ❌ |
| CA-4 | `src/medicion/latencia.ts` (puro), `src/medicion/latencia-db.ts` (lecturas) | `src/medicion/latencia.test.ts` (un gol por tramo a-e, CDN/espera, residuo, juntas; anulado por bajada, sin pintura, sin referencia, sin Decision, anterior a la sonda, sin Age; pureza); `src/medicion/latencia-db.db.test.ts` | | ❌ |
| CA-5 | `src/medicion/informe-latencia.ts`, `src/medicion/generar-informe.ts`, `tools/informe-latencia.mjs`, `package.json` (`informe:latencia`) | `src/medicion/informe-latencia.test.ts` (Informe sembrado: n, tramos, peor caso n<20, calibración, escenarios con sus fórmulas, peticiones ×2, veredicto, CSV); `src/medicion/generar-informe.db.test.ts` (de punta a punta con rollback y crudo del repo en memoria) | | ❌ |
| CA-6 | n-a hasta la jornada 2026-10-16/19 (procedimiento en «Cómo retomar») | — | | ❌ |
| CA-7 | sin dependencias nuevas; `git diff $(git merge-base HEAD origin/main) --stat -- src/decide src/ingest src/model` vacío | gates, `e2e`, `e2e:db`, `test:db` (abajo); ningún test pide a la red (fixtures del repo, `RawStore` en memoria, Storage local) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-025/. Informe HTML opcional: _qa/SPEC-025/informe.html -->

## Evidencia del implementador (2026-10-09, local)
| Comando | Salida |
|---|---|
| `DATABASE_URL_PUBLIC="" npm run gates` | exit 0; 79 ficheros, 1343 tests; build ok (1 aviso de Biome previo en `src/arch/deploy.test.ts`) |
| `npm run e2e` | 91 passed |
| `DATABASE_URL=<local> npm run e2e:db` | 14 passed, 1 skipped |
| `DATABASE_URL=<local> npm run test:db` (tras el reset de e2e:db) | 20 ficheros, 189 passed |
| `supabase db push` local, luego `select count(*), count(recorded_at) from decisions` | 9 / 0: las filas previas quedan `null` |
| storage-api local v1.72.1, `pg.js upsertObject` | inserta sin `created_at` → default `now()` (reloj de Postgres); test de horquilla con `clock_timestamp()` verde |
| `tools/sonda-pantalla.mjs --horas 0.042 --url http://localhost:3120` (next start local, polling, BD local) + Decision local v2 a las 20:04:49.717Z | 117 líneas, 0 ilegibles, 0 no visibles; pintura v2 en `/es` 20:05:08.440Z y `/` 20:05:11.434Z |
| `informe:latencia` sobre ese JSONL y la BD local | (d) entrega 18,7 s (n=1); base ↔ sonda 0,43 s (n=9); 0 crudos, 0 peticiones al proveedor |

## Salvedades / follow-ups
- **F-SPEC-025-1 (referencia, H-1).** En el crudo guardado Segunda (liga 141) trae `fixture.periods` nulo en vivo (Granada-Andorra en `live-2026-09-26.json`; las 247 capturas de Girona-Albacete): sus goles quedan «referencia sin intervalo: no_periods» y su total solo sale de la calibración manual. Las ligas 435/875/439 sí traen `periods.first`. Destino: el titular con el informe; si hace falta, spec futura (p. ej. inicio de parte = primera captura en `1H`/`2H`).
- **F-SPEC-025-2 (tramos b/c).** `storage.objects.created_at` es `now()` de la transacción de la Storage API, no `clock_timestamp()`: si la API abre la transacción antes de subir los bytes, (b) se acorta y (c) se alarga en lo que tarde la subida. Comprobado en local (v1.72.1); en producción no.
- **F-SPEC-025-3 (workflow).** Los cron son de día y mes (se repiten cada año) y `schedule` solo corre desde `main`: hay que fusionar antes del vie 2026-10-16 18:00Z y cambiarlos o quitarlos tras la jornada (N-2: se repiten en la jornada publicada).
- **F-SPEC-025-4 (ajeno).** `test:db` sobre una BD local con el calendario ya cargado por la semilla de e2e:db falla en `src/ingest/reconciliacion-sin-directo.db.test.ts` (`matches_pkey`: inserta ids reales del calendario). Tras el reset de e2e:db, 189/189. Preexistente.
- **F-SPEC-025-5 (CA-1/CA-7, letra).** El `main` local está atrasado (`a4890b4`): `git diff main` literal enseña ruido; contra `origin/main` (base `9f4fbd0`) `src/model`, `src/decide`, `src/ingest` no cambian.
- **N (D-9).** La junta base ↔ sonda usa la cabecera `Date` de Vercel, no el reloj de Postgres; el desfase Vercel ↔ Postgres se supone NTP y no se mide.

## Cómo retomar (handoff)
Hecho CA-1..CA-5 y CA-7 en la rama (8 commits sobre `9f4fbd0`); falta CA-6, que es de campo. Procedimiento del titular:
1. **Migración** (aditiva y compatible: el código desplegado y el nuevo no nombran las columnas; vistas con columnas fijas). Da igual antes o después del merge; **aplicarla antes del vie 2026-10-16 18:00Z**, o las filas de la jornada quedan `null` y no hay (b)/(c). `supabase migration list` (solo `20261009180000` pendiente) → `npm run db:push`. Comprobar: `column_default = clock_timestamp()` en `ingest_attempts.opened_at` y `decisions.recorded_at`, y tras un tick `count(opened_at) > 0` en los intentos de los últimos 5 min.
2. **Merge** a `main` antes del vie 2026-10-16 18:00Z (el `schedule` solo corre desde `main`). Sin secretos nuevos: el workflow solo lee `https://marcador.gal`.
3. **Jornada 2026-10-16/19**: los 7 cron (UTC) de `sonda-pantalla.yml` lanzan la sonda solos: vie 18:00 (3,25 h); sáb 10:30 y 15:45 (5,5 h); dom 09:30, 14:30 (5,5 h) y 18:00 (3,25 h); lun 18:00 (3,25 h). GitHub retrasa los cron: si un bloque no arrancó, `gh workflow run sonda-pantalla.yml --ref main -f horas=<≤ 5.5>`. Mirar que cada run sube su `sonda-*.jsonl` y que `visibilidad` dice `visible`.
4. **Calibración (H-1)**: ≥ 8 goles, ≥ 3 de Primera o Segunda, con la radio FM en directo del propio partido y el reloj del móvil sincronizado. CSV `matchId,gol,instante,nota`: `matchId` el de `data-match-id` (o `data/calendario`), `gol` = k-ésimo gol del partido contando ambos equipos, `instante` ISO UTC con `Z` al segundo (octubre: Madrid − 2 h).
5. **Informe** (antes de 30 días: retención del crudo y de los artefactos): `gh run download --pattern 'sonda-*' -D sondas/` y `npm run informe:latencia -- 2026-10-16T18:20Z 2026-10-19T21:30Z --sonda sondas/*/*.jsonl --calibracion calibracion.csv` (con el `.env`: solo lecturas de la BD y `GET` del crudo a Storage; ninguna petición al proveedor) → `_qa/SPEC-025/latencia-2026-10-16.md`. Al ledger: mediana, p95/peor caso con n, tramos, juntas, escenarios y veredicto por objetivo (CA-6, H-4).
