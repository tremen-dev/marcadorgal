---
id: SPEC-076
tipo: spec
epica: EPIC-FIX
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-10, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-10, por: sdd-implementador}
---
# SPEC-076 — Retirar el override racing-ferrol → rayo-cantabria

## Problema
`COMPETITION_TEAM_OVERRIDES["segunda-rfef-g1"]` (`src/sources/rfef/calendar.ts`) reescribe `racing-ferrol` «Racing Club de Ferrol» como `rayo-cantabria` «Rayo Cantabria». Era un parche nuestro para un fallo de explorer (F-SPEC-074-3): explorer exportaba al Rayo Cantabria con el id y el nombre del Racing de Ferrol. Es la **única** entrada que queda en el mapa (las demás se retiraron en PR 120, F-SPEC-074-1). Explorer lo corrigió en producción el 2026-11-10: `GET /api/export/calendar?competition=segunda-rfef-g1&season=2026-27` trae `{"externalId":"rayo-cantabria","externalName":"Rayo Cantabria"}` en sus 34 partidos, con externalId de partido nuevos (`…-rayo-cantabria-…`). `primera-rfef-g1` no cambia: sigue con `racing-ferrol` «Racing Club de Ferrol». El override ya no hace nada útil y, si explorer volviese a emitir `racing-ferrol` en Segunda RFEF por un motivo legítimo, lo falsearía.

Nuestro id de partido se deriva de competición + temporada + jornada + teamId local/visitante (`src/calendar/match-id.ts`). El externalId de partido de explorer solo se guardaría como alias de partido, y `data/alias/2026-27/rfef.json` no tiene ninguno. El cambio de externalId no duplica partidos.

## Usuarios / roles afectados
Bot del calendario (`calendario:sync`, SPEC-015) y titular, que revisa sus PR. Público: ninguno, si los ids no cambian.

## Criterios de aceptación
- **CA-1 (override retirado)**: Dado `src/sources/rfef/calendar.ts`, cuando se lee `COMPETITION_TEAM_OVERRIDES`, entonces no tiene clave `segunda-rfef-g1` ni ninguna entrada `racing-ferrol`. El mapa queda vacío y el mecanismo se conserva (ver notas). El comentario que lo justifica se actualiza. Test en `src/sources/rfef/calendar.test.ts` que lo comprueba. El test actual «applies COMPETITION_TEAM_OVERRIDES only in its competition» se sustituye por los de CA-2.
- **CA-2 (parseo sin override)**: Dado un export (fixture del repo, sin red) de `segunda-rfef-g1` con el equipo `rayo-cantabria` «Rayo Cantabria», cuando `rfefCalendar.parse` lo lee, entonces el equipo y sus partidos salen con `rayo-cantabria`. Dado el mismo payload con competición `primera-rfef-g1` y `racing-ferrol` «Racing Club de Ferrol», entonces sale `racing-ferrol` «Racing Club de Ferrol». Y `segunda-rfef-g1` con `racing-ferrol` sale como `racing-ferrol`, porque ya no hay reescritura.
- **CA-3 (export real nuevo como fixture: ids estables)**: Dada la respuesta cruda **byte a byte** del export de producción posterior a la corrección (`src/sources/rfef/fixtures/export/calendar-segunda-rfef-g1-2026-27-<fecha>.json`, con su `.headers` y su entrada en el `README.md` del directorio: fecha, sha256, nº de equipos y partidos, y la nota de que trae `rayo-cantabria`), cuando `src/calendar/sync-rfef.test.ts` la sincroniza contra `data/calendario/2026-27/segunda-rfef-g1.json` y `data/alias/2026-27/rfef.json`, entonces `diff.newTeams`, `diff.added`, `diff.missing` y `diff.rematched` están vacíos. Además, los 34 ids derivados con `rayo-cantabria` coinciden con los del calendario del repo, y `validateCalendar`/`validateAliases` no dan problemas. El test de SPEC-074 CA-1 apunta a la fixture nueva y conserva sus aserciones. La fixture del 2026-11-10 con `racing-ferrol` se retira (código y README), porque sin override ya no sincroniza limpia.
- **CA-4 (dry-run real, evidencia)**: Con el código de la rama, `npm run calendario:sync -- 2026-27 segunda-rfef-g1 --dry-run` contra explorer en producción (Bearer real, GET de solo lectura) da `newTeams: 0`, `added: 0`, `missing: 0` y `rematched: 0`, y ninguna línea que mencione `rayo-cantabria` o `racing-ferrol`. La salida se guarda en `docs/epicas/EPIC-FIX/_qa/SPEC-076/` y se enlaza en el ledger. Es evidencia de verificación, no test: necesita red y credenciales. No escribe en `data/` (`git status` limpio tras el comando).
- **CA-5 (regresión y versión)**: `npm run gates` → 0. Versión `patch` con `npm version patch --no-git-tag-version` y `package-lock.json` coherente (`node tools/version-gate.mjs --base origin/main` ok, ADR-028).

## Entidades y reglas afectadas
SPEC-074 (F-SPEC-074-1, F-SPEC-074-3, test `sync-rfef.test.ts`), SPEC-015 (bot del calendario), ADR-026 (export de calendario de explorer), ADR-028 (versión). `CLAUDE.md`: crudo antes que parseo y tests de fuentes contra fixtures del repo. Términos: equipo, partido, xornada (`docs/fundacion/dominio.md`).

## Fuera de alcance
Cambios en `data/calendario/**` o `data/alias/**`: no hacen falta (el calendario ya tiene `rayo-cantabria` y ningún `ferrol`). Tocar explorer. Otras competiciones. Retirar el mecanismo de overrides (ver notas).

## Notas para el gate humano
- **Mecanismo vacío vs. retirarlo**: tras quitar esta entrada, `COMPETITION_TEAM_OVERRIDES` queda `{}`. La spec conserva el mecanismo (el parche más pequeño, y sirve para el próximo fallo de explorer). Su lógica de aplicación queda sin un caso real que la ejerza. Si prefieres borrarlo entero (mapa + las dos líneas de `parse`), dilo y lo cambio en CA-1.
- **Fixture nueva con token real**: CA-3 exige pedir el export con el Bearer de explorer (solo lectura, el token no va a ningún fichero), como hizo SPEC-074. La fixture antigua se borra, no se conserva como histórico.
- **Orden de despliegue**: si se fusiona esto y explorer volviese atrás, el Rayo Cantabria aparecería como `racing-ferrol` en Segunda RFEF. El bot lo vería como equipo nuevo en su PR (`newTeams`), no en silencio.
