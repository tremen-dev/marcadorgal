---
id: SPEC-074
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-074 calendario:sync vuelve a funcionar

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-074-calendario-sync-vuelve-a-funcionar`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `data/alias/2026-27/rfef.json` (+3 entradas: `alavés b`, `eibar b`, `atlético astorga`); fixture `src/sources/rfef/fixtures/export/calendar-segunda-rfef-g1-2026-27-2026-11-10.{json,headers}` (procedencia en el `README.md` de esa carpeta) | `src/calendar/sync-rfef.test.ts` (4 casos: nombres nuevos en el fixture; `newTeams`/`added`/`missing` vacíos; ningún `-<n>`; `validateCalendar`/`validateAliases` = []); `src/sources/rfef/alias.test.ts` «SPEC-074 CA-1: buildRfefAlias keeps the new names…». Rojo antes de los datos: 3 fallos (`alaves-b-2`…, 90 problemas) | | ❌ |
| CA-2 | `src/calendar/sync.ts` (`knownNames`: nombres del alias por `teamId`+slug; solo avisa si el nombre no lo conoce ese equipo) | `src/calendar/sync.test.ts` describe «SPEC-074 CA-2…» (4 casos: Girona FC, Athletic Club B por slug, Ourense CF de otro `teamId`, nombre nuevo). Rojo antes del cambio: 2 fallos. El test de Ourense → «Ourense CF» que cita la spec es el «(d)» de `sync.test.ts`, no el «(c)»: sigue sin tocar y en verde | | ❌ |
| CA-3 | — (comprobación contra prod, solo lectura) | `RFEF_EXPLORER_TOKEN=… npm run calendario:sync -- 2026-27 --dry-run` → `_qa/SPEC-074/dry-run-implementador-2026-11-10.log`: **exit 0**; las cinco con `newTeams`/`added`/`missing`/`renamedAtProvider`/`rematched` = 0; 14 `rescheduled` (Segunda 1 `las-palmas-eldense` PASADO; Primera RFEF 3 de J13 futuras; Segunda RFEF 1 `gimnastica-gernika` 16:00→16:03 PASADO; Tercera 9 de J10 PASADO); `urgentes: 0`; `auto-aplicable: si`; `git status` sin cambios en `data/` tras el dry-run (solo `?? _qa/SPEC-074/`). El token no está en el log (grep = 0) | | ❌ |
| CA-4 | Sin ajustes a tests existentes: solo se añaden casos (`sync.test.ts`, `alias.test.ts`) y `sync-rfef.test.ts` | `npx vitest run src/calendar/ src/sources/rfef/` → 19 ficheros, 398 passed / 3 skipped. `npm run gates` (worktree LF, Windows): typecheck y lint OK; test 2568 passed / 3 skipped / **1 failed** = `src/db/test-db.test.ts` «wins over a .env file in the cwd too» (fallo ajeno conocido, no toca esta spec) → exit 1; `npm run build` aparte → exit 0. Versión 0.5.3 → 0.5.4 (`npm version patch --no-git-tag-version`) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-074/. Informe HTML opcional: _qa/SPEC-074/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-074-1, F-SPEC-074-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-074-1: retirar los overrides muertos de `COMPETITION_TEAM_OVERRIDES` (`src/sources/rfef/calendar.ts`); fuera de alcance por decisión del titular → spec futura.
- F-SPEC-074-2: aviso cuando el workflow del bot del calendario falla; fuera de alcance por decisión del titular → spec futura.
- F-SPEC-074-3: explorer exporta a Rayo Cantabria como `racing-ferrol` «Racing Club de Ferrol» (visible en el fixture de CA-1); el override `racing-ferrol → rayo-cantabria` lo tapa. Fallo de explorer a reportar.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Implementación completa en `ft/SPEC-074-calendario-sync-vuelve-a-funcionar` (versión 0.5.3 → 0.5.4, ADR-028). Baseline del arquitecto: `_qa/SPEC-074/baseline-dry-run-2026-11-10.log` (no está en el repo). Pendiente: verificación. Para repetir CA-3 hace falta `RFEF_EXPLORER_TOKEN` (= `ADMIN_API_KEY` de explorer en Vercel prod); solo `--dry-run`.
