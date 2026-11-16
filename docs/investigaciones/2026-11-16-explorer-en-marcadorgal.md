# Explorer en marcadorgal: hallazgos y cambios propuestos

Fecha: 2026-11-16. Análisis de solo lectura hecho por un subagente sobre el
código de marcadorgal (y comprobaciones puntuales en marcadorgal-explorer).
Los hallazgos 1 y 2 se comprobaron además a mano en el código. Las líneas
citadas corresponden al commit `efc1ff4`.

## Contexto: de dónde sale cada dato

| Qué | De dónde viene |
|---|---|
| Marcador y estado en la xornada (`/`, `/es`, `/api/board`) | Base de marcadorgal (`web.xornada`), ingerido de explorer como fuente `rfef` (`src/ingest/adapters.ts`) |
| Goleadores en la xornada | Explorer en vivo en cada render (`enrichMatchesWithGoals`), sobre las filas de la base |
| Xornada femenina | Explorer en vivo (`fetchWomenXornadaMatches`), sin pasar por la base |
| `/directos` | Explorer en vivo (`getDayMatches`), sin pasar por la base |

## Hallazgos por severidad

| # | Sev. | Hallazgo | Estado |
|---|---|---|---|
| 1 | Alta | **Un fallo de Explorer se convierte en estado en el femenino.** Si el calendario llega (o está en la caché de 1 h) pero falla la petición del día, la fila queda sin emparejar y cae a `scheduled` (`src/lib/explorer-xornada.ts:266-274`, `315-323`). Un partido en directo o acabado pasa a «programado» y vuelve. Contradice el comentario D-9 de `src/lib/xornada-board.ts:51-52`. | CONFIRMADO |
| 2 | Alta | **Marcador inventado 0-0 en el femenino.** `FINISHED` o `LIVE_PROVISIONAL` con goles nulos se pinta 0-0 (`explorer-xornada.ts:333-340`). La ingesta descarta ese mismo caso como `missing_score` y exige ventana de directo (`src/sources/rfef/explorer.ts:169-200`); el femenino y `/directos` no aplican ninguna de las dos reglas. | CONFIRMADO |
| 3 | Alta | **`/directos` sin timeout, sin caché y con `date` sin validar.** `getDayMatches(date)` va sin `timeoutMs` (`src/app/(gl)/directos/page.tsx:27-31`, igual en `(es)`). Es `force-dynamic` y `next.config.ts` no le pone cabecera de CDN: cada visita es una petición a Explorer. `?date=` se reenvía tal cual. El `catch` vacío deja la página vacía sin log: una caída es indistinguible de «hoy no hay partidos». | CONFIRMADO |
| 4 | Media | **El ETag de `/api/board` cambia en cada render cuando hay femenino.** `observedAt` y `decidedAt` son `now` (`explorer-xornada.ts:377-378`) y entran en el cuerpo hasheado (`src/board/http.ts:26-27`). El sondeo de 30 s casi nunca recibe 304. | CONFIRMADO |
| 5 | Media | **La frescura del femenino es falsa.** `rowAge` usa `observedAt` (`src/xornada/freshness.ts:65-71`), que es la hora del render y no el `lastSeenAt` de la fila. | CONFIRMADO |
| 6 | Media | **El `revalidate: 15` de `fetchExplorer` es código muerto.** `"next" in customFetch` es falso para el `fetch` global (`src/lib/explorer-client.ts:148-150`). No hay caché de datos. | CONFIRMADO |
| 7 | Media | **El femenino aparece y desaparece.** Con timeout la lista es `[]` (`xornada-board.ts:62-64`, `90`) y `applyBoard` toma la lista del 200 como membresía (`src/xornada/live.ts:54-66`). En instancia fría, tres calendarios y los días deben caber en 2 s. | CONFIRMADO en lógica; frecuencia PLAUSIBLE |
| 8 | Media | **Goles del femenino sin sanear.** No pasan por `sanitizeGoals` (`explorer-xornada.ts:352-358`). Un solo gol inválido hace lanzar `PublicMatch.parse` y se pierde todo el femenino (`:203-206`). | CONFIRMADO en estructura; datos PLAUSIBLE |
| 9 | Media | **Goleadores y marcador no se reconcilian.** `enrichMatchesWithGoals` adjunta los goles sin comparar su número con `m.score` (`src/lib/explorer-enrichment.ts:196-204`). Puede verse 2-1 con un goleador, o con tres. | CONFIRMADO |
| 10 | Media | **`/directos` y la portada pueden discrepar.** `/directos` pinta `LIVE_PROVISIONAL` crudo como `live`, sin Decision ni ventana (`src/lib/explorer-matches.ts:54-69`, `137`). | CONFIRMADO, por diseño |
| 11 | Baja | **Variables de entorno incoherentes.** La URL prefiere `EXPLORER_BASE_URL` sobre `RFEF_EXPLORER_URL` y cae a producción por defecto; el token vacío se envía como `Bearer ` y el 401 se traga (`explorer-client.ts:1-16`). La ingesta exige solo `RFEF_EXPLORER_*`. `src/sources/rfef/calendar.ts:73-91` repite los fallbacks leyendo `process.env` dentro de `src/sources`. | CONFIRMADO |
| 12 | Baja | **`findActiveRound` puede anclarse en una jornada vieja** si un aplazado se reprograma a futuro (`explorer-xornada.ts:157-165`). | CONFIRMADO en lógica; PLAUSIBLE en datos |
| 13 | Baja | **Heurística de «galego» por subcadena.** `includes("deportivo")` marca Deportivo Alavés; las competiciones desconocidas caen en `femenino` (`explorer-matches.ts:86-102`, `161`). | CONFIRMADO |
| 14 | Baja | **Fecha UTC en el femenino** (`explorer-xornada.ts:228`) frente a fecha de Madrid en el resto. Entre 00:00 y 02:00 pide el día anterior: una petición de más, sin dato erróneo. | CONFIRMADO |

## Lo que está bien

- Cinco estados respetados; el descanso va como `halfTime` dentro de `live`.
- Sin duplicados femenino/base: `data/calendario/2026-27` solo declara competiciones masculinas.
- Emparejamiento estricto (`src/lib/explorer-identity.ts`): lo ambiguo no empareja y se avisa.
- Ingesta y enriquecimiento usan fecha de Madrid de forma coherente.
- Sin violaciones de fronteras en `src/sources`.
- Carga de la portada acotada: `s-maxage=10`, `stale-while-revalidate=30`, `oncePerDay`, límite de 2 s.

## Cambios propuestos

1. **Femenino sin degradar ni inventar** (hallazgos 1, 2, 4, 5, 8), en `src/lib/explorer-xornada.ts`: si el día no se pudo leer, omitir esas filas o servir la última lectura buena, nunca `scheduled`; con marcador nulo, descartar la fila como la ingesta; `sanitizeGoals` y `safeParse` por fila; `observedAt`/`decidedAt` = `lastSeenAt` de la fila (añadirlo a `DayMatchesResponse`).
2. **Última lectura buena por instancia** (hallazgo 7): extender `cachedCalendar` a `dayMatches` con TTL 10–15 s y servir lo anterior 2–5 min si falla.
3. **`/directos`** (hallazgo 3): validar `date` (`^\d{4}-\d{2}-\d{2}$`, acotada a días cercanos), pasar `timeoutMs`, `console.error` en el `catch`, estado «non dispoñible» distinto del vacío, cabecera `Vercel-CDN-Cache-Control` en `next.config.ts`.
4. **Reconciliar goleadores** (hallazgo 9): no mostrarlos si superan el marcador; parciales si faltan.
5. **Entorno** (hallazgos 6, 11): solo `RFEF_EXPLORER_URL`/`RFEF_EXPLORER_TOKEN`, error si falta el token, quitar el `revalidate` muerto.
6. **De fondo, para ADR:** persistir goles en base desde la ingesta (`row.ts` ya lee `goals`, SPEC-060) y declarar el femenino en `data/calendario`; el render leería solo la base. Elimina de raíz 1, 2, 4, 5, 7 y 9.

## Reparto marcadorgal / explorer

Todos los cambios son de marcadorgal. Explorer ya exporta `lastSeenAt`
(`marcadorgal-explorer/src/export/export-matches.ts:50`, `:206`) y ya filtra
«Goleador Local/Visitante» (`:151`). Opcional en explorer: garantizar en el
contrato que `LIVE_PROVISIONAL`/`FINISHED` siempre llevan marcador; marcadorgal
debe defenderse igualmente.
