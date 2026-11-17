---
id: SPEC-091
tipo: spec
epica: EPIC-MANT
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-17, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-17, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-17, por: sdd-implementador}
---
# SPEC-091 — Vuelve 2ª Federación Femenina G1 con calendario y clasificación oficiales

## Problema
SPEC-088/089 sacaron `segunda-federacion-fem-g1` de la xornada y dejaron su página en `none` porque explorer servía un round-robin generado y una tabla a ceros. Desde el 2026-11-17 explorer sirve lo oficial (comprobado por el titular): `/api/export/calendar` (182 partidos, 26 xornadas, 14 equipos) con el campo nuevo opcional `dateConfirmed` (ausente = `true`; con `false`, `kickoff` es la fecha nominal a 00:00Z y solo ordena), `/api/export/standings` (14 filas RFEF) y filas `fem-galicia` en `/api/export/matches`. Decisión del titular: el femenino es producto; 1ª Fed. Fem. sigue dormida. Hoy además la xornada pinta «01:00» con `timeConfirmed:false` (fuera de alcance en SPEC-088) y `CalendarView` pinta los ids de explorer (`bizkerre-club`) como nombre.

## Usuarios / roles afectados
Público de la xornada (`/`, `/es`, `/api/board`) y de `/competicion|calendario|clasificacion/segunda-federacion-fem-g1` (gl y es).

## Criterios de aceptación
Vitest sobre fixtures del repo, explorer inyectado (SPEC-085 CA-2), sin red, reloj = `nowIso`. «Precisión» de un partido de explorer: `round` si `dateConfirmed === false` (diga lo que diga `timeConfirmed`); si no, `date` si `timeConfirmed === false`; `exact` en otro caso.
- **CA-1 (crudo e identidad, una vez)**: El implementador guarda en el repo, tal cual, una lectura de solo lectura de calendario, clasificación y export de partidos de un día con filas de G1 (comando y fecha en el ledger). Evidencia: cada fila de G1 del export empareja con exactamente un partido del calendario por la identidad de SPEC-070 sin alias (`canonicalCompetitionId` = `segunda-federacion-fem-g1`, ids canónicos = ids del calendario); lista de no emparejadas, que debe ser vacía. Si no lo es, PARA y lo devuelve: no se inventan alias para cuadrar.
- **CA-2 (fuentes)**: `WOMEN_COMPETITIONS` es exactamente `["liga-f", "segunda-federacion-fem-g1"]`; `COMPETITION_SOURCES["segunda-federacion-fem-g1"]` = `{calendar: "explorer", standings: "explorer"}`; `primera-federacion-fem` sigue `none/none` y `explorer.calendar` nunca se llama para ella (ni xornada ni páginas).
- **CA-3 (contrato `dateConfirmed`)**: `OfficialCalendarResponse.matches[]` declara `dateConfirmed?: boolean`; una función pura da la precisión. Casos: ausente + `timeConfirmed:true` → `exact`; ausente + `false` → `date`; `false` + `true` → `round`; `false` + `false` → `round`. Rige para todo calendario de explorer, también `liga-f` (nota 3).
- **CA-4 (xornada G1 con las garantías)**: Con los fixtures de CA-1, los partidos de G1 de la xornada activa salen con los nombres de CA-8 y el estado de su fila. Los casos de SPEC-086 CA-1 (día ilegible), CA-2 (sin marcador) y CA-5 (una fila mala) y de SPEC-088 CA-2/CA-3 se repiten con un partido de G1 y dan lo mismo.
- **CA-5 (xornada, precisión `round`)**: `PublicMatch` admite `kickoffPrecision?: "date" | "round"` (ausente = `exact`; ningún partido masculino lo lleva). Una fila `scheduled` `round` pinta solo `xornada.round` («xornada 10» / «jornada 10»), sin hora ni línea de fecha, y su fecha nominal no entra en `xornadaDays`. El partido se empareja contra las filas de su día nominal y de hoy en Madrid (`toMadridDate(now)`); emparejado, sale con el estado de la fila. Sin fila, sale `scheduled` hasta acabar el día nominal en Madrid (regla de SPEC-088 CA-3) y después no sale. Casos: nominal `2026-11-29T00:00:00Z`; now `2026-11-27T10:00Z` sin fila → «xornada N»; now `2026-11-28T11:30Z` con fila `LIVE_PROVISIONAL` de ese día → `live`; now `2026-11-29T23:30Z` sin fila → no sale.
- **CA-6 (xornada, precisión `date`)**: Una fila `scheduled` `date` pinta su línea de fecha y, en lugar de hora, la clave nueva `xornada.timeTbd`; nunca «01:00». Igual para `liga-f`.
- **CA-7 (página de calendario)**: Con el fixture de G1 salen 182 partidos en 26 xornadas. `exact`: «dom 22 nov · 12:00» (J10 Depor B–Bizkerre, `2026-11-22T11:00:00Z`) + `competitions.confirmedTime`; `date`: «<día> <mes>» sin «· hh:mm» + `competitions.tbdTime`; `round`: ni día ni hora, solo la clave nueva `competitions.dateTbd`, sin repetir «Xornada N» en el partido (ya va en la cabecera de sección). Orden de SPEC-089 CA-8 por el `kickoff` nominal. Los equipos se pintan con nombre (CA-8), nunca con el id, también en `liga-f`.
- **CA-8 (identidad visible)**: Los 14 ids de G1 (`arratia`, `as-celtas`, `bizkerre-club`, `burgos-femenino`, `depor-abanca-b`, `eibar-femenino-b`, `madrid-cff-b`, `osasuna-femenino-b`, `racing-santander-femenino`, `rayo-vallecano-femenino`, `real-aviles-industrial`, `real-oviedo-femenino`, `sporting-gijon-femenino`, `victoria`) resuelven a `name`/`shortName` distintos del id (tabla de nombres o `getGalicianClub`). Filiales sin colapsar: `depor-abanca-b` ≠ `depor-abanca` en nombre, y una fila de G1 de `depor-abanca-b` no empareja con un partido de `liga-f` de `depor-abanca` ni al revés. Equipos galegos de G1, en `src/model/clubs.ts` y marcados galegos con escudo: `as-celtas`, `depor-abanca-b` y `victoria` (Victoria CF, A Coruña; alta nueva). El escudo de `victoria` se descarga de la web del club (nota 1) a `public/escudos/`, nombrado por su id y con el formato y tamaño de los demás; origen y comando en el ledger.
- **CA-9 (clasificación)**: Con el fixture de CA-1, la clasificación de G1 pinta 14 filas; la 1ª, Depor ABANCA B: 22 pts, 9 PJ, 7-1-1, 27-6, marcada como galega con escudo. Un fallo de explorer da `xornada.unavailable` (SPEC-089 CA-6).
- **CA-10 (sin regresión)**: Los fixtures actuales de `liga-f` (sin `dateConfirmed`) dan el mismo `PublicMatch` que hoy; los partidos masculinos no cambian; SPEC-086 CA-7 (ETag estable) sigue verde con G1 dentro; las claves nuevas existen en gl y es con los textos de la nota 2.

## Entidades y reglas afectadas
D-2, D-8, D-9 (FOUNDATION). SPEC-086, SPEC-088 (su CA-1 se amplía aquí), SPEC-089 CA-1/CA-3/CA-8, SPEC-070 (identidad), ADR-014 §3 (`PublicMatch`, campo opcional nuevo). Toca `src/lib/{explorer-xornada,competition-sources,competition-data,explorer-client}.ts`, `src/xornada/view.ts`, `CalendarView`, `MatchRow`, `src/model/{public,clubs}.ts`, `src/i18n/{gl,es}.ts`.

## Fuera de alcance
- `primera-federacion-fem` (dormida); declarar el femenino en `data/calendario` o en el bot (SPEC-090).
- `/directos` (filas crudas del export, sin calendario). Cambios en explorer.
- Limpiar las entradas viejas de G1 en `WOMEN_TEAM_NAMES` (`cd-arratia`, `victoria-cf`, `eibar-b`…) y el `competitionId` de `lugo-femenino` en `clubs.ts` (no está en G1 esta temporada): EPIC-MEJORA, apuntado como F-SPEC-091-1 en el ledger (decisión del gate).

## Notas para el gate humano (gate del titular 2026-11-17)
1. **`victoria`** — *decidido*: es el Victoria CF de A Coruña, galego; entra en `clubs.ts` con escudo, tomado de https://www.webdelclub.com/web/Equipo.aspx?vweb=wvic&id=318 (CA-8). `arratia` (CD Arratia, Bizkaia) no es galego.
2. **Textos nuevos** — *aprobados*: `xornada.timeTbd` gl/es «Hora por confirmar»; `competitions.dateTbd` gl «Data por confirmar» / es «Fecha por confirmar». En la página de calendario el partido `round` no repite «Xornada N» (CA-7).
3. **`dateConfirmed` para todo calendario de explorer** — *aprobado*, no solo G1: es contrato de explorer, no de la competición; MARCA no lo manda y `liga-f` queda igual. Una regla, no una excepción por id.
4. **`kickoffPrecision` en `PublicMatch`** amplía el contrato público (ADR-014 §3) con un campo opcional; propongo no hacer ADR (no cambia fronteras ni fuentes). Alternativa rechazada: no publicar en la xornada los partidos `round` (la xornada activa de G1 quedaría vacía hasta que la RFEF fije fechas).
5. **Emparejar `round` contra hoy** (CA-5) — *aprobado*: si la RFEF juega el sábado una xornada de fecha nominal domingo, sale en directo. Si ya se jugó y hoy no hay fila, dice «xornada N» hasta acabar el día nominal: no inventa estado, pero tampoco muestra el resultado. Coste: lectura del export de hoy (ya se pide) dentro del plazo de SPEC-085 CA-3.
6. **Épica**: EPIC-MANT por continuidad con SPEC-086..090 (revierte su exclusión). No existe épica de femenino.
