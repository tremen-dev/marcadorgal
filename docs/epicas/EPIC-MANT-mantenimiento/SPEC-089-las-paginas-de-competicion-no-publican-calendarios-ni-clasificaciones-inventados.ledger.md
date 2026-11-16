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
| CA-1 | `src/lib/competition-sources.ts` (`COMPETITION_SOURCES`), `src/calendar/bundled.ts` (`BUNDLED_CALENDARS`) | `src/lib/competition-data.test.ts` «SPEC-089 CA-1»: mapa exacto; cada `local` en el bundle | Test verde (mapa exacto, 8 claves = `ALLOWED_COMPETITIONS`, 5 `local` en bundle). Navegador: el stub de explorer solo recibe `calendar liga-f` y `standings liga-f/primera-division/segunda-division` | ✅ |
| CA-2 | `src/lib/competition-data.ts` (`loadCompetitionCalendar`, `localCalendar` con `homeId/awayId` del fichero), `src/components/competition/CalendarView.tsx` (escudo/realce por `homeId ?? home`, nombre de `teams[].name`), `src/app/competition-page.tsx` | `src/lib/competition-data.test.ts` «SPEC-089 CA-2»: tercera 306 partidos por nombre; las 5 `local` sin explorer; fichero inválido → unavailable; páginas calendario y portada. «SPEC-089 CA-2 local calendar keeps Galician shields» (F-V-1): 1ª Div celta/deportivo, 1ª RFEF racing-ferrol/lugo/pontevedra, 2ª RFEF ourense-cf con escudo, nombre y `matchCardGalician`; el loader lleva los ids | Tests verdes (306 de tercera por nombre, 5 `local` sin explorer, fichero inválido → unavailable). Navegador: tercera 306, 1ª Div 380, 2ª Div 462, 1ª RFEF 380, 2ª RFEF 306 partidos sin llamada a explorer; «Alondras CF». Pero F-V-1: sin escudo ni realce galego | ⚠️ |
| CA-3 | `src/components/competition/CalendarView.tsx` (`formatKickoff`, badge solo si `timeConfirmed` es booleano) | `src/components/competition/CalendarView.test.ts` «SPEC-089 CA-3»: 18:00 con `TZ=UTC`; sin badge en local; liga-f con badge | Tests verdes (18:00 con `TZ=UTC`, sin badge en local, badge en liga-f). Navegador: tercera j1 «sáb 5 · 18:00» (5-sep 16:00Z); local sin badges; liga-f con «Horario confirmado/por confirmar» | ✅ |
| CA-4 | `src/lib/competition-data.ts`, `src/app/competition-page.tsx` (`Section`), `src/i18n/{gl,es}.ts` `competitions.calendarNotOffered` | `src/lib/competition-data.test.ts` «SPEC-089 CA-4»: fem. 1ª/2ª en gl y es, portada y calendario; textos decididos ≠ `xornada.unavailable` | Tests verdes gl/es portada+calendario. Navegador: 200 y texto decidido en `/competicion` y `/calendario` de fem. 1ª/2ª, gl y es, móvil y escritorio, sin `calendar-view`; el stub no recibe llamadas de ellas | ✅ |
| CA-5 | Ídem + `competitions.standingsNotOffered` | `src/lib/competition-data.test.ts` «SPEC-089 CA-5»: las `none` (5 tras CA-7) en gl y es, portada y clasificación | Tests verdes. Navegador: texto decidido en portada y clasificación de las 5 `none`, gl y es; el stub no recibe `standings` de ellas. La lista de 5 depende de CA-7 | ✅ |
| CA-6 | `src/app/competition-page.tsx` (explorer inyectable, `clientCompetitionExplorer` por defecto) | `src/lib/competition-data.test.ts` «SPEC-089 CA-6»: liga-f y clasificaciones explorer; fallo y vacío → unavailable; 8×3 páginas responden; suites existentes de CalendarView/StandingsTable/CompetitionHeader/CompetitionNav verdes; «keeps Galician shields»: liga-f vía explorer conserva `/escudos/depor-abanca.svg`, «Deportivo ABANCA» y 1 `matchCardGalician` | Suite 3073 passed / 3 skipped; 96 páginas (8×3×gl/es×2 viewports) HTTP 200 sin scroll horizontal; stub caído → «Os resultados non están dispoñibles agora mesmo.» en liga-f y 1ª Div. Regresión visible fuera de la lista del CA: F-V-1 | ⚠️ |
| CA-7 | Decisión aplicada en `src/lib/competition-sources.ts` (`primera-rfef-g1` → standings `none`) | Evidencia abajo («CA-7 evidencia»); el test de CA-1 refleja la decisión | Evidencia registrada (HTTP 503, 0 filas). La regla del CA no cubre «sin tabla»: la decisión `none` es conservadora pero no tiene la aceptación del titular (F-V-2) | ⚠️ |
| CA-8 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**RED — 2026-11-16.** Gates verdes (worktree LF detached en 9c90384): `npm run typecheck` exit 0; `npm run lint` «Checked 500 files… No fixes applied.»; `npm test` 179 ficheros, 3073 passed / 3 skipped. `npm run build` (árbol principal, `EXPLORER_BASE_URL` a stub local 127.0.0.1:4599) «Compiled successfully». Navegador: `next start` + Playwright chromium 390×844 y 1280×900, gl y es, 96 páginas → todas 200.

Findings:
- **F-V-1 (regresión visible, CA-2/CA-6)**: en los calendarios `local` ningún equipo galego lleva escudo ni realce. `localCalendar` (`src/lib/competition-data.ts`) pasa `home/away` = `teams[].name` («RC Celta») y `CalendarView` busca `getGalicianClub(m.home)` por id. Medido: render de `loadCompetitionCalendar` → `primera-division shields: 0 galicianCards: 0`, `primera-rfef-g1 0/0`, `segunda-rfef-g1 0/0`; Playwright `img`=0 y `matchCardGalician`=0 en las 5 `local`, frente a 1/1 en liga-f. Los ids del fichero (`celta`, `deportivo`, `racing-ferrol`, `lugo`, `pontevedra`, `ourense-cf`) coinciden con las claves de `GALICIAN_CLUBS`: el dato para conservar escudo y realce está en el fichero. En main explorer daba slugs canónicos (`TEAM_SHORT_SLUGS`, p. ej. `celta-de-vigo→celta`), así que al menos Celta, Lugo y Pontevedra salían con escudo y realce. El realce galego es el núcleo del producto; aplazarlo a EPIC-MEJORA (F-SPEC-089-1) no lo ha aceptado el titular. Acción: pintar escudo y realce por el id del fichero, conservando el nombre de `teams[].name`, con test (p. ej. 1ª Div: Celta y Deportivo con escudo).
- **F-V-2 (CA-7, gate humano)**: la comparación del CA no se pudo hacer (503, 0 filas) y la regla solo define `explorer` (la tabla es el G1) o `none` (mezcla grupos). La decisión `none` está razonada y es reversible, pero es una desviación de la spec que necesita aceptación explícita del titular (o enmienda de CA-7) antes de cerrar.

Observaciones (no bloquean; decide el titular): (a) F-SPEC-089-2: sin mes, la «xornada 1» de 1ª Div muestra «sáb 15», «mér 19», «xov 27», «luns 17»…, ambiguo en una temporada; lo impone CA-3 (`formatDay`), no la implementación. (b) Dentro de cada xornada los partidos `local` siguen el orden del fichero, no el cronológico.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-089/. Informe HTML opcional: _qa/SPEC-089/informe.html -->
| CA | Capturas (`_qa/SPEC-089/`, prefijo `movil-`/`escritorio-`; `-es-` = castellano) |
|---|---|
| CA-2, CA-3, F-V-1 | `*-calendario-tercera-rfef-g1.png`, `*-calendario-primera-division.png` (RC Celta / RC Deportivo sin escudo ni realce) |
| CA-4, CA-5 | `*-competicion-primera-federacion-fem.png`, `*-clasificacion-tercera-rfef-g1.png` |
| CA-3, CA-6 | `*-competicion-liga-f.png` (stub: escudo y realce de Deportivo ABANCA, badges), `*-clasificacion-primera-division.png` (tabla del stub) |

## Salvedades / follow-ups
<!-- IDs F-SPEC-089-1, F-SPEC-089-2… con destino (spec futura o EPIC-MEJORA). -->
### CA-7 evidencia (comprobación hecha por el orquestador, registrada por el implementador)
- Comando (2026-11-16T21:38:41Z): `curl -s -H "Authorization: Bearer <ADMIN_API_KEY de explorer>" "https://marcadorgal-explorer.vercel.app/api/export/standings?competition=primera-rfef-g1&season=2026-27"` → HTTP 503, `{"error":"No se pudo obtener la clasificación: Unexpected end of JSON input"}`. Filas: 0. Equipos no emparejados: no evaluable (no hay tabla).
- Código de explorer: `marcadorgal-explorer/src/scraper/providers/marca/marca-stats.ts:19` `'primera-rfef-g1': { tournamentId: '0154', marcaPath: 'primera-rfef' }`: la ruta MARCA no lleva grupo.
- Decisión: no se puede demostrar que la tabla sea exactamente el G1 → clasificación de `primera-rfef-g1` = `none`. CA-1/CA-5 aplicados con esa lista (`explorer` solo para `primera-division`, `segunda-division`, `liga-f`).
- **Desviación para el titular**: la spec contemplaba `explorer` o `none` según la comparación; la comparación no pudo hacerse (sin filas). Se aplica el principio de la spec (no publicar lo no verificable). Reversible en una línea de `COMPETITION_SOURCES` cuando la tabla se pueda comprobar.

- F-V-1 resuelto (bf41a13, e8177ee): el calendario `local` pasa `homeId/awayId` del fichero y `CalendarView` busca escudo y realce por id, con el nombre visible de `teams[].name`.
- F-SPEC-089-1 (reformulado): escudo y realce siguen a `GALICIAN_CLUBS`. Los galegos del fichero que no están ahí (`celta-fortuna`, `deportivo-fabril`, `compostela`, `coruxo`, `bergantinos` y los de tercera: `alondras`, `barco`, `celta-c`, `estradense`, `pontevedra-b`…) salen sin escudo ni realce; en tercera ninguno lo lleva. Ampliarlo (p. ej. realce por `galicianNames`, escudos nuevos) es trabajo fuera de los CA. Destino: EPIC-MEJORA.
- F-SPEC-089-2: `CalendarView` pinta «día · hora» (`formatDay`/`formatTime`), sin mes; antes salía el mes abreviado. Si se quiere mes, ampliar `src/i18n/format.ts`. Destino: EPIC-MEJORA.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1..CA-7 implementados con tests en rama `ft/SPEC-089-competicion-sin-inventos` (commits d475afc, 89d5e1b, 42c7e32, 73481cf versión 0.10.12). Iteración 2 tras RED: F-V-1 resuelto en bf41a13 + e8177ee (formato). Sin nueva subida de versión. Spec en `en-revision`.
- Gates 2026-11-16 iteración 2 (worktree LF en bf41a13 + formato = e8177ee): `npm run typecheck` exit 0; `npm run lint` «Checked 500 files… No fixes applied.» sin errores; `npm test` 179 ficheros, 3078 passed / 3 skipped. `npm run build` (árbol principal) «Compiled successfully», exit 0.
- Pendiente del titular: F-V-2 (CA-7), no tocado en esta iteración.
- Falta: re-verificación (sdd-verificador): escudo y realce en `/calendario/primera-division`, `primera-rfef-g1`, `segunda-rfef-g1`; liga-f sin cambios.
