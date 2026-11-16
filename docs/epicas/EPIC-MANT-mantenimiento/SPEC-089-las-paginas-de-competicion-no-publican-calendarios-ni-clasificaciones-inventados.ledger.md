---
id: SPEC-089
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-089 Las paginas de competicion no publican calendarios ni clasificaciones inventados

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-089-competicion-sin-inventos`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/competition-sources.ts` (`COMPETITION_SOURCES`), `src/calendar/bundled.ts` (`BUNDLED_CALENDARS`) | `src/lib/competition-data.test.ts` «SPEC-089 CA-1»: mapa exacto; cada `local` en el bundle | | ❌ |
| CA-2 | `src/lib/competition-data.ts` (`loadCompetitionCalendar`, `localCalendar`), `src/app/competition-page.tsx` | `src/lib/competition-data.test.ts` «SPEC-089 CA-2»: tercera 306 partidos por nombre; las 5 `local` sin explorer; fichero inválido → unavailable; páginas calendario y portada | | ❌ |
| CA-3 | `src/components/competition/CalendarView.tsx` (`formatKickoff`, badge solo si `timeConfirmed` es booleano) | `src/components/competition/CalendarView.test.ts` «SPEC-089 CA-3»: 18:00 con `TZ=UTC`; sin badge en local; liga-f con badge | | ❌ |
| CA-4 | `src/lib/competition-data.ts`, `src/app/competition-page.tsx` (`Section`), `src/i18n/{gl,es}.ts` `competitions.calendarNotOffered` | `src/lib/competition-data.test.ts` «SPEC-089 CA-4»: fem. 1ª/2ª en gl y es, portada y calendario; textos decididos ≠ `xornada.unavailable` | | ❌ |
| CA-5 | Ídem + `competitions.standingsNotOffered` | `src/lib/competition-data.test.ts` «SPEC-089 CA-5»: las `none` (5 tras CA-7) en gl y es, portada y clasificación | | ❌ |
| CA-6 | `src/app/competition-page.tsx` (explorer inyectable, `clientCompetitionExplorer` por defecto) | `src/lib/competition-data.test.ts` «SPEC-089 CA-6»: liga-f y clasificaciones explorer; fallo y vacío → unavailable; 8×3 páginas responden; suites existentes de CalendarView/StandingsTable/CompetitionHeader/CompetitionNav verdes | | ❌ |
| CA-7 | Decisión aplicada en `src/lib/competition-sources.ts` (`primera-rfef-g1` → standings `none`) | Evidencia abajo («CA-7 evidencia»); el test de CA-1 refleja la decisión | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-089/. Informe HTML opcional: _qa/SPEC-089/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-089-1, F-SPEC-089-2… con destino (spec futura o EPIC-MEJORA). -->
### CA-7 evidencia (comprobación hecha por el orquestador, registrada por el implementador)
- Comando (2026-11-16T21:38:41Z): `curl -s -H "Authorization: Bearer <ADMIN_API_KEY de explorer>" "https://marcadorgal-explorer.vercel.app/api/export/standings?competition=primera-rfef-g1&season=2026-27"` → HTTP 503, `{"error":"No se pudo obtener la clasificación: Unexpected end of JSON input"}`. Filas: 0. Equipos no emparejados: no evaluable (no hay tabla).
- Código de explorer: `marcadorgal-explorer/src/scraper/providers/marca/marca-stats.ts:19` `'primera-rfef-g1': { tournamentId: '0154', marcaPath: 'primera-rfef' }`: la ruta MARCA no lleva grupo.
- Decisión: no se puede demostrar que la tabla sea exactamente el G1 → clasificación de `primera-rfef-g1` = `none`. CA-1/CA-5 aplicados con esa lista (`explorer` solo para `primera-division`, `segunda-division`, `liga-f`).
- **Desviación para el titular**: la spec contemplaba `explorer` o `none` según la comparación; la comparación no pudo hacerse (sin filas). Se aplica el principio de la spec (no publicar lo no verificable). Reversible en una línea de `COMPETITION_SOURCES` cuando la tabla se pueda comprobar.

- F-SPEC-089-1: los calendarios `local` pintan nombres de `teams[].name`; `CalendarView` busca escudo/realce galego por id de `GALICIAN_CLUBS`, así que los equipos galegos del calendario local salen sin escudo ni realce. Destino: EPIC-MEJORA (usar `galicianNames` o ids del fichero).
- F-SPEC-089-2: `CalendarView` pinta «día · hora» (`formatDay`/`formatTime`), sin mes; antes salía el mes abreviado. Si se quiere mes, ampliar `src/i18n/format.ts`. Destino: EPIC-MEJORA.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1..CA-7 implementados con tests en rama `ft/SPEC-089-competicion-sin-inventos` (commits d475afc, 89d5e1b, 42c7e32, 73481cf versión 0.10.12). Spec en `en-revision`.
- Gates 2026-11-16 (worktree LF): `npm run typecheck` OK; `npm run lint` «Checked 500 files… No fixes applied.»; `npm test` 179 ficheros, 3073 passed / 3 skipped. `npm run build` (árbol principal) «Compiled successfully», rutas `/competicion|/calendario|/clasificacion/[id]` y `/es` presentes.
- Falta: verificación (sdd-verificador), con captura de `/calendario/tercera-rfef-g1` y `/competicion/primera-federacion-fem` si se quiere evidencia visual.
