---
id: SPEC-074
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
# SPEC-074 — calendario:sync vuelve a funcionar

## Problema
`calendario:sync -- 2026-27` sale con exit 1 en `main` y el bot del calendario no abre PR: no llegan reprogramaciones ni las correcciones de ADR-031 (F-SPEC-071-1). Reproducido hoy en solo lectura: `_qa/SPEC-074/baseline-dry-run-2026-11-10.log`. Dos causas, ambas en el emparejado de equipos de `syncCalendar` (`src/calendar/sync.ts`) contra el alias rfef (`data/alias/2026-27/rfef.json`, claves = nombre normalizado, ADR-017 §2, `src/sources/rfef/alias.ts`):
1. **Filiales con nombre nuevo.** El export de explorer de `segunda-rfef-g1` ya da `alaves-b` «Alavés B», `eibar-b` «Eibar B» y `astorga` «Atlético Astorga»; antes daba ids del primer equipo que `COMPETITION_TEAM_OVERRIDES` (`src/sources/rfef/calendar.ts`) traducía a «Deportivo Alavés B», «SD Eibar B», «Atlético Astorga FC». Esos overrides ya no casan y ninguno de los tres nombres está en el alias (ni por nombre ni por slug), así que el sync crea `alaves-b-2`, `eibar-b-2`, `atletico-astorga` (`freeSlug`), duplica 96 partidos y la validación falla con 90 «plays twice».
2. **Renombrados falsos.** `girona` y `sabadell` casan por `externalId` con entradas `Girona`/`Sabadell`, pero «Girona FC» y «CE Sabadell FC» ya son alias del mismo equipo; «Athletic Club B» casa por slug con `Athletic Club "B"`. Los 3 `renamedAtProvider` bloquean `auto-aplicable` aunque nada cambie en los ficheros (los renombrados no reescriben el alias).

## Usuarios / roles afectados
Público (calendario y kickoffs reales al día) y titular (el bot vuelve a abrir y autofusionar PRs).

## Criterios de aceptación
- **CA-1 (alias de filiales, datos)**: `data/alias/2026-27/rfef.json` añade `alavés b → alaves-b`, `eibar b → eibar-b` y `atlético astorga → astorga`, con `externalId` = nombre normalizado (`normalizeName`). Dado el crudo del export de calendario de `segunda-rfef-g1` guardado como fixture (`src/sources/rfef/fixtures/export/`, procedencia en el README), el calendario y el alias del repo, cuando corre `syncCalendar`, entonces `newTeams`, `added` y `missing` están vacíos y ningún `teamId` termina en `-<n>`; `validateAliases` y `validateCalendar` sin problemas. Un `buildRfefAlias` con ese fichero como `existing` conserva las tres entradas (test).
- **CA-2 (un nombre ya conocido no es un renombrado)**: Dado un alias con dos entradas del mismo `teamId` («Girona», «Girona FC»), cuando el import trae `externalId girona` con «Girona FC», entonces `renamedAtProvider` está vacío. Igual si el nombre nuevo coincide por slug con una entrada del mismo equipo (`Athletic Club "B"` / «Athletic Club B»). Si el nombre solo es conocido para **otro** `teamId`, o es nuevo, se sigue informando (el test «(c)» de `sync.test.ts`, Ourense → «Ourense CF», sigue igual).
- **CA-3 (el bot, solo lectura contra prod)**: En el ledger, comando y salida de `npm run calendario:sync -- 2026-27 --dry-run`: exit 0; en las cinco competiciones `newTeams`, `added`, `missing`, `renamedAtProvider` y `rematched` a 0 (o cada línea distinta explicada como cambio real del proveedor); `auto-aplicable: si` si solo hay reprogramaciones, según `autoAplicable` vigente (SPEC-015 CA-4, y SPEC-073 si se aprueba antes); `git status` sin cambios en `data/`.
- **CA-4 (regresión)**: Los tests de `src/calendar/` (`sync`, `cli`, `data`, `schema`, `real-kickoffs`) y de `src/sources/rfef/` (`calendar`, `alias`) siguen en verde; todo ajuste se justifica en el ledger. `npm run gates` → 0.

## Entidades y reglas afectadas
ADR-017 §2 (alias rfef por nombre normalizado), ADR-026 (explorer importa el calendario), ADR-031 y SPEC-071 (correcciones que deben llegar), SPEC-015 CA-3/CA-4 y H-1 (diff, `autoAplicable`, alias nunca se autofusiona), SPEC-038 CA-5 (`alias:rfef`), ADR-028 (toca `src/`: sube versión `patch`), D-2.

## Fuera de alcance
Ejecutar `calendario:sync` en escritura o `calendario:load` (lo hace el bot tras la fusión). Retirar los overrides muertos de `COMPETITION_TEAM_OVERRIDES` (ver preguntas). Cambiar explorer. Filtrar correcciones de kickoff (SPEC-073). Avisar cuando el workflow falla.

## Notas para el gate humano
- **Sonda del arquitecto (2026-11-10, deshecha, sin commit)**: con las tres entradas de CA-1 y la regla de CA-2 aplicadas en local, el mismo dry-run salió con exit 0, todo a 0 salvo 10 reprogramaciones `PASADO` (9 de Tercera J10, 1 de Segunda RFEF `gimnastica-gernika` 16:00→16:03) y `auto-aplicable: si`. La solución es **mixta**: datos (CA-1) + código (CA-2).
- **CA-2 es una regla nueva del diff**: un «renombrado» solo avisa de un nombre que el alias no conoce para ese equipo. No borra información: el nombre visible sale del calendario, no del alias.
- **Preguntas abiertas para el titular**:
  1. ¿Aceptas la regla de CA-2, o prefieres solo datos (reescribir `externalName` de las entradas `girona`/`sabadell` y añadir `athletic club b`), que vuelve a romperse en el próximo cambio de nombre de explorer?
  2. Overrides de `COMPETITION_TEAM_OVERRIDES`: explorer ya no emite `real-sociedad`, `athletic-club`, `ourense-cf` (Primera RFEF), `alaves`, `atletico-madrid`, `real-oviedo` ni `eibar`. ¿Se retiran en otra spec? `racing-ferrol → rayo-cantabria` en Segunda RFEF sigue vivo: explorer exporta a Rayo Cantabria como «Racing Club de Ferrol» (fallo de explorer a reportar).
  3. El bot llevaba fallando desde el cambio de explorer sin que nadie se enterase. ¿Quieres un aviso cuando el workflow falla (spec aparte)?
