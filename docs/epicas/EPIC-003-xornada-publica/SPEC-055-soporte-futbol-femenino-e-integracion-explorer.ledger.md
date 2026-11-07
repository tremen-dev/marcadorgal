---
id: SPEC-055
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-055 Soporte de Fútbol Femenino e integración con API Explorer v2.0

## Resumen
- Fase: completada
- Rama: `main`

## Matriz de criterios de aceptación
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/model/competitions.ts` (esquema Zod, metadatos, categorías) | `src/model/competitions.test.ts` | 2026-11-07 | ✅ |
| CA-2 | `src/model/clubs.ts`, `public/escudos/` (`depor-abanca`, `as-celtas`) | `src/model/clubs.test.ts` | 2026-11-07 | ✅ |
| CA-3 | `src/model/public.ts`, `src/components/xornada/MatchRow.tsx`, `src/components/directos/DirectosView.tsx` | `src/components/xornada/goals.test.ts`, `src/lib/explorer-matches.test.ts` | 2026-11-07 | ✅ |
| CA-4 | `src/components/navigation/CompetitionNav.tsx`, `src/app/competition-page.tsx`, `src/app/(gl)/`, `src/app/(es)/` | `src/components/navigation/CompetitionNav.test.ts`, `src/components/competition/StandingsTable.test.ts`, `src/components/competition/CalendarView.test.ts`, `src/components/directos/DirectosView.test.ts` | 2026-11-07 | ✅ |
| CA-5 | `src/sources/rfef/calendar.ts` | `src/sources/rfef/calendar.test.ts` | 2026-11-07 | ✅ |
| CA-6 | Gates completos (`npm run gates`: typecheck, lint, test, build) | CI local | 2026-11-07 | ✅ |
