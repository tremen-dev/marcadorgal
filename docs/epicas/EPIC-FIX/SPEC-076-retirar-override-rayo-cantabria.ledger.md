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
| CA-1 | `src/sources/rfef/calendar.ts` (`COMPETITION_TEAM_OVERRIDES = {}`, comentario nuevo; la aplicación en `parse` se conserva) | `src/sources/rfef/calendar.test.ts` «SPEC-076 CA-1 COMPETITION_TEAM_OVERRIDES is empty…» (sustituye a «applies COMPETITION_TEAM_OVERRIDES only in its competition») | vitest 14/14 en verde; `COMPETITION_TEAM_OVERRIDES = {}`, comentario actualizado, test viejo sustituido | ✅ |
| CA-2 | `src/sources/rfef/calendar.ts` | `src/sources/rfef/calendar.test.ts` «SPEC-076 CA-2 parse rewrites no team» (3 casos: fixture real segunda con `rayo-cantabria`, 34 partidos; `primera-rfef-g1` y `segunda-rfef-g1` con `racing-ferrol` sin reescritura) | 3 casos revisados (no vacíos), en verde; la fixture real da 34 partidos `rayo-cantabria` y ningún `racing-ferrol` | ✅ |
| CA-3 | `src/sources/rfef/fixtures/export/calendar-segunda-rfef-g1-2026-27-2026-11-10T1407Z.{json,headers}` (byte a byte, 51373 B, sha256 `7fb2afa4…07cda01e`, 18 equipos, 306 partidos) + `README.md`; retirada `…-2026-11-10.{json,headers}` | `src/calendar/sync-rfef.test.ts` (FIXTURE nueva; `rematched` vacío; «SPEC-076 CA-3 the 34 rayo-cantabria ids match the calendar of the repo») | sha256 recalculado `7fb2afa4…07cda01e`, 51373 B = Content-Length; 18/306/34; la vieja no está en el árbol; `rematched` + 34 ids + validate* en verde | ✅ |
| CA-4 | — | evidencia: [`_qa/SPEC-076/dry-run-segunda-rfef-g1.txt`](_qa/SPEC-076/dry-run-segunda-rfef-g1.txt): `newTeams: 0 added: 0 missing: 0 rematched: 0`, exit 0, 0 líneas `racing-ferrol`; `rayo-cantabria` aparece en 22 líneas `TBD/PST` (ver F-SPEC-076-2); `git status` sin cambios en `data/` | dry-run repetido 2026-11-10 ~15:16 local: exit 0, contadores a 0, 0 `racing-ferrol`, 22 `rayo-cantabria` (todas `TBD/PST`), `git status` limpio. La letra del CA («ninguna línea… `rayo-cantabria`») no se cumple → F-SPEC-076-V2 | ⚠️ |
| CA-5 | `package.json`/`package-lock.json` 0.7.1 → 0.7.2 (tras merge de `origin/main` 41f0e0f) | [`_qa/SPEC-076/gates.txt`](_qa/SPEC-076/gates.txt): tras el merge, typecheck/lint ok, vitest 1 fallo (F-SPEC-076-3, solo Windows; `ci` de main en verde en Linux); F-SPEC-076-1 resuelto en main por SPEC-078; version-gate ok | `npm run gates` exit 1 en la rama (2 fallos); los mismos 2 fallan en un worktree de `origin/main` b21e4d6 (vitest: 2 failed). version-gate ok. El CA exige 0 → F-SPEC-076-V1 | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**RED — 2026-11-10 (sdd-verificador).** CA-1..CA-3 ✅. El código de la spec es correcto y sus tests pasan.
- **F-SPEC-076-V1 (bloquea, CA-5)**: `npm run gates` = 1 por `src/sources/rfef/explorer.test.ts` «SPEC-069 … CA-2 …» y `src/db/test-db.test.ts` «wins over a .env file in the cwd too». Ambos fallan igual en `origin/main` (no son regresión de esta rama), pero CA-5 pide gates → 0 y CI fallará. Hay que arreglar F-SPEC-076-1 (test acoplado al calendario vivo) en su propia spec y fusionarla antes, o que el arquitecto cambie CA-5 para aceptar fallos preexistentes con su spec destino. F-SPEC-076-3 hay que comprobarlo en Linux/CI.
- **F-SPEC-076-V2 (CA-4, redacción)**: 22 líneas `TBD/PST` mencionan `rayo-cantabria` (ids de siempre, kickoff sin confirmar). La intención del CA (ninguna alta/renombre/rematch del equipo) se cumple; la letra no. El arquitecto debe reformular CA-4 (p. ej. «ninguna línea de newTeams/added/missing/rematched/renamedAtProvider…») para poder cerrarlo.

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
2026-11-10: rama fusionada con `origin/main` (065749d), versión 0.7.2. F-SPEC-076-1 resuelto por SPEC-078 (PR 128). CA-4 reformulado (E-1); la evidencia existente cumple la letra nueva. En local solo falla F-SPEC-076-3 (Windows). Falta: re-verificación, push y PR (CI = gates en Linux).
