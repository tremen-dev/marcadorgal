---
id: SPEC-070
tipo: spec
epica: EPIC-FIX
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-09, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-09, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-09, por: sdd-implementador}
---
# SPEC-070 — Emparejamiento estricto con el export de explorer

## Problema
`historico:sync --dry-run` (SPEC-060) dio Sporting–Valladolid (Segunda, 2026-11-08) **FINISHED 0-0**; fue 1-2 (acta 70695047). El 0-0 es el juvenil Real Oviedo–Real Sporting de Gijón (`codGrupo` 33836117, acta 70692248, 16:30, sin `canonicalCompetitionId`). `isMatchEqual` deja pasar filas sin competición, `areTeamsSimilar` acepta una sola palabra común («real»), y `planDaySync` y `enrichMatchesWithGoals` se quedan con la **primera** fila que encaja. Además, `canonical*TeamId` de explorer **no es el espacio de ids de `public.teams`**: en el export del 11-08 solo 20 de 48 coinciden (`sporting-gijon` ≠ `sporting`, `fc-andorra` ≠ `andorra`, `celta-de-vigo` ≠ `celta`). La identidad fiable ya existe en el adaptador rfef (`src/sources/rfef/explorer.ts`, `resolveMatch`): `codGrupo` → competición y nombre → equipo por `data/alias/<temporada>/rfef.json` (ADR-017 §2, ADR-023 §5); con ella las 24 filas de las cinco competiciones del 11-08 resuelven a ids locales.

## Usuarios / roles afectados
Público de la xornada (goleadores mal atribuidos) y titular (back-fill de SPEC-060 bloqueado).

## Criterios de aceptación
Regla común («identidad»): una fila del export y un partido local son el mismo solo si (a) la competición de la fila — `competitions[codGrupo]` del alias rfef, o `canonicalCompetitionId` si el grupo no está en el mapa — es igual a la del partido; una fila sin competición resuelta nunca empareja; y (b) local y visitante resuelven al id del partido, cada lado por alias de nombre o por `canonical*TeamId` **igual** al id (nunca subcadena). Un `canonical*TeamId` que no coincide no descarta (otro espacio de ids); descarta que el alias resuelva a otro id. **No hay comparación por nombres aproximados**: `areTeamsSimilar`, `toTokenSet` y `NOISE_WORDS` dejan de usarse para emparejar (se borran si nada más los usa); un lado que no resuelve por alias ni por id deja la fila sin emparejar.
- **CA-1 (caso real 11-08)**: Dado un fixture nuevo `export-2026-11-08-emparejamiento.json` en `src/sources/rfef/fixtures/export/` con las filas 70692248 (juvenil, 0-0) y 70695047 (Segunda, 1-2, 3 goles) copiadas tal cual del crudo `docs/epicas/EPIC-004-fuente-rfef/_qa/SPEC-039/export-2026-11-08-acta.json` (procedencia en el README), cuando se empareja `segunda-division-2026-27-j13-sporting-valladolid`, entonces `isMatchEqual` da `false` con 70692248 y `true` con 70695047, y `planDaySync` produce un plan con `finalScore` 1-2 y 3 goles.
- **CA-2 (dos «Real» de Segunda)**: Dados Real Oviedo–Granada y Real Sociedad B–Castellón el mismo día en Segunda, con sus dos filas, cuando se empareja cada uno, entonces cada partido empareja con su fila y nunca con la otra (en `isMatchEqual`, `planDaySync` y `enrichMatchesWithGoals`).
- **CA-3 (ids que no coinciden)**: Dada una fila con competición correcta y `canonicalHomeTeamId`/`canonicalAwayTeamId` iguales a los de **otro** partido local del día, cuando sus nombres se parecen a los del partido evaluado pero el alias los resuelve a otros ids, entonces `isMatchEqual` da `false`.
- **CA-4 (fila sin competición)**: Dada una fila sin `canonicalCompetitionId` y con `codGrupo` fuera del mapa, con nombres idénticos a los de un partido local, entonces `isMatchEqual` da `false`.
- **CA-5 (ambigüedad)**: Dadas dos filas que cumplen la identidad para un mismo partido local, cuando corre `planDaySync` o `enrichMatchesWithGoals`, entonces ese partido no se empareja (sin plan, sin goles añadidos) y queda un aviso con el `matchId` y el `codActa`/equipos de cada candidata (`ambiguous` en el plan de `planDaySync`; `console.warn` en el enriquecimiento). Desempate permitido: si exactamente una candidata tiene `horaTexto` igual al `kickoff` del partido en Europe/Madrid, se empareja con ella.
- **CA-6 (xornada femenina)**: Dadas dos filas del día con los mismos `canonical*TeamId` y distinta `canonicalCompetitionId`, cuando `fetchWomenXornadaMatches` cruza el calendario de `liga-f`, entonces solo usa la fila de `liga-f`; con dos filas de la misma competición y equipos, el partido queda sin datos del día (sin «la última gana» del `Map`).
- **CA-7 (informe del dry-run)**: Dado `historico:sync --dry-run`, entonces el informe añade `matchesPaired`, `matchesUnpaired` y `matchesAmbiguous` y, por partido emparejado, una línea `fecha · matchId · codActa · local–visitante de la fila · marcador · nº goles`; los sin emparejar y ambiguos se listan por `matchId`.
- **CA-8 (regresión)**: Los tests de `explorer-enrichment.test.ts`, `historico.test.ts` y `explorer-xornada` siguen en verde; los que fijaban el comportamiento permisivo se ajustan y el ledger dice cuáles y por qué. `npm run gates` → 0.
- **CA-10 (sin nombres aproximados)**: Dada una fila de la competición correcta cuyos nombres no están en el alias y sin `canonical*TeamId` iguales a los ids del partido, aunque los nombres coincidan casi letra a letra (p. ej. «Real Sporting» frente a «Real Sporting»), entonces `isMatchEqual` da `false`; y `grep -n "areTeamsSimilar\|NOISE_WORDS" src/` no devuelve ningún uso en el camino de emparejamiento.
- **CA-11 (alias en las rutas web)**: El ledger deja evidencia (comando y salida, p. ej. el trace de ficheros de `next build` en `.next/server/**/*.nft.json` o una petición a un preview) de si `data/alias/2026-27/rfef.json` llega al bundle de `/api/board`, `xornada-home` y `xornada-week`. Si llega, el enriquecimiento usa `loadAliasFile`; si no, los equipos se resuelven leyendo `public.team_aliases` (`source_id = 'rfef'`, temporada en curso) y un test cubre esa vía. En ambos casos, CA-1 a CA-5 pasan por el enriquecimiento con la vía elegida.
- **CA-9 (dry-run real, evidencia)**: Con el export desplegado, `historico:sync --dry-run --desde 2026-08-14 --hasta <ayer>` contra prod (solo lectura) deja en el ledger: totales emparejados/sin emparejar/ambiguos; la línea de Sporting–Valladolid 2026-11-08 con acta 70695047, 1-2 y 3 goles; cero emparejamientos cuyos equipos de la fila resuelvan a ids distintos de los del partido (comprobación automática, comando y salida); y la causa de cada sin emparejar/ambiguo, agrupada.

## Entidades y reglas afectadas
ADR-023 §4 (contrato, no cambia: `codGrupo`, `equipoLocal`, `equipoVisitante`, `horaTexto` son de contrato; `canonical*` y `goals` son extras tolerados), ADR-017 §2 (identidad por nombre y grupo), N-2 (`matchId`; en el enriquecimiento los ids de equipo salen del sufijo tras `<competición>-<temporada>-j<round>-`), SPEC-060, alias rfef (`src/model/alias.ts`).

## Fuera de alcance
Ejecutar `historico:sync` en real (lo decide el titular tras ver CA-9). Cambiar explorer o su contrato. `explorer-matches.ts` (agrupa por competición, no empareja con partidos locales; su detección de «gallego» por subcadena queda igual). Reprogramaciones de kickoff (F-SPEC-069-2).

## Notas para el gate humano
- **Decidido por el titular (2026-11-10):** identidad del adaptador rfef (alias + `codGrupo`) y `canonical*` solo como acierto exacto, nunca como descarte (sustituye el punto 2 de la petición); comparación por nombres eliminada; vía del alias en la web según CA-11.
- `public.team_aliases` solo guarda equipos: el mapa `codGrupo` → competición (5 entradas) no está en base de datos. Si el fichero no llega al bundle, la competición sale de `canonicalCompetitionId`; el implementador lo deja dicho en el ledger.
