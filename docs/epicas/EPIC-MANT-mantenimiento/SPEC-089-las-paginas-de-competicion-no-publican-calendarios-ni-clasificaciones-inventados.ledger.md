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
| CA-1 | `src/lib/competition-sources.ts` (`COMPETITION_SOURCES`), `src/calendar/bundled.ts` (`BUNDLED_CALENDARS`) | `src/lib/competition-data.test.ts` «SPEC-089 CA-1»: mapa exacto; cada `local` en el bundle | Test verde (mapa exacto, 8 claves = `ALLOWED_COMPETITIONS`, 5 `local` en bundle). Navegador (2026-11-16, 72c893b): el stub de explorer solo recibe `calendar liga-f` y `standings liga-f/primera-division/segunda-division` | ✅ |
| CA-2 | `src/lib/competition-data.ts` (`loadCompetitionCalendar`, `localCalendar` con `homeId/awayId` del fichero), `src/components/competition/CalendarView.tsx` (escudo/realce por `homeId ?? home`, nombre de `teams[].name`), `src/app/competition-page.tsx` | `src/lib/competition-data.test.ts` «SPEC-089 CA-2»: tercera 306 partidos por nombre; las 5 `local` sin explorer; fichero inválido → unavailable; páginas calendario y portada. «SPEC-089 CA-2 local calendar keeps Galician shields» (F-V-1): 1ª Div celta/deportivo, 1ª RFEF racing-ferrol/lugo/pontevedra, 2ª RFEF ourense-cf con escudo, nombre y `matchCardGalician`; el loader lleva los ids | Tests verdes. Navegador: 1ª Div 380, 2ª Div 462, 1ª RFEF 380, 2ª RFEF 306, tercera 306 tarjetas = partidos del fichero, gl/es, móvil/escritorio, portada y calendario; todos con `teams[].name`; sin llamada a explorer. F-V-1 resuelto: escudos/realce por id del fichero, 0 discrepancias por tarjeta (1ª Div 76 escudos/74 realzadas; 1ª RFEF 114/108; 2ª RFEF 34/34) | ✅ |
| CA-3 | `src/components/competition/CalendarView.tsx` (`formatKickoff` = `formatDay` + `formatMonth` + `formatTime`, badge solo si `timeConfirmed` es booleano), `src/i18n/format.ts` (`formatMonth`, enmienda 2026-11-16) | `src/components/competition/CalendarView.test.ts` «SPEC-089 CA-3»: 18:00 con `TZ=UTC`; sin badge en local; liga-f con badge; «date with month»: los 3 casos de la spec en gl y es con `TZ=UTC` («sáb 5 set · 18:00», «sáb 5 sept · 18:00», «dom 15 nov · 18:00», «dom 22 nov · 00:30»). `src/i18n/format.test.ts` «SPEC-089 CA-3 formatMonth» | Tests verdes (3 casos de la spec gl/es con `TZ=UTC`; `formatMonth`). Navegador con `next start` en `TZ=UTC`: las 1.834 tarjetas `local` × gl/es casan con «<día> <mes ICU> · <HH:MM>» calculado aparte (CEST/CET a mano), 0 fallos; tercera j1 «sáb 5 set · 18:00» / «sáb 5 sept · 18:00»; local sin badges; liga-f con «Horario confirmado/por confirmar» | ✅ |
| CA-4 | `src/lib/competition-data.ts`, `src/app/competition-page.tsx` (`Section`), `src/i18n/{gl,es}.ts` `competitions.calendarNotOffered` | `src/lib/competition-data.test.ts` «SPEC-089 CA-4»: fem. 1ª/2ª en gl y es, portada y calendario; textos decididos ≠ `xornada.unavailable` | Tests verdes gl/es portada+calendario. Navegador: 200 y texto decidido en `/competicion` y `/calendario` de fem. 1ª/2ª, gl y es, móvil y escritorio, sin `calendar-view` ni `xornada.unavailable`; el stub no recibe llamadas de ellas | ✅ |
| CA-5 | Ídem + `competitions.standingsNotOffered` | `src/lib/competition-data.test.ts` «SPEC-089 CA-5»: las `none` (5 tras CA-7) en gl y es, portada y clasificación | Tests verdes. Navegador: texto decidido en portada y clasificación de las 5 `none` (lista de CA-7), gl y es, ambos viewports; el stub no recibe `standings` de ellas | ✅ |
| CA-6 | `src/app/competition-page.tsx` (explorer inyectable, `clientCompetitionExplorer` por defecto) | `src/lib/competition-data.test.ts` «SPEC-089 CA-6»: liga-f y clasificaciones explorer; fallo y vacío → unavailable; 8×3 páginas responden; suites existentes de CalendarView/StandingsTable/CompetitionHeader/CompetitionNav verdes; «keeps Galician shields»: liga-f vía explorer conserva `/escudos/depor-abanca.svg`, «Deportivo ABANCA» y 1 `matchCardGalician` | Suite 179 ficheros, 3083 passed / 3 skipped. 96 páginas (8×3×gl/es×2 viewports) HTTP 200 sin scroll horizontal; liga-f: escudo y realce de Deportivo ABANCA; stub caído (503) → `xornada.unavailable` en `/calendario/liga-f`, `/clasificacion/liga-f`, `/clasificacion/primera-division`, gl y es. `CompetitionNav` sin diff | ✅ |
| CA-7 | Decisión aplicada en `src/lib/competition-sources.ts` (`primera-rfef-g1` → standings `none`), conforme al tercer caso del CA enmendado (comparación no hecha → `none`); sin cambio de código en la iteración 3 | Evidencia abajo («CA-7 evidencia»); el test de CA-1 refleja la decisión | Evidencia del ledger completa para el tercer caso enmendado (comando y fecha, HTTP 503, 0 filas, no emparejados no evaluable, decisión `none`); `COMPETITION_SOURCES` y el test de CA-1 la reflejan. F-V-2 resuelto por la enmienda b0aeebb | ✅ |
| CA-8 | `src/components/competition/CalendarView.tsx` (`compareMatches`: kickoff ascendente, desempate `externalId` con `<`, ilegible al final; vale para `local`, cuyo `externalId` es el `matchId`, y para explorer) | `src/components/competition/CalendarView.test.ts` «SPEC-089 CA-8»: 18:00 b, 16:00 c, 16:00 a → a, c, b; dos permutaciones → mismo DOM (×2); xornadas ascendentes, kickoff ilegible al final, `B` antes que `a` (orden de código) | Tests verdes (caso b/c/a → a,c,b; permutaciones → mismo DOM; ilegible al final; orden de código). Navegador: en las 5 `local` el orden del DOM = orden esperado (xornada, `Date.parse`, `matchId` con `<`) y el del fichero no lo es; liga-f con stub desordenado (18:00 b, 16:00 c, 16:00 a + j9) → lf-z, lf-a, lf-c, lf-b | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-11-16 (re-verificación sobre 72c893b, spec enmendada en b0aeebb).** Gates (worktree LF detached en 72c893b): `npm run typecheck` exit 0; `npm run lint` «Checked 500 files in 1224ms. No fixes applied.»; `npm test` «Test Files 179 passed (179)», «Tests 3083 passed | 3 skipped (3086)». `npm run build` (árbol principal, `EXPLORER_BASE_URL` a stub local 127.0.0.1:4599, token ficticio) exit 0. Navegador: `next start` con `TZ=UTC` + Playwright chromium 390×844 y 1280×900, gl y es: 446 comprobaciones, 0 fallos; peticiones al stub solo `calendar liga-f`, `standings liga-f/primera-division/segunda-division`.

- F-V-1 (RED anterior): resuelto. Cada tarjeta `local` lleva exactamente los escudos y el realce de sus ids en `GALICIAN_CLUBS` (0 discrepancias en las 5 `local`); liga-f conserva Deportivo ABANCA.
- F-V-2 (RED anterior): resuelto por la enmienda de CA-7 (tercer caso); la evidencia y el mapa cumplen ese caso.

Observaciones (no bloquean): (a) F-SPEC-089-1 sigue abierto: galegos fuera de `GALICIAN_CLUBS` (tercera entera, filiales, Compostela…) sin escudo ni realce; igual que en main, fuera de los CA. (b) El `it` de CA-5 se titula «lists the four none» y afirma cinco: solo el título.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-089/. Informe HTML opcional: _qa/SPEC-089/informe.html -->
| CA | Capturas (`_qa/SPEC-089/`, prefijo `movil-`/`escritorio-`; `-es-` = castellano) |
|---|---|
| CA-2, CA-3 | `*-calendario-tercera-rfef-g1.png`, `*-calendario-primera-division.png` (capturas reescritas en la re-verificación) |
| CA-4, CA-5 | `*-competicion-primera-federacion-fem.png`, `*-clasificacion-tercera-rfef-g1.png` |
| CA-3, CA-6 | `*-competicion-liga-f.png` (stub: escudo y realce de Deportivo ABANCA, badges), `*-clasificacion-primera-division.png` (tabla del stub), `escritorio-explorer-caido-calendario-liga-f.png` (stub caído → unavailable) |
| CA-2, CA-3, CA-8, F-V-1 (re-verificación) | `*-calendario-primera-division.png` (RC Deportivo/RC Celta con escudo y realce, «sáb 15 ago · 19:30»), `*-calendario-primera-rfef-g1.png`, `*-calendario-tercera-rfef-g1.png` («sáb 5 set · 18:00» / «sáb 5 sept · 18:00»), `*-calendario-liga-f.png` (orden j9, j10 16:00 a, 16:00 c, 18:00 b) |

## Salvedades / follow-ups
<!-- IDs F-SPEC-089-1, F-SPEC-089-2… con destino (spec futura o EPIC-MEJORA). -->
### CA-7 evidencia (comprobación hecha por el orquestador, registrada por el implementador)
- Comando (2026-11-16T21:38:41Z): `curl -s -H "Authorization: Bearer <ADMIN_API_KEY de explorer>" "https://marcadorgal-explorer.vercel.app/api/export/standings?competition=primera-rfef-g1&season=2026-27"` → HTTP 503, `{"error":"No se pudo obtener la clasificación: Unexpected end of JSON input"}`. Filas: 0. Equipos no emparejados: no evaluable (no hay tabla).
- Código de explorer: `marcadorgal-explorer/src/scraper/providers/marca/marca-stats.ts:19` `'primera-rfef-g1': { tournamentId: '0154', marcaPath: 'primera-rfef' }`: la ruta MARCA no lleva grupo.
- Decisión: no se puede demostrar que la tabla sea exactamente el G1 → clasificación de `primera-rfef-g1` = `none`. CA-1/CA-5 aplicados con esa lista (`explorer` solo para `primera-division`, `segunda-division`, `liga-f`).
- ~~Desviación para el titular~~: resuelta por la enmienda del titular (2026-11-16, b0aeebb): CA-7 contempla ahora «la comparación no se puede hacer → `none` hasta comprobarla con otra spec». La decisión registrada es exactamente ese caso. Reversible en una línea de `COMPETITION_SOURCES`.

- F-V-1 resuelto (bf41a13, e8177ee): el calendario `local` pasa `homeId/awayId` del fichero y `CalendarView` busca escudo y realce por id, con el nombre visible de `teams[].name`.
- F-SPEC-089-1 (reformulado): escudo y realce siguen a `GALICIAN_CLUBS`. Los galegos del fichero que no están ahí (`celta-fortuna`, `deportivo-fabril`, `compostela`, `coruxo`, `bergantinos` y los de tercera: `alondras`, `barco`, `celta-c`, `estradense`, `pontevedra-b`…) salen sin escudo ni realce; en tercera ninguno lo lleva. Ampliarlo (p. ej. realce por `galicianNames`, escudos nuevos) es trabajo fuera de los CA. Destino: EPIC-MEJORA.
- F-SPEC-089-2: resuelto por la enmienda de CA-3 (97ca791): «día mes · hora» con `formatMonth` en `src/i18n/format.ts`.
- Observación (b) del RED (orden dentro de la xornada): cubierta por CA-8 (97ca791).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1..CA-8 implementados con tests en rama `ft/SPEC-089-competicion-sin-inventos` (d475afc, 89d5e1b, 42c7e32, 73481cf versión 0.10.12; iteración 2 F-V-1 en bf41a13 + e8177ee; iteración 3 tras la enmienda b0aeebb: CA-3 con mes y CA-8 orden en 97ca791). Sin nueva subida de versión. Spec en `en-revision`.
- Gates 2026-11-16 iteración 3 (worktree LF detached en b0aeebb + cambios de 97ca791): `npm run typecheck` exit 0; `npm run lint` «Checked 500 files in 1023ms. No fixes applied.»; `npm test` «Test Files 179 passed (179)», «Tests 3083 passed | 3 skipped (3086)». `npm run build` (árbol principal) «✓ Compiled successfully», exit 0.
- Falta: re-verificación (sdd-verificador): fecha con mes en `/calendario/*` gl/es (p. ej. tercera j1 «sáb 5 set · 18:00» / «sáb 5 sept · 18:00»); orden cronológico dentro de cada xornada en las `local` y liga-f; CA-7 con la regla enmendada.
