# Ledger de SPEC-060 — Ingesta histórica de resultados y goleadores desde la jornada inicial hasta la actual

Criterios de aceptación y evidencia de verificación de SPEC-060.

| Criterio | Módulos afectados | Pruebas | Estado |
| :--- | :--- | :--- | :--- |
| CA-1 Modelo y persistencia relacional de eventos de gol | `supabase/migrations/20261108120000_spec060_match_goals.sql`, `src/board/row.ts` | `src/db/web.db.test.ts` (67 tests), `src/board/row.test.ts` | ✅ Verificado |
| CA-2 Herramienta de ingesta histórica | `tools/historico-sync.mjs`, `src/ingest/historico.ts`, `src/ingest/historico-db.ts` | `src/ingest/historico.test.ts`, `src/ingest/historico.db.test.ts` | ✅ Verificado |
| CA-3 Integración en la lectura pública histórica | `src/board/week-read.ts`, `src/board/row.ts`, `src/app/xornada-week.tsx` | `src/board/week-read.test.ts`, `src/board/row.test.ts` | ✅ Verificado |
| CA-4 Idempotencia y trazabilidad | `tools/historico-sync.mjs`, `src/ingest/historico-db.ts` | `src/ingest/historico.test.ts`, `src/ingest/historico.db.test.ts` | ✅ Verificado |
| CA-5 Calidad, pruebas y gates | Suite completa (`npm run gates`) | `typecheck`, `lint`, 142 suites vitest (2.282 tests) e `next build` 100% en verde | ✅ Verificado |

## Evidencia de Verificación

- **CA-1 Modelo e persistencia relacional:**
  - Creada a migración `supabase/migrations/20261108120000_spec060_match_goals.sql` que crea `public.match_goals` con clave primaria UUID, `match_id` referenciando `matches`, `team` (`home`\|`away`), `player`, `minute`, `penalty`, `own_goal`, índice composto `(match_id, minute asc)` e RLS activado.
  - Actualizada a vista `web.xornada` engadindo `goals` como 24.ª columna mediante agregación JSON ordenada cronoloxicamente.
  - Verificado en `src/db/web.db.test.ts` que `web_reader` le os goles a través de `web.xornada` mantendo a barreira arquitectónica de ADR-014 e ADR-015 (sen permisos directos en táboas internas).
- **CA-2 Ferramenta de ingesta histórica:**
  - Creado `src/ingest/historico.ts`, `src/ingest/historico-db.ts` e `tools/historico-sync.mjs`.
  - Script rexistrado en `package.json` baixo `npm run historico:sync`.
  - Soporta `--desde`, `--hasta` (por defecto `2026-08-14` ata hoxe) e `--dry-run`.
  - Execución en seco verificada localmente contra 552 partidos disputados en 60 datas.
- **CA-3 Integración na lectura pública histórica:**
  - `src/board/row.ts` mapea `goals` en `PublicMatch`.
  - `src/board/week-read.ts` e `WeekXornada` preservan e transmiten os goles leídos de `web.xornada`, habilitando o acordeón interactivo de `MatchRow.tsx` (SPEC-056).
- **CA-4 Idempotencia e trazabilidade:**
  - Re-execución demostrada en `src/ingest/historico.db.test.ts`: non xera decisións redundantes para partidos xa consolidados co mesmo marcador nin duplica goles en `match_goals`.
  - Modo `--dry-run` desglosa estatísticas por competición sen tocar a base de datos.
- **CA-5 Gates:**
  - `npm run gates` 100% en verde (typecheck limpo, biome lint sen erros, 2.282 tests unitarios e de base de datos pasando, Next.js build optimizado).
