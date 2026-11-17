---
id: SPEC-090
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-090 El bot del calendario no pide a explorer lo que no es suyo

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-090-el-bot-del-calendario-no-pide-a-explorer-lo-que-no-es-suyo`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/calendar.ts` (`fetch` lee `data/calendario/<season>/tercera-rfef-g1.json`; `parse` rechaza export de explorer para tercera) | `src/sources/rfef/calendar.test.ts` › «SPEC-090 CA-1 … fetch + parse calls ctx.fetch 0 times…», «parse refuses an explorer response…»; `src/calendar/sync-rfef.test.ts` verde | | ❌ |
| CA-2 | `src/sources/rfef/calendar.ts` (`fetch`: sin fichero lanza con competición y temporada) | `src/sources/rfef/calendar.test.ts` › «SPEC-090 CA-2 … fetch throws naming competition and season…» | | ❌ |
| CA-3 | `src/sources/rfef/calendar.ts` (`COVERED_COMPETITIONS` = `FIVE_COMPETITIONS`) | `src/sources/rfef/calendar.test.ts` › «SPEC-090 CA-3 …» (2 casos); `src/calendar/cli.test.ts` › «CA-3 segunda-federacion-fem-g1 is still an unknown competition: exit 1» | | ❌ |
| CA-4 | `src/sources/rfef/calendar.ts`; `src/calendar/cli.fake-provider.mjs` (`FAKE_CALENDAR_STATUS`, `FAKE_PROVIDER_LOG`) | `src/calendar/cli.test.ts` › «CA-4 tercera answers 503 and one reschedule in primera: exit 0, no tercera request, auto=si» | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-090/. Informe HTML opcional: _qa/SPEC-090/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-090-1, F-SPEC-090-2… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Implementado CA-1..CA-4 en commit `2bd78e4` (versión 0.10.13). Falta la verificación.
- Evidencia del implementador (worktree LF): `npm run typecheck` ok; `npm run lint` → «Checked 500 files… No fixes applied»; `npm test` → «179 passed (179) · 3089 passed | 3 skipped». RED previo de CA-4: «tercera-rfef-g1: rfef explorer calendar responded 503». `npm run build` no ejecutado por el implementador.
- El externalId de tercera usa `${season}-3rfef-…`: idéntico al de hoy en 2026-27.
- Se retiró el test antiguo «preserves declared benchmark calendar for tercera-rfef-g1» (parseaba un export de explorer de tercera, lo que CA-1 prohíbe); lo sustituyen los de CA-1.
