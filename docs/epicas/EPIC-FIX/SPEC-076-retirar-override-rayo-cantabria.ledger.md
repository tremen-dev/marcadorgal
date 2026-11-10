---
id: SPEC-076
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-076 Retirar el override racing-ferrol → rayo-cantabria

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-076-retirar-override-rayo-cantabria`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/sources/rfef/calendar.ts` (`COMPETITION_TEAM_OVERRIDES = {}`, comentario nuevo; la aplicación en `parse` se conserva) | `src/sources/rfef/calendar.test.ts` «SPEC-076 CA-1 COMPETITION_TEAM_OVERRIDES is empty…» (sustituye a «applies COMPETITION_TEAM_OVERRIDES only in its competition») | | ❌ |
| CA-2 | `src/sources/rfef/calendar.ts` | `src/sources/rfef/calendar.test.ts` «SPEC-076 CA-2 parse rewrites no team» (3 casos: fixture real segunda con `rayo-cantabria`, 34 partidos; `primera-rfef-g1` y `segunda-rfef-g1` con `racing-ferrol` sin reescritura) | | ❌ |
| CA-3 | `src/sources/rfef/fixtures/export/calendar-segunda-rfef-g1-2026-27-2026-11-10T1407Z.{json,headers}` (byte a byte, 51373 B, sha256 `7fb2afa4…07cda01e`, 18 equipos, 306 partidos) + `README.md`; retirada `…-2026-11-10.{json,headers}` | `src/calendar/sync-rfef.test.ts` (FIXTURE nueva; `rematched` vacío; «SPEC-076 CA-3 the 34 rayo-cantabria ids match the calendar of the repo») | | ❌ |
| CA-4 | — | evidencia: [`_qa/SPEC-076/dry-run-segunda-rfef-g1.txt`](_qa/SPEC-076/dry-run-segunda-rfef-g1.txt): `newTeams: 0 added: 0 missing: 0 rematched: 0`, exit 0, 0 líneas `racing-ferrol`; `rayo-cantabria` aparece en 22 líneas `TBD/PST` (ver F-SPEC-076-2); `git status` sin cambios en `data/` | | ❌ |
| CA-5 | `package.json`/`package-lock.json` 0.5.7 → 0.5.8 | [`_qa/SPEC-076/gates.txt`](_qa/SPEC-076/gates.txt): version-gate ok; build ok; gates exit 1 por 2 tests que ya fallan en `origin/main` (F-SPEC-076-1, F-SPEC-076-3) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-076/. Informe HTML opcional: _qa/SPEC-076/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-076-1, F-SPEC-076-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-076-1 (bloquea CA-5, ajeno a la spec)**: `src/sources/rfef/explorer.test.ts` «SPEC-069 … CA-2 all its observations come out…» falla en `origin/main` (b21e4d6) desde `cdaad54` (bot del calendario, PR 125): Las Palmas–Eldense J13 pasó de `2026-11-08T17:30Z` a `2026-11-09T19:30Z` en `data/calendario/2026-27/segunda-division.json` y ahora sale `live` en vez de `skipped: ambiguous_state`. El test depende del calendario vivo. Destino: EPIC-FIX (spec propia), no se toca aquí.
- **F-SPEC-076-2 (redacción de CA-4)**: el dry-run lista 203 `TBD/PST` (kickoffs sin confirmar); 22 son partidos del Rayo Cantabria con su id de siempre (`…-rayo-cantabria-…`). Contadores a 0 y ninguna línea `racing-ferrol`, pero la letra «ninguna línea que mencione `rayo-cantabria`» no se cumple. Lo decide el verificador/arquitecto.
- **F-SPEC-076-3 (entorno)**: `src/db/test-db.test.ts` «wins over a .env file in the cwd too» falla en Windows local también en `origin/main`; no se probó en Linux/Docker.
- **F-SPEC-076-4**: la fixture nueva lleva sufijo de hora (`2026-11-10T1407Z`) para no reutilizar el nombre de la retirada (misma fecha).
- **F-SPEC-076-5**: PR 126 (SPEC-077) sube a 0.6.0; quien se fusione segundo tendrá que volver a subir versión.
- Nota: la rama `ft/SPEC-076-…` estaba en `197ee71`; se avanzó a `origin/main` (b21e4d6) y se trajo la spec por cherry-pick (`3ef0c92`, original `bb1af38` en la rama de SPEC-077).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-4 implementados con test/evidencia; CA-5 con version-gate ok y build ok, pero `npm run gates` = 1 por F-SPEC-076-1 y F-SPEC-076-3 (preexistentes en main). Falta: verificador, y arreglar F-SPEC-076-1 en su propia spec antes del PR (CI fallará igual). Sin push ni PR.
