# Ledger de SPEC-059 — Enriquecemento de goleadores da xornada pública desde Explorer

Criterios de aceptación e evidencia de verificación de SPEC-059.

| Criterio | Módulos afectados | Probas | Estado |
| :--- | :--- | :--- | :--- |
| CA-1 Reconciliación e enriquecemento de goles | `src/lib/explorer-enrichment.ts` | `src/lib/explorer-enrichment.test.ts` (14 probas) | ✅ Feito |
| CA-2 Filtrado defensivo de placeholders | `src/lib/explorer-enrichment.ts` | `src/lib/explorer-enrichment.test.ts` | ✅ Feito |
| CA-3 Preservación do modelo e estado SSR | `src/app/xornada-home.tsx` | `npm run test` (141 suites, 2268 probas) | ✅ Feito |
| CA-4 Resiliencia e fallbacks | `src/lib/explorer-enrichment.ts` | `src/lib/explorer-enrichment.test.ts` | ✅ Feito |
| CA-5 Calidade, probas e gates | Suite completa (`npm run gates`) | Biome (0 erros), TypeScript (0 erros), Vitest (2268 pasados), Next.js build (11.2s) | ✅ Feito |

## Evidencia de Verificación

### CA-1, CA-2 e CA-4: Reconciliación, filtrado e resiliencia
- Ficheiro `src/lib/explorer-enrichment.ts` implementa:
  - `enrichMatchesWithGoals`: deducción de datas con goles da xornada, consulta en paralelo con `Promise.allSettled(dates.map(fetcher))`, cruzamento por `canonicalHomeTeamId`/`canonicalAwayTeamId` ou nomes de equipo tolerantes a ruído (CF, CD, Club de Fútbol).
  - `sanitizeGoals`: desbota placeholders sintéticos (`"Goleador Local"`, `"Goleador Visitante"`, `"Goleador 1"`, nomes baleiros), asegura minutos positivos e ordena cronoloxicamente.
  - Se Explorer falla (erro de rede, 5xx, timeout), captúrase sen lanzar excepcións e devólvense os partidos intactos.
- `src/lib/explorer-enrichment.test.ts`: 14 tests unitarios en verde en 12ms.

### CA-3: Integración en HomeXornada
- `src/app/xornada-home.tsx`: enriquecemento previo dos partidos de Postgres antes de engadir a liga feminina, garantindo que tódolos partidos masculinos reciban o array `goals` para habilitar o acordeón de SPEC-056.

### CA-5: Gates de Calidade
- `npm run lint` (`biome check .`): 0 erros.
- `npm run typecheck` (`tsc --noEmit`): 0 erros.
- `npm run test` (`vitest run`): 141 ficheiros de test, 2268 pasados, 0 fallos.
- `next build`: compilado con éxito en 11.2s sen erros de páxinas estáticas ou SSR.
