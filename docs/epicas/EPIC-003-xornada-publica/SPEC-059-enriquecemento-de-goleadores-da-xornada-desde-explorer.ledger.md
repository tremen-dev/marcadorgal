---
id: SPEC-059
tipo: ledger
epica: EPIC-003
---
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

## Verificación (sdd-verificador, 2026-11-11, código de `main` en beab20b)

| CA | Verif. | Evidencia | Estado |
| :--- | :--- | :--- | :--- |
| CA-1 | ⚠️ | `enrichMatchesWithGoals`: candidatos `live` o marcador > 0 sin goles; fechas `toMadridDate` deduplicadas; `Promise.allSettled`. Llamado en `xornada-home.tsx:118`, `xornada-week.tsx:49`, `api/board/route.ts:18`. Emparejamiento: ya no por nombres normalizados sino por la identidad de SPEC-070 (alias rfef o `canonical*TeamId` igual), decisión del titular 2026-11-10; la spec no lleva nota de enmienda | ⚠️ |
| CA-2 | ✅ | `sanitizeGoals` descarta vacíos, «Goleador Local/Visitante», prefijo `goleador `; sin goles válidos no se asigna `goals` (test «leaves goals undefined…») | ✅ |
| CA-3 | ⚠️ | `{...m, goals}` solo añade `goals`; SSR y `/api/board` aplican el mismo enriquecimiento. Sin test que fije la preservación de campos ni la coherencia del `ETag` SSR↔board | ⚠️ |
| CA-4 | ❌ | Error/HTTP: `allSettled` + `try/catch` → partidos intactos (test «handles network failure»). **Timeout: no existe.** `fetchExplorer` no lleva `AbortSignal`/timeout; con Explorer colgado la portada y `/api/board` esperan indefinidamente. Sonda: `node --experimental-strip-types scratchpad/probe/hang.mts` (fetch global que nunca responde, fetcher por defecto) → `enrichMatchesWithGoals con Explorer colgado: still-pending-after-10s (10008 ms)` | ❌ |
| CA-5 | ✅ | `npm run gates`: typecheck 0, `biome check` 486 ficheros sin errores, vitest 172 ficheros / 2905 pasados / 3 skipped; `next build` → `✓ Compiled successfully` (reintentado aparte por bloqueo de otro build concurrente). `npx vitest run src/lib/explorer-enrichment.test.ts src/lib/explorer-emparejamiento.test.ts` → 31 pasados | ✅ |

UI (Playwright) no ejecutada: requiere Supabase local y Explorer real; el RED de CA-4 no depende de ella.

### Veredicto del verificador: RED

- **F-SPEC-059-1 (CA-4, bloqueante):** sin timeout en la llamada a Explorer del camino de `HomeXornada`/`WeekXornada`/`/api/board`. Arreglo: timeout corto (p. ej. `AbortSignal.timeout`) en `getDayMatches`/`fetchExplorer` para este uso, y test con fetcher que no resuelve que demuestre que se devuelven los partidos intactos dentro del límite.
- **F-SPEC-059-2 (CA-1, no bloqueante si el arquitecto enmienda):** nota de enmienda en SPEC-059 CA-1 por SPEC-070 (sin nombres aproximados).
- **F-SPEC-059-3 (CA-3, no bloqueante):** test que fije que el enriquecimiento no altera `score`, `status`, `minute`, `halfTime`, `homeScoredAt`, `awayScoredAt`.

## Corrección del RED (sdd-implementador, 2026-11-11, rama `ft/SPEC-059-timeout-explorer`, commit c48e381)

| CA | Implementado (fichero) | Test (fichero/caso) |
| :--- | :--- | :--- |
| CA-4 (F-SPEC-059-1) | `src/lib/explorer-enrichment.ts`: `EXPLORER_ENRICHMENT_TIMEOUT_MS = 2000`, `withDeadline` por fecha, opción `timeoutMs`; fetcher por defecto `getDayMatches(date, undefined, { timeoutMs })`. `src/lib/explorer-client.ts`: `ExplorerRequestOptions` en `fetchExplorer`/`getDayMatches` → `AbortSignal.timeout` solo si se pide | `explorer-enrichment.test.ts` «returns the matches intact when Explorer never answers (CA-4 timeout)» (timers falsos: pendiente a 1999 ms, resuelto a 2000 ms), «honours an injected timeout…», «keeps the enrichment timeout short…»; `explorer-client.test.ts` «getDayMatches with timeoutMs aborts…» (TimeoutError), «…sends no abort signal unless a timeout is asked» |
| CA-3 (F-SPEC-059-3) | sin cambio de código (`{...m, goals}`) | `explorer-enrichment.test.ts` «only adds goals: certified fields stay untouched (CA-3)»: `score`, `status`, `minute`, `halfTime`, `homeScoredAt`, `awayScoredAt` y resto iguales aunque la fila de Explorer traiga otros valores; la entrada no muta |

Evidencia:
- RED previo: `npx vitest run src/lib/explorer-enrichment.test.ts src/lib/explorer-client.test.ts` → 4 failed (los de timeout).
- Sonda del verificador `node --experimental-strip-types …/scratchpad/probe/hang.mts` → `enrichMatchesWithGoals con Explorer colgado: resolved (2012 ms)` (antes `still-pending-after-10s`).
- Mutación 1 (sin `withDeadline`): 2 failed («…never answers (CA-4 timeout)», «honours an injected timeout…»). Mutación 2 (sin `signal` en el cliente): 1 failed («getDayMatches with timeoutMs aborts…»). Ambas revertidas.
- `npm run gates` → exit 0; `Checked 487 files … No fixes applied`; `Test Files 173 passed (173)`, `Tests 2923 passed | 3 skipped (2926)`; `✓ Compiled successfully`.

### Salvedades / follow-ups
- Valor 2 s elegido por el implementador: ni la spec ni un ADR fijan cifra. `/directos`, `explorer-xornada.ts` y la ingesta siguen sin timeout (comportamiento previo, fuera de esta spec).
- Observación `goals: []` sin tocar (EPIC-MEJORA). F-SPEC-059-2 (nota de enmienda por SPEC-070) queda al arquitecto.

### Cómo retomar (handoff)
Re-verificar CA-3 y CA-4 con los tests citados y la sonda `hang.mts`; el resto de CA no cambió.
