---
id: SPEC-059
tipo: spec
epica: EPIC-003
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-08, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-08, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-08, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-08, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-11-11, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-11-11, por: sdd-implementador}
---
# SPEC-059 — Enriquecemento de goleadores da xornada pública desde Explorer

## Contexto e Problema
Na SPEC-056 completouse a interface interactiva desplegable de goleadores por equipo (`MatchRow.tsx`). Non obstante, no dashboard principal (`/` e `/es`, `HomeXornada`), os partidos masculinos lense da vista PostgreSQL `web.xornada`, a cal non almacena eventos de gol (`goals: undefined`).

Actualmente só os partidos femininos (`fetchWomenXornadaMatches`) integraban goles desde Explorer. Como resultado, na versión despregada en produción, ningún partido masculino (Primeira, Segunda, Primeira RFEF, etc.) posúe o array `goals`, polo que os partidos con goles non responden ao clic/tap. Ademais, cómpre filtrar de maneira defensiva calquera placeholder sintético legado de Explorer (`"Goleador Local"`, `"Goleador Visitante"`) para garantir que só se amosen autores reais e minutos válidos.

## Usuarios e roles afectados
- Afición e usuarios de `marcador.gal` (en galego e castelán, móbil e escritorio): ao consultar a xornada na portada, poden pulsar sobre calquera partido con goles (masculino ou feminino) e ver os autores e minutos reais.

## Criterios de aceptación
- **CA-1 Reconciliación e enriquecemento de goles desde Explorer.**
  - `HomeXornada`, `WeekXornada` e `/api/board` (a través do módulo `src/lib/explorer-enrichment.ts`) enriquecen os partidos de `read.matches` que aínda non teñan goles en `public.match_goals` cos goles procedentes de `getDayMatches(date)` de Explorer.
  - As datas a consultar dedúcense en zona horaria `Europe/Madrid` (`toMadridDate(m.kickoff)`) do conxunto de partidos da xornada que teñan goles (`score.home > 0 || score.away > 0`) ou estean en directo, consultándose en paralelo con `Promise.allSettled`.
  - A correlación entre os partidos de Postgres e os de Explorer realízase por `canonicalHomeTeamId` e `canonicalAwayTeamId`, ou por coincidencia normalizada de nomes de equipo.
- **CA-2 Filtrado defensivo de autores sintéticos e placeholders.**
  - Desbótanse do conxunto de goles aqueles rexistros cuxo nome de xogador estea baleiro ou conteña placeholders sintéticos (`"Goleador Local"`, `"Goleador Visitante"`, ou empede con `"Goleador "`).
  - Se tras o filtrado un partido non posúe ningún gol válido, o campo `goals` establécese en `undefined` (para evitar presentar afordance interactivo sen datos).
- **CA-3 Preservación do modelo, estado SSR e polling `/api/board`.**
  - O enriquecemento engade unicamente a propiedade `goals: Array<GoalEvent>` a cada `PublicMatch`, mantendo intactos o resto de campos certificados (`score`, `status`, `minute`, `halfTime`, `homeScoredAt`, `awayScoredAt`).
  - Compatible co cliente de Realtime e co polling de `/api/board` cada 30s (mantendo o `ETag` consistente entre SSR e `/api/board` sen perder os goleadores tras o primeiro refresco).
- **CA-4 Resiliencia e fallbacks.**
  - Se a consulta a Explorer falla por rede, timeout ou erro HTTP (4xx, 5xx), a portada renderízase con normalidade cos partidos da base de datos sen romper nin degradar o tempo de resposta.
- **CA-5 Calidade, probas e gates.**
  - Suite unitaria dedicada en `src/lib/explorer-enrichment.test.ts`.
  - `npm run gates` (typecheck, lint, vitest e build de produción) 100% en verde.

## Ficheiros afectados
- `src/lib/explorer-enrichment.ts` (módulo de reconciliación e conversión `toMadridDate`)
- `src/lib/explorer-enrichment.test.ts` (suite de tests unitarios)
- `src/app/xornada-home.tsx` (invocación do enriquecemento en `HomeXornada`)
- `src/app/xornada-week.tsx` (invocación do enriquecemento en `WeekXornada`)
- `src/app/api/board/route.ts` (invocación do enriquecemento en `/api/board`)
- `docs/epicas/EPIC-003-xornada-publica/SPEC-059-enriquecemento-de-goleadores-da-xornada-desde-explorer.ledger.md`
