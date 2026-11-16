---
id: SPEC-086
tipo: spec
epica: EPIC-MANT
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-16, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-16, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-16, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-16, por: sdd-implementador}
---
# SPEC-086 — La xornada femenina no degrada ni inventa ante un fallo o un hueco de explorer

## Problema
La xornada femenina (SPEC-055) se construye en cada render desde explorer en `src/lib/explorer-xornada.ts`, sin base ni reglas de la ingesta. Investigación `docs/investigaciones/2026-11-16-explorer-en-marcadorgal.md` (commit `efc1ff4`), hallazgos 1, 2, 4, 5 y 8: (1) si falla `dayMatches` de un día, el `catch` vacío deja las filas sin emparejar y caen a `scheduled`: un partido en directo o acabado se pinta «programado» (contra D-9); (2) `LIVE_PROVISIONAL`/`FINISHED` con goles nulos se pintan 0-0 (`?? 0`) y `SUSPENDED` nulo también, cuando la ingesta rfef los descarta (`missing_score`, `suspended_without_score`) y exige ventana de directo (`rowState` en `src/sources/rfef/explorer.ts`, ADR-023 §5); (4)(5) `observedAt`/`decidedAt` son el `now` del render: el ETag de `/api/board` cambia en cada render y `rowAge` mide la edad del render, no del dato (D-9: no se mezclan relojes); (8) los goles no pasan por `sanitizeGoals` y un solo `PublicMatch.parse` que lanza tira todo el femenino.

## Usuarios / roles afectados
Público de la xornada (`/`, `/es`, `/api/board`) que sigue el femenino.

## Criterios de aceptación
Todos con `WomenExplorer` inyectado (SPEC-085 CA-2) y fixtures del repo; sin red; el reloj es el `nowIso` del parámetro. «Fila» = la del export emparejada por la identidad de SPEC-070.
- **CA-1 (día ilegible, nunca `scheduled`)**: Dado un calendario de `liga-f` con partidos en los días D1 y D2, cuando `dayMatches(D1)` rechaza (o responde sin `matches`) y `dayMatches(D2)` responde bien, entonces ningún partido de D1 sale en el resultado, los de D2 salen con su estado, y queda un `console.error` con la fecha D1. Si D1 se lee bien pero un partido no tiene fila, ese partido sigue saliendo `scheduled` (comportamiento actual). Si el día se lee bien pero el partido tiene dos o más filas que cumplen la identidad (`pickRow` da `ambiguous`), el partido **no sale** y queda el `console.warn` actual con su `externalId` y las candidatas; esto afina SPEC-070 CA-6, donde quedaba `scheduled`.
- **CA-2 (sin marcador no se inventa)**: Dadas filas `FINISHED`, `LIVE_PROVISIONAL` (dentro de ventana) y `SUSPENDED` con marcador nulo (ambos lados o uno, tanto en `homeScore`/`awayScore` como en `golesLocal`/`golesVisitante`), cuando se construye la xornada, entonces esos partidos no salen; con marcador completo salen con ese marcador. Nunca aparece un `0` que no venga de la fila.
- **CA-3 (ventana de directo)**: Dada una fila `LIVE_PROVISIONAL` con marcador, entonces sale `live` solo si `lastSeenAt` cae en la ventana de la ingesta respecto al `kickoff` del calendario (`inLiveWindow` de `src/sources/rfef/state.ts`: 130 min, 140 si la fila trae `minute` o `halfTime`); fuera de ella el partido no sale. Minuto y añadido se acotan como en la ingesta. Casos de test: −11 min, −10 min, +129 min, +130 min sin minuto, +139 min con minuto.
- **CA-4 (goles saneados)**: Dada una fila con goles `Goleador Local`, sin `player`, con `minute` no numérico y uno válido, entonces el partido sale solo con el válido (vía `sanitizeGoals`); sin goles válidos, `goals` queda ausente.
- **CA-5 (una fila mala no tira el resto)**: Dado un calendario con un partido que no valida como `PublicMatch` (p. ej. `kickoff` no ISO) y otros dos válidos, entonces salen los dos válidos y queda un `console.warn` con el `externalId` del descartado (`safeParse` por partido; ningún `parse` que lance).
- **CA-6 (relojes de la fila)**: `DayMatchesResponse` (`src/lib/explorer-client.ts`) declara `lastSeenAt` como lo exporta explorer (`export-matches.ts:50`, `:206`). Dado un partido no programado emparejado, entonces `observedAt = decidedAt = lastSeenAt` de la fila y `version = 1`; un partido `scheduled` sale con `version 0`, `observedAt` y `decidedAt` nulos (como un partido sin Decision de la base). Una fila no programada sin `lastSeenAt` ISO válido no sale.
- **CA-7 (ETag estable)**: Dadas las mismas respuestas de explorer y dos `nowIso` separados 30 s, entonces las dos listas son iguales y `boardEtag` coincide.
- **CA-8 (frescura real)**: Dado un partido femenino `live` con minuto cuya fila tiene `lastSeenAt` 5 min antes de `now`, entonces `rowAge` da 5 (y no `null` por haberse observado «ahora»).

## Entidades y reglas afectadas
D-9 (FOUNDATION). ADR-023 §5 (estados de la rfef vía explorer, reloj = `lastSeenAt`). SPEC-038 (reglas de la ingesta que aquí se replican), SPEC-070 (identidad; CA-1 afina su CA-6), SPEC-085 CA-2/CA-3 (inyección y plazo, sin cambios), SPEC-059/SPEC-068 (goles). `PublicMatch` (`src/model/public.ts`). Los cinco estados de partido.

## Fuera de alcance
- Servir la «última lectura buena» si falla el día (cambio 2 de la investigación, hallazgo 7) y el parpadeo por membresía en `applyBoard`.
- Fecha UTC de `nowIso.slice(0,10)` (hallazgo 14), `findActiveRound` (12), reconciliar goleadores con marcador (9), variables de entorno y `revalidate` muerto (6, 11), `/directos` (SPEC-087).
- Persistir el femenino en base (cambio 6, ADR futuro). Cambios en explorer.

## Notas para el gate humano
1. **Omitir en vez de `scheduled`** (CA-1, CA-2, CA-3, también la ambigüedad de CA-1): el partido desaparece de la lista mientras dure el hueco; con el sondeo de 30 s vuelve solo. Es el mismo trato que la ingesta da a `missing_score`.
2. **`decidedAt = lastSeenAt`**, no `lastChangedAt`: si explorer refresca `lastSeenAt` en cada pasada, el ETag cambia a ese ritmo (minutos), no en cada render. `lastChangedAt` lo estabilizaría más pero `rowAge` necesita `lastSeenAt` en `observedAt`.
3. **Reutilizar la regla**: el implementador puede extraer y exportar la lógica de `rowState` de la ingesta para no duplicarla; `src/lib` ya importa de `src/sources/rfef` (`explorer-identity.ts`, `explorer-window.ts`).
