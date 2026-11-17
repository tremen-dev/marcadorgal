---
id: SPEC-091
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-091 Vuelve 2ª Federación Femenina G1 con calendario y clasificación oficiales

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-091-vuelve-2-federacion-femenina-g1` (la creada por el orquestador)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/fixtures/export/{calendar,standings}-segunda-federacion-fem-g1-2026-27-2026-11-17T1220Z.json`, `export-2026-11-{14,15,17}-2026-11-17T1220Z.json` (crudo tal cual), README de la carpeta | `explorer-xornada.spec091.test.ts` › CA-1 (182/26/14 ids = clasificación; par único; toda fila G1 de `export-*.json` empareja 1:1 sin alias — **0 filas G1 en las capturas: pendiente**, ver Salvedades) | | ❌ |
| CA-2 | `src/lib/explorer-xornada.ts` (`WOMEN_COMPETITIONS`), `src/lib/competition-sources.ts` | `explorer-xornada.spec091.test.ts` › CA-2; `competition-data.spec091.test.ts` › CA-2; ajustados `explorer-xornada{,.spec088}.test.ts`, `xornada-board.test.ts`, `competition-data.test.ts` (SPEC-088 CA-1 / SPEC-089 CA-1,4,5 enmendados) | | ❌ |
| CA-3 | `src/lib/kickoff-precision.ts`, `src/lib/explorer-client.ts` (`dateConfirmed?`) | `explorer-xornada.spec091.test.ts` › CA-3 (6 combinaciones; captura: 175 round, 7 exact) | | ❌ |
| CA-4 | `src/lib/explorer-xornada.ts` (`womenMatches`, `viewOf`, `stillScheduled`) | `explorer-xornada.spec091.test.ts` › CA-4 (J10 real + filas sintéticas: nombres/estado; SPEC-086 CA-1, CA-2, CA-5; SPEC-088 CA-2, CA-3) | | ❌ |
| CA-5 | `src/model/public.ts` (`kickoffPrecision?`), `src/lib/explorer-xornada.ts` (`rowDays`, `rowKickoff`), `src/xornada/view.ts` (margen `round`, `xornadaDays`), `src/components/xornada/MatchRow.tsx` | `explorer-xornada.spec091.test.ts` › CA-5 (27-11 «xornada N»; 28-11 fila LIVE de hoy → live; 29-11 23:30Z no sale; hoy ilegible → no sale); `components/xornada/kickoff-precision.test.ts` › CA-5 (gl/es, sin hora ni fecha, fuera de `xornadaDays`) | | ❌ |
| CA-6 | `src/xornada/view.ts` (margen `timeTbd`), `MatchRow.tsx`, `src/i18n/{gl,es}.ts` (`xornada.timeTbd`) | `explorer-xornada.spec091.test.ts` › CA-6 (G1 y liga-f); `components/xornada/kickoff-precision.test.ts` › CA-6 | | ❌ |
| CA-7 | `src/components/competition/CalendarView.tsx`, `src/lib/competition-data.ts` (`explorerCalendar`: nombre + `homeId`/`awayId`), `src/i18n/{gl,es}.ts` (`competitions.dateTbd`) | `competition-data.spec091.test.ts` › CA-7 (182/26; exact «dom 22 nov · 12:00»; round; date derivado en memoria; orden; nombres G1 y liga-f; escudo y realce) | | ❌ |
| CA-8 | `src/lib/explorer-xornada.ts` (`WOMEN_TEAM_NAMES` + `resolveTeamNames` exportada), `src/model/clubs.ts` (alta `victoria`, `shield` opcional) | `explorer-xornada.spec091.test.ts` › CA-8 (14 ids; filial; galegos de G1; depor-abanca-b ≠ depor-abanca al emparejar); `model/clubs.test.ts`. **Escudo de victoria: no** (Salvedades) | | ❌ |
| CA-9 | sin código nuevo: `COMPETITION_SOURCES` + `StandingsTable` existente | `competition-data.spec091.test.ts` › CA-9 (14 filas; 1ª depor-abanca-b 9-7-1-1 27-6 +21 22, galega con escudo; fallo → `xornada.unavailable`) | | ❌ |
| CA-10 | — | `explorer-xornada.spec091.test.ts` › CA-10 (liga-f exacto: `PublicMatch` sin campo nuevo; ETag estable con G1); suites previas de xornada/board/columnas sin cambios en verde; `i18n.test.ts` (paridad gl/es) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-091/. Informe HTML opcional: _qa/SPEC-091/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-091-1, F-SPEC-091-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-091-1** → EPIC-MEJORA (gate del titular, 2026-11-17): limpiar en `WOMEN_TEAM_NAMES` las entradas viejas de G1 (`cd-arratia`, `victoria-cf`, `eibar-b`…) que ya no casan con los ids del calendario oficial, y el `competitionId` de `lugo-femenino` en `src/model/clubs.ts` (no está en G1 esta temporada). Mejora para quien mantiene el código: una sola tabla de nombres vigente.
- **F-SPEC-091-2** → gate del titular (CA-8): el escudo de Victoria CF no entra. Origen: `curl -sSL -A "Mozilla/5.0" "https://www.webdelclub.com/web/Equipo.aspx?vweb=wvic&id=318"` → `<img id="imgEscudo" src="https://www.webdelclub.com/wvic/fotos/esc/topheader.png" alt="Escudo del Club">`; `curl -sSL -A "Mozilla/5.0" -o topheader.png <esa url>` (2026-11-17 12:23Z) → `HTTP/1.1 200`, `Content-Type: image/png`, `Last-Modified: Thu, 23 Mar 2023`, 53869 bytes, PNG 389×450 RGBA, sha256 `9f1d55f0…48443af9`. Es mapa de bits; los 8 de `public/escudos/` son SVG 100×100 dibujados («escudos vectoriales», SPEC-055 CA-2) y no hay precedente de escudo no vectorial en ledgers ni ADR: no se vectoriza ni se cambia de formato. `victoria` queda galega sin escudo (`GalicianClub.shield` pasa a opcional; las tres vistas ya pintan sin él). Decide el titular: SVG propio, admitir PNG o dejarlo así.
- **F-SPEC-091-3** → EPIC-MANT: un partido `date` (liga-f o G1) con fila `LIVE_PROVISIONAL` juzga la ventana de directo contra su `kickoff` 00:00Z y no sale (comportamiento previo, fuera de los CA). La regla de CA-5 (hora de la fila en su día) lo arreglaría también para `date`.
- **F-SPEC-091-4** → EPIC-MEJORA: una fila `round` lleva `day` = fecha nominal; como esa fecha no entra en `xornadaDays`, al elegir un día en la tira esas filas desaparecen. No lo pide ningún CA.
- **CA-1, pendiente explícito**: las capturas del 14, 15 y 17-11 no tienen ninguna fila de G1 (explorer encendió `fem-galicia` el 17-11 ~10:15Z; no hay partidos femeninos hasta el 21-11), así que «cada fila de G1 del export empareja con exactamente un partido» no se ha demostrado con filas reales: el caso corre en vacío (0 filas). No se inventaron filas. Se cierra con una lectura real del 21-22 nov guardada como `export-<fecha>-….json` en la misma carpeta (entra sola en el caso). Sí está demostrado: los 14 ids del calendario = los de sus partidos = los de la clasificación, y cada par local-visitante es un único partido.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Hecho CA-1..CA-10 en 4 commits sobre `7632261` (fixtures, xornada, páginas) + versión 0.11.0. Gates en worktree LF: `tsc --noEmit` limpio, `biome check .` limpio, `vitest run` 182 ficheros / 3141 verdes; `next build` en el árbol principal. Lectura de producción: la hizo el orquestador (CA-1); el implementador no hizo ninguna. Para cerrar CA-1: capturar el export del 21-11 y/o 22-11 con filas de G1, guardarlo tal cual en `src/sources/rfef/fixtures/export/` y correr `npx vitest run src/lib/explorer-xornada.spec091.test.ts` (si alguna fila no empareja, PARA: no se inventan alias). Pendiente del titular: F-SPEC-091-2 (escudo de Victoria).
