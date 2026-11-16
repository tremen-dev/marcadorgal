---
id: SPEC-089
tipo: spec
epica: EPIC-MANT
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-16, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-16, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-16, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-16, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-11-16, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-11-16, por: sdd-implementador}
---
# SPEC-089 — Las páginas de competición no publican calendarios ni clasificaciones inventados

## Problema
Nota 1 de SPEC-088. `src/app/competition-page.tsx` (`/competicion/<id>`, `/calendario/<id>`, `/clasificacion/<id>` y sus `/es`) pinta lo que sirva explorer para las 8 de `ALLOWED_COMPETITIONS`. Comprobado en `marcadorgal-explorer` el 2026-11-16: el calendario de `primera-federacion-fem`, `segunda-federacion-fem-g1` y `tercera-rfef-g1` es un round-robin generado (`export-calendar.ts` `getCalendar`/`buildFederationCalendar`: domingos 12:00Z, `timeConfirmed:false`), y su clasificación es un relleno (`marca-stats.ts` `buildFallbackStandings`: fem. con todos los equipos a 0 puntos; tercera vacía). `segunda-rfef-g1` no está en `COMPETITION_CONFIG` de MARCA: su clasificación siempre falla. Además `CalendarView` formatea la hora con `toLocaleDateString` sin zona: en Vercel (UTC) sale 2 h antes. Todo eso contradice D-9 y la regla «crudo/declarado antes que inventado». En cambio `data/calendario/2026-27/` ya tiene el calendario real de las 5 masculinas, mantenido por el bot y validado en gates.

## Usuarios / roles afectados
Público de las páginas de competición (gl y es).

## Criterios de aceptación
Tests con Vitest sobre fixtures del repo y explorer inyectado (como SPEC-085 CA-2), sin red. «Fuente» = de dónde sale el dato de una página.
- **CA-1 (mapa explícito)**: Existe un mapa único y puro de fuente por competición. Calendario: `local` para `primera-division`, `segunda-division`, `primera-rfef-g1`, `segunda-rfef-g1`, `tercera-rfef-g1`; `explorer` solo para `liga-f`; `none` para `primera-federacion-fem` y `segunda-federacion-fem-g1`. Clasificación: `explorer` para `primera-division`, `segunda-division`, `primera-rfef-g1` (sujeto a CA-7), `liga-f`; `none` para las otras 4. Un test afirma el mapa exacto y que cada `local` tiene su fichero en el bundle.
- **CA-2 (calendario local)**: Dado `tercera-rfef-g1`, cuando se cargan los datos de la página de calendario y de la portada de competición, entonces salen los 306 partidos de `data/calendario/2026-27/tercera-rfef-g1.json` (importado como JSON, como `src/calendar/galicians.ts`, y validado con `CalendarFile`), con los nombres de `teams[].name` (p. ej. «Alondras CF») y `getOfficialCalendar` no se llama. Igual para las otras 4 `local`. Si el fichero no valida, la página muestra `xornada.unavailable`, nunca cae a explorer.
- **CA-3 (hora de Madrid, sin badge que no sabemos)**: `CalendarView` pinta día y hora con `formatDay`/`formatTime` (`src/i18n/format.ts`, Europe/Madrid): `2026-09-05T16:00:00Z` sale «18:00» con el proceso en `TZ=UTC`. Los partidos `local` no llevan badge «Horario confirmado/por confirmar» (el fichero no lo dice); los de `liga-f` lo siguen llevando según `timeConfirmed`.
- **CA-4 (sin calendario oficial)**: Dado `primera-federacion-fem` o `segunda-federacion-fem-g1`, en gl y es, cuando se pinta la portada o el calendario de la competición, entonces `getOfficialCalendar` no se llama y en lugar de partidos sale el texto i18n nuevo `competitions.calendarNotOffered` (estado explícito en texto, no solo color), distinto de `xornada.unavailable` (fallo transitorio, D-9).
- **CA-5 (sin clasificación real)**: Dado cualquiera de las 4 con clasificación `none`, cuando se pinta la portada o la clasificación, entonces `getStandings` no se llama y sale el texto i18n nuevo `competitions.standingsNotOffered`.
- **CA-7 (1ª RFEF G1 solo si es el Grupo 1)**: Antes de fijar CA-1, el implementador comprueba una vez (lectura de solo lectura, fuera de los tests) la clasificación que sirve explorer para `primera-rfef-g1` (torneo MARCA `0154`) y compara sus equipos con `teams[]` de `data/calendario/2026-27/primera-rfef-g1.json`. Regla: si la tabla son exactamente esos equipos (mismo número, todos emparejados por nombre o alias), la clasificación de `primera-rfef-g1` queda `explorer`; si mezcla grupos (más filas o algún equipo ajeno al G1), pasa a `none` y CA-1/CA-5 se aplican con esa lista. Evidencia en el ledger: comando y fecha, número de filas, lista de equipos no emparejados (vacía o no) y la decisión resultante. El test de CA-1 refleja la decisión.
- **CA-6 (sin regresión)**: `liga-f` sigue tomando calendario y clasificación de explorer, y las competiciones con clasificación `explorer` también; un fallo de explorer sigue mostrando `xornada.unavailable`. Las 8 competiciones siguen respondiendo (sin 404) y `CompetitionNav` no cambia. Los tests existentes de `CalendarView`, `StandingsTable` y `CompetitionHeader` siguen verdes.

## Entidades y reglas afectadas
D-2 (i18n), D-8 (diseño), D-9 (FOUNDATION). SPEC-088 (nota 1; `WOMEN_COMPETITIONS = ["liga-f"]`, mismo criterio). SPEC-085 CA-2 (inyección). `CalendarFile` (`src/calendar/schema.ts`), `matchId` (`src/calendar/match-id.ts`, para la key de cada partido local). `OfficialCalendarResponse`, `getStandings` (`src/lib/explorer-client.ts`). Enlace a la tabla de SPEC-057 (`CompetitionSection`): no cambia.

## Fuera de alcance
- Cambiar explorer, encender `fem-galicia`/`fem-nacional`, declarar el femenino en `data/calendario`. Volver a dar fuente a una `none` requiere spec y dato real.
- Calcular clasificaciones propias desde la base (para tercera y 2ª RFEF).
- Resultados sobre el calendario local (es calendario, no marcador). Pichichi/Zamora (no se pintan hoy).

## Notas para el gate humano
1. **Mapa explícito, no heurística** (como SPEC-088 nota 2): «todo `timeConfirmed:false` ⇒ inventado» ocultaría un calendario real sin horas o dejaría pasar uno generado. Reversible en una línea.
2. **DECIDIDO (titular, 2026-11-16): local también para 1ª y 2ª División**, aunque MARCA sea real: una sola verdad, la del calendario declarado que ya usa la xornada. Descartado: `local` solo para tercera.
3. **DECIDIDO (titular, 2026-11-16): Fem. 1ª/2ª Fed. mantienen su página con estado explícito**, sin retirarlas ni tocar `ALLOWED_COMPETITIONS` ni `CompetitionNav`.
4. **DECIDIDO (titular, 2026-11-16): textos** gl «O calendario oficial desta competición aínda non está en marcador.gal.» / es «El calendario oficial de esta competición aún no está en marcador.gal.»; clasificación análoga («A clasificación oficial…» / «La clasificación oficial…»).
5. **DECIDIDO (titular, 2026-11-16): torneo MARCA `0154`** lo comprueba el implementador; regla y evidencia en CA-7.
