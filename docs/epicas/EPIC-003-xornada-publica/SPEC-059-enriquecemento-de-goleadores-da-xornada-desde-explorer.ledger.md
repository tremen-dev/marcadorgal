# Ledger de SPEC-059 — Enriquecemento de goleadores da xornada pública desde Explorer

Criterios de aceptación e evidencia de verificación de SPEC-059.

| Criterio | Módulos afectados | Probas | Estado |
| :--- | :--- | :--- | :--- |
| CA-1 Reconciliación e enriquecemento de goles | `src/lib/explorer-enrichment.ts` | `src/lib/explorer-enrichment.test.ts` (15 probas) | ✅ Feito |
| CA-2 Filtrado defensivo de placeholders | `src/lib/explorer-enrichment.ts` | `src/lib/explorer-enrichment.test.ts` | ✅ Feito |
| CA-3 Preservación do modelo, estado SSR e `/api/board` | `src/app/xornada-home.tsx`, `src/app/xornada-week.tsx`, `src/app/api/board/route.ts` | `npm run test` (139 suites, 2152 probas) | ✅ Feito |
| CA-4 Resiliencia e fallbacks | `src/lib/explorer-enrichment.ts` | `src/lib/explorer-enrichment.test.ts` | ✅ Feito |
| CA-5 Calidade, probas e gates | Suite completa (`npm run gates`) | Biome (0 erros), TypeScript (0 erros), Vitest (2152 pasados) | ✅ Feito |

## Evidencia de Verificación

### CA-1, CA-2 e CA-4: Reconciliación, filtrado e resiliencia
- Ficheiro `src/lib/explorer-enrichment.ts` implementa:
  - `toMadridDate`: converte o `kickoff` UTC de cada partido á data `YYYY-MM-DD` en zona horaria `Europe/Madrid` antes de consultar Explorer.
  - `enrichMatchesWithGoals`: deducción de datas con goles da xornada, consulta en paralelo con `Promise.allSettled(dates.map(fetcher))`, cruzamento por `canonicalHomeTeamId`/`canonicalAwayTeamId` ou nomes de equipo tolerantes a ruído (CF, CD, Club de Fútbol). Respecta os goles xa presentes en `public.match_goals` (`m.goals.length > 0`).
  - `sanitizeGoals`: desbota placeholders sintéticos (`"Goleador Local"`, `"Goleador Visitante"`, `"Goleador 1"`, nomes baleiros), asegura minutos positivos e ordena cronoloxicamente.
  - Se Explorer falla (erro de rede, 5xx, timeout), captúrase sen lanzar excepcións e devólvense os partidos intactos.
- `src/lib/explorer-enrichment.test.ts`: 15 tests unitarios en verde.

### CA-3: Integración en HomeXornada, WeekXornada e `/api/board`
- `src/app/xornada-home.tsx`: enriquecemento previo dos partidos de Postgres antes de engadir a liga feminina, garantindo que tódolos partidos masculinos reciban o array `goals` para habilitar o acordeón de SPEC-056.
- `src/app/api/board/route.ts`: aplica `enrichMatchesWithGoals` sobre as filas de `web.xornada` antes de construír o snapshot de `/api/board`, evitando que o refresco periódico do cliente cada 30s sobrescriba o estado inicial sen goleadores e mantendo o `ETag` consistente con `HomeXornada`.
- `src/app/xornada-week.tsx`: aplica `enrichMatchesWithGoals` en vistas de xornadas pasadas cando se le de `web.xornada` en vivo.

### CA-5: Gates de Calidade
- `npm run lint` (`biome check .`): 0 erros.
- `npm run typecheck` (`tsc --noEmit`): 0 erros.
- `npm run test` (`vitest run`): 141 ficheiros de test, 2268 pasados, 0 fallos.
- `next build`: compilado con éxito en 11.2s sen erros de páxinas estáticas ou SSR.
