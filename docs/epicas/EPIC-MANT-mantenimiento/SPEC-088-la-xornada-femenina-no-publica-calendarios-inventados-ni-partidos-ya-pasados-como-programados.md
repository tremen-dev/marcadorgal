---
id: SPEC-088
tipo: spec
epica: EPIC-MANT
estado: en-progreso
aprobada-por: Alberto Fojo (delegada en Claude)
historial:
  - {estado: borrador, fecha: 2026-11-16, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-16, por: Alberto Fojo (delegada en Claude)}
  - {estado: en-progreso, fecha: 2026-11-16, por: sdd-implementador}
---
# SPEC-088 — La xornada femenina no publica calendarios inventados ni partidos ya pasados como programados

## Problema
Finding F-SPEC-086-4, comprobado el 2026-11-16 con lecturas de solo lectura contra explorer en producción: (a) el export de partidos no trae ninguna fila femenina (targets `fem-galicia` y `fem-nacional` apagados desde 2026-11-01); (b) los calendarios de `primera-federacion-fem` y `segunda-federacion-fem-g1` que sirve explorer son un round-robin generado (`buildFederationCalendar`, domingos 12:00Z, todos `timeConfirmed:false`), no el oficial. En `src/lib/explorer-xornada.ts` eso produce dos mentiras contra D-9: partidos inventados publicados como «programado», y partidos reales de Liga F ya jugados que siguen «programado» porque SPEC-086 CA-1 deja «sin fila → `scheduled`» sin límite de tiempo.

## Usuarios / roles afectados
Público de la xornada (`/`, `/es`, `/api/board`) que sigue el femenino.

## Criterios de aceptación
Como SPEC-086: `WomenExplorer` inyectado, fixtures del repo, sin red, reloj = `nowIso`. «Fila» = la del export emparejada por la identidad de SPEC-070. «Margen» = `LIVE_BEFORE_MINUTES` (10 min, `src/sources/rfef/state.ts`).
- **CA-1 (solo calendarios oficiales)**: `WOMEN_COMPETITIONS` es exactamente `["liga-f"]`. Dado un `WomenExplorer` que responde calendario para las tres competiciones con partidos en la jornada activa, cuando se construye la xornada, entonces solo salen partidos de `liga-f` y `explorer.calendar` no se llama para `primera-federacion-fem` ni `segunda-federacion-fem-g1`.
- **CA-2 (sin fila, hora confirmada)**: Dado un partido de `liga-f` con `timeConfirmed:true`, kickoff K, y su día leído sin fila que lo empareje, entonces sale `scheduled` si `now < K + margen` y **no sale** si `now ≥ K + margen`. Casos: K−1 h, K+9 min (sale); K+10 min, K+3 días (no sale).
- **CA-3 (sin fila, hora sin confirmar)**: Dado un partido con `timeConfirmed:false` (p. ej. kickoff `…T00:00:00Z`), su día leído y sin fila, entonces sale `scheduled` mientras la fecha de Madrid de `now` (`toMadridDate`) sea igual o anterior a la del kickoff, y no sale a partir del día siguiente. Casos con kickoff `2026-11-22T00:00:00Z`: now `2026-11-22T20:00:00Z` sale; now `2026-11-22T23:30:00Z` (00:30 del 23 en Madrid) no sale.
- **CA-4 (fila `SCHEDULED` caducada)**: Una fila emparejada con `estado: "SCHEDULED"` sigue la misma regla que «sin fila» (CA-2/CA-3): pasado el plazo, el partido no sale.
- **CA-5 (sin regresión)**: Los partidos con fila no programada se comportan como en SPEC-086 (CA-2..CA-8): la nueva regla solo toca el camino que hoy devuelve `scheduled`. Los tests de SPEC-086 siguen verdes, salvo el texto de su CA-1 «sin fila → `scheduled`», que esta spec afina.

## Entidades y reglas afectadas
D-9 (FOUNDATION). SPEC-086 CA-1 (afinado aquí), SPEC-070 (identidad), SPEC-055 (xornada femenina), SPEC-085 CA-2 (inyección). `inLiveWindow`/`LIVE_BEFORE_MINUTES` (ADR-023 §5). `OfficialCalendarResponse.matches[].timeConfirmed` (`src/lib/explorer-client.ts`). `/directos` (`src/lib/explorer-matches.ts`) no cambia: solo pinta filas del export, sin calendario; hoy simplemente no tiene femenino.

## Fuera de alcance
- **Decisión del titular**: encender `fem-galicia`/`fem-nacional` en explorer (más carga a la RFEF vía proxies) y sustituir los calendarios generados de explorer por los reales. Volver a añadir una competición a `WOMEN_COMPETITIONS` requiere spec y calendario real.
- Las páginas `/competicion/<id>` y `/calendario/<id>` (`src/app/competition-page.tsx`), que también pintan esos calendarios generados (y el de `tercera-rfef-g1`, mismo generador). Ver nota 1.
- Cómo se pinta la hora de un kickoff con `timeConfirmed:false` (hoy saldría «01:00»). Chips de filtro de 1ª/2ª Fed. Fem. en `league-preferences.ts` y nombres en `WOMEN_TEAM_NAMES`: se quedan, sin partidos.
- Cambios en explorer.

## Notas para el gate humano
1. **Las páginas de competición también publican inventos** (1ª y 2ª Fed. Fem. y Tercera G1, todos `timeConfirmed:false`). No entra aquí por alcance delegado; propongo spec aparte o ampliar esta. Decide.
2. **Quitar de la lista y no un criterio de datos** («todos `timeConfirmed:false` ⇒ inventado»): es la heurística la que podría ocultar un calendario real recién publicado sin horas, o dejar pasar uno generado que marque `true`. La lista es explícita y reversible en una línea.
3. **Margen de 10 min tras el kickoff** (CA-2): el mismo que la ingesta concede antes del kickoff; cubre un retraso corto del export. Un partido en juego sin fila desaparece a los 10 min en vez de mentir «programado». Con los targets femeninos apagados, en la práctica todo Liga F pasado desaparece: la xornada femenina mostrará solo lo próximo.
4. **Hora sin confirmar** (CA-3): 00:00Z no es una hora, es «ese día»; se le da el día entero de Madrid.
